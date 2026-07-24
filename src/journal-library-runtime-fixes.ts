import { lookupJournalReviewMetrics } from './lib/journal-review-lookup'

const UNKNOWN_VALUES = new Set(['', '—', '--', '-', '–', 'N/A', 'NA'])

function normalizeText(value?: string | null) {
  return (value || '').replace(/\s+/g, ' ').trim()
}

function scheduleFactory(callback: () => void) {
  let frame = 0
  return () => {
    cancelAnimationFrame(frame)
    frame = requestAnimationFrame(callback)
  }
}

function normalizeHref(value: string) {
  try {
    const url = new URL(value, window.location.href)
    url.hash = ''
    const removable = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content']
    removable.forEach(key => url.searchParams.delete(key))
    return `${url.origin}${url.pathname.replace(/\/$/, '')}${url.search}`.toLocaleLowerCase()
  } catch {
    return value.trim().toLocaleLowerCase()
  }
}

function fixMetricVisibility(card: HTMLElement) {
  const host = card.querySelector<HTMLElement>('.prep-journal-numbers')
  if (!host) return

  const cells = Array.from(host.querySelectorAll<HTMLElement>(':scope > div'))
  cells.forEach(cell => {
    const value = normalizeText(cell.querySelector('b')?.textContent).toLocaleUpperCase()
    const unknown = UNKNOWN_VALUES.has(value)
    cell.hidden = unknown
    cell.toggleAttribute('data-empty', unknown)
  })

  const visibleCount = cells.filter(cell => !cell.hidden).length
  host.hidden = visibleCount === 0
  host.toggleAttribute('data-empty', visibleCount === 0)
}

function fixOverviewUnknownMetrics() {
  document.querySelectorAll<HTMLElement>('.prep-journal-overview-card').forEach(card => {
    card.querySelectorAll<HTMLElement>('.prep-overview-journal-meta > span').forEach(item => {
      if (item.dataset.tone !== 'speed') return
      const text = normalizeText(item.textContent)
      item.hidden = /(?:—|--|–)\s*天/.test(text)
    })
  })
}

function fixJournalTitle(card: HTMLElement) {
  const title = card.querySelector<HTMLElement>('.prep-journal-card-main > h3')
  if (!title) return
  const text = normalizeText(title.textContent)
  title.title = text
  title.classList.toggle('title-long', text.length > 40 && text.length <= 56)
  title.classList.toggle('title-xlong', text.length > 56 && text.length <= 72)
  title.classList.toggle('title-xxlong', text.length > 72)
}

function fixRankChips(card: HTMLElement) {
  const main = card.querySelector<HTMLElement>('.prep-journal-card-main')
  const available = Math.max(180, (main?.clientWidth || card.clientWidth) - 22)
  const seen = new Set<string>()

  card.querySelectorAll<HTMLElement>('.prep-journal-rank-blocks > span').forEach(chip => {
    const text = normalizeText(chip.textContent)
    const token = text.toLocaleUpperCase()
    if (token && seen.has(token)) {
      chip.remove()
      return
    }
    if (token) seen.add(token)
    chip.title = text
    chip.dataset.long = String(chip.scrollWidth > available || text.length > 34)
  })
}

function fixJournalLinks(card: HTMLElement) {
  const host = card.querySelector<HTMLElement>('.prep-journal-links')
  if (!host) return
  const seen = new Set<string>()

  Array.from(host.querySelectorAll<HTMLAnchorElement>('a')).forEach(link => {
    const hrefKey = normalizeHref(link.href)
    const textKey = normalizeText(link.textContent).replace(/[↗\s]+$/g, '').toLocaleUpperCase()
    const key = hrefKey || textKey
    if (key && seen.has(key)) {
      link.remove()
      return
    }
    if (key) seen.add(key)

    if (/api\.crossref\.org\/journals\//i.test(link.href)) {
      link.childNodes.forEach(node => {
        if (node.nodeType === Node.TEXT_NODE) node.textContent = 'Crossref ISSN '
      })
      link.title = 'Crossref ISSN 期刊记录'
    } else if (/crossref/i.test(textKey) && /\/works(?:\?|\/|$)/i.test(link.href)) {
      link.childNodes.forEach(node => {
        if (node.nodeType === Node.TEXT_NODE) node.textContent = 'Crossref DOI '
      })
      link.title = 'Crossref DOI 记录'
    }
  })

  host.hidden = host.children.length === 0
}

function fixJournalCards() {
  document.querySelectorAll<HTMLElement>('.prep-journal-card').forEach(card => {
    fixMetricVisibility(card)
    fixJournalTitle(card)
    fixRankChips(card)
    fixJournalLinks(card)
  })
  fixOverviewUnknownMetrics()
}

function fieldByLabel(root: ParentNode, label: string | RegExp) {
  return Array.from(root.querySelectorAll<HTMLElement>('.prep-field')).find(field => {
    const text = normalizeText(field.querySelector(':scope > span')?.textContent)
    return typeof label === 'string' ? text === label : label.test(text)
  }) || null
}

function inputByLabel(root: ParentNode, label: string | RegExp) {
  return fieldByLabel(root, label)?.querySelector<HTMLInputElement>('input') || null
}

function setNativeInputValue(input: HTMLInputElement | null, value: string) {
  if (!input) return
  const descriptor = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')
  descriptor?.set?.call(input, value)
  input.dispatchEvent(new Event('input', { bubbles: true }))
  input.dispatchEvent(new Event('change', { bubbles: true }))
}

function ensureReviewLookupButton(modal: HTMLElement) {
  const section = modal.querySelector<HTMLElement>('.journal-form-section.public-metrics')
  const header = section?.querySelector<HTMLElement>('.journal-form-section-head')
  if (!section || !header || header.querySelector('.journal-review-lookup-button')) return

  const decision = modal.querySelector<HTMLElement>('.journal-form-section.decision')
  const decisionHint = decision?.querySelector<HTMLElement>('.journal-form-section-head > span')
  if (decisionHint) decisionHint.textContent = '公开页面可自动识别；未获取项再人工核对'

  const apcLabel = fieldByLabel(decision || modal, /APC/)?.querySelector<HTMLElement>(':scope > span')
  if (apcLabel && normalizeText(apcLabel.textContent) !== 'APC') apcLabel.textContent = 'APC'

  const message = document.createElement('small')
  message.className = 'journal-review-lookup-message'
  message.setAttribute('role', 'status')
  message.setAttribute('aria-live', 'polite')
  section.appendChild(message)

  const button = document.createElement('button')
  button.type = 'button'
  button.className = 'btn btn-ghost btn-sm journal-review-lookup-button'
  button.textContent = '获取审稿周期'
  header.appendChild(button)

  button.addEventListener('click', async () => {
    if (button.dataset.loading === 'true') return
    const website = inputByLabel(modal, '期刊官网')
    const guide = inputByLabel(modal, '作者指南')
    const submission = inputByLabel(modal, '投稿系统')
    const reviewSource = inputByLabel(modal, '审稿周期来源')
    const journalName = inputByLabel(modal, '期刊名称')

    button.dataset.loading = 'true'
    button.disabled = true
    button.textContent = '获取中…'
    message.classList.remove('danger')
    message.textContent = '正在读取期刊公开页面并识别首轮决定、总审稿周期和接收率…'

    try {
      const result = await lookupJournalReviewMetrics({
        journalName: journalName?.value,
        websiteUrl: website?.value,
        authorGuideUrl: guide?.value,
        submissionUrl: submission?.value,
        reviewSourceUrl: reviewSource?.value,
      })

      if (result.firstDecisionDays !== null) setNativeInputValue(inputByLabel(modal, /首轮决定/), String(result.firstDecisionDays))
      if (result.totalReviewDays !== null) setNativeInputValue(inputByLabel(modal, /总审稿周期/), String(result.totalReviewDays))
      if (result.acceptanceRate !== null) setNativeInputValue(inputByLabel(modal, /接收率/), String(result.acceptanceRate))
      setNativeInputValue(reviewSource, result.sourceUrl)

      const parts = [
        result.firstDecisionDays !== null ? `首轮 ${result.firstDecisionDays} 天` : '',
        result.totalReviewDays !== null ? `总周期 ${result.totalReviewDays} 天` : '',
        result.acceptanceRate !== null ? `接收率 ${result.acceptanceRate}%` : '',
      ].filter(Boolean)
      message.textContent = `已从公开页面识别：${parts.join('；')}。来源已写入，请保存前核对口径。`
    } catch (error) {
      message.classList.add('danger')
      message.textContent = error instanceof Error ? error.message : '审稿周期自动获取失败。'
    } finally {
      button.dataset.loading = 'false'
      button.disabled = false
      button.textContent = '获取审稿周期'
    }
  })
}

function fixJournalForms() {
  document.querySelectorAll<HTMLElement>('.journal-form-modal').forEach(ensureReviewLookupButton)
}

function enhanceAll() {
  fixJournalCards()
  fixJournalForms()
}

function start() {
  const schedule = scheduleFactory(enhanceAll)
  enhanceAll()
  const observer = new MutationObserver(schedule)
  observer.observe(document.body, { childList: true, subtree: true, characterData: true })
  window.addEventListener('resize', schedule, { passive: true })
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true })
else start()
