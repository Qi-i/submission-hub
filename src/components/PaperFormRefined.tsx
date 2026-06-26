import { useMemo, useState } from 'react'
import { X, Save, Trash2, FileText, Loader, ChevronDown } from 'lucide-react'
import type { Paper } from '../lib/types'
import { STATUSES, JCR_OPTIONS, CAS_OPTIONS, SYSTEM_STATUS_PRESETS, SUBMISSION_SYSTEM_OPTIONS, NEXT_ACTION_OPTIONS, REMINDER_LEVELS } from '../lib/types'
import Timeline from './Timeline'
import { uploadFile } from '../lib/storage'

interface FileItem { n: string; p: string }
interface Props {
  paper: Paper | 'new'
  allPapers: Paper[]
  currentUsername: string
  onSave: (data: Partial<Paper>) => void | Promise<void>
  onDelete: (id: string) => void | Promise<void>
  onClose: () => void
}

type SectionKey = 'basic' | 'workflow' | 'authors' | 'timeline' | 'files'

type FormState = {
  title: string
  title_zh: string
  journal: string
  manuscript_no: string
  submission_system: string
  system_status: string
  last_status_date: string
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
  notes: string
  timeline: string
  prev_id: string
}

const toText = (v: unknown) => v === null || v === undefined ? '' : String(v)

function makeInitialForm(paper: Paper | 'new', currentUsername: string): FormState {
  if (paper === 'new') {
    return {
      title: '', title_zh: '', journal: '', manuscript_no: '', submission_system: '', system_status: '', last_status_date: '',
      next_action: '', reminder_level: 'none', apc_amount: '', apc_currency: 'USD', revision_round: '', followup_log: '',
      status: 'preparing', lang: 'zh', quartile_jcr: '未定', quartile_cas: '未定', quartile_new: '无', quartile_cust: '无', quartile_zh: ['', '', '', ''],
      authors: currentUsername ? [currentUsername] : [], corresponding_author: '', files: [], submitted_date: '', resolve_date: '', deadline: '',
      tracking_url: '', notes: '', timeline: '', prev_id: '',
    }
  }
  return {
    title: paper.title || '', title_zh: paper.title_zh || '', journal: paper.journal || '', manuscript_no: paper.manuscript_no || '',
    submission_system: paper.submission_system || '', system_status: paper.system_status || '', last_status_date: paper.last_status_date || '',
    next_action: paper.next_action || '', reminder_level: paper.reminder_level || 'none', apc_amount: toText(paper.apc_amount), apc_currency: paper.apc_currency || 'USD',
    revision_round: paper.revision_round ? String(paper.revision_round) : '', followup_log: paper.followup_log || '', status: paper.status, lang: paper.lang,
    quartile_jcr: paper.quartile_jcr || '未定', quartile_cas: paper.quartile_cas || '未定', quartile_new: paper.quartile_new || '无', quartile_cust: paper.quartile_cust || '无',
    quartile_zh: paper.quartile_zh || ['', '', '', ''], authors: [...(paper.authors || [])], corresponding_author: paper.corresponding_author || '', files: [...(paper.files || [])],
    submitted_date: paper.submitted_date || '', resolve_date: paper.resolve_date || '', deadline: paper.deadline || '', tracking_url: paper.tracking_url || '',
    notes: paper.notes || '', timeline: paper.timeline || '', prev_id: paper.prev_id || '',
  }
}

function Section({ title, subtitle, children, defaultOpen = true }: { title: string; subtitle?: string; children: React.ReactNode; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <section className="form-section glass-panel">
      <button type="button" className="form-section-head" onClick={() => setOpen(v => !v)}>
        <div>
          <div className="form-section-title">{title}</div>
          {subtitle && <div className="form-section-subtitle">{subtitle}</div>}
        </div>
        <ChevronDown size={16} className={open ? 'section-chevron open' : 'section-chevron'} />
      </button>
      {open && <div className="form-section-body">{children}</div>}
    </section>
  )
}

export default function PaperFormRefined({ paper, allPapers, currentUsername, onSave, onDelete, onClose }: Props) {
  const isNew = paper === 'new'
  const [customTlOpts, setCustomTlOpts] = useState<string[]>([])
  const [uploading, setUploading] = useState<number | null>(null)
  const [activeSection, setActiveSection] = useState<SectionKey>('basic')
  const [form, setForm] = useState<FormState>(() => makeInitialForm(paper, currentUsername))
  const [authorsStr, setAuthorsStr] = useState(() => form.authors.join(', '))

  const authors = useMemo(() => authorsStr.split(/[，,;；、\s]+/).map(a => a.trim()).filter(Boolean), [authorsStr])
  const set = <K extends keyof FormState>(key: K, val: FormState[K]) => setForm(prev => ({ ...prev, [key]: val }))

  const handleSave = () => {
    const apc = form.apc_amount ? Number(form.apc_amount) : null
    const round = form.revision_round ? Number(form.revision_round) : 0
    const files = form.files.filter(f => f.p && f.p.trim())
    onSave({
      title: form.title || '未命名', title_zh: form.title_zh || null, journal: form.journal || null,
      manuscript_no: form.manuscript_no || null, submission_system: form.submission_system || null, system_status: form.system_status || null,
      last_status_date: form.last_status_date || null, next_action: form.next_action || null, reminder_level: form.reminder_level || 'none',
      apc_amount: apc !== null && Number.isFinite(apc) ? apc : null, apc_currency: form.apc_currency || 'USD',
      revision_round: Number.isFinite(round) ? round : 0, followup_log: form.followup_log || null,
      status: form.status, lang: form.lang, quartile_jcr: form.quartile_jcr, quartile_cas: form.quartile_cas,
      quartile_new: form.quartile_new, quartile_cust: form.quartile_cust, quartile_zh: form.quartile_zh,
      authors, corresponding_author: form.corresponding_author || null, files: files.length ? files : null,
      submitted_date: form.submitted_date || null, resolve_date: form.resolve_date || null, deadline: form.deadline || null,
      tracking_url: form.tracking_url || null, notes: form.notes || null, timeline: form.timeline || null, prev_id: form.prev_id || null,
      updated_at: new Date().toISOString(),
    })
  }

  const addFile = () => setForm(prev => ({ ...prev, files: [...(prev.files || []), { n: '', p: '' }] }))
  const updateFile = (idx: number, field: 'n' | 'p', val: string) => setForm(prev => {
    const files = [...(prev.files || [])]
    files[idx] = { ...files[idx], [field]: val }
    return { ...prev, files }
  })
  const removeFile = (idx: number) => setForm(prev => ({ ...prev, files: (prev.files || []).filter((_, i) => i !== idx) }))
  const upload = async (idx: number) => {
    const inp = document.createElement('input')
    inp.type = 'file'
    inp.onchange = async e => {
      const file = (e.target as HTMLInputElement).files?.[0]
      if (!file) return
      updateFile(idx, 'n', file.name)
      updateFile(idx, 'p', '上传中...')
      setUploading(idx)
      const result = await uploadFile(file)
      updateFile(idx, 'p', result ? result.fileUrl : `local://${file.name}`)
      setUploading(null)
    }
    inp.click()
  }

  const navItems: { key: SectionKey; label: string }[] = [
    { key: 'basic', label: '基本信息' },
    { key: 'workflow', label: '投稿跟踪' },
    { key: 'authors', label: '作者分区' },
    { key: 'timeline', label: '时间线' },
    { key: 'files', label: '文件备注' },
  ]

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal paper-form-modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header paper-form-header">
          <div>
            <h3 className="modal-title">{isNew ? '新建投稿记录' : '编辑投稿记录'}</h3>
            <div className="modal-subtitle">按“基本信息—投稿跟踪—作者分区—时间线—文件备注”顺序整理，减少重复选择。</div>
          </div>
          <button className="btn btn-ghost btn-icon" onClick={onClose}><X size={18} /></button>
        </div>

        <div className="form-section-tabs">
          {navItems.map(item => <button key={item.key} type="button" className={activeSection === item.key ? 'active' : ''} onClick={() => setActiveSection(item.key)}>{item.label}</button>)}
        </div>

        <div className="modal-body refined-form-body">
          {(activeSection === 'basic' || true) && (
            <Section title="基本信息" subtitle="标题、期刊、主状态和版本关系。" defaultOpen={activeSection === 'basic'}>
              <div className="field-row" style={{ gridTemplateColumns: '140px 180px 1fr' }}>
                <div className="field"><label className="field-label">语言</label><select className="select" value={form.lang} onChange={e => set('lang', e.target.value)}><option value="zh">中文</option><option value="en">英文</option></select></div>
                <div className="field"><label className="field-label">主状态</label><select className="select" value={form.status} onChange={e => set('status', e.target.value)}>{STATUSES.map(s => <option key={s.key} value={s.key}>{s.emoji} {s.label}</option>)}</select></div>
                <div className="field"><label className="field-label">目标期刊 / 会议</label><input className="input" value={form.journal} onChange={e => set('journal', e.target.value)} placeholder="如 Geomatics, Natural Hazards and Risk" /></div>
              </div>
              <div className="field"><label className="field-label">论文标题 *</label><input className="input input-title" value={form.title} onChange={e => set('title', e.target.value)} placeholder="输入论文标题" /></div>
              {form.lang === 'en' && <div className="field"><label className="field-label">中文翻译标题</label><input className="input" value={form.title_zh} onChange={e => set('title_zh', e.target.value)} /></div>}
              <div className="field"><label className="field-label">版本追溯</label><select className="select" value={form.prev_id} onChange={e => set('prev_id', e.target.value)}><option value="">常规首投 / 无前置稿件</option>{allPapers.filter(p => isNew || p.id !== (paper as Paper).id).map(p => <option key={p.id} value={p.id}>{p.title || '（未命名）'} [{p.journal || '未知期刊'}]</option>)}</select></div>
            </Section>
          )}

          <Section title="投稿跟踪" subtitle="稿件编号、系统状态、提醒动作和修回控制。" defaultOpen={activeSection === 'workflow'}>
            <div className="field-row" style={{ gridTemplateColumns: '1fr 1fr 1fr' }}>
              <div className="field"><label className="field-label">稿件编号</label><input className="input" value={form.manuscript_no} onChange={e => set('manuscript_no', e.target.value)} placeholder="Submission ID / Manuscript ID" /></div>
              <div className="field"><label className="field-label">投稿系统</label><input className="input" list="submission-system-options" value={form.submission_system} onChange={e => set('submission_system', e.target.value)} placeholder="ScholarOne / Editorial Manager" /><datalist id="submission-system-options">{SUBMISSION_SYSTEM_OPTIONS.map(o => <option key={o} value={o} />)}</datalist></div>
              <div className="field"><label className="field-label">审稿系统 URL</label><input className="input" value={form.tracking_url} onChange={e => set('tracking_url', e.target.value)} placeholder="https://..." /></div>
            </div>
            <div className="field-row" style={{ gridTemplateColumns: '1.2fr 160px 1fr 160px' }}>
              <div className="field"><label className="field-label">系统原始状态</label><input className="input" list="system-status-options" value={form.system_status} onChange={e => set('system_status', e.target.value)} placeholder="With Editor / Out for Review" /><datalist id="system-status-options">{SYSTEM_STATUS_PRESETS.map(o => <option key={o} value={o} />)}</datalist></div>
              <div className="field"><label className="field-label">状态更新日期</label><input type="date" className="input" value={form.last_status_date} onChange={e => set('last_status_date', e.target.value)} /></div>
              <div className="field"><label className="field-label">下一步行动</label><select className="select" value={form.next_action} onChange={e => set('next_action', e.target.value)}><option value="">自动判断 / 不显示</option>{NEXT_ACTION_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}</select></div>
              <div className="field"><label className="field-label">提醒级别</label><select className="select" value={form.reminder_level} onChange={e => set('reminder_level', e.target.value)}>{REMINDER_LEVELS.map(o => <option key={o.key} value={o.key}>{o.label}</option>)}</select></div>
            </div>
            <div className="field-row" style={{ gridTemplateColumns: 'repeat(5, 1fr)' }}>
              <div className="field"><label className="field-label">首投日期</label><input type="date" className="input" value={form.submitted_date} onChange={e => set('submitted_date', e.target.value)} /></div>
              <div className="field"><label className="field-label">修回截止</label><input type="date" className="input" value={form.deadline} onChange={e => set('deadline', e.target.value)} /></div>
              <div className="field"><label className="field-label">终审 / 录用</label><input type="date" className="input" value={form.resolve_date} onChange={e => set('resolve_date', e.target.value)} /></div>
              <div className="field"><label className="field-label">返修轮次</label><input type="number" min="0" className="input" value={form.revision_round} onChange={e => set('revision_round', e.target.value)} /></div>
              <div className="field"><label className="field-label">APC / 版面费</label><div className="fee-field"><input type="number" min="0" className="input" value={form.apc_amount} onChange={e => set('apc_amount', e.target.value)} placeholder="金额" /><input className="input" value={form.apc_currency} onChange={e => set('apc_currency', e.target.value.toUpperCase())} /></div></div>
            </div>
            {form.status === 'accepted' && <div className="form-hint">已接收稿件不会在主页自动显示“下一步”。如需要，可在“下一步行动”中选择“校对 Proof”或“确认版面费 / APC”。</div>}
          </Section>

          <Section title="作者与分区" subtitle="作者顺序、通讯作者和期刊分区。" defaultOpen={activeSection === 'authors'}>
            <div className="field-row" style={{ gridTemplateColumns: '2fr 1fr' }}>
              <div className="field"><label className="field-label">作者名单</label><input className="input" value={authorsStr} onChange={e => setAuthorsStr(e.target.value)} placeholder="张三, Li Si, 王五" /></div>
              <div className="field"><label className="field-label">通讯作者</label><select className="select" value={form.corresponding_author} onChange={e => set('corresponding_author', e.target.value)}><option value="">未指定</option>{authors.map((a, i) => <option key={`${a}-${i}`} value={a}>{a}</option>)}</select></div>
            </div>
            {form.lang === 'en' ? <div className="field-row" style={{ gridTemplateColumns: 'repeat(4, 1fr)' }}><div className="field"><label className="field-label">JCR</label><select className="select" value={form.quartile_jcr} onChange={e => set('quartile_jcr', e.target.value)}>{JCR_OPTIONS.map(o => <option key={o}>{o}</option>)}</select></div><div className="field"><label className="field-label">中科院</label><select className="select" value={form.quartile_cas} onChange={e => set('quartile_cas', e.target.value)}>{CAS_OPTIONS.map(o => <option key={o}>{o}</option>)}</select></div><div className="field"><label className="field-label">新锐</label><input className="input" value={form.quartile_new} onChange={e => set('quartile_new', e.target.value)} /></div><div className="field"><label className="field-label">自定义</label><input className="input" value={form.quartile_cust} onChange={e => set('quartile_cust', e.target.value)} /></div></div> : <div className="field-row" style={{ gridTemplateColumns: 'repeat(4, 1fr)' }}>{[0, 1, 2, 3].map(i => <div className="field" key={i}><label className="field-label">{i < 3 ? `中文分类 ${i + 1}` : '其它属性'}</label><input className="input" value={form.quartile_zh[i] || ''} onChange={e => { const arr = [...form.quartile_zh]; arr[i] = e.target.value; set('quartile_zh', arr) }} /></div>)}</div>}
          </Section>

          <Section title="审稿时间线" subtitle="记录系统状态变化，形成可追踪审稿历史。" defaultOpen={activeSection === 'timeline'}>
            <Timeline value={form.timeline} onChange={val => set('timeline', val)} customOpts={customTlOpts} onAddCustomOpt={opt => setCustomTlOpts(prev => [...prev, opt])} />
          </Section>

          <Section title="文件与备注" subtitle="集中管理附件、催稿沟通和审稿意见。" defaultOpen={activeSection === 'files'}>
            <div className="file-archive-head"><span>文件归档</span><button className="btn btn-ghost btn-sm" onClick={addFile}>+ 添加文件</button></div>
            <div className="file-grid-refined">
              {(form.files || []).map((f, i) => <div key={i} className="file-box glass-panel"><button type="button" className="file-icon" onClick={() => upload(i)}>{uploading === i ? <Loader size={16} className="spinner" /> : <FileText size={16} />}</button><div className="file-fields"><input className="input" value={f.n} onChange={e => updateFile(i, 'n', e.target.value)} placeholder="文件名称" /><input className="input" value={f.p} onChange={e => updateFile(i, 'p', e.target.value)} placeholder="文件路径或 URL" /></div><button className="file-action-btn" onClick={() => removeFile(i)}><Trash2 size={13} /></button></div>)}
            </div>
            <div className="field"><label className="field-label">催稿 / 沟通记录</label><textarea className="textarea" value={form.followup_log} onChange={e => set('followup_log', e.target.value)} placeholder="如：2026-06-02 通过 CONTACT 询问修回进展，暂未收到回复..." /></div>
            <div className="field"><label className="field-label">备注 / 审稿意见</label><textarea className="textarea" value={form.notes} onChange={e => set('notes', e.target.value)} placeholder="记录审稿意见、修改要点、改投计划等..." /></div>
          </Section>
        </div>

        <div className="modal-footer">
          {!isNew ? <button className="btn btn-danger btn-sm" onClick={() => onDelete((paper as Paper).id)}><Trash2 size={14} /> 删除记录</button> : <div />}
          <div style={{ display: 'flex', gap: 10 }}><button className="btn btn-ghost" onClick={onClose}>取消</button><button className="btn btn-primary" onClick={handleSave}><Save size={14} /> 保存</button></div>
        </div>
      </div>
    </div>
  )
}
