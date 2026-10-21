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
  "review_response", "cloud_archive_path", "createSignedUrl", "suggestedPaper",
  "mail-config", "mail-cloud-collector",
])assert.ok(ui.includes(required),'missing mail UI contract: '+required)
assert.ok(ui.includes("setSelected(current=>"),'selection should survive background refresh')
assert.ok(ui.includes("setBodyLoading(true)"),'body should be loaded on demand')
assert.ok(ui.includes("page*PAGE_SIZE"),'mail list should support server-side pagination')
assert.ok(ui.includes("and(or("),'combined spam/full text filter must preserve both conditions')
for(const required of ['.am-workspace','.am-reader','.am-account-card','@media(max-width:700px)'])
  assert.ok(css.includes(required),'missing responsive UI element: '+required)
assert.ok(dashboard.includes("tab === 'mail' && user"),'first-class mail route missing')
assert.ok(dashboard.includes('data-main-nav-key="mail"'),'mail must be in top-level menu')
assert.ok(!dashboard.includes('mail-subnav'),'legacy tiny subnav must be removed')
assert.ok(!dashboard.includes('dashboardPanel'),'mail must not be nested within Dashboard')
assert.ok(dashboard.includes('header-account-dropdown'),'settings/feedback must be inside avatar dropdown')
const cardCss=file('src/mail-navigation-card-layout.css')
const appStyles=file('src/app-styles.ts')
const main=file('src/main.tsx')
const paperCard=file('src/components/PaperCardEnhanced.tsx')
assert.ok(cardCss.includes('.journal-pill-text') && cardCss.includes('-webkit-line-clamp: 2'), 'journal names must show up to two lines')
assert.ok(cardCss.includes('.paper-journal-slot') && cardCss.includes('width: 100% !important'), 'journal width must be unrestricted')
assert.ok(cardCss.includes('.app-layout > .academic-mail-center'), 'mail page must use the whole main width')
assert.ok(appStyles.trimEnd().endsWith("import './mail-navigation-card-layout.css'"),'final override must load last')
assert.ok(!main.includes('<ProjectFeedback />'),'feedback must not appear in header tools')
assert.ok(paperCard.includes('${linkedPaper.journal} · 悬停预览期刊信息'),'journal title tooltip must contain full name')

for(const required of [
  "Deno.connectTls", "EXAMINE ", "BODY.PEEK[]", "UIDVALIDITY", "UID SEARCH ALL",
  "mail-originals", "cloud_archive_path", "decodeModifiedUtf7", "extractDeadline",
  "mail_check_cron_token", "mail_read_cloud_secret"
])assert.ok(scanner.includes(required),'missing cloud archiver contract: '+required)
assert.ok(!scanner.includes("imap.cmd('STORE"),'mail collector cannot mutate server mail flags')
assert.ok(!scanner.includes("imap.cmd('EXPUNGE"),'mail collector cannot purge mail')
assert.ok(settings.includes("mail_save_cloud_secret"),'credentials must go through Vault')
assert.ok(!ui.includes("mailto:password"),'client must not persist mail credentials')
console.log('Academic mail UI and collection contract checks passed.')
