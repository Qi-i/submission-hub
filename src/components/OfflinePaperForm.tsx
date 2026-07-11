import type { ComponentProps } from 'react'
import * as prepStore from '../lib/local-preparation-store'
import PaperFormIntelligent from './PaperFormIntelligent'

type Props = Omit<ComponentProps<typeof PaperFormIntelligent>, 'journalProfiles'>

export default function OfflinePaperForm(props: Props) {
  const journalProfiles = prepStore.getPreparationSnapshot().journals
  return <PaperFormIntelligent {...props} journalProfiles={journalProfiles} />
}
