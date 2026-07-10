import { useState, type ReactNode } from 'react'
import { FileText, Loader, RefreshCw, Save, Sparkles, Trash2, X } from 'lucide-react'
import type { JournalRankLookupResult } from '../lib/journal-rank'
import { rankFieldSuggestions } from '../lib/journal-rank'
import type { Paper, PaperFile } from '../lib/types'
import { CAS_OPTIONS, FILE_TYPE_OPTIONS, JCR_OPTIONS, NEXT_ACTION_OPTIONS, REMINDER_LEVELS, STATUSES, SUBMISSION_SYSTEM_OPTIONS, inferNextAction } from '../lib/types'
import Timeline from './Timeline'

type FormState = {
  title: string; title_zh: string; journal: string; lang: string; status: string;
  manuscript_no: string; submission_system: string; system_status: string; last_status_date: string;
  tracking_url: string; published_url: string; journal_url: string; journal_apc_note: string;
  doi: string; publication_info: string; citation: string;
  next_action: string; reminder_level: string; apc_amount: string; apc_currency: string; revision_round: string;
  quartile_jcr: string; quartile_cas: string; quartile_new: string; quartile_cust: string; quartile_zh: string[];
  authors: string[]; corresponding_author: string; prev_id: string;
  submitted_date: string; resolve_date: string; deadline: string; timeline: string;
  followup_log: string; notes: string; files: PaperFile[];
}

type UploadResult = { fileUrl: string; fileName: string } | null

interface Props {
  paper: Paper | 'new'
  allPapers: Paper[]
  currentUsername: string
  onSave: (data: Partial<Paper>) => void | Promise<void>
  onDelete: (id: string) => void | Promise<void>
  onClose: () => void
  onUploadFile?: (file: File) => Promise<UploadResult>
  onLookupJournalRanks?: (publicationName: string) => Promise<JournalRankLookupResult>
}

const blankZhQuartile = ['', '', '', '']
const value = (input: unknown) => input === null || input === undefined ? '' : String(input)
const norm = (input?: string | null) => (input || '').trim().toLocaleLowerCase()

function uniqueNames(input: string) {
  const seen = new Set<string>()
  return input.split(/[，,;；、\s]+/).map(name => name.trim()).filter(name => {
    if (!name) return false
    const key = norm(name)
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

function initial(paper: Paper | 'new', currentUsername: string): FormState {
  if (paper === 'new') return {
    title: '', title_zh: '', journal: '', lang: 'zh', status: 'preparing',
    manuscript_no: '', submission_system: '', system_status: '', last_status_date: '',
    tracking_url: '', published_url: '', journal_url: '', journal_apc_note: '',
    doi: '', publication_info: '', citation: '',
    next_action: '', reminder_level: 'none', apc_amount: '', apc_currency: 'USD', revision_round: '',
    quartile_jcr: '未定', quartile_cas: '未定', quartile_new: '无', quartile_cust: '无', quartile_zh: [...blankZhQuartile],
    authors: currentUsername ? [currentUsername] : [], corresponding_author: '', prev_id: '',
    submitted_date: '', resolve_date: '', deadline: '', timeline: '',
    followup_log: '', notes: '', files: [],
  }
  return {
    title: paper.title || '', title_zh: paper.title_zh || '', journal: paper.journal || '', lang: paper.lang || 'zh', status: paper.status || 'preparing',
    manuscript_no: paper.manuscript_no || '', submission_system: paper.submission_system || '', system_status: paper.system_status || '', last_status_date: paper.last_status_date || '',
    tracking_url: paper.tracking_url || '', published_url: paper.published_url || '', journal_url: paper.journal_url || '', journal_apc_note: paper.journal_apc_note || '',
    doi: paper.doi || '', publication_info: paper.publication_info || '', citation: paper.citation || '',
    next_action: paper.next_action || '', reminder_level: paper.reminder_level || 'none', apc_amount: value(paper.apc_amount), apc_currency: paper.apc_currency || 'USD', revision_round: paper.revision_round ? String(paper.revision_round) : '',
    quartile_jcr: paper.quartile_jcr || '未定', quartile_cas: paper.quartile_cas || '未定', quartile_new: paper.quartile_new || '无', quartile_cust: paper.quartile_cust || '无', quartile_zh: paper.quartile_zh || [...blankZhQuartile],
    authors: [...(paper.authors || [])], corresponding_author: paper.corresponding_author || '', prev_id: paper.prev_id || '',
    submitted_date: paper.submitted_date || '', resolve_date: paper.resolve_date || '', deadline: paper.deadline || '', timeline: paper.timeline || '',
    followup_log: paper.followup_log || '', notes: paper.notes || '', files: (paper.files || []).map(file => ({ ...file, t: file.t || '其它' })),
  }
}

function latestTimelineState(timeline: string, fallbackStatus: string, fallbackDate: string) {
  const rows = timeline.split('\n').map(row => row.trim()).filter(Boolean)
  if (!rows.length) return { status: fallbackStatus || null, date: fallbackDate || null }
  const last = rows[rows.length - 1]
  const match = last.match(/^(\d{4}[-/.]\d{1,2}[-/.]\d{1,2})\s*(.*)$/)
  if (!match) return { status: last || fallbackStatus || null, date: fallbackDate || null }
  const date = match[1].replace(/[/.]/g, '-').replace(/-(\d)-/g, '-0$1-').replace(/-(\d)$/g, '-0$1')
  const status = (match[2] || '').trim().split(/\s+-\s+/)[0]?.trim() || fallbackStatus || null
  return { status, date }
}

function deriveMainStatus(systemStatus: string | null, currentStatus: string) {
  const raw = (systemStatus || '').toLowerCase()
  if (!raw) return currentStatus
  if (/(accepted|accept|published|online|proof|录用|接收|见刊|在线发表|校样)/.test(raw)) return 'accepted'
  if (/(reject|rejected|declined|拒稿|被拒|退稿)/.test(raw)) return 'rejected'
  if (/(withdraw|withdrawn|撤稿)/.test(raw)) return 'withdrawn'
  if (/(revision|required revision|major revision|minor revision|revise|revision required|revision incomplete|修回|大修|小修)/.test(raw)) return 'revision'
  if (/(out for review|under review|with editor|editor invited|decision pending|required reviews complete|review complete|with journal administrator|revised manuscript submitted|外审|审稿|编辑处理|等待决定)/.test(raw)) return 'under_review'
  if (/(submitted|submission received|new submission|已投稿|投稿成功)/.test(raw)) return 'submitted'
  return currentStatus
}

function createsVersionCycle(currentId: string, candidateId: string, allPapers: Paper[]) {
  if (!currentId || !candidateId) return false
  if (candidateId === currentId) return true
  const byId = new Map(allPapers.map(item => [item.id, item]))
  const visited = new Set<string>()
  let cursor = byId.get(candidateId)
  while (cursor?.prev_id && !visited.has(cursor.id)) {
    visited.add(cursor.id)
    if (cursor.prev_id === currentId) return true
    cursor = byId.get(cursor.prev_id)
  }
  return false
}

function Section({ title, subtitle, tone, children }: { title: string; subtitle?: string; tone?: string; children: ReactNode }) {
  return <section className="compact-section" data-tone={tone || 'blue'}><div className="compact-section-head"><h4>{title}</h4>{subtitle && <span>{subtitle}</span>}</div>{children}</section>
}

function Field({ label, children, wide }: { label: string; children: ReactNode; wide?: boolean }) {
  return <label className={`compact-field ${wide ? 'wide' : ''}`}><span>{label}</span>{children}</label>
}

export default function PaperFormArchive({ paper, allPapers, currentUsername, onSave, onDelete, onClose, onUploadFile, onLookupJournalRanks }: Props) {
  const isNew = paper === 'new'
  const currentId = isNew ? '' : paper.id
  const [form, setForm] = useState<FormState>(() => initial(paper, currentUsername))
  const [authorsText, setAuthorsText] = useState(form.authors.join(', '))
  const [uploading, setUploading] = useState<number | null>(null)
  const [saving, setSaving] = useState(false)
  const [customTl, setCustomTl] = useState<string[]>([])
  const [rankLoading, setRankLoading] = useState(false)
  const [rankResult, setRankResult] = useState<JournalRankLookupResult | null>(null)
  const [rankError, setRankError] = useState('')
  const authors = uniqueNames(authorsText)
  const set = <K extends keyof FormState>(key: K, next: FormState[K]) => setForm(previous => ({ ...previous, [key]: next }))

  const journalNames = Array.from(new Set(allPapers.map(item => item.journal).filter(Boolean) as string[])).sort()
  const journalProfile = allPapers.filter(item => item.id !== currentId && norm(item.journal) === norm(form.journal)).sort((left, right) => new Date(right.updated_at || right.created_at).getTime() - new Date(left.updated_at || left.created_at).getTime())[0]
  const versionCandidates = allPapers.filter(item => item.id !== currentId && !createsVersionCycle(currentId, item.id, allPapers))

  const applyJournalProfile = () => {
    if (!journalProfile) return
    setForm(previous => ({
      ...previous,
      submission_system: previous.submission_system || journalProfile.submission_system || '',
      journal_url: previous.journal_url || journalProfile.journal_url || '',
      journal_apc_note: previous.journal_apc_note || journalProfile.journal_apc_note || '',
      apc_amount: previous.apc_amount || value(journalProfile.apc_amount),
      apc_currency: previous.apc_currency || journalProfile.apc_currency || 'USD',
      quartile_jcr: previous.quartile_jcr !== '未定' ? previous.quartile_jcr : journalProfile.quartile_jcr || previous.quartile_jcr,
      quartile_cas: previous.quartile_cas !== '未定' ? previous.quartile_cas : journalProfile.quartile_cas || previous.quartile_cas,
      quartile_new: previous.quartile_new !== '无' ? previous.quartile_new : journalProfile.quartile_new || previous.quartile_new,
      quartile_cust: previous.quartile_cust !== '无' ? previous.quartile_cust : journalProfile.quartile_cust || previous.quartile_cust,
      quartile_zh: previous.quartile_zh.some(Boolean) ? previous.quartile_zh : journalProfile.quartile_zh || previous.quartile_zh,
    }))
  }

  const queryRanks = async () => {
    if (!onLookupJournalRanks || !form.journal.trim() || rankLoading) return
    setRankLoading(true)
    setRankError('')
    try {
      setRankResult(await onLookupJournalRanks(form.journal))
    } catch (error) {
      setRankError(error instanceof Error ? error.message : '期刊等级查询失败。')
    } finally {
      setRankLoading(false)
    }
  }

  const applyRankResult = () => {
    if (!rankResult) return
    const suggestions = rankFieldSuggestions(rankResult.values)
    const customText = rankResult.items
      .filter(item => item.group === 'custom' || item.selected)
      .map(item => `${item.label} ${item.value}`)
      .join('；')
    setForm(previous => ({
      ...previous,
      quartile_jcr: suggestions.jcr || previous.quartile_jcr,
      quartile_cas: suggestions.cas || previous.quartile_cas,
      quartile_new: rankResult.values.xrTop || rankResult.values.xr || previous.quartile_new,
      quartile_cust: customText || previous.quartile_cust,
    }))
  }

  const updateFile = (index: number, key: keyof PaperFile, next: string) => setForm(previous => {
    const files = [...previous.files]
    files[index] = { ...files[index], [key]: next }
    return { ...previous, files }
  })
  const addFile = () => setForm(previous => ({ ...previous, files: [...previous.files, { n: '', p: '', t: '其它' }] }))
  const removeFile = (index: number) => setForm(previous => ({ ...previous, files: previous.files.filter((_, itemIndex) => itemIndex !== index) }))

  const upload = async (index: number) => {
    if (!onUploadFile || uploading !== null) return
    const input = document.createElement('input')
    input.type = 'file'
    input.onchange = async event => {
      const selected = (event.target as HTMLInputElement).files?.[0]
      if (!selected) return
      updateFile(index, 'n', selected.name)
      updateFile(index, 'p', '上传中...')
      setUploading(index)
      try {
        const result = await onUploadFile(selected)
        if (!result) throw new Error('文件存储尚未配置完整，或文件类型、大小、网络和权限不符合要求。')
        updateFile(index, 'p', result.fileUrl)
      } catch (error) {
        console.error('Upload file failed:', error)
        updateFile(index, 'p', '')
        alert(error instanceof Error ? `上传失败：${error.message}` : '上传失败，请稍后重试。')
      } finally {
        setUploading(null)
      }
    }
    input.click()
  }

  const save = async () => {
    if (saving) return
    if (form.prev_id && createsVersionCycle(currentId, form.prev_id, allPapers)) {
      alert('无法保存：所选前置版本会形成循环版本链。')
      return
    }
    const latest = latestTimelineState(form.timeline, form.system_status, form.last_status_date)
    const mainStatus = deriveMainStatus(latest.status, form.status)
    const inferred = inferNextAction({ status: mainStatus, system_status: latest.status, last_status_date: latest.date, submitted_date: form.submitted_date || null, deadline: form.deadline || null, published_url: form.published_url || null, doi: form.doi || null, publication_info: form.publication_info || null })
    const apcValue = form.apc_amount === '' ? null : Number(form.apc_amount)
    const revisionValue = form.revision_round === '' ? 0 : Number(form.revision_round)
    const revisionRound = Number.isFinite(revisionValue) ? Math.max(0, Math.trunc(revisionValue)) : 0
    const normalizedFiles = form.files.map(file => ({ n: file.n.trim(), p: /^https?:\/\//i.test(file.p.trim()) ? file.p.trim() : '', t: file.t?.trim() || '其它' })).filter(file => file.n || file.p)
    const correspondingAuthor = authors.find(name => norm(name) === norm(form.corresponding_author)) || null

    setSaving(true)
    try {
      await onSave({
        title: form.title.trim() || '未命名', title_zh: form.title_zh.trim() || null, journal: form.journal.trim() || null,
        manuscript_no: form.manuscript_no.trim() || null, submission_system: form.submission_system.trim() || null,
        system_status: latest.status, last_status_date: latest.date,
        next_action: form.next_action || inferred.action, reminder_level: form.reminder_level !== 'none' ? form.reminder_level : inferred.reminder,
        apc_amount: apcValue !== null && Number.isFinite(apcValue) && apcValue >= 0 ? apcValue : null,
        apc_currency: form.apc_currency.trim().toUpperCase() || 'USD', revision_round: revisionRound,
        followup_log: form.followup_log.trim() || null,
        doi: form.doi.trim() || null, publication_info: form.publication_info.trim() || null, citation: form.citation.trim() || null,
        journal_url: form.journal_url.trim() || null, journal_apc_note: form.journal_apc_note.trim() || null,
        status: mainStatus, lang: form.lang, quartile_jcr: form.quartile_jcr, quartile_cas: form.quartile_cas,
        quartile_new: form.quartile_new, quartile_cust: form.quartile_cust, quartile_zh: form.quartile_zh.map(item => item.trim()),
        authors, corresponding_author: correspondingAuthor,
        submitted_date: form.submitted_date || null, resolve_date: form.resolve_date || null, deadline: form.deadline || null,
        tracking_url: form.tracking_url.trim() || null, published_url: form.published_url.trim() || null,
        timeline: form.timeline.trim() || null, notes: form.notes.trim() || null, prev_id: form.prev_id || null,
        files: normalizedFiles.length ? normalizedFiles : null, updated_at: new Date().toISOString(),
      })
    } catch (error) {
      console.error('Save paper failed:', error)
      alert(error instanceof Error ? `保存失败：${error.message}` : '保存失败，请检查网络或数据格式后重试。')
    } finally {
      setSaving(false)
    }
  }

  const close = () => { if (!saving) onClose() }

  return <div className="modal-overlay" onClick={close}><div className="modal compact-form-modal" onClick={event => event.stopPropagation()}>
    <div className="compact-form-header"><div><h3>{isNew ? '新建投稿记录' : '编辑投稿记录'}</h3><p>{form.journal || '未填写期刊'} · {STATUSES.find(status => status.key === form.status)?.label || form.status}</p></div><button className="btn btn-ghost btn-icon" onClick={close} disabled={saving}><X size={18} /></button></div>
    <div className="compact-form-body">
      <Section title="基本信息" subtitle="题名、期刊、主状态" tone="blue">
        <div className="compact-grid two"><Field label="文章语言"><select className="select" value={form.lang} onChange={event => set('lang', event.target.value)}><option value="zh">中文</option><option value="en">英文</option></select></Field><Field label="当前主状态"><select className="select" value={form.status} onChange={event => set('status', event.target.value)}>{STATUSES.map(status => <option key={status.key} value={status.key}>{status.emoji} {status.label}</option>)}</select></Field></div>
        <Field label="论文标题" wide><input className="input title-input" value={form.title} onChange={event => set('title', event.target.value)} /></Field>
        {form.lang === 'en' && <Field label="中文翻译标题" wide><input className="input" value={form.title_zh} onChange={event => set('title_zh', event.target.value)} /></Field>}
        <Field label="目标期刊 / 会议" wide><input className="input" list="journal-options" value={form.journal} onChange={event => { set('journal', event.target.value); setRankResult(null); setRankError('') }} /></Field>
        <datalist id="journal-options">{journalNames.map(name => <option key={name} value={name} />)}</datalist>
        <div className="paper-journal-tools">
          {journalProfile && <div className="profile-suggestion"><span>检测到历史期刊档案：{journalProfile.journal}</span><button type="button" className="timeline-link-btn" onClick={applyJournalProfile}>带出期刊信息</button></div>}
          {onLookupJournalRanks && <button type="button" className="btn btn-rank btn-sm" onClick={() => void queryRanks()} disabled={!form.journal.trim() || rankLoading}>{rankLoading ? <RefreshCw size={13} className="spin" /> : <Sparkles size={13} />} {rankLoading ? '查询中' : '查询 EasyScholar'}</button>}
        </div>
        {rankError && <div className="paper-rank-error">{rankError}</div>}
        {rankResult && <div className="paper-rank-result"><div className="paper-rank-result-head"><span>已获取 {rankResult.items.length} 项等级{rankResult.cached ? '（缓存）' : ''}</span><button type="button" className="btn btn-ghost btn-sm" onClick={applyRankResult}>应用主要等级</button></div><div className="journal-rank-chips">{rankResult.items.map(item => <span key={item.key} data-group={item.group}><b>{item.label}</b>{item.value}</span>)}</div></div>}
      </Section>

      <Section title="投稿与期刊档案" subtitle="投稿入口、期刊官网、费用备注" tone="green">
        <div className="compact-grid two"><Field label="稿件编号"><input className="input" value={form.manuscript_no} onChange={event => set('manuscript_no', event.target.value)} /></Field><Field label="投稿系统"><input className="input" list="submission-system-options" value={form.submission_system} onChange={event => set('submission_system', event.target.value)} /></Field></div>
        <datalist id="submission-system-options">{SUBMISSION_SYSTEM_OPTIONS.map(option => <option key={option} value={option} />)}</datalist>
        <div className="compact-grid two"><Field label="投稿后台 URL"><input className="input" value={form.tracking_url} onChange={event => set('tracking_url', event.target.value)} placeholder="https://..." /></Field><Field label="期刊官网 / 作者指南"><input className="input" value={form.journal_url} onChange={event => set('journal_url', event.target.value)} placeholder="https://..." /></Field></div>
        <div className="compact-grid four"><Field label="下一步行动"><select className="select" value={form.next_action} onChange={event => set('next_action', event.target.value)}><option value="">自动判断</option>{NEXT_ACTION_OPTIONS.map(option => <option key={option} value={option}>{option}</option>)}</select></Field><Field label="提醒级别"><select className="select" value={form.reminder_level} onChange={event => set('reminder_level', event.target.value)}>{REMINDER_LEVELS.map(level => <option key={level.key} value={level.key}>{level.label}</option>)}</select></Field><Field label="返修轮次"><input type="number" min="0" step="1" className="input" value={form.revision_round} onChange={event => set('revision_round', event.target.value)} /></Field><Field label="APC / 币种"><div className="compact-fee"><input type="number" min="0" className="input" value={form.apc_amount} onChange={event => set('apc_amount', event.target.value)} /><input className="input" value={form.apc_currency} onChange={event => set('apc_currency', event.target.value.toUpperCase())} maxLength={8} /></div></Field></div>
        <Field label="APC / 开源 / 期刊备注" wide><input className="input" value={form.journal_apc_note} onChange={event => set('journal_apc_note', event.target.value)} placeholder="如：APC 约 2000 USD；可选 OA；平均审稿 2–3 个月" /></Field>
      </Section>

      <Section title="作者与分区" subtitle="署名、通讯、期刊等级" tone="purple">
        <Field label="版本追溯" wide><select className="select" value={form.prev_id} onChange={event => set('prev_id', event.target.value)}><option value="">常规首投</option>{versionCandidates.map(item => <option key={item.id} value={item.id}>{item.title || '未命名'} [{item.journal || '未知期刊'}]</option>)}</select></Field>
        {form.lang === 'en' ? <div className="compact-grid four"><Field label="JCR"><select className="select" value={form.quartile_jcr} onChange={event => set('quartile_jcr', event.target.value)}>{JCR_OPTIONS.map(option => <option key={option}>{option}</option>)}</select></Field><Field label="中科院"><select className="select" value={form.quartile_cas} onChange={event => set('quartile_cas', event.target.value)}>{CAS_OPTIONS.map(option => <option key={option}>{option}</option>)}</select></Field><Field label="新锐"><input className="input" value={form.quartile_new} onChange={event => set('quartile_new', event.target.value)} /></Field><Field label="自定义等级"><input className="input" value={form.quartile_cust} onChange={event => set('quartile_cust', event.target.value)} /></Field></div> : <div className="compact-grid four">{[0, 1, 2, 3].map(index => <Field key={index} label={`分类 ${index + 1}`}><input className="input" value={form.quartile_zh[index] || ''} onChange={event => { const next = [...form.quartile_zh]; next[index] = event.target.value; set('quartile_zh', next) }} /></Field>)}</div>}
        <div className="compact-grid two"><Field label="作者名单"><input className="input" value={authorsText} onChange={event => setAuthorsText(event.target.value)} placeholder="用逗号、分号或空格分隔" /></Field><Field label="通讯作者"><select className="select" value={form.corresponding_author} onChange={event => set('corresponding_author', event.target.value)}><option value="">未指定</option>{authors.map((author, index) => <option key={`${author}-${index}`} value={author}>{author}</option>)}</select></Field></div>
      </Section>

      <Section title="日期与审稿时间线" subtitle="自动提取最新审稿状态" tone="orange"><div className="compact-grid three"><Field label="首投日期"><input type="date" className="input" value={form.submitted_date} onChange={event => set('submitted_date', event.target.value)} /></Field><Field label="终审 / 录用日期"><input type="date" className="input" value={form.resolve_date} onChange={event => set('resolve_date', event.target.value)} /></Field><Field label="修回截止"><input type="date" className="input" value={form.deadline} onChange={event => set('deadline', event.target.value)} /></Field></div><Timeline value={form.timeline} onChange={next => set('timeline', next)} customOpts={customTl} onAddCustomOpt={option => setCustomTl(previous => [...previous, option])} /></Section>

      <Section title="成果归档" subtitle="DOI、卷期页码、引用格式" tone="green"><div className="compact-grid two"><Field label="见刊 / 在线发表 URL"><input className="input" value={form.published_url} onChange={event => set('published_url', event.target.value)} placeholder="https://..." /></Field><Field label="DOI"><input className="input" value={form.doi} onChange={event => set('doi', event.target.value)} placeholder="10.xxxx/xxxxx" /></Field></div><Field label="卷期页码 / 在线发表信息" wide><input className="input" value={form.publication_info} onChange={event => set('publication_info', event.target.value)} placeholder="如：50(8), 123–145；Article 70113；Online first" /></Field><Field label="标准引用格式" wide><textarea className="textarea" value={form.citation} onChange={event => set('citation', event.target.value)} placeholder="可粘贴 GB/T、APA 或期刊要求的引用格式" /></Field></Section>

      <Section title="文件与备注" subtitle={onUploadFile ? '附件分类、催稿、补充说明' : '离线版仅记录文件名称和可选外部链接'} tone="slate"><div className="compact-file-head"><span>文件归档</span><button type="button" className="btn btn-ghost btn-sm" onClick={addFile}>+ 添加文件</button></div>{form.files.length > 0 && <div className="compact-files">{form.files.map((file, index) => <div key={index} className="compact-file-row archive-file-row"><select className="select" value={file.t || '其它'} onChange={event => updateFile(index, 't', event.target.value)}>{FILE_TYPE_OPTIONS.map(option => <option key={option} value={option}>{option}</option>)}</select>{onUploadFile ? <button type="button" className="file-icon" onClick={() => upload(index)} disabled={uploading !== null}>{uploading === index ? <Loader size={15} className="spinner" /> : <FileText size={15} />}</button> : <span className="file-icon" title="离线版不上传文件"><FileText size={15} /></span>}<input className="input" value={file.n} onChange={event => updateFile(index, 'n', event.target.value)} placeholder="文件名称" /><input className="input" value={file.p} onChange={event => updateFile(index, 'p', event.target.value)} placeholder="可选在线文件 URL" /><button type="button" className="file-action-btn" onClick={() => removeFile(index)}><Trash2 size={13} /></button></div>)}</div>}<div className="compact-grid two textarea-grid"><Field label="沟通记录"><textarea className="textarea" value={form.followup_log} onChange={event => set('followup_log', event.target.value)} /></Field><Field label="备注 / 意见"><textarea className="textarea" value={form.notes} onChange={event => set('notes', event.target.value)} /></Field></div></Section>
    </div>
    <div className="compact-form-footer">{!isNew ? <button type="button" className="btn btn-danger btn-sm" disabled={saving} onClick={() => onDelete((paper as Paper).id)}><Trash2 size={14} /> 删除记录</button> : <div />}<div className="compact-footer-actions"><button type="button" className="btn btn-ghost" onClick={close} disabled={saving}>取消</button><button type="button" className="btn btn-primary" onClick={save} disabled={saving}><Save size={14} /> {saving ? '保存中...' : '保存'}</button></div></div>
  </div></div>
}
