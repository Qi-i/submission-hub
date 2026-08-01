const JOURNAL_BUTTON_SELECTOR = '.paper-card-v3 .journal-pill-button'
const JOURNAL_POPOVER_SELECTOR = '.paper-card-v3 .journal-quick-overlay'
const MAIN_NAV_SELECTOR = '.header-tabs button, .tab-bar .tab-btn'

function compactText(value: string | null | undefined) {
  return (value || '').replace(/\s+/g, '').toLocaleLowerCase()
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

    let settled = false
    const finishOnce = (element: T | null) => {
      if (settled) return
      settled = true
      observer.disconnect()
      window.clearTimeout(timeoutId)
      finish(element)
    }
    const observer = new MutationObserver(() => {
      const element = resolve()
      if (element) finishOnce(element)
    })
    const timeoutId = window.setTimeout(() => finishOnce(resolve()), timeout)
    observer.observe(document.body, { childList: true, subtree: true })
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
  return cards.find(card => compactText(card.querySelector('h3')?.textContent) === wanted)
    || cards.find(card => compactText(card.querySelector('h3')?.textContent).includes(wanted))
    || null
}

async function navigateToJournalLibrary(journalName: string, mode: 'view' | 'edit') {
  findButton(MAIN_NAV_SELECTOR, '投稿准备')?.click()

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
  if (mode === 'edit') window.setTimeout(() => main?.click(), 180)
  else main?.focus({ preventScroll: true })
}

function addPinControl(overlay: HTMLElement) {
  if (overlay.querySelector('.journal-quick-pin-button')) return
  const head = overlay.querySelector<HTMLElement>('.journal-quick-head')
  const card = overlay.closest<HTMLElement>('.paper-card-v3')
  const journalButton = card?.querySelector<HTMLButtonElement>('.journal-pill-button')
  if (!head || !journalButton) return

  const tools = document.createElement('div')
  tools.className = 'journal-quick-head-tools'
  const pin = document.createElement('button')
  pin.type = 'button'
  pin.className = 'journal-quick-pin-button'
  pin.textContent = overlay.classList.contains('is-pinned') ? '取消固定' : '固定'
  pin.title = '固定悬浮卡片，移开鼠标后仍保持打开'
  pin.addEventListener('click', event => {
    event.stopPropagation()
    journalButton.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, view: window }))
  })
  tools.appendChild(pin)

  const close = head.querySelector<HTMLButtonElement>(':scope > button')
  close?.classList.add('journal-quick-close')
  if (close) head.insertBefore(tools, close)
  else head.appendChild(tools)
}

function addLibraryActions(overlay: HTMLElement) {
  if (overlay.querySelector('.journal-quick-library-actions')) return
  const popover = overlay.querySelector<HTMLElement>('.journal-quick-card')
  const links = overlay.querySelector<HTMLElement>('.journal-quick-links')
  const journalName = overlay.querySelector('.journal-quick-head h3')?.textContent?.trim() || ''
  if (!popover || !journalName) return

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
  if (links) popover.insertBefore(actions, links)
  else popover.appendChild(actions)
}

function annotateJournalUi(root: ParentNode = document) {
  root.querySelectorAll<HTMLButtonElement>(JOURNAL_BUTTON_SELECTOR).forEach(button => {
    button.title = '悬停预览期刊信息；点击可固定或关闭'
    button.setAttribute('aria-haspopup', 'dialog')
  })
  root.querySelectorAll<HTMLElement>(JOURNAL_POPOVER_SELECTOR).forEach(overlay => {
    overlay.dataset.journalPopover = 'true'
    overlay.setAttribute('aria-modal', 'false')
    overlay.querySelector<HTMLElement>('.journal-quick-card')?.setAttribute('aria-label', '期刊信息悬浮卡片')
    addPinControl(overlay)
    addLibraryActions(overlay)
  })
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => annotateJournalUi(), { once: true })
} else {
  annotateJournalUi()
}

new MutationObserver(records => {
  records.forEach(record => record.addedNodes.forEach(node => {
    if (!(node instanceof Element)) return
    const root = node.matches('.paper-card-v3, .journal-quick-overlay') ? node.parentElement || document : node
    annotateJournalUi(root)
  }))
}).observe(document.documentElement, { childList: true, subtree: true })
