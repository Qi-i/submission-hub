from pathlib import Path

ROOT = Path('.')

def read(path):
    return (ROOT / path).read_text(encoding='utf-8')

def write(path, text):
    (ROOT / path).write_text(text, encoding='utf-8')

def replace_once(path, old, new):
    text = read(path)
    if old not in text:
        raise SystemExit(f'MISSING in {path}: {old[:180]!r}')
    write(path, text.replace(old, new, 1))

# 1) Canonical Preparation overview is a linear page shell. Legacy dense CSS used
# a two-column 172px navigation/dashboard row and nth-child spans; explicitly reset
# those properties in the terminal unified style layer.
p = 'src/styles/preparation/components.css'
text = read(p)
marker = '/* Canonical overview flow: unified navigation is always one full-width five-column row. */'
if marker not in text:
    text += r'''

/* Canonical overview flow: unified navigation is always one full-width five-column row. */
@media (min-width: 1080px) {
  html[data-ui] body .preparation-workspace[data-section='overview'] {
    display: grid !important;
    grid-template-columns: minmax(0, 1fr) !important;
    grid-template-rows: none !important;
    grid-auto-rows: auto !important;
    align-items: stretch !important;
    column-gap: 0 !important;
    row-gap: var(--prep-gap-md) !important;
  }

  html[data-ui] body .preparation-workspace[data-section='overview'] > .prep-topbar,
  html[data-ui] body .preparation-workspace[data-section='overview'] > .prep-business-nav,
  html[data-ui] body .preparation-workspace[data-section='overview'] > .prep-dashboard,
  html[data-ui] body .preparation-workspace[data-section='overview'] > .prep-overview-grid,
  html[data-ui] body .preparation-workspace[data-section='overview'] > .prep-overview-modules,
  html[data-ui] body .preparation-workspace[data-section='overview'] > .prep-topic-overview,
  html[data-ui] body .preparation-workspace[data-section='overview'] > .prep-productivity {
    grid-column: 1 !important;
    grid-row: auto !important;
    width: 100% !important;
    max-width: none !important;
    height: auto !important;
    min-height: 0 !important;
    max-height: none !important;
    align-self: stretch !important;
  }

  html[data-ui] body .preparation-workspace[data-section='overview'] > .prep-business-nav {
    display: grid !important;
    grid-template-columns: repeat(5, minmax(0, 1fr)) !important;
    grid-template-rows: 44px !important;
    grid-auto-flow: row !important;
    align-content: stretch !important;
    margin: 0 !important;
    padding: 7px !important;
  }

  html[data-ui] body .preparation-workspace[data-section='overview'] > .prep-business-nav > .prep-nav-item,
  html[data-ui] body .preparation-workspace[data-section='overview'] > .prep-business-nav > .prep-nav-item:nth-child(n) {
    grid-column: auto !important;
    grid-row: 1 !important;
    width: 100% !important;
    height: 44px !important;
    min-height: 44px !important;
    max-height: 44px !important;
    margin: 0 !important;
    transform: none;
  }

  html[data-ui] body .preparation-workspace[data-section='overview'] > .prep-dashboard {
    margin: 0 !important;
  }
}
'''
    write(p, text)

# 2) UI geometry contract understands the restored first-class Journal Center and
# verifies visible idle route tones.
p = 'tests/visual/ui-geometry-contract-check.mjs'
replace_once(p,
"            ? ['.app-layout > .preparation-suite']",
"            ? ['.app-layout > .online-preparation-shell, .app-layout > .preparation-suite']")
replace_once(p,
"        const prepLabels = prepNav\n          ? Array.from(prepNav.querySelectorAll(':scope > button')).filter(visible).map(button => (button.textContent || '').replace(/\\s+/g, ' ').trim())\n          : []",
"        const prepButtons = prepNav ? Array.from(prepNav.querySelectorAll(':scope > button')).filter(visible) : []\n        const prepLabels = prepButtons.map(button => (button.textContent || '').replace(/\\s+/g, ' ').trim())\n        const prepToneSignatures = prepButtons.map(button => {\n          const style = getComputedStyle(button)\n          return `${style.backgroundColor}|${style.backgroundImage}|${style.borderColor}`\n        })")
replace_once(p,
"          prepLabels,\n          overviewJournalPanel:",
"          prepLabels,\n          prepToneSignatures,\n          overviewJournalPanel:")
replace_once(p,
"        if (report.prepLabels.some(item => ['选题池', '草稿准备', '期刊库', '期刊比较'].some(legacy => item.includes(legacy)))) fail(`${ui}: legacy secondary Preparation routes remain in the primary navigation`)\n        if (!report.overviewJournalPanel)",
"        if (report.prepLabels.some(item => ['选题池', '草稿准备', '期刊库', '期刊比较'].some(legacy => item.includes(legacy)))) fail(`${ui}: legacy secondary Preparation routes remain in the primary navigation`)\n        if (new Set(report.prepToneSignatures).size < 4) fail(`${ui}: idle Preparation routes are not visually distinguishable`)\n        if (!report.overviewJournalPanel)")
replace_once(p,
"    await entry.evaluate(element => element.click())\n    await catalogPage.locator('.journal-catalog-top-filters').waitFor({ state: 'visible', timeout: 15000 })\n    await catalogPage.locator('.preparation-workspace[data-section=\"match\"] .journal-grid').waitFor({ state: 'visible', timeout: 15000 })",
"    await entry.evaluate(element => element.click())\n    await catalogPage.locator('.journal-catalog-top-filters').waitFor({ state: 'visible', timeout: 15000 })\n    await catalogPage.locator('.journal-center-workspace[data-section=\"match\"] .journal-grid').waitFor({ state: 'visible', timeout: 15000 })\n    const journalRouteActive = await entry.evaluate(element => element.classList.contains('active'))\n    const preparationRouteActive = await catalogPage.locator(\"button[data-main-nav-key='preparation']:visible\").first().evaluate(element => element.classList.contains('active'))\n    if (!journalRouteActive) fail(`${ui}/catalog: Journal Center main route is not active after navigation`)\n    if (preparationRouteActive) fail(`${ui}/catalog: Preparation remains active while Journal Center is open`)")
replace_once(p,
"      const workspace = document.querySelector('.preparation-workspace[data-section=\"match\"]')",
"      const workspace = document.querySelector('.journal-center-workspace[data-section=\"match\"]')")
replace_once(p,
"        ? document.querySelector('.lx-status-bar[data-page=\"preparation\"] .lx-status-controls-host')",
"        ? document.querySelector('.lx-status-bar[data-page=\"journals\"] .lx-status-controls-host')")
replace_once(p,
"    if (catalog.navDisplay === 'none' || catalog.navDisplay === 'missing') fail(`${ui}/catalog: canonical Preparation navigation is missing`)",
"    if (catalog.navDisplay !== 'none' && catalog.navDisplay !== 'missing') fail(`${ui}/catalog: standalone Journal Center must not render Preparation business navigation`)")

# 3) Visual layout check: standalone Journal Center has a topbar, not Preparation nav.
p = 'tests/visual/layout-check.mjs'
old = '''    const journalTabGeometry = await page.evaluate((tol) => {
      const failures = []
      const panel = document.querySelector('.preparation-workspace')
      const nav = document.querySelector('.prep-nav')
      const grid = document.querySelector('.prep-card-grid.journal-grid')
      if (!panel || !nav || !grid) return { failures: ['journal tab geometry is incomplete'] }
      const panelRect = panel.getBoundingClientRect()
      const navRect = nav.getBoundingClientRect()
      const gridRect = grid.getBoundingClientRect()
      if (navRect.bottom > gridRect.top + tol) failures.push('workbench overlaps journal library after tab switch')
      if (Math.abs(panelRect.left - gridRect.left) > tol || Math.abs(panelRect.right - gridRect.right) > tol) failures.push('journal library edges differ from preparation page')

      document.querySelectorAll('.prep-journal-card').forEach((card, index) => {'''
new = '''    const journalTabGeometry = await page.evaluate((tol) => {
      const failures = []
      const panel = document.querySelector('.journal-center-workspace[data-section="match"]')
      const topbar = panel?.querySelector(':scope > .prep-topbar')
      const nav = panel?.querySelector(':scope > .prep-nav-primary')
      const grid = panel?.querySelector('.prep-card-grid.journal-grid')
      if (!panel || !topbar || !grid) return { failures: ['journal tab geometry is incomplete'] }
      const panelRect = panel.getBoundingClientRect()
      const topbarRect = topbar.getBoundingClientRect()
      const gridRect = grid.getBoundingClientRect()
      if (topbarRect.bottom > gridRect.top + tol) failures.push('Journal Center topbar overlaps journal library')
      if (nav && getComputedStyle(nav).display !== 'none') failures.push('standalone Journal Center renders Preparation navigation')
      if (Math.abs(panelRect.left - gridRect.left) > tol || Math.abs(panelRect.right - gridRect.right) > tol) failures.push('journal library edges differ from Journal Center page')

      panel.querySelectorAll('.prep-journal-card').forEach((card, index) => {'''
replace_once(p, old, new)

# 4) Static architectural contract protects the real top-level Journal Center and
# the online Preparation content-lane wrapper.
p = 'tests/preparation-unified-contract.mjs'
replace_once(p,
"const styles = read('src/app-styles.ts')",
"const styles = read('src/app-styles.ts')\nconst shellCss = read('src/styles/preparation/shell.css')\nconst dashboardSource = read('src/components/Dashboard.tsx')\nconst globalNavigationSource = read('src/global-navigation-search-enhancements.ts')")
insert_after = "expect(styles.includes(\"./styles/preparation/tokens.css\") && styles.includes(\"./styles/preparation/workbench.css\"), 'app-styles.ts must load the unified preparation style system.')"
replacement = insert_after + "\nexpect(shellCss.includes('.app-layout > .online-preparation-shell') && shellCss.includes('max-width: var(--ui-shell-max)'), 'Online Preparation shell must use the global centered content lane.')\nexpect(dashboardSource.includes(\"'journals'\") && dashboardSource.includes('期刊中心') && dashboardSource.includes('workspaceMode=\"journal-center\"'), 'Journal Center must remain a first-class global React route.')\nexpect(!globalNavigationSource.includes('createJournalCenterButton') && !globalNavigationSource.includes(\"clickPreparationSection('match')\"), 'Global navigation must never fake Journal Center by redirecting to Preparation match.')"
replace_once(p, insert_after, replacement)

print('Canonical geometry and first-class Journal Center contracts updated.')
