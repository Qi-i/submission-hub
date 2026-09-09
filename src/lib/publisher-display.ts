import type { JournalProfile } from './preparation'
import { journalSurfaceClassification, type RankedJournalProfile } from './journal-display'

export type PublisherIdentity = {
  name: string
  mark: string
  tone: string
}

type PublisherPreset = {
  pattern: RegExp
  name: string
  mark: string
  tone: string
}

const PUBLISHER_PRESETS: PublisherPreset[] = [
  { pattern: /elsevier/i, name: 'Elsevier', mark: 'E', tone: 'elsevier' },
  { pattern: /springer\s*nature|springer|birkh[aä]user|palgrave/i, name: 'Springer', mark: 'S', tone: 'springer' },
  { pattern: /taylor\s*(?:&|and)\s*francis|informa/i, name: 'T&F', mark: 'T&F', tone: 'taylor' },
  { pattern: /wiley/i, name: 'Wiley', mark: 'W', tone: 'wiley' },
  { pattern: /\bsage\b/i, name: 'SAGE', mark: 'SAGE', tone: 'sage' },
  { pattern: /\bmdpi\b|multidisciplinary\s+digital\s+publishing\s+institute/i, name: 'MDPI', mark: 'MDPI', tone: 'mdpi' },
  { pattern: /\bieee\b/i, name: 'IEEE', mark: 'IEEE', tone: 'ieee' },
  { pattern: /copernicus/i, name: 'Copernicus', mark: 'C', tone: 'copernicus' },
  { pattern: /emerald/i, name: 'Emerald', mark: 'E', tone: 'emerald' },
  { pattern: /oxford\s+university\s+press|\boup\b/i, name: 'OUP', mark: 'OUP', tone: 'oup' },
  { pattern: /cambridge\s+university\s+press|\bcup\b/i, name: 'CUP', mark: 'CUP', tone: 'cup' },
  { pattern: /nature\s+portfolio|nature\s+publishing/i, name: 'Nature', mark: 'N', tone: 'nature' },
  { pattern: /frontiers/i, name: 'Frontiers', mark: 'F', tone: 'frontiers' },
]

export function publisherIdentity(value?: string | null): PublisherIdentity | null {
  const rawName = (value || '').trim()
  if (!rawName) return null

  const preset = PUBLISHER_PRESETS.find(item => item.pattern.test(rawName))
  if (preset) return { name: preset.name, mark: preset.mark, tone: preset.tone }

  const cleanedName = rawName
    .replace(/\s*[（(][^（）()]*[）)]\s*$/u, '')
    .replace(/\s+/g, ' ')
    .trim() || rawName
  const words = cleanedName.replace(/[()（）]/g, ' ').split(/\s+/).filter(Boolean)
  const mark = words.length > 1
    ? words.slice(0, 2).map(word => word[0]).join('').toUpperCase()
    : cleanedName.slice(0, 2).toUpperCase()

  return { name: cleanedName, mark, tone: 'default' }
}

export function journalPublisherIdentity(journal?: JournalProfile | null): PublisherIdentity | null {
  if (!journal) return null
  const tier = journalSurfaceClassification(journal as RankedJournalProfile).tier
  if (tier.startsWith('cn-')) return null
  return publisherIdentity(journal.publisher)
}
