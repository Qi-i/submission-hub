import { useState } from 'react'
import { X, Save, Trash2, FileText } from 'lucide-react'
import type { Paper } from '../lib/types'
import { STATUSES, JCR_OPTIONS, CAS_OPTIONS, TIMELINE_PRESETS } from '../lib/types'
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

export default function PaperForm({ paper, allPapers, currentUsername, onSave, onDelete, onClose }: Props) {
  const isNew = paper === 'new'
  const [customQuartileOpts, setCustomQuartileOpts] = useState<string[]>([])
  const [customTlOpts, setCustomTlOpts] = useState<string[]>([])

  const init = isNew ? {
    title: '', title_zh: '', journal: '', status: 'preparing', lang: 'zh',
    quartile_jcr: '未定', quartile_cas: '未定', quartile_new: '无', quartile_cust: '无',
    quartile_zh: ['', '', '', ''] as string[],
    authors: currentUsername ? [currentUsername] : [],
    files: [] as FileItem[],
    submitted_date: '', resolve_date: '', deadline: '', tracking_url: '', notes: '', timeline: '',
    prev_id: '',
  } : {
    title: paper.title || '',
    title_zh: paper.title_zh || '',
    journal: paper.journal || '',
    status: paper.status,
    lang: paper.lang,
    quartile_jcr: paper.quartile_jcr || '未定',
    quartile_cas: paper.quartile_cas || '未定',
    quartile_new: paper.quartile_new || '无',
    quartile_cust: paper.quartile_cust || '无',
    quartile_zh: paper.quartile_zh || ['', '', '', ''],
    authors: [...(paper.authors || [])],
    files: [...(paper.files || [])],
    submitted_date: paper.submitted_date || '',
    resolve_date: paper.resolve_date || '',
    deadline: paper.deadline || '',
    tracking_url: paper.tracking_url || '',
    notes: paper.notes || '',
    timeline: paper.timeline || '',
    prev_id: paper.prev_id || '',
  }

  const [form, setForm] = useState(init)
  const [authorsStr, setAuthorsStr] = useState(init.authors.join(', '))

  const set = (key: string, val: unknown) => setForm(prev => ({ ...prev, [key]: val }))

  const handleSave = () => {
    const authors = authorsStr.split(/[，,;；、\s]+/).map(a => a.trim()).filter(Boolean)
    const files = form.files.filter(f => f.p && f.p.trim())
    onSave({
      title: form.title || '未命名',
      title_zh: form.title_zh || null,
      journal: form.journal || null,
      status: form.status,
      lang: form.lang,
      quartile_jcr: form.quartile_jcr,
      quartile_cas: form.quartile_cas,
      quartile_new: form.quartile_new,
      quartile_cust: form.quartile_cust,
      quartile_zh: form.quartile_zh,
      authors,
      files: files.length > 0 ? files : null,
      submitted_date: form.submitted_date || null,
      resolve_date: form.resolve_date || null,
      deadline: form.deadline || null,
      tracking_url: form.tracking_url || null,
      notes: form.notes || null,
      timeline: form.timeline || null,
      prev_id: form.prev_id || null,
      updated_at: new Date().toISOString(),
    })
  }

  // File management
  const addFile = () => {
    setForm(prev => ({
      ...prev,
      files: [...(prev.files || []), { n: '', p: '' }],
    }))
  }

  const updateFile = (idx: number, field: 'n' | 'p', val: string) => {
    setForm(prev => {
      const files = [...(prev.files || [])]
      files[idx] = { ...files[idx], [field]: val }
      return { ...prev, files }
    })
  }

  const removeFile = (idx: number) => {
    setForm(prev => ({
      ...prev,
      files: (prev.files || []).filter((_, i) => i !== idx),
    }))
  }

  const handleFileUpload = (idx: number) => {
    const inp = document.createElement('input')
    inp.type = 'file'
    inp.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0]
      if (!file) return
      // Store file name as placeholder (real upload would go to Supabase Storage)
      updateFile(idx, 'n', file.name)
      updateFile(idx, 'p', `local://${file.name}`)
    }
    inp.click()
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 860 }}>
        {/* Header */}
        <div className="modal-header">
          <h3 className="modal-title">
            {isNew ? '✨ 新建投稿记录' : '✏️ 编辑投稿状态'}
          </h3>
          <button className="btn btn-ghost btn-icon" onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="modal-body">
          {/* Language + Status */}
          <div className="field-row" style={{ gridTemplateColumns: '1fr 1fr' }}>
            <div className="field">
              <label className="field-label">文章语言</label>
              <select className="select" value={form.lang} onChange={e => set('lang', e.target.value)}>
                <option value="zh">ZH 中文</option>
                <option value="en">EN 英文</option>
              </select>
            </div>
            <div className="field">
              <label className="field-label">当前状态</label>
              <select className="select" value={form.status} onChange={e => set('status', e.target.value)}
                style={{ fontWeight: 700, color: 'var(--accent)' }}>
                {STATUSES.map(s => (
                  <option key={s.key} value={s.key}>{s.emoji} {s.label}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Title */}
          <div className="field">
            <label className="field-label">论文主要标题 *</label>
            <input className="input" value={form.title} onChange={e => set('title', e.target.value)}
              style={{ fontSize: 14, fontWeight: 700 }} placeholder="输入论文标题" />
          </div>

          {/* Chinese title (EN papers only) */}
          {form.lang === 'en' && (
            <div className="field">
              <label className="field-label">中文翻译标题 (对照)</label>
              <input className="input" value={form.title_zh} onChange={e => set('title_zh', e.target.value)}
                placeholder="输入中文翻译标题" />
            </div>
          )}

          {/* Journal */}
          <div className="field">
            <label className="field-label">目标期刊 / 会议</label>
            <input className="input" value={form.journal} onChange={e => set('journal', e.target.value)}
              placeholder="如: Nature Communications, CVPR 2025" />
          </div>

          {/* Previous submission link */}
          <div className="field">
            <label className="field-label">版本追溯 (改投时关联前次记录)</label>
            <select className="select" value={form.prev_id} onChange={e => set('prev_id', e.target.value)}
              style={{ fontWeight: 600, color: 'var(--accent)' }}>
              <option value="">-- 常规首投 (无历史关联) --</option>
              {allPapers.filter(p => isNew || p.id !== (paper as Paper).id).map(p => (
                <option key={p.id} value={p.id}>
                  {p.title || '（未命名）'} [{p.journal || '未知期刊'}]
                </option>
              ))}
            </select>
          </div>

          {/* Quartile rows */}
          {form.lang === 'en' ? (
            <div className="field-row" style={{ gridTemplateColumns: 'repeat(4, 1fr)' }}>
              <div className="field">
                <label className="field-label">JCR 分区</label>
                <select className="select" value={form.quartile_jcr} onChange={e => set('quartile_jcr', e.target.value)}>
                  {JCR_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}
                </select>
              </div>
              <div className="field">
                <label className="field-label">中科院分区</label>
                <select className="select" value={form.quartile_cas} onChange={e => set('quartile_cas', e.target.value)}>
                  {CAS_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}
                </select>
              </div>
              <div className="field">
                <label className="field-label">新锐分区</label>
                <select className="select" value={form.quartile_new} onChange={e => set('quartile_new', e.target.value)}>
                  <option value="无">无</option>
                  {['一区', '二区', '三区', '四区', 'Top'].map(o => <option key={o} value={o}>{o}</option>)}
                  {customQuartileOpts.map(o => <option key={o} value={o}>{o}</option>)}
                </select>
              </div>
              <div className="field">
                <label className="field-label" style={{ display: 'flex', justifyContent: 'space-between' }}>
                  自定义分类
                  <span style={{ display: 'flex', gap: 8, fontWeight: 400 }}>
                    <span style={{ color: '#3b82f6', cursor: 'pointer' }}
                      onClick={() => {
                        const q = prompt('输入新的自定义分区/分类:')
                        if (q?.trim() && !customQuartileOpts.includes(q.trim())) {
                          setCustomQuartileOpts(prev => [...prev, q.trim()])
                          set('quartile_cust', q.trim())
                        }
                      }}>[+添加]</span>
                  </span>
                </label>
                <select className="select" value={form.quartile_cust} onChange={e => set('quartile_cust', e.target.value)}>
                  <option value="无">无</option>
                  {customQuartileOpts.map(o => <option key={o} value={o}>{o}</option>)}
                </select>
              </div>
            </div>
          ) : (
            <div className="field-row" style={{ gridTemplateColumns: 'repeat(4, 1fr)' }}>
              {[0, 1, 2, 3].map(i => (
                <div className="field" key={i}>
                  <label className="field-label">{i < 3 ? `分类 / 基金 ${i + 1}` : '其它属性'}</label>
                  <input className="input" value={form.quartile_zh[i]}
                    onChange={e => {
                      const arr = [...form.quartile_zh]
                      arr[i] = e.target.value
                      set('quartile_zh', arr)
                    }}
                    placeholder={i === 0 ? '如: CSSCI, 国家自然基金' : ''} />
                </div>
              ))}
            </div>
          )}

          {/* Authors */}
          <div className="field">
            <label className="field-label">作者名单 (支持中文逗号、英文逗号、空格分隔)</label>
            <input className="input" value={authorsStr} onChange={e => setAuthorsStr(e.target.value)}
              placeholder="张三, Li Si, 王五" />
          </div>

          {/* Dates */}
          <div className="field-row" style={{ gridTemplateColumns: 'repeat(4, 1fr)' }}>
            <div className="field">
              <label className="field-label">首投日期</label>
              <input type="date" className="input" value={form.submitted_date}
                onChange={e => set('submitted_date', e.target.value)} />
            </div>
            <div className="field">
              <label className="field-label">终审/录用日期</label>
              <input type="date" className="input" value={form.resolve_date}
                onChange={e => set('resolve_date', e.target.value)} />
            </div>
            <div className="field">
              <label className="field-label">
                修回截止日期
                {form.deadline && (
                  <span style={{ color: '#ef4444', cursor: 'pointer', marginLeft: 8, fontWeight: 400 }}
                    onClick={() => set('deadline', '')}>[✖ 清除]</span>
                )}
              </label>
              <input type="date" className="input" value={form.deadline}
                onChange={e => set('deadline', e.target.value)} />
            </div>
            <div className="field">
              <label className="field-label">审稿系统 URL</label>
              <input className="input" value={form.tracking_url}
                onChange={e => set('tracking_url', e.target.value)}
                placeholder="https://..." />
            </div>
          </div>

          {/* Timeline */}
          <div className="field">
            <label className="field-label">📅 审稿时间线</label>
            <Timeline
              value={form.timeline}
              onChange={(val) => set('timeline', val)}
              customOpts={customTlOpts}
              onAddCustomOpt={(opt) => setCustomTlOpts(prev => [...prev, opt])}
            />
          </div>

          {/* Files */}
          <div style={{
            background: 'var(--bg-card)', borderRadius: 'var(--radius-lg)',
            padding: 16, border: '1px dashed var(--border-default)',
          }}>
            <div style={{
              fontSize: 12, fontWeight: 700, marginBottom: 12, color: 'var(--text-secondary)',
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            }}>
              <span>📎 文件归档</span>
              <button className="btn btn-ghost btn-sm" onClick={addFile} style={{ fontSize: 11 }}>
                + 添加文件
              </button>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10 }}>
              {(form.files || []).map((f, i) => (
                <div key={i} className="file-box">
                  <div className="file-icon" style={{
                    background: f.p ? 'var(--accent-bg)' : 'var(--bg-elevated)',
                    color: f.p ? 'var(--accent)' : 'var(--text-muted)',
                    border: `1px solid ${f.p ? 'var(--accent-border)' : 'var(--border-subtle)'}`,
                    cursor: 'pointer',
                  }} onClick={() => handleFileUpload(i)}>
                    <FileText size={16} />
                  </div>
                  <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}>
                    <input
                      className="input"
                      style={{ padding: '4px 6px', fontSize: 12, fontWeight: 600 }}
                      value={f.n}
                      onChange={e => updateFile(i, 'n', e.target.value)}
                      placeholder="文件名称"
                    />
                    <input
                      className="input"
                      style={{ padding: '2px 6px', fontSize: 10, color: 'var(--text-muted)' }}
                      value={f.p}
                      onChange={e => updateFile(i, 'p', e.target.value)}
                      placeholder="文件路径或URL"
                    />
                  </div>
                  <button className="file-action-btn" style={{ color: '#ef4444' }} onClick={() => removeFile(i)}>
                    <Trash2 size={13} />
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Notes */}
          <div className="field">
            <label className="field-label">备注 / 意见</label>
            <textarea className="textarea" value={form.notes}
              onChange={e => set('notes', e.target.value)}
              placeholder="记录审稿意见、修改要点等..." />
          </div>
        </div>

        {/* Footer */}
        <div className="modal-footer">
          {!isNew ? (
            <button className="btn btn-danger btn-sm" onClick={() => onDelete((paper as Paper).id)}>
              <Trash2 size={14} /> 删除记录
            </button>
          ) : <div />}
          <div style={{ display: 'flex', gap: 10 }}>
            <button className="btn btn-ghost" onClick={onClose}>取消</button>
            <button className="btn btn-primary" onClick={handleSave}>
              <Save size={14} /> 确认保存
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
