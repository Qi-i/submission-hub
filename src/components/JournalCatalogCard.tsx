import { ExternalLink, Star } from 'lucide-react'
import type { JournalProfile } from '../lib/preparation'
import { OA_OPTIONS, PRIORITY_OPTIONS } from '../lib/preparation'
import { journalPrimaryRankItems, journalRankTone, type RankedJournalProfile } from '../lib/journal-display'
import CurrencyCny from './CurrencyCny'

interface Props {
  journal: JournalProfile
  onClick: () => void
  standalone?: boolean
  thirdPartyLinkLimit?: number
}

const safeUrl = (value?: string | null) => !!value && /^https?:\/\//i.test(value)

function RankBlocks({ journal }: { journal: JournalProfile }) {
  const ranks = journalPrimaryRankItems(journal as RankedJournalProfile, 7)
  if (!ranks.length) return <div className="prep-journal-rank-blocks empty full">主要分区与收录未记录</div>
  return <div className="prep-journal-rank-blocks full">
    {ranks.map(item => <span key={`${item.key}-${item.value}`} data-tone={journalRankTone(item.key)}><b>{item.label}</b><em>{item.value}</em></span>)}
  </div>
}

export default function JournalCatalogCard({ journal, onClick, standalone = false, thirdPartyLinkLimit = 2 }: Props) {
  const oa = OA_OPTIONS.find(item => item.key === journal.oa_type)?.label || '未确认'
  const priority = PRIORITY_OPTIONS.find(item => item.key === journal.priority)?.label || '中'
  const risk = journal.risk_level === 'warning' ? '预警' : journal.risk_level === 'watch' ? '关注' : '正常'
  const showAbbreviation = !!journal.official_abbreviation && journal.official_abbreviation.toLocaleLowerCase() !== journal.name.toLocaleLowerCase()
  const publisherLine = journal.publisher || journal.scope_zh || journal.scope || '尚未填写出版社或期刊范围'
  const selectionTags = Array.isArray(journal.selection_tags) ? journal.selection_tags : []
  const indexing = Array.isArray(journal.indexing) ? journal.indexing : []
  const thirdPartyLinks = (Array.isArray(journal.third_party_links) ? journal.third_party_links : []).filter(link => safeUrl(link.url)).slice(0, thirdPartyLinkLimit)
  const metricCount = [
    journal.first_decision_days,
    journal.total_review_days,
    journal.acceptance_rate,
    journal.apc_amount,
  ].filter(value => value != null).length

  return <article
    className={`prep-journal-card journal-catalog-card${standalone ? ' journal-center-card' : ''}`}
    data-priority={journal.priority}
    data-risk={journal.risk_level}
    data-favorite={journal.is_favorite ? 'true' : 'false'}
  >
    <button
      className={`prep-journal-card-main journal-catalog-card__main${standalone ? ' journal-center-card__body' : ''}`}
      onClick={onClick}
      title={journal.selection_notes || journal.scope_zh || undefined}
      type="button"
    >
      <div className="prep-card-top journal-catalog-card__head">
        <div className="journal-catalog-card__status-area">
          <span className={`prep-priority journal-catalog-card__status ${journal.priority}`}>
            {journal.is_favorite && <Star size={13} fill="currentColor" />}
            {journal.is_favorite ? '重点期刊' : '期刊档案'}
          </span>
          <span className={`prep-risk journal-catalog-card__substatus ${journal.risk_level}`}>
            <i aria-hidden="true" />优先级 {priority} · {risk}
          </span>
        </div>
        <span className="journal-catalog-card__oa" data-tone="oa">{oa}</span>
      </div>

      <div className="journal-catalog-card__title-block">
        <h3>{journal.name}</h3>
        {(journal.name_zh || showAbbreviation) && <div className="prep-journal-local-identity journal-catalog-card__identity">
          {journal.name_zh && <strong>{journal.name_zh}</strong>}
          {showAbbreviation && <em>{journal.official_abbreviation}</em>}
        </div>}
        <p className="prep-journal-publisher journal-catalog-card__subtitle" title={publisherLine}>{publisherLine}</p>
      </div>

      <RankBlocks journal={journal} />

      <div className="prep-journal-facts journal-catalog-card__facts">
        {selectionTags.slice(0, 2).map(item => <span key={`selection-${item}`} data-tone="selection">{item}</span>)}
        {indexing.slice(0, 4).map(item => <span key={item} data-tone="index">{item}</span>)}
      </div>

      {metricCount > 0 && <div className="prep-journal-numbers prep-journal-metrics-compact journal-catalog-card__metrics">
        {journal.first_decision_days != null && <div><b>{journal.first_decision_days}</b><small>首轮决定/天</small></div>}
        {journal.total_review_days != null && <div><b>{journal.total_review_days}</b><small>总审稿/天</small></div>}
        {journal.acceptance_rate != null && <div><b>{journal.acceptance_rate}%</b><small>接收率</small></div>}
        {journal.apc_amount != null && <div className="prep-journal-apc-metric">
          <b>{journal.apc_amount}</b>
          <small>{journal.apc_currency || 'APC'}</small>
          {journal.apc_amount > 0 && !['CNY', 'RMB', 'CNH'].includes((journal.apc_currency || '').trim().toUpperCase()) && <CurrencyCny amount={journal.apc_amount} currency={journal.apc_currency || 'USD'} showOriginal={false} compact className="prep-journal-apc-cny" />}
        </div>}
      </div>}
    </button>

    <div className={`prep-journal-links journal-catalog-card__footer${standalone ? ' journal-center-card__links' : ''}`}>
      {safeUrl(journal.website_url) && <a href={journal.website_url!} target="_blank" rel="noopener noreferrer">官网 <ExternalLink size={11} /></a>}
      {safeUrl(journal.author_guide_url) && <a href={journal.author_guide_url!} target="_blank" rel="noopener noreferrer">指南 <ExternalLink size={11} /></a>}
      {safeUrl(journal.submission_url) && <a href={journal.submission_url!} target="_blank" rel="noopener noreferrer">投稿 <ExternalLink size={11} /></a>}
      {thirdPartyLinks.map(link => <a key={`${link.label}-${link.url}`} href={link.url} target="_blank" rel="noopener noreferrer">{link.label} <ExternalLink size={11} /></a>)}
    </div>
  </article>
}
