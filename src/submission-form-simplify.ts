const PLATFORM_INPUT_SELECTOR = 'input[list="submission-system-options"]'

function simplifySubmissionPlatformFields(root: ParentNode = document) {
  root.querySelectorAll<HTMLInputElement>(PLATFORM_INPUT_SELECTOR).forEach(input => {
    const field = input.closest<HTMLElement>('.compact-field')
    if (!field || field.dataset.platformFieldRemoved === 'true') return
    field.dataset.platformFieldRemoved = 'true'
    field.hidden = true
    field.setAttribute('aria-hidden', 'true')
    field.closest<HTMLElement>('.compact-grid')?.classList.add('submission-system-removed')
  })
}

function startSubmissionFormSimplifier() {
  simplifySubmissionPlatformFields()
  const observer = new MutationObserver(records => {
    records.forEach(record => record.addedNodes.forEach(node => {
      if (!(node instanceof Element)) return
      if (node.matches(PLATFORM_INPUT_SELECTOR)) simplifySubmissionPlatformFields(node.parentElement || document)
      else simplifySubmissionPlatformFields(node)
    }))
  })
  observer.observe(document.body, { childList: true, subtree: true })
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', startSubmissionFormSimplifier, { once: true })
} else {
  startSubmissionFormSimplifier()
}
