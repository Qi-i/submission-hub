import type { ComponentProps } from 'react'
import { lookupJournalRanks } from '../lib/journal-rank-client'
import { uploadFile } from '../lib/storage'
import PaperFormArchive from './PaperFormArchive'

type Props = Omit<ComponentProps<typeof PaperFormArchive>, 'onUploadFile' | 'onLookupJournalRanks'>

export default function PaperForm(props: Props) {
  return <PaperFormArchive {...props} onUploadFile={uploadFile} onLookupJournalRanks={lookupJournalRanks} />
}
