const JOURNAL_BUTTON_SELECTOR = '.paper-card-v3 .journal-pill-button'
const JOURNAL_POPOVER_SELECTOR = '.paper-card-v3 .journal-quick-overlay'
const LOCAL_POPOVER_SELECTOR = '.journal-quick-overlay'
const MAIN_NAV_SELECTOR = '.header-tabs button, .tab-bar .tab-btn'
const OPEN_DELAY = 90
const CLOSE_DELAY = 220

const openTimers = new WeakMap<HTMLElement, number>()
const closeTimers = new WeakMap<HTMLElement, number>()

function compactText(value: string | null | undefined) {
  return (value || '').replace(/\s+/g, '').toLocaleLowerCase()
}

function cardFor(element: Element | null) {
  return element?.closest<HTMLElement>('.paper-card-v3') || null
}

function clearTimer(map: WeakMap<HTMLElement, number>, element: HTMLElement | null) {
  if (!element) return
  const timer = map.get(element)
  if (timer !== undefined) window.clearTimeout(timer)
  map.delete(element)
}

function isPinned(card: HTMLElement) {
  return card.dataset.journalPinned === 'true'
}

function setPinned(card: HTMLElement, pinned: boolean) {
  card.dataset.journalPinned = pinned ? 'true' : 'false'
  card.querySelector<HTMLElement>(LOCAL_POPOVER_SELECTOR)?.classList.toggle('is-pinned', pinned)
  if (pinned) clearTimer(closeTimers, card)
}

function closeJournalPopover(card: HTMLElement) {
  const overlay = card.querySelector<HTMLElement>(LOCAL_POPOVER_SELECTOR)
  if (!overlay) return
  setPinned(card, false)
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
  if (isPinned(card)) return
  clearTimer(closeTimers, card)
  const timer = window.setTimeout(() => {
    closeTimers.delete(card)
    if (!isPinned(card) && !pointerOrFocusInside(card)) closeJournalPopover(card)
  }, CLOSE_DELAY)
  closeTimers.set(card, timer)
}

function findButton(selector: string, label: string) {
  const wanted = compactText(label)
  return Array.from(document.querySelectorAll<HTMLButtonElement>(selector))
    .find(button => compactText(button.textContent).includes(wanted))
}

function waitForElement<T extends Element>(resolve: () => T | null, timeout = 3500) {
  return new Promise<T | null>(finish => {
    const immediate = resolve()
    if (immediate) {
      finish(immediate)
      return
    }

    const started = Date.now()
    const observer = new MutationObserver(() => {
      const element = resolve()
      if (element) {
        observer.disconnect()
        finish(element)
      } else if (Date.now() - started > timeout) {
        observer.disconnect()
        finish(null)
      }
    })
    observer.observe(document.body, { childList: true, subtree: true })
    window.setTimeout(() => {
      observer.disconnect()
      finish(resolve())
    }, timeout)
  })
}

function setControlledInputValue(input: HTMLInputElement, value: string) {
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set
  setter?.call(input, value)
  input.dispatchEvent(new Event('input', { bubbles: true }))
  input.dispatchEvent(new Event('change', { bubbles: true }))
}

function matchingJournalCard(journalName: string) {
  const wanted = compactText(journalName)
  const cards = Array.from(document.querySelectorAll<HTMLElement>('.prep-journal-card'))
  return cards.find(card => {
    const name = card.querySelector('h3')?.textContent
    return compactText(name) === wanted
  }) || cards.find(card => compactText(card.querySelector('h3')?.textContent).includes(wanted)) || null
}

async function navigateToJournalLibrary(journalName: string, mode: 'view' | 'edit') {
  document.querySelectorAll<HTMLElement>('.paper-card-v3:has(.journal-quick-overlay)').forEach(closeJournalPopover)

  const preparationButton = findButton(MAIN_NAV_SELECTOR, '投稿准备')
  preparationButton?.click()

  const workspace = await waitForElement(() => document.querySelector<HTMLElement>('.preparation-workspace'))
  if (!workspace) return

  findButton('.preparation-workspace > .prep-nav button, .lx-status-bar[data-page="preparation"] .lx-page-proxy-controls button', '期刊库')?.click()
  await waitForElement(() => document.querySelector<HTMLElement>('.preparation-workspace[data-section="journals"], .preparation-workspace .journal-grid'))

  const search = document.querySelector<HTMLInputElement>('.preparation-workspace .prep-search input')
  if (search) setControlledInputValue(search, journalName)

  const journalCard = await waitForElement(() => matchingJournalCard(journalName))
  if (!journalCard) return

  journalCard.scrollIntoView({ behavior: 'smooth', block: 'center' })
  journalCard.classList.add('journal-library-focus')
  window.setTimeout(() => journalCard.classList.remove('journal-library-focus'), 2600)

  const main = journalCard.querySelector<HTMLButtonElement>('.prep-journal-card-main')
  if (mode === 'edit') {
    window.setTimeout(() => main?.click(), 180)
  } else {
    main?.focus({ preventScroll: true })
  }
}

function addLibraryActions(overlay: HTMLElement) {
  if (overlay.querySelector('.journal-quick-library-actions')) return
  const card = overlay.querySelector<HTMLElement>('.journal-quick-card')
  const links = overlay.querySelector<HTMLElement>('.journal-quick-links')
  const journalName = overlay.querySelector('.journal-quick-head h3')?.textContent?.trim() || ''
  if (!card || !journalName) return

  const actions = document.createElement('div')
  actions.className = 'journal-quick-library-actions'

  const view = document.createElement('button')
  view.type = 'button'
  view.className = 'journal-quick-library-action is-view'
  view.textContent = '在期刊库查看'
  view.title = '进入期刊库，查看完整期刊档案和全部链接'
  view.addEventListener('click', event => {
    event.stopPropagation()
    void navigateToJournalLibrary(journalName, 'view')
  })

  const edit = document.createElement('button')
  edit.type = 'button'
  edit.className = 'journal-quick-library-action is-edit'
  edit.textContent = '编辑期刊信息'
  edit.title = '进入期刊库并直接打开该期刊编辑器'
  edit.addEventListener('click', event => {
    event.stopPropagation()
    void navigateToJournalLibrary(journalName, 'edit')
  })

  actions.append(view, edit)
  if (links) card.insertBefore(actions, links)
  else card.appendChild(actions)
}

function annotateJournalUi(root: ParentNode = document) {
  root.querySelectorAll<HTMLButtonElement>(JOURNAL_BUTTON_SELECTOR).forEach(button => {
    button.title = '悬停预览期刊信息；点击可固定或关闭'
    button.setAttribute('aria-haspopup', 'dialog')
  })
  root.querySelectorAll<HTMLElement>(JOURNAL_POPOVER_SELECTOR).forEach(overlay => {
    overlay.dataset.journalPopover = 'true'
    overlay.setAttribute('aria-modal', 'false')
    const card = cardFor(overlay)
    overlay.classList.toggle('is-pinned', !!card && isPinned(card))
    const panel = overlay.querySelector<HTMLElement>('.journal-quick-card')
    panel?.setAttribute('aria-label', '期刊信息悬浮卡片')
    if (panel && panel.dataset.hoverRetentionBound !== 'true') {
      panel.dataset.hoverRetentionBound = 'true'
      panel.addEventListener('pointerenter', () => clearTimer(closeTimers, card))
    }
    addLibraryActions(overlay)
  })
}

document.addEventListener('click', event => {
  const target = event.target as Element | null
  const journalButton = target?.closest<HTMLButtonElement>(JOURNAL_BUTTON_SELECTOR)
  if (journalButton && event.isTrusted) {
    const card = cardFor(journalButton)
    if (!card) return
    if (isPinned(card)) {
      setPinned(card, false)
      queueMicrotask(() => closeJournalPopover(card))
    } else {
      setPinned(card, true)
    }
    return
  }

  const closeButton = target?.closest<HTMLButtonElement>('.paper-card-v3 .journal-quick-head > button')
  const card = cardFor(closeButton)
  if (card) setPinned(card, false)
}, true)

document.addEventListener('pointerdown', event => {
  const target = event.target as Element | null
  document.querySelectorAll<HTMLElement>('.paper-card-v3[data-journal-pinned="true"]:has(.journal-quick-overlay)').forEach(card => {
    if (target?.closest('.journal-pill-button, .journal-quick-card')) return
    closeJournalPopover(card)
  })
}, true)

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
