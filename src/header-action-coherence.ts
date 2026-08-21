const DESKTOP_X_QUERY = '(min-width: 981px)'

let frame = 0

function compactText(value: string | null | undefined) {
  return (value || '').replace(/\s+/g, '')
}

function ensureButtonLabel(button: HTMLButtonElement, key: string, label: string) {
  if (button.dataset.utilityKey !== key) button.dataset.utilityKey = key
  button.classList.remove('btn-icon')

  let span = button.querySelector<HTMLSpanElement>(':scope > .header-utility-label')
  if (!span) {
    span = document.createElement('span')
    span.className = 'header-utility-label'
    button.appendChild(span)
  }
  if (span.textContent !== label) span.textContent = label
}

function normalizeExportLabel(button: HTMLButtonElement) {
  if (compactText(button.textContent).includes('处理中')) return
  Array.from(button.childNodes).forEach(node => {
    if (node.nodeType !== Node.TEXT_NODE) return
    const text = compactText(node.textContent)
    if (text === '备份' || text === '导出') node.textContent = ' 导出'
  })
}

function enhanceUtilityButtons() {
  document.querySelectorAll<HTMLElement>('.header-utility-grid').forEach(grid => {
    const buttons = Array.from(grid.querySelectorAll<HTMLButtonElement>(':scope > button'))

    buttons.forEach(button => {
      const label = compactText(button.textContent)
      const title = compactText(button.title)

      if (button.classList.contains('theme-toggle-btn')) {
        ensureButtonLabel(button, 'theme', '主题')
      } else if (title.includes('个人设置') || title.includes('设置署名')) {
        ensureButtonLabel(button, 'settings', '设置')
      } else if (label.includes('导入')) {
        button.dataset.utilityKey = 'import'
      } else if (label.includes('备份') || label.includes('导出') || label.includes('处理中')) {
        button.dataset.utilityKey = 'export'
        normalizeExportLabel(button)
      }
    })
  })

  document.querySelectorAll<HTMLButtonElement>('.header-user button[title="退出"]').forEach(button => {
    button.classList.remove('btn-icon')
    let span = button.querySelector<HTMLSpanElement>(':scope > .header-logout-label')
    if (!span) {
      span = document.createElement('span')
      span.className = 'header-logout-label'
      span.textContent = '退出'
      button.appendChild(span)
    }
  })
}

type PrimaryAction = {
  source: HTMLButtonElement
  label: string
  title: string
}

function preparationPrimaryAction(): PrimaryAction | null {
  const workspace = document.querySelector<HTMLElement>('.preparation-workspace')
  if (!workspace) return null

  const section = workspace.dataset.section || 'overview'
  const actionHost = workspace.querySelector<HTMLElement>('.prep-top-actions')
    || document.querySelector<HTMLElement>('.prep-top-actions-portal')
  if (!actionHost) return null

  if (section === 'journals' || section === 'compare' || section === 'match') {
    const source = actionHost.querySelector<HTMLButtonElement>('.btn-journal-primary')
    return source ? { source, label: '新增期刊', title: '新增期刊档案' } : null
  }

  const source = actionHost.querySelector<HTMLButtonElement>('.btn-context-new')
  if (!source) return null
  if (section === 'topics') return { source, label: '新增选题', title: '新增研究选题' }
  return { source, label: '新建草稿', title: '新建论文草稿' }
}

function clearPreparationActionSource(except?: HTMLButtonElement) {
  document.querySelectorAll<HTMLButtonElement>('.prep-top-actions .header-action-source, .prep-top-actions-portal .header-action-source')
    .forEach(button => {
      if (button !== except) button.classList.remove('header-action-source')
    })
}

function syncProxyContent(proxy: HTMLButtonElement, action: PrimaryAction) {
  const iconMarkup = action.source.querySelector('svg')?.outerHTML || ''
  const contentKey = `${action.label}|${iconMarkup}`
  if (proxy.dataset.contentKey === contentKey) return

  const icon = action.source.querySelector('svg')?.cloneNode(true)
  proxy.replaceChildren()
  if (icon) proxy.appendChild(icon)
  const label = document.createElement('span')
  label.textContent = action.label
  proxy.appendChild(label)
  proxy.dataset.contentKey = contentKey
}

function syncPrimaryAction() {
  const root = document.documentElement
  const isDesktopX = root.dataset.ui === 'luminous-x' && window.matchMedia(DESKTOP_X_QUERY).matches
  const stack = document.querySelector<HTMLElement>('.header-utility-stack')
  const existingProxy = document.querySelector<HTMLButtonElement>('.header-context-primary')
  const nativeDashboardAction = stack?.querySelector<HTMLButtonElement>(':scope > .lx-new-paper')

  if (nativeDashboardAction && nativeDashboardAction.dataset.headerPrimaryAction !== 'true') {
    nativeDashboardAction.dataset.headerPrimaryAction = 'true'
  }

  if (!isDesktopX || !stack || nativeDashboardAction) {
    existingProxy?.remove()
    clearPreparationActionSource()
    root.classList.remove('header-context-primary-active')
    return
  }

  const action = preparationPrimaryAction()
  if (!action) {
    existingProxy?.remove()
    clearPreparationActionSource()
    root.classList.remove('header-context-primary-active')
    return
  }

  clearPreparationActionSource(action.source)
  action.source.classList.add('header-action-source')

  const proxy = existingProxy || document.createElement('button')
  if (!existingProxy) {
    proxy.type = 'button'
    proxy.className = 'btn btn-primary btn-sm header-context-primary'
    proxy.dataset.headerPrimaryAction = 'true'
  }
  if (proxy.title !== action.title) proxy.title = action.title
  if (proxy.getAttribute('aria-label') !== action.label) proxy.setAttribute('aria-label', action.label)
  syncProxyContent(proxy, action)
  proxy.onclick = event => {
    event.preventDefault()
    preparationPrimaryAction()?.source.click()
  }

  if (!proxy.isConnected || proxy.parentElement !== stack) stack.prepend(proxy)
  root.classList.add('header-context-primary-active')
}

function enhance() {
  frame = 0
  enhanceUtilityButtons()
  syncPrimaryAction()
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

window.matchMedia(DESKTOP_X_QUERY).addEventListener('change', scheduleEnhance)
new MutationObserver(scheduleEnhance).observe(document.documentElement, {
  childList: true,
  subtree: true,
  characterData: true,
  attributes: true,
  attributeFilter: ['class', 'data-section', 'data-ui', 'title'],
})
