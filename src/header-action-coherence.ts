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


function cleanupLegacyPrimaryProxy() {
  document.querySelectorAll('.header-context-primary').forEach(element => element.remove())
  document.querySelectorAll('.header-action-source').forEach(element => element.classList.remove('header-action-source'))
  document.documentElement.classList.remove('header-context-primary-active')
}

function enhance() {
  frame = 0
  enhanceUtilityButtons()
  cleanupLegacyPrimaryProxy()
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
  characterData: true,
  attributes: true,
  attributeFilter: ['class', 'data-section', 'data-ui', 'title'],
})
