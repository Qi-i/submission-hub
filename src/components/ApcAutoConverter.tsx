import { useEffect } from 'react'
import { convertToCny, formatCny } from '../lib/exchange-rate'
import { CHINESE_SUBMISSION_STATUS_PRESETS } from '../lib/submission-intelligence'

function numericText(value?: string | null) {
  if (!value) return null
  const parsed = Number(value.replace(/,/g, '').trim())
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null
}

function isCny(currency: string) {
  return ['CNY', 'RMB', 'CNH'].includes(currency)
}

function renderConversion(output: HTMLElement, amount: number, currency: string, key: string) {
  if (output.dataset.key === key) return
  output.dataset.key = key
  output.textContent = isCny(currency) ? formatCny(amount) : '换算中…'
  output.dataset.state = isCny(currency) ? 'ready' : 'loading'
  if (isCny(currency)) return

  void convertToCny(amount, currency).then(result => {
    if (output.dataset.key !== key) return
    output.textContent = result ? `≈ ${formatCny(result.cny)}` : '人民币价暂不可用'
    output.dataset.state = result ? 'ready' : 'error'
    output.title = result
      ? `参考汇率：1 ${result.currency} = ${result.rate.toFixed(4)} CNY；日期 ${result.date}${result.stale ? '；使用缓存' : ''}`
      : '原始 APC 金额仍保留'
  })
}

function normalizedToken(value?: string | null) {
  return (value || '').replace(/[\s·/｜|：:，,（）()_-]+/g, '').trim().toLocaleUpperCase()
}

function compactJournalRanks(card: HTMLElement) {
  const seen = new Set<string>()
  const rankSpans = Array.from(card.querySelectorAll<HTMLElement>('.prep-journal-rank-blocks > span'))

  rankSpans.forEach(span => {
    const label = span.querySelector<HTMLElement>('b')
    const value = span.querySelector<HTMLElement>('em')
    const labelText = label?.textContent?.trim() || ''
    const valueText = value?.textContent?.trim() || ''
    const labelToken = normalizedToken(labelText)
    const valueToken = normalizedToken(valueText)
    const isAffirmation = ['是', 'YES', 'TRUE', '收录'].includes(valueToken)

    if (value && (labelToken === valueToken || isAffirmation)) {
      value.remove()
      span.dataset.collapsed = 'true'
    }

    const token = normalizedToken(span.textContent)
    if (token && seen.has(token)) {
      span.remove()
      return
    }
    if (token) seen.add(token)
  })

  const represented = new Set(
    Array.from(card.querySelectorAll<HTMLElement>('.prep-journal-rank-blocks > span'))
      .flatMap(span => [
        normalizedToken(span.textContent),
        normalizedToken(span.querySelector('b')?.textContent),
        normalizedToken(span.querySelector('em')?.textContent),
      ])
      .filter(Boolean),
  )

  card.querySelectorAll<HTMLElement>('.prep-journal-facts [data-tone="index"]').forEach(item => {
    const token = normalizedToken(item.textContent)
    if (token && represented.has(token)) item.remove()
  })
}

function compactJournalMetrics(card: HTMLElement) {
  const host = card.querySelector<HTMLElement>('.prep-journal-numbers')
  if (!host) return
  host.classList.add('prep-journal-metrics-compact')

  const cells = Array.from(host.querySelectorAll<HTMLElement>(':scope > div'))
  let knownCount = 0
  cells.forEach(cell => {
    const value = cell.querySelector<HTMLElement>('b')?.textContent?.trim() || ''
    const label = cell.querySelector<HTMLElement>('small:not(.journal-card-cny)')?.textContent?.trim() || ''
    const unknown = !value || value === '—' || value === '--'
    cell.hidden = unknown
    cell.classList.toggle('is-known', !unknown)
    if (unknown) return
    knownCount += 1
    const metric = /首轮/.test(label) ? 'first'
      : /总审稿/.test(label) ? 'review'
        : /接收率/.test(label) ? 'acceptance'
          : 'apc'
    cell.dataset.metric = metric
  })

  let missing = host.querySelector<HTMLElement>('.prep-journal-metrics-missing')
  if (knownCount === 0) {
    if (!missing) {
      missing = document.createElement('span')
      missing.className = 'prep-journal-metrics-missing'
      missing.textContent = '审稿周期、接收率与 APC 暂未记录'
      host.appendChild(missing)
    }
  } else {
    missing?.remove()
  }
}

function enhanceJournalCards() {
  document.querySelectorAll<HTMLElement>('.prep-journal-card').forEach(card => {
    compactJournalRanks(card)
    compactJournalMetrics(card)

    const feeCell = card.querySelector<HTMLElement>('.prep-journal-numbers > [data-metric="apc"]')
    const amountNode = feeCell?.querySelector<HTMLElement>('b')
    const raw = amountNode?.textContent?.trim() || ''
    const amount = numericText(raw.match(/[\d,.]+/)?.[0])
    const currency = (feeCell?.querySelector<HTMLElement>('small:not(.journal-card-cny)')?.textContent || '').trim().toUpperCase()
    if (!feeCell || amount === null || !currency || currency === 'APC') return

    let output = feeCell.querySelector<HTMLElement>('.journal-card-cny')
    if (!output) {
      output = document.createElement('small')
      output.className = 'journal-card-cny'
      feeCell.appendChild(output)
    }
    renderConversion(output, amount, currency, `${amount}:${currency}`)
  })
}

function enhanceOverviewCards() {
  document.querySelectorAll<HTMLElement>('.prep-journal-overview-card').forEach(card => {
    const fit = card.querySelector<HTMLElement>('.prep-overview-journal-meta [data-tone="fit"]')
    if (!fit) return
    const raw = fit.dataset.rawText || fit.childNodes[0]?.textContent || fit.textContent || ''
    if (!fit.dataset.rawText) fit.dataset.rawText = raw.trim()
    const match = raw.match(/(\d[\d,]*(?:\.\d+)?)\s+([A-Z]{3})\b/)
    if (!match) return
    const amount = numericText(match[1])
    const currency = match[2].toUpperCase()
    if (amount === null) return

    let output = fit.querySelector<HTMLElement>('.journal-overview-cny')
    if (!output) {
      output = document.createElement('small')
      output.className = 'journal-overview-cny'
      fit.appendChild(output)
    }
    renderConversion(output, amount, currency, `${amount}:${currency}`)
  })
}

function installInputPreview(amountInput: HTMLInputElement, currencyInput: HTMLInputElement, host: HTMLElement, className: string) {
  if (host.querySelector(`.${className}`)) return
  const output = document.createElement('small')
  output.className = className
  host.appendChild(output)
  let requestId = 0

  const update = () => {
    const amount = numericText(amountInput.value)
    const currency = currencyInput.value.trim().toUpperCase()
    const current = ++requestId
    if (amount === null || !currency) {
      output.textContent = '外币 APC 将自动显示人民币参考价'
      output.dataset.state = 'idle'
      return
    }
    if (isCny(currency)) {
      output.textContent = `人民币金额：${formatCny(amount)}`
      output.dataset.state = 'ready'
      return
    }
    output.textContent = '正在获取参考汇率…'
    output.dataset.state = 'loading'
    void convertToCny(amount, currency).then(result => {
      if (current !== requestId) return
      output.textContent = result
        ? `参考价 ≈ ${formatCny(result.cny)} · 汇率日期 ${result.date}${result.stale ? '（离线缓存）' : ''}`
        : '当前无法获取人民币参考价，原始 APC 不受影响'
      output.dataset.state = result ? 'ready' : 'error'
      output.title = result ? `1 ${result.currency} = ${result.rate.toFixed(4)} CNY` : ''
    })
  }

  amountInput.addEventListener('input', update)
  amountInput.addEventListener('change', update)
  currencyInput.addEventListener('input', update)
  currencyInput.addEventListener('change', update)
  output.dataset.listeners = 'installed'
  update()
}

function enhanceJournalForm() {
  document.querySelectorAll<HTMLElement>('.journal-form-section.decision').forEach(section => {
    const fields = Array.from(section.querySelectorAll<HTMLElement>('.prep-field'))
    const amountField = fields.find(field => field.querySelector(':scope > span')?.textContent?.trim() === 'APC')
    const currencyField = fields.find(field => field.querySelector(':scope > span')?.textContent?.trim() === '币种')
    const amountInput = amountField?.querySelector<HTMLInputElement>('input')
    const currencyInput = currencyField?.querySelector<HTMLInputElement>('input')
    const host = amountField?.parentElement
    if (amountInput && currencyInput && host) installInputPreview(amountInput, currencyInput, host, 'journal-apc-cny-live')
  })
}

function enhancePaperForm() {
  document.querySelectorAll<HTMLElement>('.compact-form-modal').forEach(modal => {
    const fee = modal.querySelector<HTMLElement>('.compact-fee')
    const inputs = fee?.querySelectorAll<HTMLInputElement>('input')
    const host = fee?.parentElement
    if (inputs?.length === 2 && host && !host.querySelector('.paper-cny-live')) {
      installInputPreview(inputs[0], inputs[1], host, 'paper-cny-live')
    }
  })
}

type FileDescriptor = { kind: string; mark: string }

function fileDescriptor(text: string): FileDescriptor {
  const normalized = text.toLowerCase()
  if (/检索证明/.test(normalized)) return { kind: 'retrieval', mark: '检索' }
  if (/见刊文章|published article|final article/.test(normalized)) return { kind: 'published', mark: '见刊' }
  if (/录用通知|acceptance letter/.test(normalized)) return { kind: 'acceptance', mark: '录用' }
  if (/proof|校样/.test(normalized)) return { kind: 'proof', mark: '校样' }
  if (/response to reviewers|response|回复|审稿意见/.test(normalized)) return { kind: 'response', mark: '回复' }
  if (/cover letter/.test(normalized)) return { kind: 'document', mark: 'CL' }
  if (/初稿/.test(normalized)) return { kind: 'document', mark: '初稿' }
  if (/投稿稿/.test(normalized)) return { kind: 'document', mark: '投稿' }
  if (/修回稿/.test(normalized)) return { kind: 'document', mark: '修回' }
  if (/版权协议/.test(normalized)) return { kind: 'receipt', mark: '版权' }
  if (/apc|发票/.test(normalized)) return { kind: 'receipt', mark: '发票' }
  if (/投稿截图/.test(normalized)) return { kind: 'image', mark: '截图' }
  if (/\.pdf\b/.test(normalized)) return { kind: 'pdf', mark: 'PDF' }
  if (/\.(docx?|odt|rtf)\b/.test(normalized)) return { kind: 'document', mark: 'Word' }
  if (/\.(xlsx?|csv|ods)\b/.test(normalized)) return { kind: 'sheet', mark: '表格' }
  if (/\.(pptx?|odp)\b/.test(normalized)) return { kind: 'slides', mark: 'PPT' }
  if (/\.(png|jpe?g|webp|gif|bmp|tiff?|svg)\b/.test(normalized)) return { kind: 'image', mark: '图片' }
  if (/\.(zip|rar|7z|tar|gz)\b/.test(normalized)) return { kind: 'archive', mark: '压缩' }
  if (/\.(json|xml|html?|md|txt|log)\b/.test(normalized)) return { kind: 'code', mark: '文本' }
  return { kind: 'generic', mark: '附件' }
}

function enhanceAttachmentIcons() {
  document.querySelectorAll<HTMLElement>('.compact-file-row').forEach(row => {
    const type = row.querySelector<HTMLSelectElement>('.compact-file-type')?.value || ''
    const name = row.querySelector<HTMLInputElement>('.compact-file-name')?.value || ''
    const descriptor = fileDescriptor(`${type} ${name}`)
    row.dataset.fileKind = descriptor.kind
    row.dataset.fileMark = descriptor.mark
  })

  document.querySelectorAll<HTMLElement>('.paper-grid .file-dot').forEach(file => {
    const descriptor = fileDescriptor(file.getAttribute('title') || file.textContent || '')
    file.dataset.fileKind = descriptor.kind
    file.dataset.fileMark = descriptor.mark
  })
}

function enhancePublicationEntry() {
  document.querySelectorAll<HTMLElement>('.paper-card-v3').forEach(card => {
    const statusArea = card.querySelector<HTMLElement>('.paper-status-area')
    const published = card.querySelector<HTMLAnchorElement>('.paper-publication-link')
    const doi = card.querySelector<HTMLAnchorElement>('.archive-chip.doi')
    const primary = published || doi

    if (statusArea && primary && !statusArea.contains(primary)) {
      primary.classList.add('paper-publication-compact')
      primary.textContent = published ? '见刊 ↗' : 'DOI ↗'
      statusArea.appendChild(primary)
    }
    if (published && doi && published !== doi) doi.remove()

    card.querySelectorAll<HTMLElement>('.paper-meta-row.paper-meta-compact, .archive-chip-row').forEach(row => {
      if (row.children.length === 0) row.remove()
    })
  })
}

function enhanceTimelinePresets() {
  document.querySelectorAll<HTMLDataListElement>('#timeline-event-options').forEach(datalist => {
    const existing = new Set(Array.from(datalist.options).map(option => option.value))
    CHINESE_SUBMISSION_STATUS_PRESETS.forEach(value => {
      if (existing.has(value)) return
      const option = document.createElement('option')
      option.value = value
      datalist.appendChild(option)
    })
  })
}

function enhanceAll() {
  enhanceJournalCards()
  enhanceOverviewCards()
  enhanceJournalForm()
  enhancePaperForm()
  enhanceAttachmentIcons()
  enhancePublicationEntry()
  enhanceTimelinePresets()
}

export default function ApcAutoConverter() {
  useEffect(() => {
    let frame = 0
    const schedule = () => {
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(enhanceAll)
    }
    enhanceAll()
    const observer = new MutationObserver(schedule)
    observer.observe(document.body, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ['value', 'title', 'class'] })
    document.addEventListener('input', schedule, true)
    document.addEventListener('change', schedule, true)
    return () => {
      cancelAnimationFrame(frame)
      observer.disconnect()
      document.removeEventListener('input', schedule, true)
      document.removeEventListener('change', schedule, true)
    }
  }, [])

  return null
}
