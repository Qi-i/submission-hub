import assert from 'node:assert/strict'
import fs from 'node:fs'
const read = name=>fs.readFileSync(new URL('../'+name,import.meta.url),'utf8')
const ui=read('src/components/AcademicMailCenter.tsx')
const css=read('src/components/AcademicMailCenter.css')
const commandStart=ui.indexOf('<header className="am-header am-command-header">')
const commandEnd=ui.indexOf('</header>',commandStart)
const tabsInsideCommand=ui.indexOf('<nav className="am-tabs"',commandStart)>commandStart&&ui.indexOf('<nav className="am-tabs"',commandStart)<commandEnd
const tests=[
 ['single shared title, navigation and actions row',ui.includes('am-header am-command-header')&&tabsInsideCommand],
 ['navigation no longer stacks above filters',ui.indexOf('<nav className="am-tabs"')<ui.indexOf('</header>')&&ui.includes('className={"am-filterbar"')],
 ['archive/AI status are small badges, not duplicate hero cards',ui.includes('am-command-status')&&!ui.includes('am-hero-tiles')],
 ['filters and search compose a single responsive row',css.includes('grid-template-columns:minmax(390px,.78fr) minmax(0,1.22fr)')&&ui.includes('className="am-filterbar"')],
 ['stat chips remain interactive and dynamic',ui.includes('savedViews.map(view=>')&&ui.includes('onClick={()=>pickScope(view.kind)}')],
 ['filters adapt to hidden or newly added views',css.includes('.am-filterbar.no-views')&&css.includes('repeat(auto-fit,minmax(96px,1fr))')],
 ['desktop command height is content-first',css.includes('min-height:54px')&&css.includes('min-height:40px')],
 ['desktop reader consumes freed height',css.includes('calc(100dvh - 170px)')&&css.includes('calc(100dvh - 247px)')],
 ['list titles are readable at 14px',css.includes('font-size:14px;line-height:1.43')],
 ['preview text stays readable at 12.5px',css.includes('font-size:12.5px;line-height:1.5')],
 ['mail body is at least 14.5px on desktop',css.includes('font-size:14.5px;line-height:1.78')],
 ['reading column is wider than list',css.includes('minmax(325px,.82fr) minmax(0,1.36fr)')],
 ['body precedes manual classification form',ui.indexOf('className="am-reader-content"')<ui.indexOf('className="am-review-controls"')],
 ['stored submission count actually computed',ui.includes('submission:submission.count||0')&&ui.includes('counts.submission')],
 ['HTML entities are decoded only for display',ui.includes('const readableMailText')&&ui.includes('readableMailText(activeBody||active.snippet')],
 ['mobile retains stacked reader mode and legible body',css.includes('.am-workspace.show-detail .am-reader')&&css.includes('font-size:14px')],
 ['account and OAuth workflows preserved',ui.includes("callFunction('mail-outlook-oauth'")&&ui.includes('mail-cloud-collector')],
]
for(const [name,pass] of tests)assert.ok(pass,'Mail density regression failed: '+name)
console.log('Mail dense-layout regression: '+tests.length+' checks passed')
