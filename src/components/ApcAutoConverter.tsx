import { useEffect } from 'react'
import { convertToCny, formatCny } from '../lib/exchange-rate'

function numericText(value?: string | null) {
  if (!value) return null
  const parsed = Number(value.replace(/,/g, '').trim())
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null
}

function enhanceJournalCards() {
  document.querySelectorAll<HTMLElement>('.prep-journal-card').forEach(card => {
    const cells = card.querySelectorAll<HTMLElement>('.prep-journal-numbers > div')
    const feeCell = cells[cells.length - 1]
    const amountNode = feeCell?.querySelector<HTMLElement>('b')
    const currencyNode = feeCell?.querySelector<HTMLElement>('small')
    const amount = numericText(amountNode?.textContent)
    const currency = (currencyNode?.textContent || '').trim().toUpperCase()
    if (!feeCell || amount === null || !currency || currency === 'APC') return

    const key = `${amount}:${currency}`
    let output = feeCell.querySelector<HTMLElement>('.journal-card-cny')
    if (!output) {
      output = document.createElement('small')
      output.className = 'journal-card-cny'
      feeCell.appendChild(output)
    }
    if (output.dataset.key === key) return
    output.dataset.key = key
    output.textContent = currency === 'CNY' || currency === 'RMB' || currency === 'CNH'
      ? formatCny(amount)
      : '换算中…'

    if (currency !== 'CNY' && currency !== 'RMB' && currency !== 'CNH') {
      void convertToCny(amount, currency).then(result => {
        if (output?.dataset.key !== key) return
        output.textContent = result ? `≈ ${formatCny(result.cny)}` : '人民币价暂不可用'
        output.title = result ? `参考汇率日期 ${result.date}${result.stale ? '；使用离线缓存' : ''}` : '原始 APC 金额仍保留'
      })
    }
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
    if (currency === 'CNY' || currency === 'RMB' || currency === 'CNH') {
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

function enhanceOfflinePaperForm() {
  document.querySelectorAll<HTMLElement>('.compact-fee').forEach(fee => {
    const inputs = fee.querySelectorAll<HTMLInputElement>('input')
    const host = fee.parentElement
    if (inputs.length === 2 && host && !host.querySelector('.paper-cny-live')) {
      installInputPreview(inputs[0], inputs[1], host, 'paper-cny-live')
    }
  })
}

function enhanceAll() {
  enhanceJournalCards()
  enhanceJournalForm()
  enhanceOfflinePaperForm()
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
    observer.observe(document.body, { childList: true, subtree: true, characterData: true })
    return () => {
      cancelAnimationFrame(frame)
      observer.disconnect()
    }
  }, [])

  return null
}
