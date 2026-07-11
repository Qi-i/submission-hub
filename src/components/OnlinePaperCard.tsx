import { useEffect, useState, type ComponentProps } from 'react'
import { findJournalProfile } from '../lib/journal-paper-sync'
import type { JournalProfile } from '../lib/preparation'
import { supabase } from '../lib/supabase'
import PaperCardEnhanced from './PaperCardEnhanced'

type Props = Omit<ComponentProps<typeof PaperCardEnhanced>, 'journalProfile'>

let cachedProfiles: JournalProfile[] | null = null
let pendingProfiles: Promise<JournalProfile[]> | null = null

async function loadProfiles() {
  if (cachedProfiles) return cachedProfiles
  if (pendingProfiles) return pendingProfiles
  pendingProfiles = (async () => {
    const { data, error } = await (supabase.from('journal_profiles') as any).select('*').order('updated_at', { ascending: false })
    if (error) throw error
    cachedProfiles = ((data || []) as JournalProfile[]).map(profile => ({
      ...profile,
      third_party_links: Array.isArray(profile.third_party_links) ? profile.third_party_links : [],
      subject_tags: Array.isArray(profile.subject_tags) ? profile.subject_tags : [],
      indexing: Array.isArray(profile.indexing) ? profile.indexing : [],
    }))
    return cachedProfiles
  })().finally(() => { pendingProfiles = null })
  return pendingProfiles
}

export function invalidateOnlineJournalProfileCache() {
  cachedProfiles = null
}

export default function OnlinePaperCard(props: Props) {
  const [journalProfile, setJournalProfile] = useState<JournalProfile | undefined>()

  useEffect(() => {
    let active = true
    if (!props.paper.journal) {
      setJournalProfile(undefined)
      return () => { active = false }
    }
    void loadProfiles().then(profiles => {
      if (active) setJournalProfile(findJournalProfile(profiles, props.paper.journal))
    }).catch(error => {
      if (active) console.error('Load linked journal profile failed:', error)
    })
    return () => { active = false }
  }, [props.paper.journal])

  return <PaperCardEnhanced {...props} journalProfile={journalProfile} />
}
