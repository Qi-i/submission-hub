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

function enhanceJournalCards() {
  document.querySelectorAll<HTMLElement>('.prep-journal-card').forEach(card => {
    const cells = card.querySelectorAll<HTMLElement>('.prep-journal-numbers > div')
    const feeCell = cells[cells.length - 1]
    const amountNode = feeCell?.querySelector<HTMLElement>('b')
    const currencyNode = feeCell?.querySelector<HTMLElement>('small:not(.journal-card-cny)')
    const amount = numericText(amountNode?.textContent)
    const currency = (currencyNode?.textContent || '').trim().toUpperCase()
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

    const revisionField = Array.from(modal.querySelectorAll<HTMLElement>('.compact-field')).find(field => field.querySelector(':scope > span')?.textContent?.trim() === '返修轮次')
    if (revisionField && !revisionField.querySelector('.paper-auto-field-hint')) {
      const hint = document.createElement('small')
      hint.className = 'paper-auto-field-hint'
      hint.textContent = '保存时根据时间线自动重算；没有可识别记录时保留手填值'
      revisionField.appendChild(hint)
    }
  })
}

function fileKind(text: string) {
  const normalized = text.toLowerCase()
  if (/\.pdf\b/.test(normalized)) return /检索证明|录用通知|proof/.test(normalized) ? 'proof' : 'pdf'
  if (/\.(docx?|odt|rtf)\b/.test(normalized)) return /response|回复|审稿意见/.test(normalized) ? 'response' : 'document'
  if (/\.(xlsx?|csv|ods)\b/.test(normalized)) return 'sheet'
  if (/\.(pptx?|odp)\b/.test(normalized)) return 'slides'
  if (/\.(png|jpe?g|webp|gif|bmp|tiff?|svg)\b/.test(normalized)) return 'image'
  if (/\.(zip|rar|7z|tar|gz)\b/.test(normalized)) return 'archive'
  if (/\.(json|xml|html?|md|txt|log)\b/.test(normalized)) return 'code'
  if (/检索证明|录用通知|见刊文章|proof/.test(normalized)) return 'proof'
  if (/response|回复|审稿意见/.test(normalized)) return 'response'
  if (/apc|发票|版权协议/.test(normalized)) return 'receipt'
  return 'generic'
}

function enhanceAttachmentIcons() {
  document.querySelectorAll<HTMLElement>('.compact-file-row').forEach(row => {
    const type = row.querySelector<HTMLSelectElement>('.compact-file-type')?.value || ''
    const name = row.querySelector<HTMLInputElement>('.compact-file-name')?.value || ''
    row.dataset.fileKind = fileKind(`${type} ${name}`)
  })

  document.querySelectorAll<HTMLElement>('.paper-grid .file-dot').forEach(file => {
    file.dataset.fileKind = fileKind(file.getAttribute('title') || file.textContent || '')
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
    observer.observe(document.body, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ['value', 'title'] })
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
