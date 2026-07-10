import type { ComponentProps } from 'react'
import { uploadFile } from '../lib/storage'
import PaperFormArchive from './PaperFormArchive'

type Props = Omit<ComponentProps<typeof PaperFormArchive>, 'onUploadFile'>

export default function PaperForm(props: Props) {
  return <PaperFormArchive {...props} onUploadFile={uploadFile} />
}
