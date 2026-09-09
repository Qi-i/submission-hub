import { existsSync, readFileSync } from 'node:fs'

// Browser-independent RED/GREEN guard for the shared card geometry and publisher policy.
const failures = []
const cssPath = 'src/styles/submission-family-card-coherence.css'
const publisherPath = 'src/lib/publisher-display.ts'
const journalPath = 'src/components/JournalCatalogCard.tsx'
const paperPath = 'src/components/PaperCardEnhanced.tsx'

const css = readFileSync(cssPath, 'utf8')
const journal = readFileSync(journalPath, 'utf8')
const paper = readFileSync(paperPath, 'utf8')

for (const token of [
  '--card-inline-primary-h: 30px',
  '--card-inline-secondary-h: 26px',
  '--card-inline-compact-h: 24px',
  '--card-inline-metric-h: 42px',
  '--card-inline-primary-pad-x: 10px',
  '--card-inline-secondary-pad-x: 8px',
  '--card-inline-compact-pad-x: 8px',
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
if (!paper.includes("from '../lib/publisher-display'")) failures.push('PaperCardEnhanced does not use the shared publisher display policy')
if (/function\s+publisherMark\s*\(/.test(journal)) failures.push('JournalCatalogCard still owns a duplicate publisherMark implementation')
if (/function\s+publisherIdentity\s*\(/.test(paper)) failures.push('PaperCardEnhanced still owns a duplicate publisherIdentity implementation')

if (failures.length) {
  console.error('Card inline rhythm source contract failed:')
  failures.forEach(item => console.error(`- ${item}`))
  process.exit(1)
}

console.log('Card inline rhythm source contract passed.')
