import type { CSSProperties, KeyboardEvent } from 'react'
import { ExternalLink } from 'lucide-react'
import type { JournalProfile } from '../lib/preparation'
import { OA_OPTIONS } from '../lib/preparation'
import { journalPrimaryRankItems, journalRankTone, journalStarRating, journalSurfaceClassification, type RankedJournalProfile } from '../lib/journal-display'
import { journalPublisherIdentity } from '../lib/publisher-display'
import CurrencyCny from './CurrencyCny'
import './JournalCatalogCard.css'
import './JournalCatalogCardDetail.css'
import './JournalCatalogCardTopMeta.css'

interface Props {
  journal: JournalProfile
  onClick: () => void
  standalone?: boolean
  thirdPartyLinkLimit?: number
}

const safeUrl = (value?: string | null) => !!value && /^https?:\/\//i.test(value)

function journalAccent(journal: JournalProfile) {
  if (journal.risk_level === 'warning' || journal.priority === 'critical') return '#dc2626'
  if (journal.risk_level === 'watch') return '#d97706'
  if (journal.priority === 'high') return '#2563eb'
  if (journal.priority === 'medium') return '#7c3aed'
  return '#64748b'
}

function RankBlocks({ journal, standalone = false }: { journal: JournalProfile; standalone?: boolean }) {
  const ranks = journalPrimaryRankItems(journal as RankedJournalProfile, standalone ? 5 : 7)
  const className = `prep-journal-rank-blocks full${standalone ? ' paper-meta-row paper-rank-row journal-catalog-card__ranks' : ''}`
  if (!ranks.length) return <div className={`${className} empty`}>主要分区与收录未记录</div>
  return <div className={className}>
    {ranks.map(item => <span key={`${item.key}-${item.value}`} data-tone={journalRankTone(item.key)}><b>{item.label}</b><em>{item.value}</em></span>)}
  </div>
}

export default function JournalCatalogCard({ journal, onClick, standalone = false, thirdPartyLinkLimit = 2 }: Props) {
  const oa = OA_OPTIONS.find(item => item.key === journal.oa_type)?.label || '未确认'
  const risk = journal.risk_level === 'warning' ? '预警' : journal.risk_level === 'watch' ? '关注' : '正常'
  const rating = journalStarRating(journal as RankedJournalProfile)
  const ratingStars = `${'★'.repeat(rating)}${'☆'.repeat(5 - rating)}`
  const showAbbreviation = !!journal.official_abbreviation && journal.official_abbreviation.toLocaleLowerCase() !== journal.name.toLocaleLowerCase()
  const publisher = journalPublisherIdentity(journal)
  const selectionTags = Array.isArray(journal.selection_tags) ? journal.selection_tags : []
  const indexing = Array.isArray(journal.indexing) ? journal.indexing : []
  const subjectTags = Array.isArray(journal.subject_tags) ? journal.subject_tags : []
  const thirdPartyLinks = (Array.isArray(journal.third_party_links) ? journal.third_party_links : []).filter(link => safeUrl(link.url)).slice(0, thirdPartyLinkLimit)
  const metricCount = [journal.first_decision_days, journal.total_review_days, journal.acceptance_rate, journal.apc_amount].filter(value => value != null).length
  const selectionLimit = standalone ? 1 : 2
  const subjectLimit = standalone ? 1 : 2
  const indexingLimit = standalone ? 3 : 4

  const facts = <div className={`prep-journal-facts journal-catalog-card__facts${standalone ? ' archive-chip-row' : ''}`}>
    {selectionTags.slice(0, selectionLimit).map(item => <span key={`selection-${item}`} data-tone="selection">{item}</span>)}
    {subjectTags.slice(0, subjectLimit).map(item => <span key={`subject-${item}`} data-tone="subject">{item}</span>)}
    {indexing.slice(0, indexingLimit).map(item => <span key={item} data-tone="index">{item}</span>)}
  </div>

  const metrics = metricCount > 0 && <div className="prep-journal-numbers prep-journal-metrics-compact journal-catalog-card__metrics" data-count={metricCount}>
    {journal.first_decision_days != null && <div data-tone="decision">
      <small className="journal-metric-label">首轮决定</small>
      <b className="journal-metric-value">{journal.first_decision_days}<span className="journal-metric-unit"> 天</span></b>
    </div>}
    {journal.total_review_days != null && <div data-tone="review">
      <small className="journal-metric-label">总审稿</small>
      <b className="journal-metric-value">{journal.total_review_days}<span className="journal-metric-unit"> 天</span></b>
    </div>}
    {journal.acceptance_rate != null && <div data-tone="accept">
      <small className="journal-metric-label">接收率</small>
      <b className="journal-metric-value">{journal.acceptance_rate}%</b>
    </div>}
    {journal.apc_amount != null && <div className="prep-journal-apc-metric" data-tone="apc">
      <small className="journal-metric-label">APC · {journal.apc_currency || '未注明'}</small>
      <b className="journal-metric-value">{journal.apc_amount}</b>
      {journal.apc_amount > 0 && !['CNY', 'RMB', 'CNH'].includes((journal.apc_currency || '').trim().toUpperCase()) && <CurrencyCny amount={journal.apc_amount} currency={journal.apc_currency || 'USD'} showOriginal={false} compact className="prep-journal-apc-cny" />}
    </div>}
  </div>

  const links = <div className={`prep-journal-links journal-catalog-card__footer${standalone ? ' journal-center-card__links' : ''}`} onClick={event => event.stopPropagation()}>
    {safeUrl(journal.website_url) && <a href={journal.website_url!} target="_blank" rel="noopener noreferrer">官网 <ExternalLink size={11} /></a>}
    {safeUrl(journal.author_guide_url) && <a href={journal.author_guide_url!} target="_blank" rel="noopener noreferrer">指南 <ExternalLink size={11} /></a>}
    {safeUrl(journal.submission_url) && <a href={journal.submission_url!} target="_blank" rel="noopener noreferrer">投稿 <ExternalLink size={11} /></a>}
    {thirdPartyLinks.map(link => <a key={`${link.label}-${link.url}`} href={link.url} target="_blank" rel="noopener noreferrer">{link.label} <ExternalLink size={11} /></a>)}
  </div>

  if (standalone) {
    const accent = journalAccent(journal)
    const surface = journalSurfaceClassification(journal as RankedJournalProfile)
    const style = {
      ['--paper-status-color' as string]: accent,
    } as CSSProperties
    const handleKeyDown = (event: KeyboardEvent<HTMLElement>) => {
      if (event.target !== event.currentTarget) return
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault()
        onClick()
      }
    }

    return <article
      className="card glass-card paper-card-v3 journal-catalog-card journal-center-card"
      style={style}
      data-priority={journal.priority}
      data-risk={journal.risk_level}
      data-oa={journal.oa_type || 'unknown'}
      data-favorite={journal.is_favorite ? 'true' : 'false'}
      data-star-rating={rating}
      data-surface-tier={surface.tier}
      data-surface-code={surface.code}
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={handleKeyDown}
      title={journal.selection_notes || journal.scope_zh || undefined}
    >
      <div className="paper-card-head journal-catalog-card__head">
        <div className="paper-status-area journal-catalog-card__status-area">
          <span className="badge journal-rating-pill journal-catalog-card__status" title={`投稿星级：${rating}/5`} aria-label={`投稿星级 ${rating} 星`}>
            <span className="journal-rating-stars" aria-hidden="true">{ratingStars}</span>
          </span>
        </div>
        <div className="paper-meta-row paper-meta-compact paper-action-rail journal-catalog-card__publisher-rail">
          {publisher && <span className="publisher-mark" data-publisher={publisher.tone} title={`出版社：${publisher.name}`}>
            <span className="publisher-mark-name">{publisher.name}</span>
          </span>}
          {showAbbreviation && <span className="badge badge-sm badge-outline journal-catalog-card__abbreviation">{journal.official_abbreviation}</span>}
        </div>
        <div className="journal-catalog-card__oa-slot">
          <span className="journal-catalog-card__oa" data-oa={journal.oa_type || 'unknown'} title={`开放获取：${oa}`}>
            <span className="journal-catalog-card__oa-key" aria-hidden="true">OA</span>
            <span className="journal-catalog-card__oa-label">{oa}</span>
          </span>
        </div>
      </div>

      <div className="title-block journal-catalog-card__title-block">
        <div className="card-title" title={journal.name}>{journal.name}</div>
        {journal.name_zh && <div className="card-subtitle journal-catalog-card__identity"><strong>{journal.name_zh}</strong></div>}
      </div>

      <RankBlocks journal={journal} standalone />
      {facts}
      {metrics}
      {links}
    </article>
  }

  return <article
    className="prep-journal-card journal-catalog-card"
    data-priority={journal.priority}
    data-risk={journal.risk_level}
    data-favorite={journal.is_favorite ? 'true' : 'false'}
    data-star-rating={rating}
  >
    <button className="prep-journal-card-main journal-catalog-card__main" onClick={onClick} title={journal.selection_notes || journal.scope_zh || undefined} type="button">
      <div className="prep-card-top journal-catalog-card__head">
        <div className="journal-catalog-card__status-area">
          <span className="prep-priority journal-rating-pill journal-catalog-card__status" title={`投稿星级：${rating}/5`}><span className="journal-rating-stars" aria-hidden="true">{ratingStars}</span></span>
          {risk !== '正常' && <span className={`prep-risk journal-catalog-card__substatus ${journal.risk_level}`}><i aria-hidden="true" />{risk}</span>}
        </div>
        <span className="journal-catalog-card__oa" data-tone="oa">{oa}</span>
      </div>
      <div className="journal-catalog-card__title-block">
        <h3>{journal.name}</h3>
        {(journal.name_zh || showAbbreviation) && <div className="prep-journal-local-identity journal-catalog-card__identity">{journal.name_zh && <strong>{journal.name_zh}</strong>}{showAbbreviation && <em>{journal.official_abbreviation}</em>}</div>}
        {publisher && <p className="prep-journal-publisher journal-catalog-card__subtitle" title={publisher.name}>{publisher.name}</p>}
      </div>
      <RankBlocks journal={journal} />
      {facts}
      {metrics}
    </button>
    {links}
  </article>
}
