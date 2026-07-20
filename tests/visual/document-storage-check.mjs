import { readFileSync } from 'node:fs'

const failures = []
const pathHelpers = readFileSync('src/lib/file-storage-path.ts', 'utf8')
const storage = readFileSync('src/lib/storage.ts', 'utf8')
const paperForm = readFileSync('src/components/PaperForm.tsx', 'utf8')
const archive = readFileSync('src/components/PaperFormArchive.tsx', 'utf8')
const onlineCard = readFileSync('src/components/OnlinePaperCard.tsx', 'utf8')
const preview = readFileSync('src/components/FilePreviewModal.tsx', 'utf8')
const previewPortal = readFileSync('src/components/FilePreviewPortal.tsx', 'utf8')
const types = readFileSync('src/lib/types.ts', 'utf8')
const layerCss = readFileSync('src/ui-layer-contract.css', 'utf8')
const edge = readFileSync('supabase/functions/r2-upload/index.ts', 'utf8')
const migration = readFileSync('supabase/009_paper_file_storage_hardening.sql', 'utf8')

for (const required of [
  "const R2_STORAGE_SCHEME = 'r2-storage://'",
  'createR2StoragePath',
  'parseR2StoragePath',
]) {
  if (!pathHelpers.includes(required)) failures.push(`R2 storage reference helper is missing ${required}`)
}

for (const required of [
  "const R2_FUNCTION = 'r2-upload'",
  "action: 'upload-url'",
  "proxyFunctionUrl('proxy-upload')",
  "proxyFunctionUrl('proxy-read'",
  'getStoredFileAccess',
  'fetchStoredFile',
  'downloadStoredFile',
  "action: 'delete'",
  "action: 'usage'",
  'parseSupabaseStoragePath',
]) {
  if (!storage.includes(required)) failures.push(`private R2 storage helper is missing ${required}`)
}
if (storage.includes("supabase.storage.from(STORAGE_BUCKET).upload")) failures.push('new paper uploads still use Supabase Storage as the primary store')

for (const required of [
  "action === 'upload-url'",
  "actionHint === 'proxy-upload'",
  "actionHint === 'proxy-read'",
  "action === 'access'",
  "action === 'delete'",
  "action === 'usage'",
  'HeadObjectCommand',
  'GetObjectCommand',
  'DeleteObjectCommand',
  'ListObjectsV2Command',
  'ownedKey(auth.user.id',
]) {
  if (!edge.includes(required)) failures.push(`R2 edge function is missing ${required}`)
}
if (edge.includes('R2_PUBLIC_URL')) failures.push('R2 edge function still requires a public bucket URL')

for (const required of [
  'FilePreviewPortal',
  'setPreviewFile',
  'onOpenStoredFile={handleOpenStoredFile}',
]) {
  if (!onlineCard.includes(required)) failures.push(`paper card preview wiring is missing ${required}`)
}

for (const required of ['createPortal', 'document.body', 'FilePreviewModal']) {
  if (!previewPortal.includes(required)) failures.push(`preview portal is missing ${required}`)
}

for (const required of [
  'mammoth@1.10.0',
  'xlsx-0.20.3',
  'pptx-preview@1.0.7',
  "kind === 'pdf'",
  "kind === 'image'",
  "resolvedKind === 'docx'",
  "resolvedKind === 'sheet'",
  "resolvedKind === 'slides'",
  'sanitizeHtml',
  'Office 文件在当前浏览器本地解析',
]) {
  if (!preview.includes(required)) failures.push(`online preview is missing ${required}`)
}

for (const required of [
  'const files = data.files || []',
  'onPreviewFile={setPreviewFile}',
  'onDownloadFile={handleDownloadFile}',
  'cleanupStoredFiles(obsolete',
  'Clean unsaved paper attachments',
  ".select('id').eq('id', id).maybeSingle()",
]) {
  if (!paperForm.includes(required)) failures.push(`paper form lifecycle is missing ${required}`)
}
if (paperForm.includes('readCurrentFileRows')) failures.push('paper form still scrapes attachment rows from the DOM')

for (const required of [
  'isSupabaseStoragePath(path) || isWebUrl(path)',
  'onPreviewFile?:',
  'onDownloadFile?:',
  'compact-file-actions',
  '移除；保存后同步删除云端文件',
  'compact-paper-workflow-grid',
]) {
  if (!archive.includes(required)) failures.push(`paper editor attachment/APC UI is missing ${required}`)
}

for (const required of ['检索证明', '见刊文章']) {
  if (!types.includes(required)) failures.push(`file archive type is missing ${required}`)
}

for (const required of [
  'z-index: 60000',
  'height: calc(100dvh - 24px)',
  'html:has(.file-preview-overlay) .app-header',
  'html:has(.file-preview-overlay) .ui-mode-switcher',
  '.compact-file-row.is-managed',
  '.compact-paper-workflow-grid',
]) {
  if (!layerCss.includes(required)) failures.push(`interaction layer contract is missing ${required}`)
}

for (const required of ['file_size_limit', '20971520', 'TO authenticated', 'Delete own paper files']) {
  if (!migration.includes(required)) failures.push(`legacy Supabase storage migration is missing ${required}`)
}

console.log(JSON.stringify({ failures }, null, 2))
if (failures.length) throw new Error(failures.join(' | '))
