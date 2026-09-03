import { useCallback, useEffect, useMemo, useState } from 'react'
import { ExternalLink, Search, Star } from 'lucide-react'
import { supabase } from '../lib/supabase'
import type { Paper } from '../lib/types'
import type { JournalProfile } from '../lib/preparation'
import { OA_OPTIONS } from '../lib/preparation'
import { deriveAutomaticJournalProfiles } from '../lib/journal-auto-catalog'
import { lookupJournalRanks } from '../lib/journal-rank-client'
import { journalPrimaryRankItems, journalRankTone, type RankedJournalProfile } from '../lib/journal-display'
import JournalFormEnhanced from './JournalFormEnhanced'
import CurrencyCny from './CurrencyCny'
import { invalidateOnlineJournalProfileCache } from './OnlinePaperCard'

interface Props {
  userId: string
  onChanged?: () => void
}

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

function normalizeJournal(journal: JournalProfile): JournalProfile {
  return {
    ...journal,
    third_party_links: Array.isArray(journal.third_party_links) ? journal.third_party_links : [],
    subject_tags: Array.isArray(journal.subject_tags) ? journal.subject_tags : [],
    selection_tags: Array.isArray(journal.selection_tags) ? journal.selection_tags : [],
    indexing: Array.isArray(journal.indexing) ? journal.indexing : [],
  }
}

function cleanPayload<T extends Record<string, any>>(data: T) {
  const { id, user_id, created_at, updated_at, ...payload } = data
  return payload
}

function legacyAutomaticJournalPayload(journal: JournalProfile) {
  const { name_zh, official_abbreviation, scope_zh, selection_tags, selection_notes, ...legacy } = journal
  return { ...legacy, notes: journal.notes || '系统根据投稿历史自动建立的简易期刊档案。' }
}

function RankBlocks({ journal }: { journal: JournalProfile }) {
  const ranks = journalPrimaryRankItems(journal as RankedJournalProfile, 7)
  if (!ranks.length) return <div className="journal-center-ranks empty">主要分区与收录未记录</div>
  return <div className="journal-center-ranks">{ranks.map(item => <span key={`${item.key}-${item.value}`} data-tone={journalRankTone(item.key)}><b>{item.label}</b><em>{item.value}</em></span>)}</div>
}

function JournalCenterCard({ journal, onEdit }: { journal: JournalProfile; onEdit: () => void }) {
  const oa = OA_OPTIONS.find(item => item.key === journal.oa_type)?.label || '未确认'
  const showAbbreviation = !!journal.official_abbreviation && journal.official_abbreviation.toLocaleLowerCase() !== journal.name.toLocaleLowerCase()
  const publisher = journal.publisher || journal.scope_zh || journal.scope || '尚未填写出版社或期刊范围'
  const hasMetrics = journal.first_decision_days != null || journal.total_review_days != null || journal.acceptance_rate != null || journal.apc_amount != null
  const seenLinks = new Set<string>()
  const links = [
    ...(safeUrl(journal.website_url) ? [{ label: '官网', url: journal.website_url! }] : []),
    ...(safeUrl(journal.author_guide_url) ? [{ label: '指南', url: journal.author_guide_url! }] : []),
    ...(safeUrl(journal.submission_url) ? [{ label: '投稿', url: journal.submission_url! }] : []),
    ...journal.third_party_links.filter(link => safeUrl(link.url)),
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
      <p>{publisher}</p>
      <RankBlocks journal={journal} />
      <div className="journal-center-card__facts">
        {journal.selection_tags.slice(0, 2).map(tag => <span key={tag}>{tag}</span>)}
        <span>{oa}</span>
        {journal.indexing.slice(0, 4).map(item => <span key={item}>{item}</span>)}
      </div>
      {hasMetrics && <div className="journal-center-card__metrics">
        {journal.first_decision_days != null && <span><b>{journal.first_decision_days}</b><small>首轮决定/天</small></span>}
        {journal.total_review_days != null && <span><b>{journal.total_review_days}</b><small>总审稿/天</small></span>}
        {journal.acceptance_rate != null && <span><b>{journal.acceptance_rate}%</b><small>接收率</small></span>}
        {journal.apc_amount != null && <span><b>{journal.apc_amount}</b><small>{journal.apc_currency || 'APC'}</small>{journal.apc_amount > 0 && !['CNY', 'RMB', 'CNH'].includes((journal.apc_currency || '').toUpperCase()) && <CurrencyCny amount={journal.apc_amount} currency={journal.apc_currency || 'USD'} showOriginal={false} compact />}</span>}
      </div>}
    </button>
    {links.length > 0 && <div className="journal-center-card__links">
      {links.map(link => <a key={`${link.label}-${link.url}`} href={link.url} target="_blank" rel="noopener noreferrer">{link.label} <ExternalLink size={11} /></a>)}
    </div>}
  </article>
}

export default function JournalCenterWorkspace({ userId, onChanged }: Props) {
  const [journals, setJournals] = useState<JournalProfile[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [favoritesOnly, setFavoritesOnly] = useState(false)
  const [editor, setEditor] = useState<JournalProfile | 'new' | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [journalResult, paperResult] = await Promise.all([
        (supabase.from('journal_profiles') as any).select('*').order('updated_at', { ascending: false }),
        (supabase.from('papers') as any).select('*').order('updated_at', { ascending: false }),
      ])
      if (journalResult.error) throw journalResult.error
      if (paperResult.error) throw paperResult.error
      let current = ((journalResult.data || []) as JournalProfile[]).map(normalizeJournal)
      const automatic = deriveAutomaticJournalProfiles((paperResult.data || []) as Paper[], current, userId)
      if (automatic.length) {
        const fullInsert = await (supabase.from('journal_profiles') as any).insert(automatic).select('*')
        if (!fullInsert.error) current = [...((fullInsert.data || []) as JournalProfile[]).map(normalizeJournal), ...current]
        else {
          const legacyInsert = await (supabase.from('journal_profiles') as any).insert(automatic.map(legacyAutomaticJournalPayload)).select('*')
          current = legacyInsert.error ? [...automatic.map(normalizeJournal), ...current] : [...((legacyInsert.data || []) as JournalProfile[]).map(normalizeJournal), ...current]
        }
        invalidateOnlineJournalProfileCache()
      }
      setJournals(current)
    } catch (error) {
      console.error('Load Journal Center failed:', error)
    } finally {
      setLoading(false)
    }
  }, [userId])

  useEffect(() => { void load() }, [load])

  const visible = useMemo(() => {
    const query = search.trim().toLocaleLowerCase()
    return journals
      .filter(journal => !favoritesOnly || journal.is_favorite)
      .filter(journal => !query || `${journal.name} ${journal.name_zh || ''} ${journal.official_abbreviation || ''} ${journal.publisher || ''} ${journal.subject_tags.join(' ')} ${journal.selection_tags.join(' ')}`.toLocaleLowerCase().includes(query))
      .sort((a, b) => Number(b.is_favorite) - Number(a.is_favorite) || priorityWeight[b.priority] - priorityWeight[a.priority] || a.name.localeCompare(b.name))
  }, [journals, favoritesOnly, search])

  const saveJournal = async (data: Partial<JournalProfile> & Pick<JournalProfile, 'name'>) => {
    const now = new Date().toISOString()
    if (data.id) {
      const result = await (supabase.from('journal_profiles') as any).update({ ...cleanPayload(data), updated_at: now }).eq('id', data.id).select('id')
      if (result.error) throw result.error
      if (!result.data?.length) {
        const insert = await (supabase.from('journal_profiles') as any).insert({ ...cleanPayload(data), id: data.id, user_id: userId, created_at: data.created_at || now, updated_at: now })
        if (insert.error) throw insert.error
      }
    } else {
      const insert = await (supabase.from('journal_profiles') as any).insert({ ...cleanPayload(data), id: crypto.randomUUID(), user_id: userId, created_at: now, updated_at: now })
      if (insert.error) throw insert.error
    }
    invalidateOnlineJournalProfileCache()
    await load()
    onChanged?.()
  }

  const deleteJournal = async (id: string) => {
    const result = await (supabase.from('journal_profiles') as any).delete().eq('id', id)
    if (result.error) throw result.error
    invalidateOnlineJournalProfileCache()
    await load()
    onChanged?.()
  }

  return <section className="journal-center-workspace" aria-label="期刊中心">
    <header className="journal-center-toolbar">
      <div className="journal-center-toolbar__title"><h1>期刊中心</h1><p>集中维护期刊档案、评价信息、投稿入口和费用；投稿准备中的期刊匹配直接读取这里的数据。</p></div>
      <div className="journal-center-toolbar__actions">
        <label className="journal-center-search"><Search size={15} /><input value={search} onChange={event => setSearch(event.target.value)} placeholder="搜索期刊、缩写、出版商或标签" /></label>
        <button type="button" className={favoritesOnly ? 'active' : ''} onClick={() => setFavoritesOnly(value => !value)}><Star size={14} fill={favoritesOnly ? 'currentColor' : 'none'} /> 收藏</button>
        <button type="button" className="primary" onClick={() => setEditor('new')}><Star size={14} /> 新增期刊</button>
      </div>
    </header>

    {loading ? <div className="journal-center-loading">正在加载期刊档案…</div> : <div className="journal-center-grid">
      {visible.map(journal => <JournalCenterCard key={journal.id} journal={journal} onEdit={() => setEditor(journal)} />)}
      {!visible.length && <div className="journal-center-empty">{search || favoritesOnly ? '没有符合当前条件的期刊。' : '暂无期刊档案。'}</div>}
    </div>}

    {editor && <JournalFormEnhanced value={editor} onSave={saveJournal} onDelete={deleteJournal} onClose={() => setEditor(null)} onLookupRanks={lookupJournalRanks} />}
  </section>
}
