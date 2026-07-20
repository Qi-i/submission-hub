import { useEffect, useState, type ComponentProps } from 'react'
import { findJournalProfile } from '../lib/journal-paper-sync'
import type { JournalProfile } from '../lib/preparation'
import type { PaperFile } from '../lib/types'
import { supabase } from '../lib/supabase'
import FilePreviewModal from './FilePreviewModal'
import PaperCardEnhanced from './PaperCardEnhanced'

type Props = ComponentProps<typeof PaperCardEnhanced>

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

export default function OnlinePaperCard({ journalProfile: providedProfile, ...props }: Props) {
  const [loadedProfile, setLoadedProfile] = useState<JournalProfile | undefined>(providedProfile)
  const [previewFile, setPreviewFile] = useState<PaperFile | null>(null)

  useEffect(() => {
    let active = true
    if (providedProfile) {
      setLoadedProfile(providedProfile)
      return () => { active = false }
    }
    if (!props.paper.journal) {
      setLoadedProfile(undefined)
      return () => { active = false }
    }
    void loadProfiles().then(profiles => {
      if (active) setLoadedProfile(findJournalProfile(profiles, props.paper.journal))
    }).catch(error => {
      if (active) console.error('Load linked journal profile failed:', error)
    })
    return () => { active = false }
  }, [providedProfile, props.paper.journal])

  const handleOpenStoredFile = (path: string) => {
    const matched = props.paper.files?.find(file => file.p === path)
    setPreviewFile(matched || { n: '附件', p: path, t: '其它' })
  }

  return <>
    <PaperCardEnhanced {...props} journalProfile={providedProfile || loadedProfile} onOpenStoredFile={handleOpenStoredFile} />
    <FilePreviewModal file={previewFile} onClose={() => setPreviewFile(null)} />
  </>
}
