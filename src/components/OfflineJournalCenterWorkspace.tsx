import { useMemo, useState } from 'react'
import { Search, Star } from 'lucide-react'
import * as prepStore from '../lib/local-preparation-store'
import type { JournalProfile } from '../lib/preparation'
import JournalFormEnhanced from './JournalFormEnhanced'
import JournalCatalogCard from './JournalCatalogCard'

interface Props { refreshToken?: number; onChanged?: () => void }
const priorityWeight = { critical: 4, high: 3, medium: 2, low: 1 }
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
    <div className="journal-center-grid prep-card-grid journal-grid journal-catalog-grid">{visible.map(journal=><JournalCatalogCard key={journal.id} journal={journal} onClick={()=>setEditor(journal)} standalone thirdPartyLinkLimit={(journal.third_party_links || []).length}/>)}{!visible.length && <div className="journal-center-empty">暂无符合条件的期刊。</div>}</div>
    {editor && <JournalFormEnhanced value={editor} onSave={save} onDelete={remove} onClose={()=>setEditor(null)} />}
  </section>
}
