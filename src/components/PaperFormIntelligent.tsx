import { useEffect, type ComponentProps } from 'react'
import { convertToCny, formatCny } from '../lib/exchange-rate'
import { findJournalProfile } from '../lib/journal-paper-sync'
import { primaryJournalRankItems, type RankedJournalProfile } from '../lib/journal-display'
import type { JournalProfile } from '../lib/preparation'
import { CHINESE_SUBMISSION_STATUS_PRESETS, inferMainSubmissionStatus, inferRevisionRound } from '../lib/submission-intelligence'
import type { Paper } from '../lib/types'
import PaperFormArchive from './PaperFormArchive'

type Props = ComponentProps<typeof PaperFormArchive> & {
  journalProfiles?: JournalProfile[]
}

function setControlledValue(control: HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement, value: string) {
  const prototype = control instanceof HTMLSelectElement
    ? HTMLSelectElement.prototype
    : control instanceof HTMLTextAreaElement
      ? HTMLTextAreaElement.prototype
      : HTMLInputElement.prototype
  const setter = Object.getOwnPropertyDescriptor(prototype, 'value')?.set
  setter?.call(control, value)
  control.dispatchEvent(new Event('input', { bubbles: true }))
  control.dispatchEvent(new Event('change', { bubbles: true }))
}

function installFormEnhancements(journalProfiles: JournalProfile[]) {
  const modal = document.querySelector<HTMLElement>('.compact-form-modal')
  if (!modal) return () => {}
  const cleanups: Array<() => void> = []

  const fields = () => Array.from(modal.querySelectorAll<HTMLElement>('.compact-field'))
  const fieldByLabel = (label: string) => fields().find(field => field.querySelector(':scope > span')?.textContent?.trim() === label)
  const controlByLabel = (label: string) => fieldByLabel(label)?.querySelector<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>('input, select, textarea')
  const setField = (label: string, value?: string | null, overwrite = false, emptyValues: string[] = []) => {
    if (!value) return
    const control = controlByLabel(label)
    if (!control) return
    const current = control.value.trim()
    if (!overwrite && current && !emptyValues.includes(current)) return
    if (current !== value) setControlledValue(control, value)
  }

  const revisionField = fieldByLabel('返修轮次')
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

  const addPresets = () => {
    const timelineList = modal.querySelector<HTMLDataListElement>('#timeline-event-options')
    if (timelineList) {
      const existing = new Set(Array.from(timelineList.options).map(option => option.value))
      CHINESE_SUBMISSION_STATUS_PRESETS.forEach(value => {
        if (existing.has(value)) return
        const option = document.createElement('option')
        option.value = value
        timelineList.appendChild(option)
      })
    }

    const journalList = modal.querySelector<HTMLDataListElement>('#journal-options')
    if (journalList) {
      const existing = new Set(Array.from(journalList.options).map(option => option.value))
      journalProfiles.forEach(profile => {
        if (existing.has(profile.name)) return
        const option = document.createElement('option')
        option.value = profile.name
        journalList.appendChild(option)
      })
    }
  }

  const syncProfile = (profile: JournalProfile, overwrite: boolean) => {
    const ranked = profile as RankedJournalProfile
    const rankItems = primaryJournalRankItems(ranked, 10)
    const newRank = rankItems.find(item => item.key === 'xr' || item.key.startsWith('xr'))?.value
    const domestic = rankItems
      .filter(item => ['eii', 'pku', 'cscd', 'zhongguokejihexin', 'cssci'].includes(item.key) || item.key.startsWith('index:'))
      .map(item => item.value === '收录' ? item.label : `${item.label} ${item.value}`)

    setField('投稿后台 URL', profile.submission_url, overwrite)
    setField('期刊官网 / 作者指南', profile.website_url || profile.author_guide_url, overwrite)
    setField('APC / 开源 / 期刊备注', profile.fee_notes, overwrite)
    setField('JCR', profile.jcr_quartile, overwrite, ['未定'])
    setField('中科院', profile.cas_quartile, overwrite, ['未定'])
    setField('新锐', newRank, overwrite, ['无'])

    domestic.slice(0, 4).forEach((value, index) => setField(`分类 ${index + 1}`, value, overwrite))

    const currentFeeInputs = modal.querySelector<HTMLElement>('.compact-fee')?.querySelectorAll<HTMLInputElement>('input')
    if (currentFeeInputs?.length === 2) {
      if (profile.apc_amount != null && (overwrite || !currentFeeInputs[0].value)) setControlledValue(currentFeeInputs[0], String(profile.apc_amount))
      if (profile.apc_currency && (overwrite || !currentFeeInputs[1].value || currentFeeInputs[1].value === 'USD')) setControlledValue(currentFeeInputs[1], profile.apc_currency.toUpperCase())
    }
  }

  let lastAutoLinked = ''
  const enhanceJournalLink = () => {
    addPresets()
    const journalInput = controlByLabel('目标期刊 / 会议') as HTMLInputElement | undefined
    const profile = findJournalProfile(journalProfiles, journalInput?.value)
    const tools = modal.querySelector<HTMLElement>('.paper-journal-tools')
    let suggestion = tools?.querySelector<HTMLElement>('.library-profile-suggestion')

    if (!profile || !tools) {
      suggestion?.remove()
      lastAutoLinked = ''
      return
    }

    if (!suggestion) {
      suggestion = document.createElement('div')
      suggestion.className = 'profile-suggestion library-profile-suggestion'
      const label = document.createElement('span')
      const button = document.createElement('button')
      button.type = 'button'
      button.className = 'timeline-link-btn'
      button.textContent = '同步最新信息'
      button.addEventListener('click', () => {
        const latest = findJournalProfile(journalProfiles, journalInput?.value)
        if (latest) syncProfile(latest, true)
      })
      suggestion.append(label, button)
      tools.prepend(suggestion)
    }

    const label = suggestion.querySelector<HTMLElement>('span')
    const nextLabel = `已关联期刊库：${profile.name}`
    if (label && label.textContent !== nextLabel) label.textContent = nextLabel

    if (lastAutoLinked !== profile.id) {
      lastAutoLinked = profile.id
      window.setTimeout(() => syncProfile(profile, false), 0)
    }
  }

  addPresets()
  enhanceJournalLink()
  const observer = new MutationObserver(enhanceJournalLink)
  observer.observe(modal, { childList: true, subtree: true })
  cleanups.push(() => observer.disconnect())

  const journalInput = controlByLabel('目标期刊 / 会议') as HTMLInputElement | undefined
  if (journalInput) {
    const onJournalChange = () => window.setTimeout(enhanceJournalLink, 0)
    journalInput.addEventListener('input', onJournalChange)
    journalInput.addEventListener('change', onJournalChange)
    cleanups.push(() => {
      journalInput.removeEventListener('input', onJournalChange)
      journalInput.removeEventListener('change', onJournalChange)
    })
  }

  return () => cleanups.forEach(cleanup => cleanup())
}

export default function PaperFormIntelligent({ journalProfiles = [], ...props }: Props) {
  useEffect(() => {
    const timer = window.setTimeout(() => {
      const cleanup = installFormEnhancements(journalProfiles)
      ;(window as any).__submissionHubPaperFormCleanup = cleanup
    }, 0)
    return () => {
      window.clearTimeout(timer)
      const cleanup = (window as any).__submissionHubPaperFormCleanup
      if (typeof cleanup === 'function') cleanup()
      delete (window as any).__submissionHubPaperFormCleanup
    }
  }, [journalProfiles])

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
