const WORKSPACE_SELECTOR = '.preparation-workspace'
const FILTERS = ['all', 'focus', 'submission-history', 'manual'] as const

type JournalFilter = typeof FILTERS[number]

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
  if (Number.isFinite(parsed)) return parsed
  return workspace.querySelectorAll('.prep-journal-card').length
}

function syncJournalTotals(workspace: HTMLElement, total: number) {
  const pipeline = Array.from(workspace.querySelectorAll<HTMLButtonElement>('.prep-pipeline button'))
    .find(button => compact(button.querySelector('span')?.textContent) === '期刊')
  setTextIfChanged(pipeline?.querySelector('b'), String(total))

  const metric = workspace.querySelector<HTMLElement>('.prep-metrics > [data-tone="journal"]')
  setTextIfChanged(metric?.querySelector('b'), String(total))
  setTextIfChanged(metric?.querySelector('small'), '档案总数')
}

function classifyJournalCard(card: HTMLElement) {
  const priority = card.querySelector<HTMLElement>('.prep-priority')
  const priorityText = compact(priority?.textContent)
  const isFocus = !!priority?.querySelector('svg') || (!priorityText && !!priority)

  if (priority && priorityText === '未收藏') {
    setTextIfChanged(priority, '普通记录')
  }
  if (priority) {
    priority.title = isFocus ? '重点期刊' : '普通期刊档案'
    priority.setAttribute('aria-label', isFocus ? '重点期刊' : '普通期刊档案')
  }

  const tags = Array.from(card.querySelectorAll<HTMLElement>('.prep-journal-facts [data-tone="selection"]'))
  const fromHistory = tags.some(tag => compact(tag.textContent) === '投稿历史自动收录')
  const source = fromHistory ? 'submission-history' : 'manual'
  card.dataset.catalogSource = source
  card.dataset.catalogPriority = isFocus ? 'focus' : 'ordinary'

  const facts = card.querySelector<HTMLElement>('.prep-journal-facts')
  const apc = card.querySelector<HTMLElement>('[data-metric="apc"]')
  if (facts && apc && apc.parentElement !== facts) facts.appendChild(apc)

  return { source, isFocus }
}

function applyJournalFilter(workspace: HTMLElement, filter: JournalFilter) {
  workspace.dataset.journalCatalogFilter = filter
  workspace.querySelectorAll<HTMLElement>('.prep-journal-card').forEach(card => {
    const visible = filter === 'all'
      || (filter === 'focus' && card.dataset.catalogPriority === 'focus')
      || (filter === 'submission-history' && card.dataset.catalogSource === 'submission-history')
      || (filter === 'manual' && card.dataset.catalogSource === 'manual')
    card.hidden = !visible
  })

  workspace.querySelectorAll<HTMLButtonElement>('.journal-catalog-filter').forEach(button => {
    const active = button.dataset.filter === filter
    button.classList.toggle('active', active)
    button.setAttribute('aria-pressed', String(active))
  })
}

function ensureCatalogToolbar(workspace: HTMLElement) {
  if (workspace.dataset.section !== 'journals') return
  const grid = workspace.querySelector<HTMLElement>('.journal-grid')
  if (!grid) return

  const cards = Array.from(grid.querySelectorAll<HTMLElement>('.prep-journal-card'))
  const counts = cards.reduce((result, card) => {
    const classification = classifyJournalCard(card)
    result.all += 1
    if (classification.isFocus) result.focus += 1
    if (classification.source === 'submission-history') result.history += 1
    else result.manual += 1
    return result
  }, { all: 0, focus: 0, history: 0, manual: 0 })

  let toolbar = workspace.querySelector<HTMLElement>(':scope > .journal-catalog-toolbar')
  if (!toolbar) {
    toolbar = document.createElement('section')
    toolbar.className = 'journal-catalog-toolbar'
    toolbar.setAttribute('aria-label', '期刊中心分类筛选')
    toolbar.innerHTML = `
      <div class="journal-catalog-toolbar-copy">
        <span>JOURNAL CATALOG</span>
        <strong>全部期刊档案</strong>
        <p>同时包含重点期刊、手动记录与投稿历史自动收录记录。</p>
      </div>
      <div class="journal-catalog-filters" role="group" aria-label="筛选期刊档案">
        <button type="button" class="journal-catalog-filter" data-filter="all"></button>
        <button type="button" class="journal-catalog-filter" data-filter="focus"></button>
        <button type="button" class="journal-catalog-filter" data-filter="submission-history"></button>
        <button type="button" class="journal-catalog-filter" data-filter="manual"></button>
      </div>
    `
    grid.before(toolbar)
    toolbar.querySelectorAll<HTMLButtonElement>('.journal-catalog-filter').forEach(button => {
      button.addEventListener('click', () => {
        const next = (button.dataset.filter || 'all') as JournalFilter
        applyJournalFilter(workspace, FILTERS.includes(next) ? next : 'all')
      })
    })
  }

  const labels: Record<JournalFilter, string> = {
    all: `全部 ${counts.all}`,
    focus: `重点期刊 ${counts.focus}`,
    'submission-history': `投稿自动收录 ${counts.history}`,
    manual: `手动记录 ${counts.manual}`,
  }
  toolbar.querySelectorAll<HTMLButtonElement>('.journal-catalog-filter').forEach(button => {
    const filter = (button.dataset.filter || 'all') as JournalFilter
    setTextIfChanged(button, labels[filter])
  })

  const active = (workspace.dataset.journalCatalogFilter || 'all') as JournalFilter
  applyJournalFilter(workspace, FILTERS.includes(active) ? active : 'all')
}

function enhanceGlobalJournalActions() {
  document.querySelectorAll<HTMLElement>('.btn-journal-primary, .prep-quick-actions button, .prep-empty button').forEach(button => {
    replaceExactTextNodes(button, {
      收藏期刊: '新增期刊',
    })
    if (compact(button.textContent).includes('新增期刊')) {
      button.title = '新增一条期刊档案，可选择是否设为重点期刊'
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

function enhanceOverviewGuidance(workspace: HTMLElement, total: number) {
  const nextCard = workspace.querySelector<HTMLElement>('.prep-dashboard-next-card')
  if (!nextCard) return
  const title = nextCard.querySelector<HTMLElement>('h3')
  const detail = nextCard.querySelector<HTMLElement>('p')
  const action = nextCard.querySelector<HTMLElement>('.prep-next-primary')

  if (total > 0 && compact(title?.textContent) === '建立目标期刊库') {
    setTextIfChanged(title, '完善期刊档案')
    setTextIfChanged(detail, '已有期刊记录，可补充分区、收录、费用、审稿周期，并将常用期刊设为重点期刊。')
    replaceExactTextNodes(action || nextCard, { 收藏期刊: '完善档案' })
  } else if (total === 0) {
    setExactText(title, '建立目标期刊库', '建立首条期刊档案')
    if (detail && compact(detail.textContent).includes('收藏目标期刊')) {
      setTextIfChanged(detail, '新增期刊档案并补充分区、收录、费用和审稿周期；正式投稿后也会自动简易入库。')
    }
  }
}

function enhanceWorkspace(workspace: HTMLElement) {
  const total = journalTotal(workspace)

  workspace.querySelectorAll<HTMLElement>('.prep-panel-head h2').forEach(title => {
    setExactText(title, '收藏期刊', '期刊档案')
  })
  workspace.querySelectorAll<HTMLElement>('.prep-panel-head p').forEach(subtitle => {
    if (compact(subtitle.textContent).includes('按期刊类型突出主要分区')) {
      setTextIfChanged(subtitle, '展示重点期刊、手动记录与投稿自动收录档案')
    }
  })
  workspace.querySelectorAll<HTMLElement>('.prep-empty').forEach(empty => {
    setExactText(empty.querySelector('span'), '尚未收藏期刊', '尚无期刊档案')
  })

  replaceExactTextNodes(workspace, {
    收藏期刊: '新增期刊',
    尚未收藏期刊: '尚无期刊档案',
    已收藏: '档案总数',
  })

  syncJournalTotals(workspace, total)
  enhanceOverviewGuidance(workspace, total)
  workspace.querySelectorAll<HTMLElement>('.prep-journal-card').forEach(classifyJournalCard)
  ensureCatalogToolbar(workspace)
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
  attributeFilter: ['class', 'data-section', 'data-metric'],
})
