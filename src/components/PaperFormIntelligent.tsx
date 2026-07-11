import { useEffect, type ComponentProps } from 'react'
import { convertToCny, formatCny } from '../lib/exchange-rate'
import { CHINESE_SUBMISSION_STATUS_PRESETS, inferMainSubmissionStatus, inferRevisionRound } from '../lib/submission-intelligence'
import type { Paper } from '../lib/types'
import PaperFormArchive from './PaperFormArchive'

type Props = ComponentProps<typeof PaperFormArchive>

function installFormEnhancements() {
  const modal = document.querySelector<HTMLElement>('.compact-form-modal')
  if (!modal) return () => {}
  const cleanups: Array<() => void> = []

  const revisionField = Array.from(modal.querySelectorAll<HTMLElement>('.compact-field')).find(field => field.querySelector(':scope > span')?.textContent?.trim() === '返修轮次')
  if (revisionField && !revisionField.querySelector('.paper-auto-field-hint')) {
    const hint = document.createElement('small')
    hint.className = 'paper-auto-field-hint'
    hint.textContent = '保存时根据时间线自动重算；无可识别记录时保留手填值'
    revisionField.appendChild(hint)
  }

  const fee = modal.querySelector<HTMLElement>('.compact-fee')
  const feeInputs = fee?.querySelectorAll<HTMLInputElement>('input')
  if (fee && feeInputs?.length === 2 && !fee.parentElement?.querySelector('.paper-cny-live')) {
    const preview = document.createElement('small')
    preview.className = 'paper-cny-live'
    fee.parentElement?.appendChild(preview)
    let requestId = 0
    const update = () => {
      const amount = Number(feeInputs[0].value)
      const currency = feeInputs[1].value.trim().toUpperCase()
      const current = ++requestId
      if (!feeInputs[0].value || !Number.isFinite(amount) || amount < 0 || !currency) {
        preview.textContent = '外币 APC 将自动显示人民币参考价'
        preview.dataset.state = 'idle'
        return
      }
      if (currency === 'CNY' || currency === 'RMB' || currency === 'CNH') {
        preview.textContent = `人民币金额：${formatCny(amount)}`
        preview.dataset.state = 'ready'
        return
      }
      preview.textContent = '正在获取参考汇率…'
      preview.dataset.state = 'loading'
      void convertToCny(amount, currency).then(result => {
        if (current !== requestId) return
        preview.textContent = result
          ? `参考价 ≈ ${formatCny(result.cny)} · 汇率日期 ${result.date}${result.stale ? '（离线缓存）' : ''}`
          : '当前无法获取人民币参考价，原始 APC 不受影响'
        preview.dataset.state = result ? 'ready' : 'error'
      })
    }
    feeInputs.forEach(input => {
      input.addEventListener('input', update)
      input.addEventListener('change', update)
      cleanups.push(() => {
        input.removeEventListener('input', update)
        input.removeEventListener('change', update)
      })
    })
    update()
  }

  const addChinesePresets = () => {
    const datalist = modal.querySelector<HTMLDataListElement>('#timeline-event-options')
    if (!datalist) return
    const existing = new Set(Array.from(datalist.options).map(option => option.value))
    CHINESE_SUBMISSION_STATUS_PRESETS.forEach(value => {
      if (existing.has(value)) return
      const option = document.createElement('option')
      option.value = value
      datalist.appendChild(option)
    })
  }
  addChinesePresets()
  const observer = new MutationObserver(addChinesePresets)
  observer.observe(modal, { childList: true, subtree: true })
  cleanups.push(() => observer.disconnect())

  return () => cleanups.forEach(cleanup => cleanup())
}

export default function PaperFormIntelligent(props: Props) {
  useEffect(() => {
    const timer = window.setTimeout(() => {
      const cleanup = installFormEnhancements()
      ;(window as any).__submissionHubPaperFormCleanup = cleanup
    }, 0)
    return () => {
      window.clearTimeout(timer)
      const cleanup = (window as any).__submissionHubPaperFormCleanup
      if (typeof cleanup === 'function') cleanup()
      delete (window as any).__submissionHubPaperFormCleanup
    }
  }, [])

  const save: Props['onSave'] = async data => {
    const manualRound = Number(data.revision_round || 0)
    const normalized: Partial<Paper> = {
      ...data,
      status: inferMainSubmissionStatus(data.system_status, data.status || 'preparing'),
      revision_round: inferRevisionRound(data.timeline, data.system_status, manualRound),
    }
    await props.onSave(normalized)
  }

  return <PaperFormArchive {...props} onSave={save} />
}
