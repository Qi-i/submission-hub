import { useMemo, useState } from 'react'
import { ExternalLink, Search, Star } from 'lucide-react'
import * as prepStore from '../lib/local-preparation-store'
import type { JournalProfile } from '../lib/preparation'
import { OA_OPTIONS } from '../lib/preparation'
import { journalPrimaryRankItems, journalRankTone, type RankedJournalProfile } from '../lib/journal-display'
import JournalFormEnhanced from './JournalFormEnhanced'

interface Props { refreshToken?: number; onChanged?: () => void }
const priorityWeight = { critical: 4, high: 3, medium: 2, low: 1 }
const safeUrl = (value?: string | null) => !!value && /^https?:\/\//i.test(value)
const normalizeLinkKey = (value: string) => {
  try {
    const url = new URL(value)
    url.hash = ''
    return `${url.origin}${url.pathname.replace(/\/$/, '')}${url.search}`.toLocaleLowerCase()
  } catch {
    return value.trim().toLocaleLowerCase()
  }
}

function RankBlocks({ journal }: { journal: JournalProfile }) {
  const ranks = journalPrimaryRankItems(journal as RankedJournalProfile, 7)
  if (!ranks.length) return <div className="journal-center-ranks empty">主要分区与收录未记录</div>
  return <div className="journal-center-ranks">{ranks.map(item => <span key={`${item.key}-${item.value}`} data-tone={journalRankTone(item.key)}><b>{item.label}</b><em>{item.value}</em></span>)}</div>
}

function Card({ journal, onEdit }: { journal: JournalProfile; onEdit: () => void }) {
  const oa = OA_OPTIONS.find(item => item.key === journal.oa_type)?.label || '未确认'
  const showAbbreviation = !!journal.official_abbreviation && journal.official_abbreviation.toLocaleLowerCase() !== journal.name.toLocaleLowerCase()
  const hasMetrics = journal.first_decision_days != null || journal.total_review_days != null || journal.acceptance_rate != null
  const seenLinks = new Set<string>()
  const links = [
    ...(safeUrl(journal.website_url) ? [{ label: '官网', url: journal.website_url! }] : []),
    ...(safeUrl(journal.author_guide_url) ? [{ label: '指南', url: journal.author_guide_url! }] : []),
    ...(safeUrl(journal.submission_url) ? [{ label: '投稿', url: journal.submission_url! }] : []),
    ...(journal.third_party_links || []).filter(link => safeUrl(link.url)),
  ].filter(link => {
    const key = normalizeLinkKey(link.url)
    if (seenLinks.has(key)) return false
    seenLinks.add(key)
    return true
  })
  return <article className="journal-center-card">
    <button className="journal-center-card__body" type="button" onClick={onEdit}>
      <div className="journal-center-card__flags"><span className="favorite">{journal.is_favorite ? '★' : '☆'}</span><span className={`risk ${journal.risk_level}`}>{journal.risk_level === 'warning' ? '预警' : journal.risk_level === 'watch' ? '关注' : '正常'}</span></div>
      <h2>{journal.name}</h2>
      {(journal.name_zh || showAbbreviation) && <div className="journal-center-card__identity">{journal.name_zh && <strong>{journal.name_zh}</strong>}{showAbbreviation && <em>{journal.official_abbreviation}</em>}</div>}
      <p>{journal.publisher || journal.scope_zh || journal.scope || '尚未填写出版社或期刊范围'}</p>
      <RankBlocks journal={journal} />
      <div className="journal-center-card__facts">{(journal.selection_tags || []).slice(0, 2).map(tag => <span key={tag}>{tag}</span>)}<span>{oa}</span>{journal.indexing.slice(0, 4).map(item => <span key={item}>{item}</span>)}</div>
      {hasMetrics && <div className="journal-center-card__metrics">
        {journal.first_decision_days != null && <span><b>{journal.first_decision_days}</b><small>首轮决定/天</small></span>}
        {journal.total_review_days != null && <span><b>{journal.total_review_days}</b><small>总审稿/天</small></span>}
        {journal.acceptance_rate != null && <span><b>{journal.acceptance_rate}%</b><small>接收率</small></span>}
      </div>}
    </button>
    {links.length > 0 && <div className="journal-center-card__links">{links.map(link => <a key={`${link.label}-${link.url}`} href={link.url} target="_blank" rel="noopener noreferrer">{link.label} <ExternalLink size={11} /></a>)}</div>}
  </article>
}

export default function OfflineJournalCenterWorkspace({ refreshToken, onChanged }: Props) {
  const [search, setSearch] = useState('')
  const [favoritesOnly, setFavoritesOnly] = useState(false)
  const [editor, setEditor] = useState<JournalProfile | 'new' | null>(null)
  const snapshot = prepStore.getPreparationSnapshot()
  void refreshToken
  const visible = useMemo(() => {
    const query = search.trim().toLocaleLowerCase()
    return snapshot.journals.filter(journal => !favoritesOnly || journal.is_favorite).filter(journal => !query || `${journal.name} ${journal.name_zh || ''} ${journal.official_abbreviation || ''} ${journal.publisher || ''}`.toLocaleLowerCase().includes(query)).sort((a,b) => Number(b.is_favorite)-Number(a.is_favorite) || priorityWeight[b.priority]-priorityWeight[a.priority] || a.name.localeCompare(b.name))
  }, [snapshot.journals, search, favoritesOnly])
  const save = async (data: Partial<JournalProfile> & Pick<JournalProfile,'name'>) => { prepStore.upsertJournal(data); setEditor(null); onChanged?.() }
  const remove = async (id: string) => { prepStore.deleteJournal(id); setEditor(null); onChanged?.() }
  return <section className="journal-center-workspace" aria-label="期刊中心">
    <header className="journal-center-toolbar"><div className="journal-center-toolbar__title"><h1>期刊中心</h1><p>集中维护期刊档案、评价信息、投稿入口和费用。</p></div><div className="journal-center-toolbar__actions"><label className="journal-center-search"><Search size={15}/><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="搜索期刊、缩写、出版商或标签"/></label><button type="button" className={favoritesOnly?'active':''} onClick={()=>setFavoritesOnly(v=>!v)}><Star size={14}/> 收藏</button><button type="button" className="primary" onClick={()=>setEditor('new')}><Star size={14}/> 新增期刊</button></div></header>
    <div className="journal-center-grid">{visible.map(journal=><Card key={journal.id} journal={journal} onEdit={()=>setEditor(journal)}/>)}{!visible.length && <div className="journal-center-empty">暂无符合条件的期刊。</div>}</div>
    {editor && <JournalFormEnhanced value={editor} onSave={save} onDelete={remove} onClose={()=>setEditor(null)} />}
  </section>
}
