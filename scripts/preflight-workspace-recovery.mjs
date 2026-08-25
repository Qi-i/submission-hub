import fs from 'node:fs'

function patch(file, from, to) {
  let source = fs.readFileSync(file, 'utf8')
  if (!source.includes(from)) throw new Error(`Missing preflight anchor in ${file}`)
  source = source.replace(from, to)
  fs.writeFileSync(file, source)
}

patch('src/components/Dashboard.tsx', "recordCount={tab === 'journals' ? journalProfiles.length : papers.length}", 'recordCount={papers.length}')
patch('src/components/OfflinePreparationWorkspace.tsx', "  onSectionChange?: (section: PreparationSection) => void\n  workspaceMode?: 'preparation' | 'journal-center'", "  onSectionChange?: (section: PreparationSection) => void")
patch('src/components/OfflinePreparationWorkspace.tsx', "export default function OfflinePreparationWorkspace({ authorName, refreshToken, onPaperCreated, section, onSectionChange, workspaceMode = 'preparation' }: Props)", "export default function OfflinePreparationWorkspace({ authorName, refreshToken, onPaperCreated, section, onSectionChange }: Props)")
patch('src/components/OfflinePreparationWorkspace.tsx', ' onSectionChange={onSectionChange} workspaceMode={workspaceMode} snapshot={snapshot}', ' onSectionChange={onSectionChange} snapshot={snapshot}')

console.log('workspace recovery preflight applied')
