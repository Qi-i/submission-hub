import { useCallback, useEffect, useMemo, useState } from 'react'
import { Search, Star } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useTheme } from '../lib/theme'
import type { Paper } from '../lib/types'
import type { JournalProfile } from '../lib/preparation'
import { deriveAutomaticJournalProfiles } from '../lib/journal-auto-catalog'
import { lookupJournalRanks } from '../lib/journal-rank-client'
import JournalFormEnhanced from './JournalFormEnhanced'
import JournalCatalogCard from './JournalCatalogCard'
import LuminousXStatusBar from './LuminousXStatusBar'
import { invalidateOnlineJournalProfileCache } from './OnlinePaperCard'

interface Props {
  userId: string
  onChanged?: () => void
}

const priorityWeight = { critical: 4, high: 3, medium: 2, low: 1 }

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
export default function JournalCenterWorkspace({ userId, onChanged }: Props) {
  const { uiMode } = useTheme()
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
    {uiMode === 'luminous-x' && <LuminousXStatusBar
      modeLabel="期刊中心"
      subtitle="集中管理期刊档案、投稿入口、评价指标、费用与横向比较。"
      recordCount={journals.length}
    />}

    <header className="journal-center-toolbar">
      <div className="journal-center-toolbar__title"><h1>期刊中心</h1><p>集中维护期刊档案、评价信息、投稿入口和费用；投稿准备中的期刊匹配直接读取这里的数据。</p></div>
      <div className="journal-center-toolbar__actions">
        <label className="journal-center-search"><Search size={15} /><input value={search} onChange={event => setSearch(event.target.value)} placeholder="搜索期刊、缩写、出版商或标签" /></label>
        <button type="button" className={favoritesOnly ? 'active' : ''} onClick={() => setFavoritesOnly(value => !value)}><Star size={14} fill={favoritesOnly ? 'currentColor' : 'none'} /> 收藏</button>
        <button type="button" className="primary" onClick={() => setEditor('new')}><Star size={14} /> 新增期刊</button>
      </div>
    </header>

    {loading ? <div className="journal-center-loading">正在加载期刊档案…</div> : <div className="journal-center-grid paper-grid journal-catalog-grid">
      {visible.map(journal => <JournalCatalogCard key={journal.id} journal={journal} onClick={() => setEditor(journal)} standalone thirdPartyLinkLimit={journal.third_party_links.length} />)}
      {!visible.length && <div className="journal-center-empty">{search || favoritesOnly ? '没有符合当前条件的期刊。' : '暂无期刊档案。'}</div>}
    </div>}

    {editor && <JournalFormEnhanced value={editor} onSave={saveJournal} onDelete={deleteJournal} onClose={() => setEditor(null)} onLookupRanks={lookupJournalRanks} />}
  </section>
}
