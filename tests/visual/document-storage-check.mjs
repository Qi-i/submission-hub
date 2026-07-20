import { readFileSync } from 'node:fs'

const failures = []
const storage = readFileSync('src/lib/storage.ts', 'utf8')
const paperForm = readFileSync('src/components/PaperForm.tsx', 'utf8')
const archive = readFileSync('src/components/PaperFormArchive.tsx', 'utf8')
const migration = readFileSync('supabase/009_paper_file_storage_hardening.sql', 'utf8')

for (const required of [
  "const STORAGE_BUCKET = 'paper-files'",
  '.createSignedUrl(',
  '.remove([location.path])',
  'deleteStoredFiles',
  'isManagedStoredFile',
]) {
  if (!storage.includes(required)) failures.push(`private storage helper is missing ${required}`)
}

if (storage.includes("supabase.functions.invoke('r2-upload'")) failures.push('paper documents still depend on the public R2 upload path')
if (!paperForm.includes('readCurrentFileRows')) failures.push('paper form does not rebuild attachment rows before save')
if (!paperForm.includes('isManagedStoredFile(rawPath)')) failures.push('managed storage references are not preserved during save')
if (!paperForm.includes('cleanupStoredFiles(obsolete')) failures.push('removed/replaced attachments are not cleaned after save')
if (!paperForm.includes('Clean unsaved paper attachments')) failures.push('unsaved uploads are not cleaned when the form closes')
if (!paperForm.includes(".select('id').eq('id', id).maybeSingle()")) failures.push('paper deletion is not verified before attachment cleanup')
if (!archive.includes("p: /^https?:\\/\\//i.test(file.p.trim()) ? file.p.trim() : ''")) failures.push('expected legacy sanitizer changed; review the wrapper-based compatibility fix')

for (const required of [
  'file_size_limit',
  '20971520',
  'allowed_mime_types',
  'TO authenticated',
  'Read own paper files',
  'Upload own paper files',
  'Update own paper files',
  'Delete own paper files',
]) {
  if (!migration.includes(required)) failures.push(`storage migration is missing ${required}`)
}

console.log(JSON.stringify({ failures }, null, 2))
if (failures.length) throw new Error(failures.join(' | '))
