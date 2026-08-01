const WORKSPACE_SELECTOR = '.preparation-workspace'
let frame = 0

function compact(value: string | null | undefined) {
  return (value || '').replace(/\s+/g, '')
}

function replaceTextNode(root: Element | null, from: string, to: string) {
  if (!root) return
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT)
  let node = walker.nextNode()
  while (node) {
    const value = node.nodeValue || ''
    if (compact(value) === compact(from)) node.nodeValue = value.replace(from, to)
    node = walker.nextNode()
  }
}

function setExactText(element: Element | null, from: string, to: string) {
  if (element && compact(element.textContent) === compact(from)) element.textContent = to
}

function journalTotal(workspace: HTMLElement) {
  const value = workspace.querySelector<HTMLSpanElement>('.prep-nav button[data-tone="journal"] span')?.textContent
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : 0
}

function syncJournalTotals(workspace: HTMLElement, total: number) {
  const pipeline = Array.from(workspace.querySelectorAll<HTMLButtonElement>('.prep-pipeline button'))
    .find(button => compact(button.querySelector('span')?.textContent) === '期刊')
  const pipelineCount = pipeline?.querySelector('b')
  if (pipelineCount) pipelineCount.textContent = String(total)

  const metric = workspace.querySelector<HTMLElement>('.prep-metrics > [data-tone="journal"]')
  const metricCount = metric?.querySelector('b')
  const metricHelper = metric?.querySelector('small')
  if (metricCount) metricCount.textContent = String(total)
  if (metricHelper) metricHelper.textContent = '已记录'
}

function enhanceJournalCards(workspace: HTMLElement) {
  workspace.querySelectorAll<HTMLElement>('.prep-journal-card').forEach(card => {
    const priority = card.querySelector<HTMLElement>('.prep-priority')
    if (priority && compact(priority.textContent) === '未收藏') {
      priority.textContent = '普通记录'
      priority.title = '已收入期刊中心，未设为重点期刊'
    } else if (priority && !priority.textContent?.trim()) {
      priority.title = '重点期刊'
      priority.setAttribute('aria-label', '重点期刊')
    }

    const tags = Array.from(card.querySelectorAll<HTMLElement>('.prep-journal-facts [data-tone="selection"]'))
    const fromHistory = tags.some(tag => compact(tag.textContent) === '投稿历史自动收录')
    card.dataset.catalogSource = fromHistory ? 'submission-history' : 'manual'
  })
}

function enhanceJournalForm() {
  const modal = document.querySelector<HTMLElement>('.journal-form-modal')
  if (!modal) return
  setExactText(modal.querySelector('#journal-form-title'), '收藏期刊', '新增期刊档案')
  modal.querySelectorAll<HTMLElement>('.prep-field > span, .prep-form-grid label > span').forEach(label => {
    setExactText(label, '收藏优先级', '期刊优先级')
  })
  setExactText(modal.querySelector('.prep-switch span'), '加入收藏期刊', '设为重点期刊')
}

function enhanceWorkspace(workspace: HTMLElement) {
  const total = journalTotal(workspace)

  workspace.querySelectorAll<HTMLElement>('.btn-journal-primary').forEach(button => replaceTextNode(button, '收藏期刊', '新增期刊'))
  workspace.querySelectorAll<HTMLElement>('.prep-quick-actions button').forEach(button => replaceTextNode(button, '收藏期刊', '新增期刊'))

  workspace.querySelectorAll<HTMLElement>('.prep-panel-head h2').forEach(title => {
    setExactText(title, '收藏期刊', '期刊档案')
  })
  workspace.querySelectorAll<HTMLElement>('.prep-panel-head p').forEach(subtitle => {
    if (compact(subtitle.textContent).includes('按期刊类型突出主要分区')) {
      subtitle.textContent = '统一展示重点期刊、手动记录与投稿历史自动收录档案'
    }
  })

  workspace.querySelectorAll<HTMLElement>('.prep-empty').forEach(empty => {
    setExactText(empty.querySelector('span'), '尚未收藏期刊', '尚无期刊记录')
    empty.querySelectorAll<HTMLElement>('button').forEach(button => replaceTextNode(button, '收藏期刊', '新增期刊'))
  })

  syncJournalTotals(workspace, total)
  enhanceJournalCards(workspace)
}

function enhance() {
  frame = 0
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
  attributeFilter: ['class', 'data-section'],
})
