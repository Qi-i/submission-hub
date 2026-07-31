const PLATFORM_INPUT_SELECTOR = 'input[list="submission-system-options"]'
const PLATFORM_FIELD_SELECTOR = '.compact-form-modal .compact-field'

function isSubmissionPlatformField(field: Element) {
  if (field.querySelector(PLATFORM_INPUT_SELECTOR)) return true
  const label = field.querySelector(':scope > span')?.textContent?.trim() || ''
  return label === '投稿系统' || label.startsWith('投稿系统（')
}

function simplifySubmissionPlatformFields(root: ParentNode = document) {
  const candidates = new Set<Element>()

  root.querySelectorAll<HTMLInputElement>(PLATFORM_INPUT_SELECTOR).forEach(input => {
    const field = input.closest('.compact-field')
    if (field) candidates.add(field)
  })

  root.querySelectorAll(PLATFORM_FIELD_SELECTOR).forEach(field => {
    if (isSubmissionPlatformField(field)) candidates.add(field)
  })

  candidates.forEach(field => {
    const grid = field.closest<HTMLElement>('.compact-grid')
    grid?.classList.add('submission-system-removed')
    field.remove()
  })

  root.querySelectorAll('#submission-system-options').forEach(node => node.remove())
}

function startSubmissionFormSimplifier() {
  simplifySubmissionPlatformFields()
  const observer = new MutationObserver(records => {
    records.forEach(record => record.addedNodes.forEach(node => {
      if (!(node instanceof Element)) return
      simplifySubmissionPlatformFields(node.matches('.compact-form-modal') ? node : node.parentElement || node)
    }))
  })
  observer.observe(document.body, { childList: true, subtree: true })
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', startSubmissionFormSimplifier, { once: true })
} else {
  startSubmissionFormSimplifier()
}
