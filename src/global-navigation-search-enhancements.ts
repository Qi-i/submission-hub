const MAIN_NAV_SELECTOR = '.header-tabs, .tab-bar'
const SEARCH_INPUT_SELECTOR = [
  'input[type="search"]',
  '.search-wrap input',
  '.prep-search input',
  'input[placeholder*="搜索"]',
  'input[placeholder*="检索"]',
].join(', ')

type PreparationSection = 'overview' | 'journals'

let frame = 0
let openingJournalCenter = false

function compactText(value: string | null | undefined) {
  return (value || '').replace(/\s+/g, '')
}

function setText(element: HTMLElement | null | undefined, value: string) {
  if (element && element.textContent !== value) element.textContent = value
}

function buttonByLabel(nav: Element, label: string) {
  const wanted = compactText(label)
  return Array.from(nav.querySelectorAll<HTMLButtonElement>(':scope > button'))
    .find(button => compactText(button.textContent).includes(wanted)) || null
}

function journalIcon() {
  return '<svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2Z"/><path d="M8 7h8"/><path d="M8 11h6"/></svg>'
}

function setNativeInputValue(input: HTMLInputElement, value: string) {
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set
  if (setter) setter.call(input, value)
  else input.value = value
  input.dispatchEvent(new Event('input', { bubbles: true }))
  input.dispatchEvent(new Event('change', { bubbles: true }))
}

function syncClearButton(input: HTMLInputElement, button: HTMLButtonElement) {
  const hasValue = input.value.length > 0
  button.hidden = !hasValue
  button.setAttribute('aria-hidden', String(!hasValue))
  button.tabIndex = hasValue ? 0 : -1
}

function enhanceSearchInput(input: HTMLInputElement) {
  if (input.dataset.globalSearchClear === 'true' || input.disabled || input.readOnly) return
  const host = input.parentElement
  if (!host) return

  input.dataset.globalSearchClear = 'true'
  input.classList.add('has-global-search-clear')
  host.classList.add('global-search-clear-host')

  const previousButton = host.querySelector<HTMLButtonElement>(':scope > .global-search-clear')
  previousButton?.remove()

  const button = document.createElement('button')
  button.type = 'button'
  button.className = 'global-search-clear'
  button.title = '清空搜索'
  button.setAttribute('aria-label', '清空搜索内容')
  button.textContent = '×'

  const sync = () => syncClearButton(input, button)
  input.addEventListener('input', sync)
  input.addEventListener('change', sync)
  button.addEventListener('pointerdown', event => event.preventDefault())
  button.addEventListener('click', event => {
    event.preventDefault()
    event.stopPropagation()
    setNativeInputValue(input, '')
    input.focus({ preventScroll: true })
    sync()
  })

  host.appendChild(button)
  sync()
}

function markInternalJournalRoute(button: HTMLButtonElement | null) {
  if (!button) return
  button.dataset.journalCenterInternal = 'true'
  button.setAttribute('aria-hidden', 'true')
  button.tabIndex = -1
}

function hideDuplicateJournalEntries() {
  const workspaceNav = document.querySelector<HTMLElement>('.preparation-workspace > .prep-nav')
  markInternalJournalRoute(workspaceNav ? buttonByLabel(workspaceNav, '期刊库') : null)

  document.querySelectorAll<HTMLElement>('.lx-status-bar[data-page="preparation"] .lx-page-proxy-controls').forEach(nav => {
    markInternalJournalRoute(buttonByLabel(nav, '期刊库'))
  })
}

function clickPreparationSection(section: PreparationSection) {
  const targetLabel = section === 'journals' ? '期刊库' : '总览'
  let attempts = 0

  const apply = () => {
    attempts += 1
    const workspace = document.querySelector<HTMLElement>('.preparation-workspace')
    const nav = workspace?.querySelector<HTMLElement>(':scope > .prep-nav')
    const button = nav ? buttonByLabel(nav, targetLabel) : null
    if (workspace && button) {
      if (!button.classList.contains('active')) button.click()
      scheduleEnhance()
      if (workspace.dataset.section === section || attempts >= 12) return
    }
    if (attempts < 12) window.setTimeout(apply, attempts < 4 ? 30 : 90)
  }

  window.setTimeout(apply, 0)
}

function ensureJournalCenterButton(nav: HTMLElement) {
  const preparation = buttonByLabel(nav, '投稿准备')
  const dashboard = buttonByLabel(nav, '投稿管理')
  const stats = buttonByLabel(nav, '个人统计')
  const admin = buttonByLabel(nav, '后台管理')
  if (!preparation || !dashboard || !stats) return

  dashboard.dataset.mainNavKey = 'dashboard'
  preparation.dataset.mainNavKey = 'preparation'
  stats.dataset.mainNavKey = 'stats'
  if (admin) admin.dataset.mainNavKey = 'admin'

  let journal = nav.querySelector<HTMLButtonElement>(':scope > button[data-main-nav-key="journals"]')
  if (!journal) {
    journal = document.createElement('button')
    journal.type = 'button'
    journal.dataset.mainNavKey = 'journals'
    journal.dataset.tone = 'journal-center'
    journal.className = preparation.className.replace(/\bactive\b/g, '').trim()
    journal.innerHTML = `${journalIcon()} 期刊中心`
    journal.title = '进入期刊中心，管理、检索与比较期刊'
    journal.setAttribute('aria-label', '期刊中心')
    journal.addEventListener('click', event => {
      event.preventDefault()
      event.stopPropagation()
      openingJournalCenter = true
      preparation.click()
      openingJournalCenter = false
      clickPreparationSection('journals')
    })
    nav.appendChild(journal)
  }

  if (preparation.dataset.journalCenterBound !== 'true') {
    preparation.dataset.journalCenterBound = 'true'
    preparation.addEventListener('click', event => {
      if (openingJournalCenter || !event.isTrusted) return
      clickPreparationSection('overview')
    }, true)
  }
}

function syncNavigationState(nav: HTMLElement) {
  const preparation = nav.querySelector<HTMLButtonElement>(':scope > button[data-main-nav-key="preparation"]')
  const journal = nav.querySelector<HTMLButtonElement>(':scope > button[data-main-nav-key="journals"]')
  if (!preparation || !journal) return

  const workspace = document.querySelector<HTMLElement>('.preparation-workspace')
  const journalSection = !!workspace && ['journals', 'compare'].includes(workspace.dataset.section || '')

  if (workspace) {
    preparation.classList.toggle('active', !journalSection)
    journal.classList.toggle('active', journalSection)
    preparation.setAttribute('aria-current', journalSection ? 'false' : 'page')
    journal.setAttribute('aria-current', journalSection ? 'page' : 'false')
  } else {
    journal.classList.remove('active')
    journal.setAttribute('aria-current', 'false')
  }

  const heading = workspace?.querySelector<HTMLElement>('.prep-heading')
  const title = heading?.querySelector<HTMLElement>('h1')
  const eyebrow = heading?.querySelector<HTMLElement>('.prep-eyebrow')
  const description = heading?.querySelector<HTMLElement>('p')
  if (title && eyebrow && description) {
    if (journalSection) {
      setText(eyebrow, 'JOURNAL INTELLIGENCE CENTER')
      setText(title, '期刊中心')
      setText(description, '集中管理期刊档案、投稿入口、评价指标与期刊比较。')
    } else {
      setText(eyebrow, 'PRE-SUBMISSION WORKSPACE')
      setText(title, '投稿准备')
      setText(description, '把选题、草稿与目标期刊组织成一条清晰的投稿前流程。')
    }
  }

  const statusBar = document.querySelector<HTMLElement>('.lx-status-bar[data-page="preparation"]')
  const statusTitle = statusBar?.querySelector<HTMLElement>('.lx-status-core strong')
  const statusDescription = statusBar?.querySelector<HTMLElement>('.lx-status-core p')
  if (statusTitle && statusDescription) {
    setText(statusTitle, journalSection ? '期刊中心' : '投稿准备')
    setText(statusDescription, journalSection
      ? '集中管理期刊档案、投稿入口、评价指标与期刊比较。'
      : '组织选题、论文草稿和目标期刊，形成清晰的投稿前流程。')
  }
}

function enhance() {
  frame = 0
  document.querySelectorAll<HTMLElement>(MAIN_NAV_SELECTOR).forEach(nav => {
    ensureJournalCenterButton(nav)
    syncNavigationState(nav)
  })
  hideDuplicateJournalEntries()
  document.querySelectorAll<HTMLInputElement>(SEARCH_INPUT_SELECTOR).forEach(enhanceSearchInput)
}

function scheduleEnhance() {
  if (frame) return
  frame = window.requestAnimationFrame(enhance)
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', enhance, { once: true })
} else {
  enhance()
}

new MutationObserver(scheduleEnhance).observe(document.documentElement, {
  childList: true,
  subtree: true,
  attributes: true,
  attributeFilter: ['class', 'data-section'],
})
