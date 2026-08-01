const WORKSPACE_SELECTOR = '.preparation-workspace'
let frame = 0

function compact(value: string | null | undefined) {
  return (value || '').replace(/\s+/g, '')
}

function setTextIfChanged(element: Element | null | undefined, value: string) {
  if (element && element.textContent !== value) element.textContent = value
}

function replaceExactTextNodes(root: Element | Document, replacements: Record<string, string>) {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT)
  let node = walker.nextNode()
  while (node) {
    const value = node.nodeValue || ''
    const replacement = replacements[compact(value)]
    if (replacement && value !== replacement) node.nodeValue = replacement
    node = walker.nextNode()
  }
}

function setExactText(element: Element | null, from: string, to: string) {
  if (element && compact(element.textContent) === compact(from)) setTextIfChanged(element, to)
}

function journalTotal(workspace: HTMLElement) {
  const value = workspace.querySelector<HTMLSpanElement>('.prep-nav button[data-tone="journal"] span')?.textContent
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : 0
}

function syncJournalTotals(workspace: HTMLElement, total: number) {
  const pipeline = Array.from(workspace.querySelectorAll<HTMLButtonElement>('.prep-pipeline button'))
    .find(button => compact(button.querySelector('span')?.textContent) === '期刊')
  setTextIfChanged(pipeline?.querySelector('b'), String(total))

  const metric = workspace.querySelector<HTMLElement>('.prep-metrics > [data-tone="journal"]')
  setTextIfChanged(metric?.querySelector('b'), String(total))
  setTextIfChanged(metric?.querySelector('small'), '已记录')
}

function enhanceJournalCards(workspace: HTMLElement) {
  workspace.querySelectorAll<HTMLElement>('.prep-journal-card').forEach(card => {
    const priority = card.querySelector<HTMLElement>('.prep-priority')
    if (priority && compact(priority.textContent) === '未收藏') {
      setTextIfChanged(priority, '普通记录')
      priority.title = '已收入期刊中心，未设为重点期刊'
    } else if (priority && !priority.textContent?.trim()) {
      priority.title = '重点期刊'
      priority.setAttribute('aria-label', '重点期刊')
    }

    const facts = card.querySelector<HTMLElement>('.prep-journal-facts')
    const apc = card.querySelector<HTMLElement>('[data-metric="apc"]')
    if (facts && apc && apc.parentElement !== facts) facts.appendChild(apc)

    const tags = Array.from(card.querySelectorAll<HTMLElement>('.prep-journal-facts [data-tone="selection"]'))
    const fromHistory = tags.some(tag => compact(tag.textContent) === '投稿历史自动收录')
    const source = fromHistory ? 'submission-history' : 'manual'
    if (card.dataset.catalogSource !== source) card.dataset.catalogSource = source
  })
}

function enhanceGlobalJournalActions() {
  document.querySelectorAll<HTMLElement>('.btn-journal-primary, .prep-quick-actions button, .prep-empty button').forEach(button => {
    replaceExactTextNodes(button, {
      收藏期刊: '新增期刊',
    })
    if (compact(button.textContent).includes('新增期刊')) {
      button.title = button.title || '新增一条期刊档案，可选择是否设为重点期刊'
      button.setAttribute('aria-label', '新增期刊')
    }
  })
}

function enhanceJournalForm() {
  document.querySelectorAll<HTMLElement>('.journal-form-modal').forEach(modal => {
    setExactText(modal.querySelector('#journal-form-title'), '收藏期刊', '新增期刊档案')
    modal.querySelectorAll<HTMLElement>('.prep-field > span, .prep-form-grid label > span').forEach(label => {
      setExactText(label, '收藏优先级', '期刊优先级')
    })
    setExactText(modal.querySelector('.prep-switch span'), '加入收藏期刊', '设为重点期刊')
  })
}

function enhanceWorkspace(workspace: HTMLElement) {
  const total = journalTotal(workspace)

  workspace.querySelectorAll<HTMLElement>('.prep-panel-head h2').forEach(title => {
    setExactText(title, '收藏期刊', '期刊档案')
  })
  workspace.querySelectorAll<HTMLElement>('.prep-panel-head p').forEach(subtitle => {
    if (compact(subtitle.textContent).includes('按期刊类型突出主要分区')) {
      setTextIfChanged(subtitle, '统一展示重点期刊、手动记录与投稿历史自动收录档案')
    }
  })

  workspace.querySelectorAll<HTMLElement>('.prep-empty').forEach(empty => {
    setExactText(empty.querySelector('span'), '尚未收藏期刊', '尚无期刊记录')
  })

  replaceExactTextNodes(workspace, {
    收藏期刊: '新增期刊',
    尚未收藏期刊: '尚无期刊记录',
    已收藏: '已记录',
  })

  syncJournalTotals(workspace, total)
  enhanceJournalCards(workspace)
}

function enhance() {
  frame = 0
  enhanceGlobalJournalActions()
  document.querySelectorAll<HTMLElement>(WORKSPACE_SELECTOR).forEach(enhanceWorkspace)
  enhanceJournalForm()
}

function schedule() {
  if (frame) return
  frame = window.requestAnimationFrame(enhance)
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', enhance, { once: true })
else enhance()

new MutationObserver(schedule).observe(document.documentElement, {
  childList: true,
  subtree: true,
  characterData: true,
  attributes: true,
  attributeFilter: ['class', 'data-section', 'data-metric', 'hidden'],
})
