const MAIN_NAV_SELECTOR = '.header-tabs, .tab-bar'
const SEARCH_INPUT_SELECTOR = [
  'input[type="search"]',
  '.search-wrap input',
  '.prep-search input',
  'input[placeholder*="搜索"]',
  'input[placeholder*="检索"]',
].join(', ')

let frame = 0

function compactText(value: string | null | undefined) {
  return (value || '').replace(/\s+/g, '')
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

  host.querySelector<HTMLButtonElement>(':scope > .global-search-clear')?.remove()
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

function ensureMainNavKeys(nav: HTMLElement) {
  const mapping = [
    ['投稿准备', 'preparation'],
    ['期刊中心', 'journals'],
    ['投稿管理', 'dashboard'],
    ['个人统计', 'stats'],
    ['后台管理', 'admin'],
  ] as const
  const buttons = Array.from(nav.querySelectorAll<HTMLButtonElement>(':scope > button'))
  for (const [label, key] of mapping) {
    const button = buttons.find(item => compactText(item.textContent).includes(label))
    if (button) button.dataset.mainNavKey = key
  }
}

function enhance() {
  frame = 0
  document.querySelectorAll<HTMLElement>(MAIN_NAV_SELECTOR).forEach(ensureMainNavKeys)
  document.querySelectorAll<HTMLInputElement>(SEARCH_INPUT_SELECTOR).forEach(enhanceSearchInput)
}

function scheduleEnhance() {
  if (frame) return
  frame = window.requestAnimationFrame(enhance)
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', enhance, { once: true })
else enhance()

new MutationObserver(scheduleEnhance).observe(document.documentElement, {
  childList: true,
  subtree: true,
  attributes: true,
  attributeFilter: ['class', 'hidden'],
})
