const query = new URLSearchParams(window.location.search)

if ((query.get('view') || 'dashboard') !== 'dashboard') {
  document.documentElement.dataset.layoutReady = 'true'
} else {
  const tolerance = 1.5

  const retry = (attempt = 0) => {
    const html = document.documentElement
    if (html.dataset.visualReady !== 'true') {
      if (attempt < 80) window.setTimeout(() => retry(attempt + 1), 50)
      return
    }

    const metrics = document.querySelector<HTMLElement>('.dashboard-metrics')
    const grid = document.querySelector<HTMLElement>('.paper-grid')
    const cards = Array.from(document.querySelectorAll<HTMLElement>('.paper-card-v3'))
    const failures: string[] = []

    if (!metrics || !grid || cards.length === 0) {
      failures.push('dashboard geometry is incomplete')
    } else {
      const metricsRect = metrics.getBoundingClientRect()
      const gridRect = grid.getBoundingClientRect()
      if (Math.abs(metricsRect.left - gridRect.left) > tolerance) failures.push('metrics and card grid left edges differ')
      if (Math.abs(metricsRect.right - gridRect.right) > tolerance) failures.push('metrics and card grid right edges differ')

      const rowTop = Math.min(...cards.map(card => card.getBoundingClientRect().top))
      const firstRow = cards.filter(card => Math.abs(card.getBoundingClientRect().top - rowTop) <= tolerance)
      if (firstRow.length > 1) {
        const heights = firstRow.map(card => card.getBoundingClientRect().height)
        if (Math.max(...heights) - Math.min(...heights) > tolerance) failures.push('cards in the same row are not equal height')
      }

      const cardWithJournal = cards.find(card => card.querySelector('.journal-pill'))
      if (!cardWithJournal) {
        failures.push('journal pill is missing')
      } else {
        const status = cardWithJournal.querySelector<HTMLElement>('.paper-status-area > .badge')
        const pill = cardWithJournal.querySelector<HTMLElement>('.journal-pill')
        const icon = cardWithJournal.querySelector<HTMLElement>('.journal-pill-icon')
        const text = cardWithJournal.querySelector<HTMLElement>('.journal-pill-text')

        if (!status || !pill || !icon || !text) {
          failures.push('paper header elements are incomplete')
        } else {
          const statusHeight = status.getBoundingClientRect().height
          const pillRect = pill.getBoundingClientRect()
          if (Math.abs(statusHeight - pillRect.height) > tolerance) failures.push('status and journal pills have different heights')

          const style = getComputedStyle(pill)
          const expectedMax = icon.getBoundingClientRect().width
            + text.scrollWidth
            + Number.parseFloat(style.paddingLeft)
            + Number.parseFloat(style.paddingRight)
            + Number.parseFloat(style.borderLeftWidth)
            + Number.parseFloat(style.borderRightWidth)
            + 8
          if (pillRect.width - expectedMax > 2) failures.push('journal pill contains unnecessary blank width')

          const cardRect = cardWithJournal.getBoundingClientRect()
          if (Math.abs((cardRect.right - 16) - pillRect.right) > 3) failures.push('journal pill is not right aligned to the card content edge')
        }

        const accent = getComputedStyle(cardWithJournal, '::before')
        if (Number.parseFloat(accent.left) < 18 || Number.parseFloat(accent.right) < 18 || Number.parseFloat(accent.top) < 4) {
          failures.push('card accent line is not safely inset from rounded corners')
        }
      }
    }

    if (failures.length > 0) {
      html.dataset.layoutError = failures.join(' | ')
      console.error('Layout validation failed:', failures)
      return
    }

    html.dataset.layoutReady = 'true'
  }

  window.setTimeout(() => retry(), 0)
}
