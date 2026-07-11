import type { ComponentProps } from 'react'
import { lookupJournalRanks } from '../lib/journal-rank-client'
import { uploadFile } from '../lib/storage'
import PaperFormIntelligent from './PaperFormIntelligent'

type Props = Omit<ComponentProps<typeof PaperFormIntelligent>, 'onUploadFile' | 'onLookupJournalRanks'>

export default function PaperForm(props: Props) {
  return <PaperFormIntelligent {...props} onUploadFile={uploadFile} onLookupJournalRanks={lookupJournalRanks} />
}
