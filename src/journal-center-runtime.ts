const WORKSPACE_SELECTOR = '.preparation-workspace'
const FILTERS = ['all', 'focus', 'submission-history', 'manual'] as const
const OA_SHORT_LABELS: Record<string, string> = {
  订阅制: '订阅',
  混合开放获取: 'Hybrid OA',
  全开放获取: 'Gold OA',
  '钻石开放获取（无APC）': 'Diamond OA',
}

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
  const value = workspace.querySelector<HTMLSpanElement>('.prep-nav button[data-tone="match"] .prep-nav-item__meta')?.textContent
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

function compactOaLabels(workspace: HTMLElement) {
  workspace.querySelectorAll<HTMLElement>('[data-tone="oa"]').forEach(label => {
    const original = compact(label.textContent)
    const shortLabel = OA_SHORT_LABELS[original]
    if (!shortLabel) return
    if (!label.title) label.title = label.textContent?.trim() || original
    setTextIfChanged(label, shortLabel)
  })
}

function classifyJournalCard(card: HTMLElement) {
  const priority = card.querySelector<HTMLElement>('.prep-priority')
  const priorityText = compact(priority?.textContent)
  const isFocus = !!priority?.querySelector('svg') || (!priorityText && !!priority)

  if (priority && priorityText === '未收藏') setTextIfChanged(priority, '普通记录')
  if (priority) {
    priority.title = isFocus ? '重点期刊' : '普通期刊档案'
    priority.setAttribute('aria-label', isFocus ? '重点期刊' : '普通期刊档案')
  }

  const existingSource = card.dataset.catalogSource
  const cardText = compact(card.textContent)
  const tags = Array.from(card.querySelectorAll<HTMLElement>('.prep-journal-facts [data-tone="selection"]'))
  const fromHistory = existingSource === 'submission-history'
    || tags.some(tag => /投稿(?:历史)?自动收录/.test(compact(tag.textContent)))
    || /投稿(?:历史)?自动收录/.test(cardText)
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
    card.classList.toggle('is-catalog-filtered-out', !visible)
    card.setAttribute('aria-hidden', String(!visible))
  })

  document.querySelectorAll<HTMLButtonElement>('.journal-catalog-filter').forEach(button => {
    const active = button.dataset.filter === filter
    button.classList.toggle('active', active)
    button.setAttribute('aria-pressed', String(active))
  })
}

function desiredCatalogHost(workspace: HTMLElement) {
  if (document.documentElement.dataset.ui === 'luminous-x') {
    const statusPage = workspace.classList.contains('journal-center-workspace') ? 'journals' : 'preparation'
    const statusHost = document.querySelector<HTMLElement>(`.lx-status-bar[data-page="${statusPage}"] .lx-status-controls-host`)
    if (statusHost) return statusHost
  }
  return workspace.querySelector<HTMLElement>(':scope > .prep-topbar')
}

function removeLegacyCatalogRows(workspace: HTMLElement) {
  workspace.querySelectorAll<HTMLElement>(':scope > .journal-catalog-toolbar').forEach(element => element.remove())
}

function ensureCatalogFilters(workspace: HTMLElement) {
  const activeSection = workspace.dataset.section === 'match'
  const statusPage = workspace.classList.contains('journal-center-workspace') ? 'journals' : 'preparation'
  const statusBar = document.querySelector<HTMLElement>(`.lx-status-bar[data-page="${statusPage}"]`)
  statusBar?.toggleAttribute('data-journal-center-active', activeSection)

  if (!activeSection) {
    document.querySelectorAll<HTMLElement>('.journal-catalog-top-filters').forEach(element => element.remove())
    workspace.querySelectorAll<HTMLElement>('.prep-journal-card.is-catalog-filtered-out').forEach(card => {
      card.classList.remove('is-catalog-filtered-out')
      card.removeAttribute('aria-hidden')
    })
    removeLegacyCatalogRows(workspace)
    return
  }

  const grid = workspace.querySelector<HTMLElement>('.journal-grid')
  const host = desiredCatalogHost(workspace)
  if (!grid || !host) return

  removeLegacyCatalogRows(workspace)

  const cards = Array.from(grid.querySelectorAll<HTMLElement>('.prep-journal-card'))
  const counts = cards.reduce((result, card) => {
    const classification = classifyJournalCard(card)
    result.all += 1
    if (classification.isFocus) result.focus += 1
    if (classification.source === 'submission-history') result.history += 1
    else result.manual += 1
    return result
  }, { all: 0, focus: 0, history: 0, manual: 0 })

  let filters = document.querySelector<HTMLElement>('.journal-catalog-top-filters')
  if (!filters) {
    filters = document.createElement('div')
    filters.className = 'journal-catalog-top-filters journal-catalog-toolbar'
    filters.setAttribute('role', 'group')
    filters.setAttribute('aria-label', '筛选期刊档案')
    filters.innerHTML = FILTERS.map(filter => (
      `<button type="button" class="journal-catalog-filter" data-filter="${filter}" aria-pressed="false"></button>`
    )).join('')
  }

  if (filters.parentElement !== host) {
    if (host.classList.contains('prep-topbar')) {
      const actions = host.querySelector(':scope > .prep-top-actions')
      host.insertBefore(filters, actions || null)
    } else {
      const proxy = host.querySelector(':scope > .lx-page-proxy-controls')
      host.insertBefore(filters, proxy || host.firstChild)
    }
  }

  const labels: Record<JournalFilter, string> = {
    all: `全部 ${counts.all}`,
    focus: `重点期刊 ${counts.focus}`,
    'submission-history': `投稿自动收录 ${counts.history}`,
    manual: `手动记录 ${counts.manual}`,
  }

  filters.querySelectorAll<HTMLButtonElement>('.journal-catalog-filter').forEach(button => {
    const filter = (button.dataset.filter || 'all') as JournalFilter
    setTextIfChanged(button, labels[filter])
    button.onclick = event => {
      event.preventDefault()
      event.stopPropagation()
      const next = (button.dataset.filter || 'all') as JournalFilter
      applyJournalFilter(workspace, FILTERS.includes(next) ? next : 'all')
    }
  })

  const active = (workspace.dataset.journalCatalogFilter || 'all') as JournalFilter
  applyJournalFilter(workspace, FILTERS.includes(active) ? active : 'all')
}

function enhanceGlobalJournalActions() {
  document.querySelectorAll<HTMLElement>('.btn-journal-primary, .prep-quick-actions button, .prep-empty button').forEach(button => {
    replaceExactTextNodes(button, { 收藏期刊: '新增期刊' })
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
  if (workspace.classList.contains('journal-center-workspace')) {
    compactOaLabels(workspace)
    workspace.querySelectorAll<HTMLElement>('.prep-journal-card').forEach(classifyJournalCard)
    return
  }

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
  compactOaLabels(workspace)
  workspace.querySelectorAll<HTMLElement>('.prep-journal-card').forEach(classifyJournalCard)
  ensureCatalogFilters(workspace)
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
  attributeFilter: ['data-section', 'data-metric', 'data-ui'],
})
