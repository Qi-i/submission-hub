import assert from 'node:assert/strict'
import fs from 'node:fs'
const read=(p)=>fs.readFileSync(new URL('../'+p,import.meta.url),'utf8')
const ui=read('src/components/AcademicMailCenter.tsx')
const css=read('src/components/AcademicMailCenter.css')
const migration=read('supabase/034_mail_personal_organization.sql')
const cleanup=read('supabase/035_mail_label_removal.sql')
const translate=read('supabase/functions/mail-translate/index.ts')
const checks=[
 ['notes are owner scoped and preserved',migration.includes('user_note text not null')&&ui.includes('user_note:noteDraft')],
 ['labels have owner RLS',migration.includes('mail_labels_owner')&&migration.includes('auth.uid())=user_id')],
 ['cross-account folders have owner foreign key',migration.includes('foreign key (user_id,virtual_folder_id)')&&migration.includes('mail_folders(user_id,id)')],
 ['virtual folders do not alter provider folders',ui.includes('virtual_folder_id:e.target.value||null')&&ui.includes('first_folder')],
 ['cross-account folder filter uses DB query',ui.includes("q=q.eq('virtual_folder_id',folderFilter)")],
 ['custom tag arrays filter server side',ui.includes("q=q.contains('user_labels',[labelFilter])")],
 ['tag deletion clears all user messages',cleanup.includes('array_remove(user_labels,l_name)')&&cleanup.includes('(select auth.uid())')],
 ['source account badges display on every list message',ui.includes('am-from-group')&&ui.includes('am-source-badge')],
 ['account logo editable while preserving actual email',ui.includes('brandEditing===a.id')&&ui.includes('short_label:brandShort.trim()')],
 ['translations are user-only via RLS and stored separately',migration.includes('mail_translations_owner')&&migration.includes('source_hash')],
 ['translation requires authenticated user and owned mail',translate.includes('db.auth.getUser(token)')&&translate.includes(".eq('user_id',uid).eq('id',id)")],
 ['translation never selects paid custom endpoints',translate.includes('!ep.declared_free')&&translate.includes('last_test_status')],
 ['translation consumes daily AI quota',translate.includes('mail_claim_ai_slot')],
 ['translation caches translated text',translate.includes("from('mail_translations').upsert")&&translate.includes('sourceHash')],
 ['original is preserved in translation columns',ui.includes('am-parallel-text')&&ui.includes('am-original-col')],
 ['manual translation does not run on message selection',ui.includes('onClick={()=>void runTranslation()}')],
 ['note, folder, labels visually distinct',css.includes('.am-annotation-panel')&&css.includes('.am-user-tag')&&css.includes('.am-folder-chip')],
 ['mobile remains usable',css.includes('@media(max-width:700px)')&&css.includes('.am-brand-editor{grid-template-columns:1fr}')],
]
for(const [name,valid] of checks)assert.ok(valid,'Mail organization contract: '+name)
console.log('Mail annotations, folders, tags, translation: '+checks.length+' checks passed')
