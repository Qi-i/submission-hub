import { createPortal } from 'react-dom'
import type { PaperFile } from '../lib/types'
import FilePreviewModal from './FilePreviewModal'

export default function FilePreviewPortal({ file, onClose }: { file: PaperFile | null; onClose: () => void }) {
  if (!file || typeof document === 'undefined') return null
  return createPortal(<FilePreviewModal file={file} onClose={onClose} />, document.body)
}
