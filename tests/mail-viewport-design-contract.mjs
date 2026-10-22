import assert from 'node:assert/strict'
import fs from 'node:fs'
const read=file=>fs.readFileSync(new URL('../'+file,import.meta.url),'utf8')
const dashboard=read('src/components/Dashboard.tsx')
const mail=read('src/components/AcademicMailCenter.tsx')
const css=read('src/components/AcademicMailCenter.css')
const tests=[
 ['mail-only viewport app shell without breaking paper dashboard',dashboard.includes("tab === 'mail' ? 'app-layout app-layout-mail' : 'app-layout'")],
 ['viewport shell takes browser visible height',css.includes('height: 100dvh;')&&css.includes('.app-layout.app-layout-mail')],
 ['primary app header never overlaps mail workspace',css.includes('> .app-header {')&&css.includes('position: relative;')],
 ['mail shell is independent scroll container',css.includes('> .academic-mail-center {')&&css.includes('flex: 1 1 0;')],
 ['inbox workspace fills remaining space',css.includes('.am-mode-inbox .am-workspace{')&&css.includes('height: 0;')],
 ['message list scrolls independently while pagination is visible',css.includes('.am-mode-inbox .am-message-list{')&&css.includes('height:auto !important;')&&css.includes('.am-pager{')],
 ['reader stays within remaining viewport',css.includes('.am-mode-inbox .am-reader {')&&css.includes('height: 100% !important;')],
 ['changing selected message resets reader position',mail.includes('readerRef.current.scrollTop=0')&&mail.includes('ref={readerRef}')],
 ['MIME leading and repeated empty lines are trimmed on display',mail.includes("const readableMailText")&&mail.includes("    .trim()")&&mail.includes("    .replace(/\\n[ \\t]*\\n")],
 ['footer does not create document scroll in inbox',mail.includes("workspace!=='inbox'&&<footer")],
 ['solid white reader text on light mode',css.includes('background:#fff;')&&css.includes('background: #fff;')],
 ['different categories receive distinct pastel surfaces',css.includes('am-message[data-category="editorial"]')&&css.includes('am-message[data-category="submission_update"]')&&css.includes('am-message[data-category="review_invite"]')],
 ['spam provenance visually distinct',css.includes('am-message[data-spam="true"]')],
 ['reader metadata and classification distinct',css.includes('.am-meta>div:nth-child(4)')&&css.includes('.am-review-controls{')],
 ['dark theme is explicitly supported',css.includes('html[data-ui][data-theme="dark"]')],
 ['mail card scrolled internally on mobile',css.includes('@media(max-width:700px)')&&css.includes('.am-workspace.show-detail .am-reader')],
 ['other tab settings remains scrollable in fixed app shell',css.includes('.academic-mail-center:not(.am-mode-inbox)')],
]
for(const [name,ok] of tests) assert.ok(ok,'Mail viewport design invariant failed: '+name)
console.log('Mail viewport & white/pastel design: '+tests.length+' checks passed')
