import { useEffect, useState, type ComponentProps } from 'react'
import { lookupJournalRanks } from '../lib/journal-rank-client'
import type { JournalProfile } from '../lib/preparation'
import { supabase } from '../lib/supabase'
import { uploadFile } from '../lib/storage'
import PaperFormIntelligent from './PaperFormIntelligent'

type Props = Omit<ComponentProps<typeof PaperFormIntelligent>, 'onUploadFile' | 'onLookupJournalRanks' | 'journalProfiles'>

export default function PaperForm(props: Props) {
  const [journalProfiles, setJournalProfiles] = useState<JournalProfile[]>([])

  useEffect(() => {
    let active = true
    void (supabase.from('journal_profiles') as any)
      .select('*')
      .order('updated_at', { ascending: false })
      .then(({ data, error }: { data?: JournalProfile[]; error?: unknown }) => {
        if (!active) return
        if (error) {
          console.error('Load journal profiles for paper form failed:', error)
          return
        }
        setJournalProfiles((data || []).map(profile => ({
          ...profile,
          third_party_links: Array.isArray(profile.third_party_links) ? profile.third_party_links : [],
          subject_tags: Array.isArray(profile.subject_tags) ? profile.subject_tags : [],
          indexing: Array.isArray(profile.indexing) ? profile.indexing : [],
        })))
      })
    return () => { active = false }
  }, [])

  return <PaperFormIntelligent {...props} journalProfiles={journalProfiles} onUploadFile={uploadFile} onLookupJournalRanks={lookupJournalRanks} />
}
