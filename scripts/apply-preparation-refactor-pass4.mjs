import fs from 'node:fs'

function read(file) { return fs.readFileSync(file, 'utf8') }
function write(file, value) { fs.writeFileSync(file, value) }
function replaceExact(file, before, after) {
  const source = read(file)
  if (!source.includes(before)) throw new Error(`Missing expected block in ${file}: ${before.slice(0, 120)}`)
  write(file, source.replace(before, after))
}
function replaceAllExact(file, before, after) {
  const source = read(file)
  if (!source.includes(before)) throw new Error(`Missing expected token in ${file}: ${before}`)
  write(file, source.split(before).join(after))
}
function replaceRegex(file, pattern, after) {
  const source = read(file)
  if (!pattern.test(source)) throw new Error(`Missing expected regex in ${file}: ${pattern}`)
  write(file, source.replace(pattern, after))
}

// Dashboard: Luminous X status bar is contextual only; the workspace owns business navigation.
replaceExact(
  'src/components/Dashboard.tsx',
  "        preparationSection={preparationSection}\n        onPreparationSectionChange={tab === 'preparation' ? setPreparationSection : undefined}\n",
  "        preparationSection={preparationSection}\n",
)

// Preparation top actions: 期刊匹配 is a journal workspace, not a draft-creation route.
replaceAllExact(
  'src/components/PreparationWorkspace.tsx',
  "!['journals', 'compare'].includes(section)",
  "!['journals', 'compare', 'match'].includes(section)",
)

// Global Journal Center aliases the canonical match route rather than a hidden journals route.
replaceExact('src/global-navigation-search-enhancements.ts', "type PreparationSection = 'overview' | 'journals'", "type PreparationSection = 'overview' | 'match'")
replaceExact('src/global-navigation-search-enhancements.ts', "  const targetLabel = section === 'journals' ? '期刊库' : '总览'", "  const targetLabel = section === 'match' ? '期刊匹配' : '总览'")
replaceExact(
  'src/global-navigation-search-enhancements.ts',
  "    if (workspace && button) {\n      button.hidden = false\n      if (!button.classList.contains('active')) button.click()\n      markInternalJournalRoute(button)\n      scheduleEnhance()\n      if (workspace.dataset.section === section || attempts >= 12) return\n    }",
  "    if (workspace && button) {\n      if (!button.classList.contains('active')) button.click()\n      scheduleEnhance()\n      if (workspace.dataset.section === section || attempts >= 12) return\n    }",
)
replaceAllExact('src/global-navigation-search-enhancements.ts', "clickPreparationSection('journals')", "clickPreparationSection('match')")
replaceAllExact('src/global-navigation-search-enhancements.ts', "workspace.dataset.section === 'journals'", "workspace.dataset.section === 'match'")
replaceRegex(
  'src/global-navigation-search-enhancements.ts',
  /\nfunction markInternalJournalRoute[\s\S]*?\nfunction clickPreparationSection/,
  '\nfunction clickPreparationSection',
)
replaceExact('src/global-navigation-search-enhancements.ts', "  hideDuplicateJournalEntries()\n", '')

// Journal runtime follows the canonical match route and reads the canonical nav counter.
replaceExact(
  'src/journal-center-runtime.ts',
  "  const value = workspace.querySelector<HTMLSpanElement>('.prep-nav button[data-tone=\"journal\"] span')?.textContent",
  "  const value = workspace.querySelector<HTMLSpanElement>('.prep-nav button[data-tone=\"match\"] .prep-nav-item__meta')?.textContent",
)
replaceAllExact('src/journal-center-runtime.ts', "workspace.dataset.section === 'journals'", "workspace.dataset.section === 'match'")

// Header primary action treats match as a journal workflow.
replaceExact(
  'src/header-action-coherence.ts',
  "  if (section === 'journals' || section === 'compare') {",
  "  if (section === 'journals' || section === 'compare' || section === 'match') {",
)

// Retire the legacy four-route CSS contract instead of overriding it again.
replaceExact(
  'src/final-layout-navigation-fixes.css',
  ".preparation-workspace[data-section='journals'] > .prep-nav,\n.preparation-workspace > .journal-catalog-toolbar {\n  display: none !important;\n}",
  ".preparation-workspace > .journal-catalog-toolbar {\n  display: none !important;\n}",
)
replaceAllExact('src/final-layout-navigation-fixes.css', "[data-section='journals']", "[data-section='match']")
replaceRegex(
  'src/final-layout-navigation-fixes.css',
  /\n\/\* 投稿准备 retains exactly four visible routes:[\s\S]*?\/\* Luminous X route styling is centralized in final-luminous-x-navigation-coherence\.css\. \*\//,
  '\n/* Preparation business navigation is owned by src/styles/preparation/components.css. */\n\n/* Luminous X route styling is centralized in final-luminous-x-navigation-coherence.css. */',
)
replaceRegex(
  'src/final-layout-navigation-fixes.css',
  /\n  \.preparation-workspace:not\(\[data-section='match'\]\) > \.prep-nav \{\n    grid-template-columns: repeat\(2, minmax\(0, 1fr\)\) !important;\n  \}\n/,
  '\n',
)

// Terminal unified CSS owns the assistant lane geometry and removes obsolete X proxy selectors.
const componentsFile = 'src/styles/preparation/components.css'
let components = read(componentsFile)
if (!components.includes('.prep-overview-module > .prep-productivity')) {
  components += "\n\n/* React-owned overview modules align exactly with the Preparation content lane. */\n.prep-overview-modules,\n.prep-overview-module { width: 100%; min-width: 0; }\n.prep-overview-module > .prep-productivity {\n  width: 100% !important;\n  margin: 0 !important;\n}\n"
  write(componentsFile, components)
}
replaceRegex(
  'src/styles/preparation/luminous-x.css',
  /\nhtml\[data-ui='luminous-x'\] \.lx-status-bar\[data-page='preparation'\]\[data-preparation-section='figures'\] \.lx-page-proxy-controls,\nhtml\[data-ui='luminous-x'\] \.lx-status-bar\[data-page='preparation'\]\[data-preparation-section='figures'\] \.prep-business-nav \{\n  display: none !important;\n\}/,
  '',
)

// Test-only visual shell no longer invents a Journal Center route; production navigation supplies it.
replaceExact('tests/visual/visual-app.tsx', "import React, { useEffect } from 'react'", "import React from 'react'")
replaceRegex(
  'tests/visual/visual-app.tsx',
  /\nfunction VisualJournalCenterBridge\(\) \{[\s\S]*?\n\}\n\n\/\/ Test-only compatibility shell/,
  '\n// Test-only compatibility shell',
)
replaceExact('tests/visual/visual-app.tsx', "      <VisualJournalCenterBridge />\n", '')

// Static architecture contract: X consumes section context but must not implement a second business nav.
replaceExact(
  'tests/preparation-unified-contract.mjs',
  "expect(lx.includes('preparationSection') && lx.includes('onPreparationSectionChange'), 'Luminous X must consume the shared preparation section state directly.')",
  "expect(lx.includes('preparationSection'), 'Luminous X must consume shared preparation section context.')\nexpect(!lx.includes('PREPARATION_OPTIONS') && !lx.includes('PreparationControls') && !lx.includes('onPreparationSectionChange'), 'Luminous X must not implement a second Preparation business navigation.')",
)

// Canonical route migration for visual contracts.
for (const file of [
  'tests/visual/ui-geometry-contract-check.mjs',
  'tests/visual/journal-center-header-filter-check.mjs',
  'tests/visual/capture-documentation-screenshots.mjs',
  'tests/visual/submission-card-actions-check.mjs',
  'tests/visual/navigation-memory-check.mjs',
  'tests/visual/header-action-coherence-check.mjs',
  'tests/visual/journal-layout-ratio-check.mjs',
  'tests/visual/journal-library-density-check.mjs',
]) {
  if (!fs.existsSync(file)) continue
  let source = read(file)
  source = source
    .replaceAll('data-section="journals"', 'data-section="match"')
    .replaceAll("data-section='journals'", "data-section='match'")
    .replaceAll("dataset.section === 'journals'", "dataset.section === 'match'")
  write(file, source)
}

// Journal Center no longer hides the canonical five-route business navigation.
for (const file of ['tests/visual/ui-geometry-contract-check.mjs', 'tests/visual/journal-center-header-filter-check.mjs']) {
  let source = read(file)
  source = source.replace(
    "if (catalog.navDisplay !== 'none') fail(`${ui}/catalog: lower Preparation navigation row remains visible`)",
    "if (catalog.navDisplay === 'none' || catalog.navDisplay === 'missing') fail(`${ui}/catalog: canonical Preparation navigation is missing`)",
  )
  source = source.replace(
    "if (placement.navDisplay !== 'none') fail(`${ui}: 期刊中心仍显示投稿准备菜单行`)",
    "if (placement.navDisplay === 'none' || placement.navDisplay === 'missing') fail(`${ui}: 期刊中心缺少统一投稿准备菜单行`)",
  )
  write(file, source)
}

// Journal Center header/filter test reads the same canonical nav in both UIs.
replaceExact(
  'tests/visual/journal-center-header-filter-check.mjs',
  "      const nav = currentUi === 'luminous-x'\n        ? document.querySelector('.lx-status-bar[data-page=\"preparation\"] .lx-page-proxy-controls')\n        : workspace?.querySelector(':scope > .prep-nav-primary')",
  "      const nav = workspace?.querySelector(':scope > .prep-nav-primary')",
)
replaceExact(
  'tests/visual/journal-center-header-filter-check.mjs',
  "        columns: currentUi === 'luminous' && nav\n          ? getComputedStyle(nav).gridTemplateColumns.split(' ').filter(Boolean).length\n          : null,",
  "        columns: nav ? getComputedStyle(nav).gridTemplateColumns.split(' ').filter(Boolean).length : null,",
)
replaceExact(
  'tests/visual/journal-center-header-filter-check.mjs',
  "    if (ui === 'luminous' && preparation.columns !== 5) fail(`${ui}: 投稿准备不是五列（${preparation.columns}）`)",
  "    if (preparation.columns !== 5) fail(`${ui}: 投稿准备不是五列（${preparation.columns}）`)",
)

// Luminous X focused contract now validates the single canonical navigation.
replaceRegex(
  'tests/visual/luminous-x-compact-check.mjs',
  /  const prep = await open\('preparation'\)[\s\S]*?  await narrowPrep\.close\(\)\n/,
`  const prep = await open('preparation')
  await prep.locator('.prep-productivity').waitFor({ state: 'visible' })
  await prep.screenshot({ path: 'focused-review/luminous-x-preparation-compact.png', fullPage: true })

  const prepLayout = await prep.evaluate(() => {
    const workspace = document.querySelector('.preparation-workspace')
    const topbar = workspace?.querySelector(':scope > .prep-topbar')
    const nav = workspace?.querySelector(':scope > .prep-nav-primary')
    const portal = document.querySelector('#lx-preparation-actions-slot .prep-top-actions-portal')
    const assistant = workspace?.querySelector('.prep-productivity')
    const topics = workspace?.querySelector('.prep-topic-overview')
    const draftPanel = workspace?.querySelector('.prep-overview-drafts')
    const journalPanel = workspace?.querySelector('.prep-overview-journals')
    const primaryJournal = document.querySelector("button[data-main-nav-key='journals']")
    const primaryPeer = document.querySelector("button[data-main-nav-key='preparation']")
    if (!workspace || !topbar || !nav) return null

    const buttons = Array.from(nav.querySelectorAll(':scope > button')).filter(button => {
      const style = getComputedStyle(button)
      const rect = button.getBoundingClientRect()
      return style.display !== 'none' && style.visibility !== 'hidden' && rect.width > 0 && rect.height > 0
    })
    const primaryJournalStyle = primaryJournal ? getComputedStyle(primaryJournal) : null
    const primaryPeerStyle = primaryPeer ? getComputedStyle(primaryPeer) : null

    return {
      workspace: workspace.getBoundingClientRect().toJSON(),
      topbarDisplay: getComputedStyle(topbar).display,
      nav: nav.getBoundingClientRect().toJSON(),
      labels: buttons.map(button => (button.textContent || '').replace(/\\s+/g, ' ').trim()),
      navOverflow: nav.scrollWidth - nav.clientWidth,
      portal: portal?.getBoundingClientRect().toJSON(),
      portalSearch: !!portal?.querySelector('.prep-search input'),
      assistant: assistant?.getBoundingClientRect().toJSON(),
      topics: topics?.getBoundingClientRect().toJSON(),
      draftPanel: draftPanel?.getBoundingClientRect().toJSON(),
      journalPanel: journalPanel?.getBoundingClientRect().toJSON(),
      primaryJournalGeometry: primaryJournal && primaryJournalStyle ? {
        width: primaryJournal.getBoundingClientRect().width,
        height: primaryJournal.getBoundingClientRect().height,
        radius: primaryJournalStyle.borderRadius,
        justify: primaryJournalStyle.justifyContent,
      } : null,
      primaryPeerGeometry: primaryPeer && primaryPeerStyle ? {
        width: primaryPeer.getBoundingClientRect().width,
        height: primaryPeer.getBoundingClientRect().height,
        radius: primaryPeerStyle.borderRadius,
        justify: primaryPeerStyle.justifyContent,
      } : null,
    }
  })

  if (!prepLayout) failures.push('preparation: required elements missing')
  else {
    const required = ['总览', '论文准备', '投稿材料', '期刊匹配', '投稿前检查']
    required.forEach(label => {
      if (!prepLayout.labels.some(item => item.includes(label))) failures.push(\`preparation: route missing \${label}\`)
    })
    if (prepLayout.labels.length !== 5) failures.push(\`preparation: expected five routes, got \${prepLayout.labels.join(' / ')}\`)
    if (!prepLayout.portal || !prepLayout.portalSearch) failures.push('preparation: real search controls were not moved into the header lane')
    if (prepLayout.topbarDisplay !== 'none') failures.push('preparation: redundant wide overview toolbar remains visible')
    if (prepLayout.navOverflow > 2) failures.push(\`preparation: canonical navigation overflows by \${prepLayout.navOverflow}px\`)
    if (prepLayout.draftPanel && prepLayout.journalPanel && Math.abs(prepLayout.draftPanel.height - prepLayout.journalPanel.height) > 4) failures.push('preparation: overview draft and journal panels are not equal height')
    if (prepLayout.assistant && prepLayout.topics && Math.abs(prepLayout.assistant.left - prepLayout.topics.left) > 4) failures.push('preparation: overview modules do not share one column')
    if (!prepLayout.primaryJournalGeometry || !prepLayout.primaryPeerGeometry) failures.push('preparation: global Journal Center geometry is missing')
    else {
      if (Math.abs(prepLayout.primaryJournalGeometry.width - prepLayout.primaryPeerGeometry.width) > 1) failures.push('preparation: Journal Center width differs from peer routes')
      if (Math.abs(prepLayout.primaryJournalGeometry.height - prepLayout.primaryPeerGeometry.height) > 1) failures.push('preparation: Journal Center height differs from peer routes')
      if (prepLayout.primaryJournalGeometry.radius !== prepLayout.primaryPeerGeometry.radius) failures.push('preparation: Journal Center radius differs from peer routes')
    }
  }

  const prepNav = prep.locator('.preparation-workspace > .prep-nav-primary')
  await prepNav.getByRole('button', { name: /论文准备/ }).click()
  await prep.locator(".preparation-workspace[data-section='paper']").waitFor({ state: 'visible', timeout: 5000 })
  const paperPanels = await prep.locator(".preparation-workspace[data-section='paper'] .prep-primary-section-grid > section").count()
  if (paperPanels < 2) failures.push(\`preparation: paper workspace expected topic + draft panels, got \${paperPanels}\`)

  const figureEntry = prep.locator('.prep-figure-tool-entry:visible').first()
  await figureEntry.waitFor({ state: 'visible', timeout: 5000 })
  const entryIcon = await figureEntry.locator('.prep-figure-tool-entry__icon svg').evaluate(element => element.getBoundingClientRect().toJSON())
  if (entryIcon.width < 18 || entryIcon.height < 18) failures.push(\`preparation: Figure Composer entry icon is not prominent (\${entryIcon.width}×\${entryIcon.height}px)\`)
  await figureEntry.click()
  await prep.locator(".preparation-workspace[data-section='figures'] .figure-composer").waitFor({ state: 'visible', timeout: 10000 })
  if (await prep.locator(".preparation-workspace[data-section='figures'] > .prep-nav-primary").count()) failures.push('preparation: business navigation remains mounted in Figure Composer mode')
  const composerGeometry = await prep.locator('.figure-composer').evaluate(element => {
    const rect = element.getBoundingClientRect()
    return { width: rect.width, overflow: element.scrollWidth - element.clientWidth }
  })
  if (composerGeometry.width < 700) failures.push(\`preparation: Figure Composer workspace is unexpectedly narrow (\${composerGeometry.width}px)\`)
  if (composerGeometry.overflow > 2) failures.push(\`preparation: Figure Composer root horizontally overflows by \${composerGeometry.overflow}px\`)
  await prep.screenshot({ path: 'focused-review/luminous-x-figure-composer.png', fullPage: true })

  await prep.getByRole('button', { name: /返回投稿准备/ }).click()
  await prep.locator('.preparation-workspace > .prep-nav-primary').waitFor({ state: 'visible', timeout: 5000 })
  const journalCenter = prep.locator("button[data-main-nav-key='journals']:visible").first()
  await journalCenter.click()
  await prep.locator(".preparation-workspace[data-section='match'] .journal-grid").waitFor({ state: 'visible', timeout: 5000 })
  await prep.close()

  const narrowPrep = await open('preparation', 1280, 1000)
  const narrow = await narrowPrep.evaluate(() => {
    const nav = document.querySelector('.preparation-workspace > .prep-nav-primary')
    if (!nav) return null
    const rect = nav.getBoundingClientRect()
    const labels = Array.from(nav.querySelectorAll(':scope > button')).filter(button => {
      const style = getComputedStyle(button)
      return style.display !== 'none' && style.visibility !== 'hidden'
    }).map(button => (button.textContent || '').replace(/\\s+/g, ' ').trim())
    return { labels, overflow: nav.scrollWidth - nav.clientWidth, rect: rect.toJSON() }
  })
  if (!narrow) failures.push('preparation narrow: canonical navigation missing')
  else {
    if (narrow.labels.length !== 5) failures.push(\`preparation narrow: expected five routes, got \${narrow.labels.join(' / ')}\`)
    if (narrow.overflow > 2) failures.push(\`preparation narrow: navigation overflows by \${narrow.overflow}px\`)
  }
  await narrowPrep.close()
`)

console.log('Applied Preparation convergence pass 4.')
