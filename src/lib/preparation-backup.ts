import type { JournalProfile, ManuscriptDraft, PreparationSnapshot, ResearchTopic } from './preparation'
import { createDefaultChecklist } from './preparation'

export interface PreparationMergeResult {
  snapshot: PreparationSnapshot
  added: PreparationSnapshot
}

const newId = () => globalThis.crypto?.randomUUID?.() || `prep-${Date.now()}-${Math.random().toString(36).slice(2)}`
const asId = (value: unknown) => typeof value === 'string' && value.trim() ? value.trim() : null

function assignIds<T extends { id: string }>(source: T[], existingIds: Set<string>) {
  const idMap = new Map<string, string>()
  const accepted: { source: T; targetId: string }[] = []

  for (const item of source) {
    if (!item || typeof item !== 'object') continue
    const sourceId = asId(item.id)
    if (sourceId && existingIds.has(sourceId)) continue
    let targetId = sourceId || newId()
    while (existingIds.has(targetId)) targetId = newId()
    existingIds.add(targetId)
    if (sourceId) idMap.set(sourceId, targetId)
    accepted.push({ source: item, targetId })
  }

  return { idMap, accepted }
}

export function mergePreparationSnapshots(
  existing: PreparationSnapshot,
  incoming: PreparationSnapshot,
  userId: string,
  validPaperIds: Set<string> = new Set(),
): PreparationMergeResult {
  const journalIds = new Set(existing.journals.map(item => item.id))
  const topicIds = new Set(existing.topics.map(item => item.id))
  const draftIds = new Set(existing.drafts.map(item => item.id))

  const journalAssignment = assignIds((incoming.journals || []) as JournalProfile[], journalIds)
  const topicAssignment = assignIds((incoming.topics || []) as ResearchTopic[], topicIds)
  const draftAssignment = assignIds((incoming.drafts || []) as ManuscriptDraft[], draftIds)
  const now = new Date().toISOString()

  const addedJournals = journalAssignment.accepted.map(({ source, targetId }): JournalProfile => ({
    ...source,
    id: targetId,
    user_id: userId,
    name: source.name || '未命名期刊',
    third_party_links: Array.isArray(source.third_party_links) ? source.third_party_links : [],
    subject_tags: Array.isArray(source.subject_tags) ? source.subject_tags : [],
    indexing: Array.isArray(source.indexing) ? source.indexing : [],
    created_at: source.created_at || now,
    updated_at: now,
  }))

  const addedTopics = topicAssignment.accepted.map(({ source, targetId }): ResearchTopic => ({
    ...source,
    id: targetId,
    user_id: userId,
    title: source.title || '未命名选题',
    keywords: Array.isArray(source.keywords) ? source.keywords : [],
    methods: Array.isArray(source.methods) ? source.methods : [],
    data_sources: Array.isArray(source.data_sources) ? source.data_sources : [],
    links: Array.isArray(source.links) ? source.links : [],
    created_at: source.created_at || now,
    updated_at: now,
  }))

  const addedDrafts = draftAssignment.accepted.map(({ source, targetId }): ManuscriptDraft => {
    const sourceTopicId = asId(source.topic_id)
    const sourcePrimaryJournalId = asId(source.primary_journal_id)
    const mappedTargets = Array.from(new Set((Array.isArray(source.target_journal_ids) ? source.target_journal_ids : [])
      .map(id => journalAssignment.idMap.get(id) || (journalIds.has(id) ? id : null))
      .filter((id): id is string => !!id)))
    const mappedPrimary = sourcePrimaryJournalId
      ? journalAssignment.idMap.get(sourcePrimaryJournalId) || (journalIds.has(sourcePrimaryJournalId) ? sourcePrimaryJournalId : null)
      : null
    const submittedPaperId = asId(source.submitted_paper_id)

    return {
      ...source,
      id: targetId,
      user_id: userId,
      title: source.title || '未命名草稿',
      topic_id: sourceTopicId ? topicAssignment.idMap.get(sourceTopicId) || (topicIds.has(sourceTopicId) ? sourceTopicId : null) : null,
      keywords: Array.isArray(source.keywords) ? source.keywords : [],
      authors: Array.isArray(source.authors) ? source.authors : [],
      external_links: Array.isArray(source.external_links) ? source.external_links : [],
      target_journal_ids: mappedTargets,
      primary_journal_id: mappedPrimary,
      checklist: Array.isArray(source.checklist) && source.checklist.length ? source.checklist : createDefaultChecklist(),
      submitted_paper_id: submittedPaperId && validPaperIds.has(submittedPaperId) ? submittedPaperId : null,
      created_at: source.created_at || now,
      updated_at: now,
    }
  })

  const added: PreparationSnapshot = { journals: addedJournals, topics: addedTopics, drafts: addedDrafts }
  return {
    added,
    snapshot: {
      journals: [...addedJournals, ...existing.journals],
      topics: [...addedTopics, ...existing.topics],
      drafts: [...addedDrafts, ...existing.drafts],
    },
  }
}
