import React, { useState } from 'react'
import ReactDOM from 'react-dom/client'
import '../../src/app-styles'
import PaperFormArchive from '../../src/components/PaperFormArchive'
import type { Paper } from '../../src/lib/types'

const paper = {
  id: 'demo-editor', user_id: 'offline', title: 'A fictional study of urban sensors',
  title_zh: null, journal: 'Example Journal', lang: 'en', status: 'under_review',
  manuscript_no: 'DEMO-001', submission_system: 'ScholarOne',
  system_status: '拟录用', last_status_date: '2026-10-02',
  quartile_jcr: 'Q2', quartile_cas: null, quartile_new: null, quartile_cust: null,
  quartile_zh: [], authors: ['Alex Example'], corresponding_author: 'Alex Example',
  submitted_date: '2026-09-01', resolve_date: null, deadline: null,
  tracking_url: null, journal_url: null, notes: '', prev_id: null,
  timeline: '2026-09-01 投稿成功\n2026-10-02 拟录用',
  files: [{ n: 'original.pdf', p: 'r2-storage://submission-hub/demo-original.pdf', t: '投稿稿' }],
  created_at: '2026-09-01T00:00:00Z', updated_at: '2026-10-02T00:00:00Z',
} as Paper

type PendingUpload = {
  resolve: (result: { fileUrl: string; fileName: string }) => void
  reject: (error: Error) => void
}
const probe = {
  saved: [] as Array<Partial<Paper>>,
  closed: 0,
  pending: null as PendingUpload | null,
  previewed: 0,
}
;(window as any).__paperFormProbe = probe

function EditorFixture() {
  const [visible, setVisible] = useState(true)
  if (!visible) return <div data-editor-closed="true" />
  return <PaperFormArchive
    paper={paper}
    allPapers={[paper]}
    currentUsername="Alex Example"
    onSave={async data => { probe.saved.push(data); setVisible(false) }}
    onDelete={async () => {}}
    onClose={() => { probe.closed += 1; setVisible(false) }}
    onUploadFile={() => new Promise((resolve, reject) => {
      probe.pending = {
        resolve: result => { probe.pending = null; resolve(result) },
        reject: error => { probe.pending = null; reject(error) },
      }
    })}
    onPreviewFile={() => { probe.previewed += 1 }}
  />
}

ReactDOM.createRoot(document.getElementById('root')!).render(<EditorFixture />)
