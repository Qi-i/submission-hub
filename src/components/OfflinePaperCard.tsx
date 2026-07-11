import type { ComponentProps } from 'react'
import { findJournalProfile } from '../lib/journal-paper-sync'
import * as prepStore from '../lib/local-preparation-store'
import PaperCardEnhanced from './PaperCardEnhanced'

type Props = Omit<ComponentProps<typeof PaperCardEnhanced>, 'journalProfile'>

export default function OfflinePaperCard(props: Props) {
  const journalProfiles = prepStore.getPreparationSnapshot().journals
  const journalProfile = findJournalProfile(journalProfiles, props.paper.journal)
  return <PaperCardEnhanced {...props} journalProfile={journalProfile} />
}
