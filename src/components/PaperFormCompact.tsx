import { useState, type ReactNode } from 'react'
import { FileText, Loader, Save, Trash2, X } from 'lucide-react'
import type { Paper } from '../lib/types'
import { CAS_OPTIONS, JCR_OPTIONS, NEXT_ACTION_OPTIONS, REMINDER_LEVELS, STATUSES, SUBMISSION_SYSTEM_OPTIONS } from '../lib/types'
import { uploadFile } from '../lib/storage'
import Timeline from './Timeline'

interface FileItem { n: string; p: string }

interface Props {
  paper: Paper | 'new'
  allPapers: Paper[]
  currentUsername: string
  onSave: (data: Partial<Paper>) => void | Promise<void>
  onDelete: (id: string) => void | Promise<void>
  onClose: () => void
}

type FormState = {
  title: string
  title_zh: string
  journal: string
  manuscript_no: string
  submission_system: string
  next_action: string
  reminder_level: string
  apc_amount: string
  apc_currency: string
  revision_round: string
  followup_log: string
  status: string
  lang: string
  quartile_jcr: string
  quartile_cas: string
  quartile_new: string
  quartile_cust: string
  quartile_zh: string[]
  authors: string[]
  corresponding_author: string
  files: FileItem[]
  submitted_date: string
  resolve_date: string
  deadline: string
  tracking_url: string
  published_url: string
  notes: string
  timeline: string
  prev_id: string
  system_status: string
  last_status_date: string
}

const blankZhQuartile = ['', '', '', '']
const text = (value: unknown) => value === null || value === undefined ? '' : String(value)

function initForm(paper: Paper | 'new', currentUsername: string): FormState {
  if (paper === 'new') {
    return {
      title: '', title_zh: '', journal: '', manuscript_no: '', submission_system: '',
      next_action: '', reminder_level: 'none', apc_amount: '', apc_currency: 'USD', revision_round: '', followup_log: '',
      status: 'preparing', lang: 'zh', quartile_jcr: '未定', quartile_cas: '未定', quartile_new: '无', quartile_cust: '无', quartile_zh: [...blankZhQuartile],
      authors: currentUsername ? [currentUsername] : [], corresponding_author: '', files: [],
      submitted_date: '', resolve_date: '', deadline: '', tracking_url: '', published_url: '', notes: '', timeline: '', prev_id: '', system_status: '', last_status_date: '',
    }
  }

  return {
    title: paper.title || '',
    title_zh: paper.title_zh || '',
    journal: paper.journal || '',
    manuscript_no: paper.manuscript_no || '',
    submission_system: paper.submission_system || '',
    next_action: paper.next_action || '',
    reminder_level: paper.reminder_level || 'none',
    apc_amount: text(paper.apc_amount),
    apc_currency: paper.apc_currency || 'USD',
    revision_round: paper.revision_round ? String(paper.revision_round) : '',
    followup_log: paper.followup_log || '',
    status: paper.status || 'preparing',
    lang: paper.lang || 'zh',
    quartile_jcr: paper.quartile_jcr || '未定',
    quartile_cas: paper.quartile_cas || '未定',
    quartile_new: paper.quartile_new || '无',
    quartile_cust: paper.quartile_cust || '无',
    quartile_zh: paper.quartile_zh || [...blankZhQuartile],
    authors: [...(paper.authors || [])],
    corresponding_author: paper.corresponding_author || '',
    files: [...(paper.files || [])],
    submitted_date: paper.submitted_date || '',
    resolve_date: paper.resolve_date || '',
    deadline: paper.deadline || '',
    tracking_url: paper.tracking_url || '',
    published_url: paper.published_url || '',
    notes: paper.notes || '',
    timeline: paper.timeline || '',
    prev_id: paper.prev_id || '',
    system_status: paper.system_status || '',
    last_status_date: paper.last_status_date || '',
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

function Section({ title, subtitle, tone, children }: { title: string; subtitle?: string; tone?: string; children: ReactNode }) {
  return (
    <section className="compact-section" data-tone={tone || 'blue'}>
      <div className="compact-section-head">
        <h4>{title}</h4>
        {subtitle && <span>{subtitle}</span>}
      </div>
      {children}
    </section>
  )
}

function Field({ label, children, wide }: { label: string; children: ReactNode; wide?: boolean }) {
  return (
    <label className={`compact-field ${wide ? 'wide' : ''}`}>
      <span>{label}</span>
      {children}
    </label>
  )
}

export default function PaperFormCompact({ paper, allPapers, currentUsername, onSave, onDelete, onClose }: Props) {
  const isNew = paper === 'new'
  const [form, setForm] = useState<FormState>(() => initForm(paper, currentUsername))
  const [authorsText, setAuthorsText] = useState(form.authors.join(', '))
  const [uploading, setUploading] = useState<number | null>(null)
  const [customTl, setCustomTl] = useState<string[]>([])

  const authors = authorsText.split(/[，,;；、\s]+/).map(item => item.trim()).filter(Boolean)
  const set = <K extends keyof FormState>(key: K, value: FormState[K]) => setForm(prev => ({ ...prev, [key]: value }))

  const save = () => {
    const latest = latestTimelineState(form.timeline, form.system_status, form.last_status_date)
    const apc = form.apc_amount ? Number(form.apc_amount) : null
    const revisionRound = form.revision_round ? Number(form.revision_round) : 0
    const files = form.files.filter(file => /^https?:\/\//i.test(file.p))

    onSave({
      title: form.title || '未命名',
      title_zh: form.title_zh || null,
      journal: form.journal || null,
      manuscript_no: form.manuscript_no || null,
      submission_system: form.submission_system || null,
      system_status: latest.status,
      last_status_date: latest.date,
      next_action: form.next_action || null,
      reminder_level: form.reminder_level || 'none',
      apc_amount: apc !== null && Number.isFinite(apc) ? apc : null,
      apc_currency: form.apc_currency || 'USD',
      revision_round: Number.isFinite(revisionRound) ? revisionRound : 0,
      followup_log: form.followup_log || null,
      status: form.status,
      lang: form.lang,
      quartile_jcr: form.quartile_jcr,
      quartile_cas: form.quartile_cas,
      quartile_new: form.quartile_new,
      quartile_cust: form.quartile_cust,
      quartile_zh: form.quartile_zh,
      authors,
      corresponding_author: form.corresponding_author || null,
      submitted_date: form.submitted_date || null,
      resolve_date: form.resolve_date || null,
      deadline: form.deadline || null,
      tracking_url: form.tracking_url || null,
      published_url: form.published_url || null,
      timeline: form.timeline || null,
      notes: form.notes || null,
      prev_id: form.prev_id || null,
      files: files.length ? files : null,
      updated_at: new Date().toISOString(),
    })
  }

  const addFile = () => setForm(prev => ({ ...prev, files: [...prev.files, { n: '', p: '' }] }))
  const updateFile = (idx: number, field: 'n' | 'p', value: string) => setForm(prev => {
    const files = [...prev.files]
    files[idx] = { ...files[idx], [field]: value }
    return { ...prev, files }
  })
  const removeFile = (idx: number) => setForm(prev => ({ ...prev, files: prev.files.filter((_, i) => i !== idx) }))

  const upload = async (idx: number) => {
    const input = document.createElement('input')
    input.type = 'file'
    input.onchange = async event => {
      const file = (event.target as HTMLInputElement).files?.[0]
      if (!file) return
      updateFile(idx, 'n', file.name)
      updateFile(idx, 'p', '上传中...')
      setUploading(idx)
      const result = await uploadFile(file)
      setUploading(null)
      if (!result) {
        updateFile(idx, 'p', '')
        alert('上传失败：文件存储尚未配置完整，或当前网络/权限不可用。请先使用可访问的在线链接，或检查 R2 配置。')
        return
      }
      updateFile(idx, 'p', result.fileUrl)
    }
    input.click()
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal compact-form-modal" onClick={event => event.stopPropagation()}>
        <div className="compact-form-header">
          <div>
            <h3>{isNew ? '新建投稿记录' : '编辑投稿记录'}</h3>
            <p>{form.journal || '未填写期刊'} · {form.status ? STATUSES.find(s => s.key === form.status)?.label || form.status : '未设置状态'}</p>
          </div>
          <button className="btn btn-ghost btn-icon" onClick={onClose}><X size={18} /></button>
        </div>

        <div className="compact-form-body">
          <Section title="基本信息" subtitle="题名、期刊、主状态" tone="blue">
            <div className="compact-grid two">
              <Field label="文章语言"><select className="select" value={form.lang} onChange={e => set('lang', e.target.value)}><option value="zh">中文</option><option value="en">英文</option></select></Field>
              <Field label="当前主状态"><select className="select" value={form.status} onChange={e => set('status', e.target.value)}>{STATUSES.map(s => <option key={s.key} value={s.key}>{s.emoji} {s.label}</option>)}</select></Field>
            </div>
            <Field label="论文标题" wide><input className="input title-input" value={form.title} onChange={e => set('title', e.target.value)} /></Field>
            {form.lang === 'en' && <Field label="中文翻译标题" wide><input className="input" value={form.title_zh} onChange={e => set('title_zh', e.target.value)} /></Field>}
            <Field label="目标期刊 / 会议" wide><input className="input" value={form.journal} onChange={e => set('journal', e.target.value)} /></Field>
          </Section>

          <Section title="投稿信息" subtitle="编号、后台、发表链接" tone="green">
            <div className="compact-grid two">
              <Field label="稿件编号"><input className="input" value={form.manuscript_no} onChange={e => set('manuscript_no', e.target.value)} /></Field>
              <Field label="投稿系统"><input className="input" list="submission-system-options" value={form.submission_system} onChange={e => set('submission_system', e.target.value)} /></Field>
            </div>
            <datalist id="submission-system-options">{SUBMISSION_SYSTEM_OPTIONS.map(option => <option key={option} value={option} />)}</datalist>
            <div className="compact-grid two">
              <Field label="投稿后台 URL"><input className="input" value={form.tracking_url} onChange={e => set('tracking_url', e.target.value)} placeholder="https://..." /></Field>
              <Field label="见刊 / 在线发表 URL"><input className="input" value={form.published_url} onChange={e => set('published_url', e.target.value)} placeholder="https://..." /></Field>
            </div>
            <div className="compact-grid four">
              <Field label="下一步行动"><select className="select" value={form.next_action} onChange={e => set('next_action', e.target.value)}><option value="">自动判断</option>{NEXT_ACTION_OPTIONS.map(option => <option key={option} value={option}>{option}</option>)}</select></Field>
              <Field label="提醒级别"><select className="select" value={form.reminder_level} onChange={e => set('reminder_level', e.target.value)}>{REMINDER_LEVELS.map(level => <option key={level.key} value={level.key}>{level.label}</option>)}</select></Field>
              <Field label="返修轮次"><input type="number" min="0" className="input" value={form.revision_round} onChange={e => set('revision_round', e.target.value)} /></Field>
              <Field label="APC / 币种"><div className="compact-fee"><input type="number" min="0" className="input" value={form.apc_amount} onChange={e => set('apc_amount', e.target.value)} /><input className="input" value={form.apc_currency} onChange={e => set('apc_currency', e.target.value.toUpperCase())} /></div></Field>
            </div>
          </Section>

          <Section title="作者与分区" subtitle="署名、通讯、期刊分区" tone="purple">
            <Field label="版本追溯" wide><select className="select" value={form.prev_id} onChange={e => set('prev_id', e.target.value)}><option value="">常规首投</option>{allPapers.filter(item => isNew || item.id !== (paper as Paper).id).map(item => <option key={item.id} value={item.id}>{item.title || '未命名'} [{item.journal || '未知期刊'}]</option>)}</select></Field>
            {form.lang === 'en' ? (
              <div className="compact-grid four">
                <Field label="JCR"><select className="select" value={form.quartile_jcr} onChange={e => set('quartile_jcr', e.target.value)}>{JCR_OPTIONS.map(option => <option key={option}>{option}</option>)}</select></Field>
                <Field label="中科院"><select className="select" value={form.quartile_cas} onChange={e => set('quartile_cas', e.target.value)}>{CAS_OPTIONS.map(option => <option key={option}>{option}</option>)}</select></Field>
                <Field label="新锐"><input className="input" value={form.quartile_new} onChange={e => set('quartile_new', e.target.value)} /></Field>
                <Field label="自定义"><input className="input" value={form.quartile_cust} onChange={e => set('quartile_cust', e.target.value)} /></Field>
              </div>
            ) : (
              <div className="compact-grid four">
                {[0, 1, 2, 3].map(index => <Field key={index} label={`分类 ${index + 1}`}><input className="input" value={form.quartile_zh[index] || ''} onChange={e => { const next = [...form.quartile_zh]; next[index] = e.target.value; set('quartile_zh', next) }} /></Field>)}
              </div>
            )}
            <div className="compact-grid two">
              <Field label="作者名单"><input className="input" value={authorsText} onChange={e => setAuthorsText(e.target.value)} /></Field>
              <Field label="通讯作者"><select className="select" value={form.corresponding_author} onChange={e => set('corresponding_author', e.target.value)}><option value="">未指定</option>{authors.map((author, index) => <option key={`${author}-${index}`} value={author}>{author}</option>)}</select></Field>
            </div>
          </Section>

          <Section title="日期与审稿时间线" subtitle="自动提取最新审稿状态" tone="orange">
            <div className="compact-grid three">
              <Field label="首投日期"><input type="date" className="input" value={form.submitted_date} onChange={e => set('submitted_date', e.target.value)} /></Field>
              <Field label="终审 / 录用日期"><input type="date" className="input" value={form.resolve_date} onChange={e => set('resolve_date', e.target.value)} /></Field>
              <Field label="修回截止"><input type="date" className="input" value={form.deadline} onChange={e => set('deadline', e.target.value)} /></Field>
            </div>
            <Timeline value={form.timeline} onChange={value => set('timeline', value)} customOpts={customTl} onAddCustomOpt={option => setCustomTl(prev => [...prev, option])} />
          </Section>

          <Section title="文件与备注" subtitle="附件、催稿、补充说明" tone="slate">
            <div className="compact-file-head"><span>文件归档</span><button className="btn btn-ghost btn-sm" onClick={addFile}>+ 添加文件</button></div>
            {form.files.length > 0 && <div className="compact-files">{form.files.map((file, index) => <div key={index} className="compact-file-row"><button type="button" className="file-icon" onClick={() => upload(index)}>{uploading === index ? <Loader size={15} className="spinner" /> : <FileText size={15} />}</button><input className="input" value={file.n} onChange={e => updateFile(index, 'n', e.target.value)} placeholder="文件名称" /><input className="input" value={file.p} onChange={e => updateFile(index, 'p', e.target.value)} placeholder="在线文件 URL" /><button className="file-action-btn" onClick={() => removeFile(index)}><Trash2 size={13} /></button></div>)}</div>}
            <div className="compact-grid two textarea-grid">
              <Field label="催稿 / 沟通记录"><textarea className="textarea" value={form.followup_log} onChange={e => set('followup_log', e.target.value)} /></Field>
              <Field label="备注 / 意见"><textarea className="textarea" value={form.notes} onChange={e => set('notes', e.target.value)} /></Field>
            </div>
          </Section>
        </div>

        <div className="compact-form-footer">
          {!isNew ? <button className="btn btn-danger btn-sm" onClick={() => onDelete((paper as Paper).id)}><Trash2 size={14} /> 删除记录</button> : <div />}
          <div className="compact-footer-actions"><button className="btn btn-ghost" onClick={onClose}>取消</button><button className="btn btn-primary" onClick={save}><Save size={14} /> 保存</button></div>
        </div>
      </div>
    </div>
  )
}
