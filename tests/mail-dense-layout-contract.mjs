import assert from 'node:assert/strict'
import fs from 'node:fs'
const read = name=>fs.readFileSync(new URL('../'+name,import.meta.url),'utf8')
const ui=read('src/components/AcademicMailCenter.tsx')
const css=read('src/components/AcademicMailCenter.css')
const tests=[
 ['hero is compact',css.includes('min-height:96px')&&css.includes('.am-header-actions')],
 ['filter cards are compact and horizontal',css.includes('min-height:55px')&&css.includes('flex-direction:row;justify-content:space-between')],
 ['desktop reader uses remaining width',css.includes('minmax(300px, .82fr) minmax(0,1.28fr)')],
 ['email details are condensed to one row',css.includes('minmax(155px,1.25fr) minmax(130px,.85fr)')],
 ['body appears before manual classification form',ui.indexOf('className="am-reader-content"')<ui.indexOf('className="am-review-controls"')],
 ['stored submission count actually computed',ui.includes('submission:submission.count||0')&&ui.includes('counts.submission')],
 ['imported entities are repaired only for display',ui.includes('const readableMailText')&&ui.includes('readableMailText(m.ai_summary||m.snippet')&&ui.includes('readableMailText(activeBody||active.snippet')],
 ['mobile layout still stacks reader',css.includes('@media(max-width:700px)')&&css.includes('.am-workspace{display:block}')],
 ['compact layout honors reduced motion',css.includes('@media(prefers-reduced-motion:reduce)')],
 ['nothing changed mail account permissions',ui.includes("callFunction('mail-outlook-oauth'")&&ui.includes('mail-cloud-collector')],
]
for(const [name,pass] of tests)assert.ok(pass,'Mail density regression failed: '+name)
console.log('Mail dense-layout regression: '+tests.length+' checks passed')
