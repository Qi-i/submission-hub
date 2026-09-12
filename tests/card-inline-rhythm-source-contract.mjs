import { existsSync, readFileSync } from 'node:fs'

const failures = []
const cssPath = 'src/styles/submission-family-card-coherence.css'
const topMetaCssPath = 'src/components/JournalCatalogCardTopMeta.css'
const publisherPath = 'src/lib/publisher-display.ts'
const displayPath = 'src/lib/journal-display.ts'
const journalPath = 'src/components/JournalCatalogCard.tsx'
const journalFormPath = 'src/components/JournalFormEnhanced.tsx'
const paperPath = 'src/components/PaperCardEnhanced.tsx'

const css = readFileSync(cssPath, 'utf8') + '\n' + (existsSync(topMetaCssPath) ? readFileSync(topMetaCssPath, 'utf8') : '')
const journal = readFileSync(journalPath, 'utf8')
const journalForm = readFileSync(journalFormPath, 'utf8')
const display = readFileSync(displayPath, 'utf8')
const paper = readFileSync(paperPath, 'utf8')

for (const token of [
  '--card-inline-primary-h: 30px',
  '--card-inline-secondary-h: 26px',
  '--card-inline-compact-h: 24px',
  '--card-inline-metric-h: 42px',
  '--card-inline-primary-pad-x: 10px',
  '--card-inline-secondary-pad-x: 8px',
  '--card-inline-compact-pad-x: 8px',
  '--journal-card-meta-h: 30px',
  '--journal-card-meta-pad-x: 9px',
]) {
  if (!css.includes(token)) failures.push(`missing shared card rhythm token: ${token}`)
}

if (!existsSync(publisherPath)) {
  failures.push('missing shared publisher-display utility')
} else {
  const publisher = readFileSync(publisherPath, 'utf8')
  for (const canonical of ["name: 'Wiley'", "name: 'MDPI'", "name: 'Elsevier'", "name: 'Springer'", "name: 'T&F'", "name: 'Copernicus'"]) {
    if (!publisher.includes(canonical)) failures.push(`publisher policy missing canonical short name: ${canonical}`)
  }
  if (!publisher.includes("tier.startsWith('cn-')")) failures.push('publisher utility does not suppress publisher display for Chinese journals')
}

if (!journal.includes("from '../lib/publisher-display'")) failures.push('JournalCatalogCard does not use the shared publisher display policy')
if (!journal.includes("./JournalCatalogCardTopMeta.css")) failures.push('JournalCatalogCard does not load the unified top metadata stylesheet')
if (!paper.includes("from '../lib/publisher-display'")) failures.push('PaperCardEnhanced does not use the shared publisher display policy')
if (/function\s+publisherMark\s*\(/.test(journal)) failures.push('JournalCatalogCard still owns a duplicate publisherMark implementation')
if (/function\s+publisherIdentity\s*\(/.test(paper)) failures.push('PaperCardEnhanced still owns a duplicate publisherIdentity implementation')
if (journal.includes('publisher-mark-symbol') || journal.includes('publisher.mark')) failures.push('JournalCatalogCard must render one publisher wordmark only, not a pseudo-logo plus duplicate text')
if (paper.includes('publisher-mark-symbol') || paper.includes('publisher.mark')) failures.push('PaperCardEnhanced must render one publisher wordmark only, not a pseudo-logo plus duplicate text')

if (!display.includes('journalStarRating') || !display.includes('ui_star_rating')) failures.push('journal-display does not expose persisted 1-5 star rating semantics')
if (!journal.includes('journalStarRating') || !journal.includes('journal-rating-pill')) failures.push('JournalCatalogCard does not render the 1-5 star rating pill')
if (journal.includes('期刊档案')) failures.push('JournalCatalogCard must not fabricate a 期刊档案 placeholder when publisher metadata is absent')
if (!journalForm.includes('投稿星级') || !journalForm.includes('ui_star_rating')) failures.push('Journal editor does not provide a persisted custom 1-5 star control')
if (journalForm.includes('收藏优先级')) failures.push('legacy 收藏优先级 dropdown should be replaced by the star rating control')

for (const selectorToken of ['journal-rating-pill', 'publisher-mark', 'journal-catalog-card__abbreviation', 'journal-catalog-card__oa']) {
  if (!css.includes(selectorToken)) failures.push(`journal top metadata geometry missing ${selectorToken}`)
}
if (!css.includes('height: var(--journal-card-meta-h)')) failures.push('journal top metadata does not share one explicit visual height')
if (!css.includes('padding-inline: var(--journal-card-meta-pad-x)')) failures.push('journal top metadata does not share balanced horizontal padding')

if (failures.length) {
  console.error('Card inline rhythm source contract failed:')
  failures.forEach(item => console.error(`- ${item}`))
  process.exit(1)
}

console.log('Card inline rhythm source contract passed.')
