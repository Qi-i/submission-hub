const JOURNAL_BUTTON_SELECTOR = '.paper-card-v3 .journal-pill-button'
const JOURNAL_POPOVER_SELECTOR = '.paper-card-v3 .journal-quick-overlay'
const LOCAL_POPOVER_SELECTOR = '.journal-quick-overlay'
const OPEN_DELAY = 90
const CLOSE_DELAY = 220

const openTimers = new WeakMap<HTMLElement, number>()
const closeTimers = new WeakMap<HTMLElement, number>()

function cardFor(element: Element | null) {
  return element?.closest<HTMLElement>('.paper-card-v3') || null
}

function clearTimer(map: WeakMap<HTMLElement, number>, element: HTMLElement | null) {
  if (!element) return
  const timer = map.get(element)
  if (timer !== undefined) window.clearTimeout(timer)
  map.delete(element)
}

function closeJournalPopover(card: HTMLElement) {
  const overlay = card.querySelector<HTMLElement>(LOCAL_POPOVER_SELECTOR)
  if (!overlay) return
  const closeButton = overlay.querySelector<HTMLButtonElement>('.journal-quick-head > button')
  closeButton?.click()
}

function pointerOrFocusInside(card: HTMLElement) {
  const active = document.activeElement
  return !!card.querySelector('.journal-pill-button:hover, .journal-quick-card:hover')
    || (!!active && (active.matches(JOURNAL_BUTTON_SELECTOR) || card.querySelector('.journal-quick-card')?.contains(active)))
}

function queueOpen(button: HTMLButtonElement) {
  const card = cardFor(button)
  if (!card || card.querySelector(LOCAL_POPOVER_SELECTOR)) return
  clearTimer(closeTimers, card)
  clearTimer(openTimers, button)
  const timer = window.setTimeout(() => {
    openTimers.delete(button)
    if (button.matches(':hover') || document.activeElement === button) button.click()
  }, OPEN_DELAY)
  openTimers.set(button, timer)
}

function queueClose(card: HTMLElement) {
  clearTimer(closeTimers, card)
  const timer = window.setTimeout(() => {
    closeTimers.delete(card)
    if (!pointerOrFocusInside(card)) closeJournalPopover(card)
  }, CLOSE_DELAY)
  closeTimers.set(card, timer)
}

function annotateJournalUi(root: ParentNode = document) {
  root.querySelectorAll<HTMLButtonElement>(JOURNAL_BUTTON_SELECTOR).forEach(button => {
    button.title = '悬停查看期刊信息；点击也可保持打开'
    button.setAttribute('aria-haspopup', 'dialog')
  })
  root.querySelectorAll<HTMLElement>(JOURNAL_POPOVER_SELECTOR).forEach(overlay => {
    overlay.dataset.journalPopover = 'true'
    overlay.setAttribute('aria-modal', 'false')
    const card = cardFor(overlay)
    const panel = overlay.querySelector<HTMLElement>('.journal-quick-card')
    panel?.setAttribute('aria-label', '期刊信息悬浮卡片')
    if (panel && panel.dataset.hoverRetentionBound !== 'true') {
      panel.dataset.hoverRetentionBound = 'true'
      panel.addEventListener('pointerenter', () => clearTimer(closeTimers, card))
    }
  })
}

document.addEventListener('pointerover', event => {
  const target = event.target as Element | null
  const button = target?.closest<HTMLButtonElement>(JOURNAL_BUTTON_SELECTOR)
  if (button && !button.contains(event.relatedTarget as Node | null)) queueOpen(button)

  const panel = target?.closest<HTMLElement>('.paper-card-v3 .journal-quick-card')
  if (panel) clearTimer(closeTimers, cardFor(panel))
})

document.addEventListener('pointerout', event => {
  const target = event.target as Element | null
  const button = target?.closest<HTMLButtonElement>(JOURNAL_BUTTON_SELECTOR)
  if (button && !button.contains(event.relatedTarget as Node | null)) {
    clearTimer(openTimers, button)
    const card = cardFor(button)
    if (card) queueClose(card)
  }

  const panel = target?.closest<HTMLElement>('.paper-card-v3 .journal-quick-card')
  if (panel && !panel.contains(event.relatedTarget as Node | null)) {
    const card = cardFor(panel)
    if (card) queueClose(card)
  }
})

document.addEventListener('focusin', event => {
  const target = event.target as Element | null
  const button = target?.closest<HTMLButtonElement>(JOURNAL_BUTTON_SELECTOR)
  if (button) queueOpen(button)
  const card = cardFor(target)
  if (card) clearTimer(closeTimers, card)
})

document.addEventListener('focusout', event => {
  const card = cardFor(event.target as Element | null)
  if (card) queueClose(card)
})

document.addEventListener('keydown', event => {
  if (event.key !== 'Escape') return
  const card = cardFor(document.activeElement)
    || document.querySelector<HTMLElement>('.paper-card-v3:has(.journal-quick-overlay)')
  if (card) closeJournalPopover(card)
})

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => annotateJournalUi(), { once: true })
} else {
  annotateJournalUi()
}

new MutationObserver(records => {
  records.forEach(record => record.addedNodes.forEach(node => {
    if (!(node instanceof Element)) return
    annotateJournalUi(node.matches('.paper-card-v3, .journal-quick-overlay') ? node.parentElement || document : node)
  }))
}).observe(document.documentElement, { childList: true, subtree: true })
