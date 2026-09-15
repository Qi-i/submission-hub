import { readFileSync } from 'node:fs'

const source = readFileSync('src/lib/journal-display.ts', 'utf8')
const failures = []

const internationalMatch = source.match(/const INTERNATIONAL_KEYS = \[([^\]]+)\]/)
if (!internationalMatch) {
  failures.push('INTERNATIONAL_KEYS declaration missing')
} else {
  const keys = Array.from(internationalMatch[1].matchAll(/'([^']+)'/g), match => match[1])
  const jcrIndex = Math.min(...['sci', 'ssci'].map(key => {
    const index = keys.indexOf(key)
    return index < 0 ? Number.POSITIVE_INFINITY : index
  }))
  for (const lowerPriority of ['sciUp', 'sciBase', 'xr', 'sciif']) {
    const index = keys.indexOf(lowerPriority)
    if (index >= 0 && !(jcrIndex < index)) failures.push(`JCR keys must precede ${lowerPriority} in international rank order`)
  }
}

const surfaceStart = source.indexOf('export function journalSurfaceClassification')
const surfaceEnd = source.indexOf('export function isDomesticJournal', surfaceStart)
const surface = source.slice(surfaceStart, surfaceEnd)
const jcrPos = surface.indexOf('const jcr = normalizeJcrQuartile')
const chinesePos = surface.indexOf('if (isChineseJournalForSurface(journal))')
if (jcrPos < 0 || chinesePos < 0 || jcrPos > chinesePos) {
  failures.push('JCR surface classification must be evaluated before Chinese core fallback classification')
}

const primaryStart = source.indexOf('export function primaryJournalRankItems')
const primaryEnd = source.indexOf('export const journalPrimaryRankItems', primaryStart)
const primary = source.slice(primaryStart, primaryEnd)
if (!primary.includes('const preferInternational = hasInternationalEvidence')) {
  failures.push('primary rank ordering must explicitly prefer international/JCR evidence when present')
}
if (!primary.includes('preferInternational\n    ? [...INTERNATIONAL_KEYS, ...DOMESTIC_KEYS]')) {
  failures.push('primary rank ordering must put international keys before domestic keys when JCR/international evidence exists')
}

if (failures.length) {
  console.error('JCR-first rank priority contract failed:')
  failures.forEach(item => console.error(`- ${item}`))
  process.exit(1)
}

console.log('JCR-first rank priority contract passed.')
