const URL_FIELD_LABELS = new Set([
  '投稿后台 URL',
  '期刊官网 / 作者指南',
  '见刊 / 在线发表 URL',
])

function normalizedOpenUrl(value: string) {
  const text = value.trim()
  if (!text) return ''
  if (/^https?:\/\//i.test(text)) return text
  if (/^[\w.-]+\.[a-z]{2,}(?:[\/:?#].*)?$/i.test(text)) return `https://${text}`
  return ''
}

function directChild<T extends Element>(element: Element, selector: string) {
  return Array.from(element.children).find(child => child.matches(selector)) as T | undefined
}

function enhanceUrlField(field: HTMLElement) {
  const label = directChild<HTMLSpanElement>(field, 'span')?.textContent?.trim() || ''
  if (!URL_FIELD_LABELS.has(label)) return
  const input = directChild<HTMLInputElement>(field, 'input')
  if (!input) return

  field.classList.add('compact-url-field')
  let link = directChild<HTMLAnchorElement>(field, 'a.compact-url-open')
  if (!link) {
    link = document.createElement('a')
    link.className = 'btn btn-ghost btn-sm compact-url-open'
    link.target = '_blank'
    link.rel = 'noopener noreferrer'
    link.textContent = '打开 ↗'
    link.addEventListener('click', event => {
      if (link?.getAttribute('aria-disabled') === 'true') event.preventDefault()
      event.stopPropagation()
    })
    field.appendChild(link)
  }

  const sync = () => {
    const href = normalizedOpenUrl(input.value)
    if (href) {
      link!.href = href
      link!.setAttribute('aria-disabled', 'false')
      link!.title = `在新标签页打开：${href}`
    } else {
      link!.removeAttribute('href')
      link!.setAttribute('aria-disabled', 'true')
      link!.title = '填写有效网址后即可打开'
    }
  }

  if (input.dataset.openUrlBound !== 'true') {
    input.dataset.openUrlBound = 'true'
    input.addEventListener('input', sync)
    input.addEventListener('change', sync)
  }
  sync()
}

function enhanceWorkflowGrid(modal: Element) {
  modal.querySelectorAll<HTMLElement>('.compact-grid.four').forEach(grid => {
    const labels = Array.from(grid.querySelectorAll<HTMLElement>(':scope > .compact-field > span')).map(item => item.textContent?.trim())
    if (labels.includes('返修轮次') && labels.includes('APC / 币种')) grid.classList.add('compact-paper-workflow-grid')
  })
}

function removeSubmissionPlatformField(modal: Element) {
  modal.querySelectorAll<HTMLElement>('.compact-field').forEach(field => {
    const label = directChild<HTMLSpanElement>(field, 'span')?.textContent?.trim() || ''
    const input = directChild<HTMLInputElement>(field, 'input')
    const isPlatformField = label === '投稿系统' || label.startsWith('投稿系统（') || input?.getAttribute('list') === 'submission-system-options'
    if (!isPlatformField) return
    field.closest<HTMLElement>('.compact-grid')?.classList.add('submission-system-removed')
    field.remove()
  })
  modal.querySelectorAll('#submission-system-options').forEach(node => node.remove())
}

function annotateInternalManuscriptNumber(modal: Element) {
  modal.querySelectorAll<HTMLElement>('.compact-field').forEach(field => {
    const label = directChild<HTMLSpanElement>(field, 'span')
    if (!label || label.dataset.internalManuscriptHint === 'true' || label.textContent?.trim() !== '稿件编号') return
    label.dataset.internalManuscriptHint = 'true'
    label.textContent = '稿件编号（仅用于检索与往来邮件，不在卡片外显）'
  })
}

function enhancePaperForms() {
  document.querySelectorAll('.compact-form-modal').forEach(modal => {
    removeSubmissionPlatformField(modal)
    annotateInternalManuscriptNumber(modal)
    enhanceWorkflowGrid(modal)
    modal.querySelectorAll<HTMLElement>('.compact-field').forEach(enhanceUrlField)
  })
}

let queued = false
function scheduleEnhance() {
  if (queued) return
  queued = true
  queueMicrotask(() => {
    queued = false
    enhancePaperForms()
  })
}

if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', scheduleEnhance, { once: true })
  else scheduleEnhance()
  new MutationObserver(scheduleEnhance).observe(document.documentElement, { childList: true, subtree: true })
}
