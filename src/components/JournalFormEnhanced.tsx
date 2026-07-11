import { useMemo, useState, type ReactNode } from 'react'
import { BadgeCheck, ExternalLink, RefreshCw, Save, Sparkles, Trash2, X } from 'lucide-react'
import { journalLookupHint, lookupJournalMetadata } from '../lib/journal-lookup'
import { rankItemsFromValues } from '../lib/journal-rank'
import type { ExternalLink as JournalLink, JournalProfile } from '../lib/preparation'
import { INDEXING_OPTIONS, OA_OPTIONS, PRIORITY_OPTIONS } from '../lib/preparation'

interface Props {
  value: JournalProfile | 'new'
  onSave: (data: Partial<JournalProfile> & Pick<JournalProfile, 'name'>) => Promise<void>
  onDelete: (id: string) => Promise<void>
  onClose: () => void
  onLookupRanks?: unknown
}

type RankedJournal = JournalProfile & {
  rank_data?: Record<string, string> | null
  rank_updated_at?: string | null
}

const toList = (value: string) => Array.from(new Set(value.split(/[，,;；、\n]+/).map(item => item.trim()).filter(Boolean)))
const fromList = (value?: string[] | null) => (value || []).join(', ')
const safeUrl = (value?: string | null) => !!value && /^https?:\/\//i.test(value)
const numberOrNull = (value: string) => value.trim() === '' ? null : Number.isFinite(Number(value)) ? Number(value) : null
const integerOrNull = (value: string) => { const parsed = numberOrNull(value); return parsed === null ? null : Math.max(0, Math.round(parsed)) }
const percentageOrNull = (value: string) => { const parsed = numberOrNull(value); return parsed === null ? null : Math.max(0, Math.min(100, parsed)) }

function parseLinks(value: string): JournalLink[] {
  return value.split('\n').map(line => line.trim()).filter(Boolean).map(line => {
    const [label, ...urlParts] = line.split('|')
    const url = (urlParts.join('|') || label).trim()
    return { label: urlParts.length ? label.trim() : '链接', url }
  }).filter(link => safeUrl(link.url))
}

function formatLinks(links?: JournalLink[] | null) {
  return (links || []).map(link => `${link.label}|${link.url}`).join('\n')
}

function Field({ label, children, wide }: { label: string; children: ReactNode; wide?: boolean }) {
  return <div className={`prep-field ${wide ? 'wide' : ''}`}><span>{label}</span>{children}</div>
}

export default function JournalFormEnhanced({ value, onSave, onDelete, onClose }: Props) {
  const source = value === 'new' ? null : value as RankedJournal
  const [saving, setSaving] = useState(false)
  const [lookingUp, setLookingUp] = useState(false)
  const [lookupInput, setLookupInput] = useState(source?.issn || source?.eissn || source?.website_url || '')
  const [lookupMessage, setLookupMessage] = useState('')
  const [lookupSource, setLookupSource] = useState('')
  const [rankData] = useState<Record<string, string>>(source?.rank_data || {})
  const [rankUpdatedAt] = useState(source?.rank_updated_at || '')
  const [name, setName] = useState(source?.name || '')
  const [publisher, setPublisher] = useState(source?.publisher || '')
  const [website, setWebsite] = useState(source?.website_url || '')
  const [guide, setGuide] = useState(source?.author_guide_url || '')
  const [submission, setSubmission] = useState(source?.submission_url || '')
  const [thirdParty, setThirdParty] = useState(formatLinks(source?.third_party_links))
  const [issn, setIssn] = useState(source?.issn || '')
  const [eissn, setEissn] = useState(source?.eissn || '')
  const [scope, setScope] = useState(source?.scope || '')
  const [tags, setTags] = useState(fromList(source?.subject_tags))
  const [indexing, setIndexing] = useState<string[]>(source?.indexing || [])
  const [jcr, setJcr] = useState(source?.jcr_quartile || '')
  const [cas, setCas] = useState(source?.cas_quartile || '')
  const [impactFactor, setImpactFactor] = useState(source?.impact_factor?.toString() || '')
  const [oaType, setOaType] = useState<string>(source?.oa_type || 'unknown')
  const [apc, setApc] = useState(source?.apc_amount?.toString() || '')
  const [currency, setCurrency] = useState(source?.apc_currency || 'USD')
  const [feeNotes, setFeeNotes] = useState(source?.fee_notes || '')
  const [firstDecision, setFirstDecision] = useState(source?.first_decision_days?.toString() || '')
  const [totalReview, setTotalReview] = useState(source?.total_review_days?.toString() || '')
  const [acceptanceRate, setAcceptanceRate] = useState(source?.acceptance_rate?.toString() || '')
  const [risk, setRisk] = useState<string>(source?.risk_level || 'normal')
  const [favorite, setFavorite] = useState(source?.is_favorite ?? true)
  const [priority, setPriority] = useState<string>(source?.priority || 'medium')
  const [notes, setNotes] = useState(source?.notes || '')

  const hint = useMemo(() => journalLookupHint(lookupInput), [lookupInput])
  const rankItems = useMemo(() => rankItemsFromValues(rankData), [rankData])

  const lookup = async () => {
    if (!lookupInput.trim() || lookingUp) return
    setLookingUp(true)
    setLookupMessage('')
    setLookupSource('')
    try {
      const result = await lookupJournalMetadata(lookupInput)
      if (result.name) setName(result.name)
      if (result.publisher) setPublisher(result.publisher)
      if (result.issn) setIssn(result.issn)
      if (result.eissn) setEissn(result.eissn)
      if (result.websiteUrl) setWebsite(result.websiteUrl)
      setLookupMessage(result.note)
      setLookupSource(result.sourceUrl)
      const sourceLink = `${result.sourceLabel}|${result.sourceUrl}`
      setThirdParty(previous => previous.includes(result.sourceUrl) ? previous : [previous, sourceLink].filter(Boolean).join('\n'))
    } catch (error) {
      setLookupMessage(error instanceof Error ? error.message : '自动识别失败，请手动填写。')
    } finally {
      setLookingUp(false)
    }
  }

  const save = async () => {
    if (!name.trim() || saving) {
      if (!name.trim()) alert('请填写期刊名称。')
      return
    }
    setSaving(true)
    try {
      const payload = {
        ...(source || {}), name: name.trim(), publisher: publisher.trim() || null,
        website_url: website.trim() || null, author_guide_url: guide.trim() || null,
        submission_url: submission.trim() || null, third_party_links: parseLinks(thirdParty),
        issn: issn.trim() || null, eissn: eissn.trim() || null, scope: scope.trim() || null,
        subject_tags: toList(tags), indexing, jcr_quartile: jcr.trim() || null, cas_quartile: cas.trim() || null,
        impact_factor: numberOrNull(impactFactor), oa_type: oaType as JournalProfile['oa_type'],
        apc_amount: numberOrNull(apc), apc_currency: currency.trim().toUpperCase() || 'USD',
        fee_notes: feeNotes.trim() || null, first_decision_days: integerOrNull(firstDecision),
        total_review_days: integerOrNull(totalReview), acceptance_rate: percentageOrNull(acceptanceRate),
        risk_level: risk as JournalProfile['risk_level'], is_favorite: favorite,
        priority: priority as JournalProfile['priority'], notes: notes.trim() || null,
        rank_data: rankData, rank_updated_at: rankUpdatedAt || null,
      }
      await onSave(payload as any)
      onClose()
    } catch (error) {
      console.error('Save journal failed:', error)
      alert(error instanceof Error ? `期刊档案保存失败：${error.message}` : '期刊档案保存失败。')
    } finally {
      setSaving(false)
    }
  }

  const remove = async () => {
    if (!source || !confirm('确认删除该期刊档案？')) return
    setSaving(true)
    try { await onDelete(source.id); onClose() }
    catch (error) { alert(error instanceof Error ? `删除失败：${error.message}` : '删除失败。') }
    finally { setSaving(false) }
  }

  return <div className="modal-overlay" onClick={() => !saving && onClose()}>
    <div className="modal prep-modal journal-form-modal" onClick={event => event.stopPropagation()}>
      <div className="prep-modal-head journal-modal-head">
        <div><span className="journal-modal-kicker">JOURNAL LIBRARY</span><h3>{source ? '编辑期刊档案' : '收藏期刊'}</h3><p>先识别基础信息，再记录真正影响投稿决策的分区、费用和周期。</p></div>
        <button type="button" className="btn btn-ghost btn-icon" onClick={onClose} disabled={saving}><X size={18} /></button>
      </div>

      <div className="prep-modal-body">
        <section className="journal-lookup-panel">
          <div className="journal-lookup-icon"><Sparkles size={20} /></div>
          <div className="journal-lookup-copy"><strong>快速识别期刊</strong><span>粘贴任意一篇论文 DOI、doi.org 链接、ISSN 或期刊官网</span></div>
          <div className="journal-lookup-control"><input className="input" value={lookupInput} onChange={event => setLookupInput(event.target.value)} onKeyDown={event => { if (event.key === 'Enter') { event.preventDefault(); void lookup() } }} placeholder="例如 10.1002/esp.70113 或 1365-3091" /><button type="button" className="btn btn-primary" onClick={() => void lookup()} disabled={lookingUp || !lookupInput.trim()}>{lookingUp ? <RefreshCw size={15} className="spin" /> : <Sparkles size={15} />} {lookingUp ? '识别中' : '自动填充'}</button></div>
          <small className="journal-lookup-hint">{lookupMessage || hint}</small>
          {lookupSource && <a className="journal-lookup-source" href={lookupSource} target="_blank" rel="noopener noreferrer">查看数据来源 <ExternalLink size={11} /></a>}
        </section>

        <section className="journal-form-section identity"><div className="journal-form-section-head"><b>基础身份</b><span>DOI / ISSN 可自动填充</span></div>
          <div className="prep-form-grid two"><Field label="期刊名称" wide><input className="input" value={name} onChange={event => setName(event.target.value)} autoFocus={!source} /></Field><Field label="出版社"><input className="input" value={publisher} onChange={event => setPublisher(event.target.value)} /></Field><Field label="收藏优先级"><select className="select" value={priority} onChange={event => setPriority(event.target.value)}>{PRIORITY_OPTIONS.map(option => <option key={option.key} value={option.key}>{option.label}</option>)}</select></Field></div>
          <div className="prep-form-grid four"><Field label="ISSN"><input className="input" value={issn} onChange={event => setIssn(event.target.value)} /></Field><Field label="EISSN"><input className="input" value={eissn} onChange={event => setEissn(event.target.value)} /></Field><Field label="JCR 分区"><input className="input" value={jcr} onChange={event => setJcr(event.target.value)} placeholder="Q1" /></Field><Field label="中科院分区"><input className="input" value={cas} onChange={event => setCas(event.target.value)} placeholder="一区" /></Field></div>
        </section>

        <section className="journal-form-section links"><div className="journal-form-section-head"><b>投稿入口</b><span>卡片底部直接打开</span></div><div className="prep-form-grid three"><Field label="期刊官网"><input className="input" value={website} onChange={event => setWebsite(event.target.value)} placeholder="https://..." /></Field><Field label="作者指南"><input className="input" value={guide} onChange={event => setGuide(event.target.value)} placeholder="https://..." /></Field><Field label="投稿系统"><input className="input" value={submission} onChange={event => setSubmission(event.target.value)} placeholder="https://..." /></Field></div></section>

        <section className="journal-rank-panel">
          <div className="journal-rank-head"><div><BadgeCheck size={17} /><span><strong>期刊等级记录</strong><small>分区与影响因子请按已核实数据填写</small></span></div></div>
          {rankItems.length > 0 ? <div className="journal-rank-chips">{rankItems.slice(0, 18).map(item => <span key={item.key} data-group={item.group}><b>{item.label}</b>{item.value}</span>)}</div> : <div className="journal-rank-empty">暂无等级快照，请在表单中填写 JCR 分区、中科院分区和影响因子。</div>}
          {rankUpdatedAt && <small className="journal-rank-time">历史更新时间：{new Date(rankUpdatedAt).toLocaleString()}</small>}
        </section>

        <section className="journal-form-section decision"><div className="journal-form-section-head"><b>投稿决策</b><span>费用和审稿周期需要人工核对</span></div>
          <div className="prep-form-grid four"><Field label="影响因子"><input type="number" step="0.001" min="0" className="input" value={impactFactor} onChange={event => setImpactFactor(event.target.value)} /></Field><Field label="开放获取"><select className="select" value={oaType} onChange={event => setOaType(event.target.value)}>{OA_OPTIONS.map(option => <option key={option.key} value={option.key}>{option.label}</option>)}</select></Field><Field label="APC"><input type="number" min="0" className="input" value={apc} onChange={event => setApc(event.target.value)} /></Field><Field label="币种"><input className="input" value={currency} onChange={event => setCurrency(event.target.value)} maxLength={8} /></Field></div>
          <div className="prep-form-grid three"><Field label="首轮决定（天）"><input type="number" min="0" step="1" className="input" value={firstDecision} onChange={event => setFirstDecision(event.target.value)} /></Field><Field label="总审稿周期（天）"><input type="number" min="0" step="1" className="input" value={totalReview} onChange={event => setTotalReview(event.target.value)} /></Field><Field label="接收率（%）"><input type="number" min="0" max="100" className="input" value={acceptanceRate} onChange={event => setAcceptanceRate(event.target.value)} /></Field></div>
          <Field label="收录情况" wide><div className="prep-check-row">{INDEXING_OPTIONS.map(option => <label key={option}><input type="checkbox" checked={indexing.includes(option)} onChange={event => setIndexing(previous => event.target.checked ? Array.from(new Set([...previous, option])) : previous.filter(item => item !== option))} /> {option}</label>)}</div></Field>
        </section>

        <section className="journal-form-section notes"><div className="journal-form-section-head"><b>适配与备注</b><span>记录为什么投、为什么不投</span></div>
          <div className="prep-form-grid two"><Field label="研究领域标签"><input className="input" value={tags} onChange={event => setTags(event.target.value)} placeholder="地质灾害, 滑坡, 遥感" /></Field><Field label="风险状态"><select className="select" value={risk} onChange={event => setRisk(event.target.value)}><option value="normal">正常</option><option value="watch">关注</option><option value="warning">预警 / 谨慎</option></select></Field></div>
          <Field label="期刊范围与适配说明" wide><textarea className="textarea" value={scope} onChange={event => setScope(event.target.value)} /></Field>
          <Field label="第三方介绍与数据来源" wide><textarea className="textarea" value={thirdParty} onChange={event => setThirdParty(event.target.value)} placeholder={'每行：LetPub|https://...\nCrossref|https://...'} /></Field>
          <div className="prep-form-grid two"><Field label="费用与开放获取备注"><textarea className="textarea" value={feeNotes} onChange={event => setFeeNotes(event.target.value)} /></Field><Field label="其它备注"><textarea className="textarea" value={notes} onChange={event => setNotes(event.target.value)} /></Field></div>
          <label className="prep-switch"><input type="checkbox" checked={favorite} onChange={event => setFavorite(event.target.checked)} /><span>加入收藏期刊</span></label>
        </section>
      </div>

      <div className="prep-modal-footer">{source ? <button type="button" className="btn btn-danger btn-sm" onClick={() => void remove()} disabled={saving}><Trash2 size={14} /> 删除</button> : <span />}<div><button type="button" className="btn btn-ghost" onClick={onClose} disabled={saving}>取消</button><button type="button" className="btn btn-primary" onClick={() => void save()} disabled={saving}><Save size={14} /> {saving ? '保存中...' : '保存期刊'}</button></div></div>
    </div>
  </div>
}
