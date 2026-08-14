import { chromium } from 'playwright'

const baseUrl = 'http://127.0.0.1:4174/tests/visual/index.html'
const browser = await chromium.launch({ headless: true })
const failures = []
const details = []

const interfaces = ['luminous', 'luminous-x']

function fail(message) {
  failures.push(message)
}

for (const ui of interfaces) {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } })
  try {
    await page.goto(`${baseUrl}?view=dashboard&theme=dark&ui=${ui}`, { waitUntil: 'domcontentloaded' })
    await page.locator("html[data-theme='dark'][data-visual-ready='true'] .paper-card-v3").first().waitFor({ state: 'visible', timeout: 45000 })
    await page.addStyleTag({ content: '*,*::before,*::after{animation:none!important;transition:none!important;}' })
    await page.waitForTimeout(100)

    const result = await page.evaluate(() => {
      const root = document.documentElement
      const rootStyle = getComputedStyle(root)
      const header = document.querySelector('.app-header')
      const cards = Array.from(document.querySelectorAll('.paper-card-v3'))
      const history = document.querySelector('.paper-history')
      const fileDots = Array.from(document.querySelectorAll('.paper-grid .file-dot'))

      function parseColor(value) {
        const probe = document.createElement('span')
        probe.style.color = value.trim()
        probe.style.display = 'none'
        document.body.appendChild(probe)
        const computed = getComputedStyle(probe).color
        probe.remove()
        const match = computed.match(/rgba?\((\d+)[, ]+(\d+)[, ]+(\d+)/)
        return match ? [Number(match[1]), Number(match[2]), Number(match[3])] : null
      }

      function describe(value) {
        const rgb = parseColor(value)
        if (!rgb) return { value, rgb: null, average: null, chroma: null }
        const average = rgb.reduce((sum, channel) => sum + channel, 0) / 3
        const chroma = Math.max(...rgb) - Math.min(...rgb)
        return { value, rgb, average, chroma }
      }

      function colorsFromImage(value) {
        if (!value || value === 'none') return []
        const colors = []
        for (const match of value.matchAll(/rgba?\([^)]*\)/g)) {
          const numbers = match[0].match(/[\d.]+/g)?.map(Number) || []
          if (numbers.length < 3) continue
          const alpha = match[0].startsWith('rgba') && numbers.length >= 4 ? numbers[3] : 1
          if (alpha <= 0.05) continue
          const rgb = numbers.slice(0, 3)
          colors.push({
            rgb,
            alpha,
            average: rgb.reduce((sum, channel) => sum + channel, 0) / 3,
            chroma: Math.max(...rgb) - Math.min(...rgb),
          })
        }
        return colors
      }

      function surfaceFor(element) {
        if (!element) return null
        const style = getComputedStyle(element)
        return {
          backgroundColor: describe(style.backgroundColor),
          backgroundImage: style.backgroundImage,
          imageColors: colorsFromImage(style.backgroundImage),
        }
      }

      const statusCards = cards.map(card => {
        const style = getComputedStyle(card)
        return {
          status: card.querySelector('.paper-status-area')?.getAttribute('data-status') || 'unknown',
          cardStart: style.getPropertyValue('--paper-card-start').trim(),
          ...surfaceFor(card),
        }
      })

      return {
        ui: root.dataset.ui,
        theme: root.dataset.theme,
        bgBase: describe(rootStyle.getPropertyValue('--bg-base')),
        bgCard: describe(rootStyle.getPropertyValue('--bg-card')),
        accent: describe(rootStyle.getPropertyValue('--accent')),
        textPrimary: describe(rootStyle.getPropertyValue('--text-primary')),
        lxCanvas: describe(rootStyle.getPropertyValue('--lx-canvas')),
        headerSurface: surfaceFor(header),
        history: history ? { surface: surfaceFor(history), text: describe(getComputedStyle(history).color) } : null,
        fileDots: fileDots.map(file => ({
          mark: file.dataset.fileMark || '',
          kind: file.dataset.fileKind || '',
          before: getComputedStyle(file, '::before').content,
          text: describe(getComputedStyle(file).color),
          surface: surfaceFor(file),
        })),
        statusCards,
        pageOverflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      }
    })

    if (result.theme !== 'dark') fail(`${ui}: visual harness did not enter dark mode`)
    if (result.ui !== ui) fail(`${ui}: visual harness entered ${result.ui || 'unknown'} instead`)

    for (const [label, color] of [['--bg-base', result.bgBase], ['--bg-card', result.bgCard]]) {
      if (!color.rgb) {
        fail(`${ui}: ${label} is not a parseable color (${color.value})`)
        continue
      }
      if (color.average < 35) fail(`${ui}: ${label} is still near-black (${color.value}, avg=${color.average.toFixed(1)})`)
      if (color.average > 90) fail(`${ui}: ${label} is too bright for dark mode (${color.value}, avg=${color.average.toFixed(1)})`)
    }

    if (ui === 'luminous-x') {
      if (!result.lxCanvas.rgb) fail(`${ui}: --lx-canvas is not a parseable color (${result.lxCanvas.value})`)
      else if (result.lxCanvas.average < 35) fail(`${ui}: --lx-canvas is still near-black (${result.lxCanvas.value})`)
    }

    if (!result.textPrimary.rgb || result.textPrimary.average < 220) {
      fail(`${ui}: primary text is not sufficiently legible (${result.textPrimary.value})`)
    }

    if (!result.accent.rgb) fail(`${ui}: accent is not a parseable color (${result.accent.value})`)
    else if (result.accent.chroma > 135) fail(`${ui}: accent remains excessively neon (${result.accent.value}, chroma=${result.accent.chroma.toFixed(1)})`)

    const headerValues = result.headerSurface?.imageColors?.map(color => color.average) || []
    if (result.headerSurface?.backgroundColor?.average !== null && result.headerSurface?.backgroundColor?.rgb?.some(channel => channel > 0)) {
      headerValues.push(result.headerSurface.backgroundColor.average)
    }
    if (!headerValues.length) fail(`${ui}: header surface is not measurable`)
    else if (Math.min(...headerValues) < 32) fail(`${ui}: header still contains a near-black surface (minimum average ${Math.min(...headerValues).toFixed(1)})`)

    if (result.pageOverflow > 2) fail(`${ui}: dark dashboard has horizontal overflow of ${result.pageOverflow}px`)

    if (result.history) {
      const historyBg = result.history.surface.backgroundColor.average
      if (historyBg === null || historyBg > 105) fail(`${ui}: version chain still uses a light surface (${result.history.surface.backgroundColor.value})`)
      if (!result.history.text.rgb || result.history.text.average < 150) fail(`${ui}: version chain text is too dim (${result.history.text.value})`)
    }

    for (const file of result.fileDots) {
      if (!file.mark || !file.kind) fail(`${ui}: attachment control is missing semantic file mark/kind`)
      if (!file.before || file.before === 'none' || file.before === 'normal' || file.before === '""') fail(`${ui}: attachment control has no visible pseudo-label (${file.kind || 'unknown'})`)
      if (!file.text.rgb || file.text.average < 120) fail(`${ui}: attachment mark is too dim (${file.text.value})`)
      const fileBg = file.surface.backgroundColor.average
      if (fileBg === null || fileBg < 30 || fileBg > 110) fail(`${ui}: attachment surface is not a readable dark control (${file.surface.backgroundColor.value})`)
    }

    if (ui === 'luminous-x') {
      const xCardStarts = [...new Set(result.statusCards.map(card => card.cardStart).filter(Boolean))]
      if (xCardStarts.length > 1) fail(`${ui}: dark card interiors still vary by status (${xCardStarts.join(', ')})`)
      const glowingCards = result.statusCards.filter(card => card.backgroundImage.includes('radial-gradient'))
      if (glowingCards.length) fail(`${ui}: ${glowingCards.length} dark cards still use decorative status glow fields`)
    }

    for (const card of result.statusCards) {
      const values = card.imageColors.map(color => color.average)
      if (card.backgroundColor.average !== null && card.backgroundColor.rgb?.some(channel => channel > 0)) values.push(card.backgroundColor.average)
      if (values.length && Math.min(...values) < 35) {
        fail(`${ui}/${card.status}: card contains a near-black surface (minimum average ${Math.min(...values).toFixed(1)}; backgroundColor=${card.backgroundColor.value}; backgroundImage=${card.backgroundImage})`)
      }
    }

    const statuses = [...new Set(result.statusCards.map(card => card.status))]
    details.push(`${ui}: base=${result.bgBase.value.trim()}, card=${result.bgCard.value.trim()}, accent=${result.accent.value.trim()}, statuses=${statuses.join(',')}`)
  } catch (error) {
    fail(`${ui}: ${error instanceof Error ? error.message : String(error)}`)
  } finally {
    await page.close()
  }
}

await browser.close()

if (failures.length) {
  console.error('Dark theme contract check failed:')
  failures.forEach(item => console.error(`- ${item}`))
  process.exit(1)
}

console.log('Dark theme contract check passed.')
details.forEach(item => console.log(`- ${item}`))
