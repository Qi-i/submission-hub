import { ArrowRight, BookOpen, FilePenLine, Star, Target } from 'lucide-react'
import { useMemo, useState } from 'react'
import type { JournalProfile, ManuscriptDraft } from '../../lib/preparation'
import { draftReadiness, journalFitSummary } from '../../lib/preparation'
import { journalPrimaryRankItems, journalRankTone, type RankedJournalProfile } from '../../lib/journal-display'

interface Props {
  drafts: ManuscriptDraft[]
  journals: JournalProfile[]
  onEditDraft: (draft: ManuscriptDraft) => void
  onEditJournal: (journal: JournalProfile) => void
  onOpenJournalCenter: () => void
}

const priorityWeight = { critical: 4, high: 3, medium: 2, low: 1 }

function Candidate({ journal, onClick }: { journal: JournalProfile; onClick: () => void }) {
  const ranks = journalPrimaryRankItems(journal as RankedJournalProfile, 4)
  return <button type="button" className="journal-match-candidate" onClick={onClick}>
    <div className="journal-match-candidate__head"><span>{journal.is_favorite ? '★' : '☆'}</span><strong>{journal.name}</strong></div>
    {(journal.name_zh || journal.official_abbreviation) && <div className="journal-match-candidate__identity">{journal.name_zh || journal.official_abbreviation}</div>}
    <div className="journal-match-candidate__ranks">{ranks.map(item => <span key={`${item.key}-${item.value}`} data-tone={journalRankTone(item.key)}>{item.label} {item.value}</span>)}</div>
    <div className="journal-match-candidate__foot"><span>{journalFitSummary(journal)}</span><ArrowRight size={12} /></div>
  </button>
}

export default function JournalMatchWorkspace({ drafts, journals, onEditDraft, onEditJournal, onOpenJournalCenter }: Props) {
  const [selectedDraftId, setSelectedDraftId] = useState<string>(drafts[0]?.id || '')
  const selectedDraft = drafts.find(item => item.id === selectedDraftId) || drafts[0] || null
  const primaryJournal = selectedDraft?.primary_journal_id ? journals.find(item => item.id === selectedDraft.primary_journal_id) : null
  const candidates = useMemo(() => [...journals]
    .sort((a, b) => Number(b.is_favorite) - Number(a.is_favorite) || priorityWeight[b.priority] - priorityWeight[a.priority] || a.name.localeCompare(b.name))
    .slice(0, 8), [journals])

  return <section className="journal-match-workspace" aria-label="期刊匹配工作台">
    <header className="prep-primary-section-head journal-match-head">
      <div><h2>期刊匹配</h2><p>从论文草稿出发查看主投期刊与候选期刊；完整档案维护仍在独立的期刊中心完成。</p></div>
      <button type="button" className="btn btn-ghost btn-sm" onClick={onOpenJournalCenter}><BookOpen size={14} /> 打开期刊中心</button>
    </header>

    {!drafts.length ? <div className="journal-match-empty"><FilePenLine size={20} /><strong>先建立论文草稿</strong><span>期刊匹配以具体草稿为对象，不再复制整套期刊库。</span></div> : <div className="journal-match-layout">
      <aside className="journal-match-drafts">
        <div className="journal-match-section-title"><FilePenLine size={14} /><strong>选择草稿</strong><span>{drafts.length}</span></div>
        {drafts.map(draft => {
          const readiness = draftReadiness(draft)
          return <button key={draft.id} type="button" className={draft.id === selectedDraft?.id ? 'active' : ''} onClick={() => setSelectedDraftId(draft.id)}>
            <strong>{draft.title}</strong><span>就绪度 {readiness.score}%</span>
          </button>
        })}
      </aside>

      <main className="journal-match-main">
        <section className="journal-match-current">
          <div className="journal-match-section-title"><Target size={14} /><strong>当前匹配对象</strong></div>
          <h3>{selectedDraft?.title}</h3>
          <div className="journal-match-current__journal">
            <span>主投期刊</span><strong>{primaryJournal?.name || '尚未设置'}</strong>
            {primaryJournal && <small>{journalFitSummary(primaryJournal)}</small>}
          </div>
          {selectedDraft && <button type="button" onClick={() => onEditDraft(selectedDraft)}>编辑草稿与目标期刊 <ArrowRight size={12} /></button>}
        </section>

        <section className="journal-match-candidates">
          <div className="journal-match-section-title"><Star size={14} /><strong>候选期刊</strong><span>{candidates.length}</span></div>
          <div className="journal-match-candidate-grid">{candidates.map(journal => <Candidate key={journal.id} journal={journal} onClick={() => onEditJournal(journal)} />)}</div>
          {!candidates.length && <div className="journal-match-empty"><span>期刊中心暂时没有可用于匹配的档案。</span><button type="button" onClick={onOpenJournalCenter}>前往期刊中心</button></div>}
        </section>
      </main>
    </div>}
  </section>
}
