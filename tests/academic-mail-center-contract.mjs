// Node built-in contracts: no network, no paid CI services needed.
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const file=(path)=>readFileSync(new URL('../'+path,import.meta.url),'utf8')
const ui=file('src/components/AcademicMailCenter.tsx')
const css=file('src/components/AcademicMailCenter.css')
const scanner=file('supabase/functions/mail-cloud-collector/index.ts')
const settings=file('supabase/functions/mail-config/index.ts')
const dashboard=file('src/components/Dashboard.tsx')

for(const required of [
  "'inbox' | 'accounts'", "PAGE_SIZE = 40", "loadMetadata", "loadMessages",
  "debouncedSearch", "activeBody", "select('body_text')", "pending",
  "review_response", "cloud_archive_path", "createSignedUrl",
  "mail-config", "mail-cloud-collector",
])assert.ok(ui.includes(required),'missing mail UI contract: '+required)
assert.ok(ui.includes("setSelected(current=>"),'selection should survive background refresh')
assert.ok(ui.includes("setBodyLoading(true)"),'body should be loaded on demand')
assert.ok(ui.includes("page*PAGE_SIZE"),'mail list should support server-side pagination')
assert.ok(ui.includes("and(or("),'combined spam/full text filter must preserve both conditions')
for(const required of ['.am-workspace','.am-reader','.am-account-card','@media(max-width:700px)'])
  assert.ok(css.includes(required),'missing responsive UI element: '+required)
assert.ok(dashboard.includes("dashboardPanel === 'mail'"),'dashboard route missing')
for(const required of [
  "Deno.connectTls", "EXAMINE ", "BODY.PEEK[]", "UIDVALIDITY", "UID SEARCH ALL",
  "mail-originals", "cloud_archive_path", "decodeModifiedUtf7",
  "mail_check_cron_token", "mail_read_cloud_secret"
])assert.ok(scanner.includes(required),'missing cloud archiver contract: '+required)
assert.ok(!scanner.includes("imap.cmd('STORE"),'mail collector cannot mutate server mail flags')
assert.ok(!scanner.includes("imap.cmd('EXPUNGE"),'mail collector cannot purge mail')
assert.ok(settings.includes("mail_save_cloud_secret"),'credentials must go through Vault')
assert.ok(!ui.includes("mailto:password"),'client must not persist mail credentials')
console.log('Academic mail UI and collection contract checks passed.')
