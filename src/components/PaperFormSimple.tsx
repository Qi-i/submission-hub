import { useState } from 'react'
import { FileText, Loader, Save, Trash2, X } from 'lucide-react'
import type { Paper } from '../lib/types'
import { CAS_OPTIONS, JCR_OPTIONS, NEXT_ACTION_OPTIONS, REMINDER_LEVELS, STATUSES, SUBMISSION_SYSTEM_OPTIONS } from '../lib/types'
import { uploadFile } from '../lib/storage'
import Timeline from './Timeline'

interface FileItem { n: string; p: string }
interface Props { paper: Paper | 'new'; allPapers: Paper[]; currentUsername: string; onSave: (data: Partial<Paper>) => void | Promise<void>; onDelete: (id: string) => void | Promise<void>; onClose: () => void }

type FormState = {
  title: string; title_zh: string; journal: string; manuscript_no: string; submission_system: string; next_action: string; reminder_level: string; apc_amount: string; apc_currency: string; revision_round: string; followup_log: string;
  status: string; lang: string; quartile_jcr: string; quartile_cas: string; quartile_new: string; quartile_cust: string; quartile_zh: string[]; authors: string[]; corresponding_author: string;
  files: FileItem[]; submitted_date: string; resolve_date: string; deadline: string; tracking_url: string; published_url: string; notes: string; timeline: string; prev_id: string; system_status: string; last_status_date: string;
}

const val = (v: unknown) => v === null || v === undefined ? '' : String(v)

function init(paper: Paper | 'new', currentUsername: string): FormState {
  if (paper === 'new') return { title: '', title_zh: '', journal: '', manuscript_no: '', submission_system: '', next_action: '', reminder_level: 'none', apc_amount: '', apc_currency: 'USD', revision_round: '', followup_log: '', status: 'preparing', lang: 'zh', quartile_jcr: '未定', quartile_cas: '未定', quartile_new: '无', quartile_cust: '无', quartile_zh: ['', '', '', ''], authors: currentUsername ? [currentUsername] : [], corresponding_author: '', files: [], submitted_date: '', resolve_date: '', deadline: '', tracking_url: '', published_url: '', notes: '', timeline: '', prev_id: '', system_status: '', last_status_date: '' }
  return { title: paper.title || '', title_zh: paper.title_zh || '', journal: paper.journal || '', manuscript_no: paper.manuscript_no || '', submission_system: paper.submission_system || '', next_action: paper.next_action || '', reminder_level: paper.reminder_level || 'none', apc_amount: val(paper.apc_amount), apc_currency: paper.apc_currency || 'USD', revision_round: paper.revision_round ? String(paper.revision_round) : '', followup_log: paper.followup_log || '', status: paper.status, lang: paper.lang, quartile_jcr: paper.quartile_jcr || '未定', quartile_cas: paper.quartile_cas || '未定', quartile_new: paper.quartile_new || '无', quartile_cust: paper.quartile_cust || '无', quartile_zh: paper.quartile_zh || ['', '', '', ''], authors: [...(paper.authors || [])], corresponding_author: paper.corresponding_author || '', files: [...(paper.files || [])], submitted_date: paper.submitted_date || '', resolve_date: paper.resolve_date || '', deadline: paper.deadline || '', tracking_url: paper.tracking_url || '', published_url: paper.published_url || '', notes: paper.notes || '', timeline: paper.timeline || '', prev_id: paper.prev_id || '', system_status: paper.system_status || '', last_status_date: paper.last_status_date || '' }
}

function latestTimeline(timeline: string, fallbackStatus: string, fallbackDate: string) {
  const rows = timeline.split('\n').map(r => r.trim()).filter(Boolean)
  if (!rows.length) return { status: fallbackStatus || null, date: fallbackDate || null }
  const last = rows[rows.length - 1]
  const m = last.match(/^(\d{4}[-/.]\d{1,2}[-/.]\d{1,2})\s*(.*)$/)
  if (!m) return { status: last || fallbackStatus || null, date: fallbackDate || null }
  const date = m[1].replace(/[/.]/g, '-').replace(/-(\d)-/g, '-0$1-').replace(/-(\d)$/g, '-0$1')
  const status = (m[2] || '').trim().split(/\s+-\s+/)[0]?.trim() || fallbackStatus || null
  return { status, date }
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return <section className="simple-form-section"><h4>{title}</h4>{children}</section>
}

export default function PaperFormSimple({ paper, allPapers, currentUsername, onSave, onDelete, onClose }: Props) {
  const isNew = paper === 'new'
  const [form, setForm] = useState<FormState>(() => init(paper, currentUsername))
  const [authorsText, setAuthorsText] = useState(form.authors.join(', '))
  const [uploading, setUploading] = useState<number | null>(null)
  const [customTl, setCustomTl] = useState<string[]>([])
  const authors = authorsText.split(/[，,;；、\s]+/).map(a => a.trim()).filter(Boolean)
  const set = <K extends keyof FormState>(key: K, value: FormState[K]) => setForm(prev => ({ ...prev, [key]: value }))

  const save = () => {
    const latest = latestTimeline(form.timeline, form.system_status, form.last_status_date)
    const apc = form.apc_amount ? Number(form.apc_amount) : null
    const round = form.revision_round ? Number(form.revision_round) : 0
    const files = form.files.filter(f => /^https?:\/\//i.test(f.p))
    onSave({ title: form.title || '未命名', title_zh: form.title_zh || null, journal: form.journal || null, manuscript_no: form.manuscript_no || null, submission_system: form.submission_system || null, system_status: latest.status, last_status_date: latest.date, next_action: form.next_action || null, reminder_level: form.reminder_level || 'none', apc_amount: apc !== null && Number.isFinite(apc) ? apc : null, apc_currency: form.apc_currency || 'USD', revision_round: Number.isFinite(round) ? round : 0, followup_log: form.followup_log || null, status: form.status, lang: form.lang, quartile_jcr: form.quartile_jcr, quartile_cas: form.quartile_cas, quartile_new: form.quartile_new, quartile_cust: form.quartile_cust, quartile_zh: form.quartile_zh, authors, corresponding_author: form.corresponding_author || null, files: files.length ? files : null, submitted_date: form.submitted_date || null, resolve_date: form.resolve_date || null, deadline: form.deadline || null, tracking_url: form.tracking_url || null, published_url: form.published_url || null, notes: form.notes || null, timeline: form.timeline || null, prev_id: form.prev_id || null, updated_at: new Date().toISOString() })
  }

  const addFile = () => setForm(prev => ({ ...prev, files: [...prev.files, { n: '', p: '' }] }))
  const updateFile = (idx: number, field: 'n' | 'p', value: string) => setForm(prev => { const files = [...prev.files]; files[idx] = { ...files[idx], [field]: value }; return { ...prev, files } })
  const removeFile = (idx: number) => setForm(prev => ({ ...prev, files: prev.files.filter((_, i) => i !== idx) }))
  const upload = async (idx: number) => {
    const input = document.createElement('input')
    input.type = 'file'
    input.onchange = async e => {
      const file = (e.target as HTMLInputElement).files?.[0]
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

  return <div className="modal-overlay" onClick={onClose}><div className="modal simple-form-modal" onClick={e => e.stopPropagation()}>
    <div className="modal-header"><h3 className="modal-title">{isNew ? '新建投稿记录' : '编辑投稿记录'}</h3><button className="btn btn-ghost btn-icon" onClick={onClose}><X size={18} /></button></div>
    <div className="modal-body simple-form-body">
      <Section title="基本信息"><div className="field-row"><div className="field"><label className="field-label">文章语言</label><select className="select" value={form.lang} onChange={e => set('lang', e.target.value)}><option value="zh">中文</option><option value="en">英文</option></select></div><div className="field"><label className="field-label">当前主状态</label><select className="select" value={form.status} onChange={e => set('status', e.target.value)}>{STATUSES.map(s => <option key={s.key} value={s.key}>{s.emoji} {s.label}</option>)}</select></div></div><div className="field"><label className="field-label">论文标题 *</label><input className="input" value={form.title} onChange={e => set('title', e.target.value)} /></div>{form.lang === 'en' && <div className="field"><label className="field-label">中文翻译标题</label><input className="input" value={form.title_zh} onChange={e => set('title_zh', e.target.value)} /></div>}<div className="field"><label className="field-label">目标期刊 / 会议</label><input className="input" value={form.journal} onChange={e => set('journal', e.target.value)} /></div></Section>
      <Section title="投稿与发表链接"><div className="form-hint">最新审稿状态自动取自“审稿时间线”的最后一条记录。投稿后台和见刊页面都可以填写在线网址，卡片上会显示跳转入口。</div><div className="field-row"><div className="field"><label className="field-label">稿件编号</label><input className="input" value={form.manuscript_no} onChange={e => set('manuscript_no', e.target.value)} /></div><div className="field"><label className="field-label">投稿系统</label><input className="input" list="submission-system-options" value={form.submission_system} onChange={e => set('submission_system', e.target.value)} /><datalist id="submission-system-options">{SUBMISSION_SYSTEM_OPTIONS.map(o => <option key={o} value={o} />)}</datalist></div></div><div className="field-row"><div className="field"><label className="field-label">投稿后台 URL</label><input className="input" value={form.tracking_url} onChange={e => set('tracking_url', e.target.value)} placeholder="https://..." /></div><div className="field"><label className="field-label">见刊 / 在线发表 URL</label><input className="input" value={form.published_url} onChange={e => set('published_url', e.target.value)} placeholder="https://..." /></div></div><div className="field-row"><div className="field"><label className="field-label">下一步行动</label><select className="select" value={form.next_action} onChange={e => set('next_action', e.target.value)}><option value="">自动判断</option>{NEXT_ACTION_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}</select></div><div className="field"><label className="field-label">提醒级别</label><select className="select" value={form.reminder_level} onChange={e => set('reminder_level', e.target.value)}>{REMINDER_LEVELS.map(o => <option key={o.key} value={o.key}>{o.label}</option>)}</select></div><div className="field"><label className="field-label">返修轮次</label><input type="number" min="0" className="input" value={form.revision_round} onChange={e => set('revision_round', e.target.value)} /></div><div className="field"><label className="field-label">APC / 版面费</label><div className="fee-field"><input type="number" min="0" className="input" value={form.apc_amount} onChange={e => set('apc_amount', e.target.value)} /><input className="input" value={form.apc_currency} onChange={e => set('apc_currency', e.target.value.toUpperCase())} /></div></div></div></Section>
      <Section title="作者与分区"><div className="field"><label className="field-label">版本追溯</label><select className="select" value={form.prev_id} onChange={e => set('prev_id', e.target.value)}><option value="">常规首投</option>{allPapers.filter(p => isNew || p.id !== (paper as Paper).id).map(p => <option key={p.id} value={p.id}>{p.title || '未命名'} [{p.journal || '未知期刊'}]</option>)}</select></div>{form.lang === 'en' ? <div className="field-row"><div className="field"><label className="field-label">JCR</label><select className="select" value={form.quartile_jcr} onChange={e => set('quartile_jcr', e.target.value)}>{JCR_OPTIONS.map(o => <option key={o}>{o}</option>)}</select></div><div className="field"><label className="field-label">中科院</label><select className="select" value={form.quartile_cas} onChange={e => set('quartile_cas', e.target.value)}>{CAS_OPTIONS.map(o => <option key={o}>{o}</option>)}</select></div><div className="field"><label className="field-label">新锐</label><input className="input" value={form.quartile_new} onChange={e => set('quartile_new', e.target.value)} /></div><div className="field"><label className="field-label">自定义</label><input className="input" value={form.quartile_cust} onChange={e => set('quartile_cust', e.target.value)} /></div></div> : <div className="field-row">{[0, 1, 2, 3].map(i => <div className="field" key={i}><label className="field-label">分类 {i + 1}</label><input className="input" value={form.quartile_zh[i] || ''} onChange={e => { const arr = [...form.quartile_zh]; arr[i] = e.target.value; set('quartile_zh', arr) }} /></div>)}</div>}<div className="field"><label className="field-label">作者名单</label><input className="input" value={authorsText} onChange={e => setAuthorsText(e.target.value)} /></div><div className="field"><label className="field-label">通讯作者</label><select className="select" value={form.corresponding_author} onChange={e => set('corresponding_author', e.target.value)}><option value="">未指定</option>{authors.map((a, i) => <option key={`${a}-${i}`} value={a}>{a}</option>)}</select></div></Section>
      <Section title="日期与时间线"><div className="field-row"><div className="field"><label className="field-label">首投日期</label><input type="date" className="input" value={form.submitted_date} onChange={e => set('submitted_date', e.target.value)} /></div><div className="field"><label className="field-label">终审 / 录用日期</label><input type="date" className="input" value={form.resolve_date} onChange={e => set('resolve_date', e.target.value)} /></div><div className="field"><label className="field-label">修回截止</label><input type="date" className="input" value={form.deadline} onChange={e => set('deadline', e.target.value)} /></div></div><Timeline value={form.timeline} onChange={value => set('timeline', value)} customOpts={customTl} onAddCustomOpt={opt => setCustomTl(prev => [...prev, opt])} /></Section>
      <Section title="文件与备注"><div className="file-archive-head"><span>文件归档</span><button className="btn btn-ghost btn-sm" onClick={addFile}>+ 添加文件</button></div><div className="file-grid-refined">{form.files.map((f, i) => <div key={i} className="file-box glass-panel"><button type="button" className="file-icon" onClick={() => upload(i)}>{uploading === i ? <Loader size={16} className="spinner" /> : <FileText size={16} />}</button><div className="file-fields"><input className="input" value={f.n} onChange={e => updateFile(i, 'n', e.target.value)} placeholder="文件名称" /><input className="input" value={f.p} onChange={e => updateFile(i, 'p', e.target.value)} placeholder="在线文件 URL" /></div><button className="file-action-btn" onClick={() => removeFile(i)}><Trash2 size={13} /></button></div>)}</div><div className="field"><label className="field-label">催稿 / 沟通记录</label><textarea className="textarea" value={form.followup_log} onChange={e => set('followup_log', e.target.value)} /></div><div className="field"><label className="field-label">备注 / 意见</label><textarea className="textarea" value={form.notes} onChange={e => set('notes', e.target.value)} /></div></Section>
    </div>
    <div className="modal-footer">{!isNew ? <button className="btn btn-danger btn-sm" onClick={() => onDelete((paper as Paper).id)}><Trash2 size={14} /> 删除记录</button> : <div />}<div style={{ display: 'flex', gap: 10 }}><button className="btn btn-ghost" onClick={onClose}>取消</button><button className="btn btn-primary" onClick={save}><Save size={14} /> 保存</button></div></div>
  </div></div>
}
