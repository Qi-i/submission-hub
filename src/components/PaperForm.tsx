import { useEffect, useRef, useState, type ComponentProps } from 'react'
import { lookupJournalRanks } from '../lib/journal-rank-client'
import type { JournalProfile } from '../lib/preparation'
import { supabase } from '../lib/supabase'
import type { Paper, PaperFile } from '../lib/types'
import { deleteStoredFiles, isManagedStoredFile, uploadFile } from '../lib/storage'
import PaperFormIntelligent from './PaperFormIntelligent'

type Props = Omit<ComponentProps<typeof PaperFormIntelligent>, 'onUploadFile' | 'onLookupJournalRanks' | 'journalProfiles'>

function managedPaths(files?: PaperFile[] | null) {
  return (files || []).map(file => file.p).filter((path): path is string => isManagedStoredFile(path))
}

function readCurrentFileRows(): PaperFile[] {
  const rows = Array.from(document.querySelectorAll<HTMLElement>('.compact-form-modal .archive-file-row'))
  return rows.map(row => {
    const inputs = Array.from(row.querySelectorAll<HTMLInputElement>('input'))
    const name = inputs[0]?.value.trim() || ''
    const rawPath = inputs[1]?.value.trim() || ''
    const type = row.querySelector<HTMLSelectElement>('select')?.value.trim() || '其它'
    if (rawPath === '上传中...') throw new Error('附件仍在上传，请等待完成后再保存。')
    const path = isManagedStoredFile(rawPath) || /^https?:\/\//i.test(rawPath) ? rawPath : ''
    return { n: name, p: path, t: type }
  }).filter(file => file.n || file.p)
}

async function cleanupStoredFiles(paths: string[], context: string) {
  try {
    await deleteStoredFiles(paths)
  } catch (error) {
    console.error(`${context}:`, error)
  }
}

export default function PaperForm(props: Props) {
  const [journalProfiles, setJournalProfiles] = useState<JournalProfile[]>([])
  const initialManagedPaths = useRef(new Set(managedPaths(props.paper === 'new' ? null : props.paper.files)))
  const newlyUploadedPaths = useRef(new Set<string>())
  const abandoned = useRef(false)

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

  const handleUploadFile = async (file: File) => {
    const result = await uploadFile(file)
    if (isManagedStoredFile(result.fileUrl)) {
      if (abandoned.current) await cleanupStoredFiles([result.fileUrl], 'Clean abandoned upload')
      else newlyUploadedPaths.current.add(result.fileUrl)
    }
    return result
  }

  const handleSave: Props['onSave'] = async data => {
    const files = readCurrentFileRows()
    await props.onSave({ ...data, files: files.length ? files : null })

    const currentManaged = new Set(managedPaths(files))
    const obsolete = Array.from(new Set([
      ...initialManagedPaths.current,
      ...newlyUploadedPaths.current,
    ])).filter(path => !currentManaged.has(path))
    await cleanupStoredFiles(obsolete, 'Clean removed paper attachments')
    initialManagedPaths.current = currentManaged
    newlyUploadedPaths.current.clear()
  }

  const handleClose = () => {
    abandoned.current = true
    void cleanupStoredFiles(Array.from(newlyUploadedPaths.current), 'Clean unsaved paper attachments')
    props.onClose()
  }

  const handleDelete: Props['onDelete'] = async id => {
    await props.onDelete(id)
    const { data, error } = await (supabase.from('papers') as any).select('id').eq('id', id).maybeSingle()
    if (error) {
      console.error('Verify paper deletion before attachment cleanup failed:', error)
      return
    }
    if (!data) {
      await cleanupStoredFiles(Array.from(new Set([
        ...initialManagedPaths.current,
        ...newlyUploadedPaths.current,
      ])), 'Clean deleted paper attachments')
    }
  }

  return <PaperFormIntelligent
    {...props}
    onSave={handleSave}
    onDelete={handleDelete}
    onClose={handleClose}
    journalProfiles={journalProfiles}
    onUploadFile={handleUploadFile}
    onLookupJournalRanks={lookupJournalRanks}
  />
}
