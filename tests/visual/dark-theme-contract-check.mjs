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
      const body = document.body
      const header = document.querySelector('.app-header')
      const cards = Array.from(document.querySelectorAll('.paper-card-v3'))

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
          const numbers = match[0].match(/[\d.]+/g)?.slice(0, 3).map(Number)
          if (numbers?.length === 3) colors.push(numbers)
        }
        return colors.map(rgb => ({
          rgb,
          average: rgb.reduce((sum, channel) => sum + channel, 0) / 3,
          chroma: Math.max(...rgb) - Math.min(...rgb),
        }))
      }

      const statusCards = cards.map(card => {
        const status = card.querySelector('.paper-status-area')?.getAttribute('data-status') || 'unknown'
        const style = getComputedStyle(card)
        return {
          status,
          backgroundColor: describe(style.backgroundColor),
          backgroundImage: style.backgroundImage,
          imageColors: colorsFromImage(style.backgroundImage),
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
        bodyBackgroundImage: getComputedStyle(body).backgroundImage,
        headerBackground: header ? describe(getComputedStyle(header).backgroundColor) : null,
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
      if (color.average > 85) fail(`${ui}: ${label} is too bright for dark mode (${color.value}, avg=${color.average.toFixed(1)})`)
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

    if (!result.headerBackground?.rgb) fail(`${ui}: header background is not measurable`)
    else if (result.headerBackground.average < 32) fail(`${ui}: header is still near-black (${result.headerBackground.value})`)

    if (result.pageOverflow > 2) fail(`${ui}: dark dashboard has horizontal overflow of ${result.pageOverflow}px`)

    for (const card of result.statusCards) {
      const imageAverages = card.imageColors.map(color => color.average)
      const measured = imageAverages.length ? Math.min(...imageAverages) : card.backgroundColor.average
      if (measured !== null && measured < 35) {
        fail(`${ui}/${card.status}: card contains a near-black surface (minimum average ${measured.toFixed(1)})`)
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
