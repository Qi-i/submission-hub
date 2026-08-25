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

patch('src/components/OfflineDashboard.tsx', "import OfflinePreparationWorkspace from './OfflinePreparationWorkspace'", "import OfflinePreparationWorkspace from './OfflinePreparationWorkspace'\nimport OfflineJournalCenterWorkspace from './OfflineJournalCenterWorkspace'")
patch('src/components/OfflineDashboard.tsx', "{uiMode === 'luminous-x' && <LuminousXStatusBar", "{uiMode === 'luminous-x' && tab !== 'journals' && <LuminousXStatusBar")
patch('src/components/OfflineDashboard.tsx', "recordCount={tab === 'journals' ? prepStore.getPreparationSnapshot().journals.length : papers.length}", "recordCount={papers.length}")
patch('src/components/OfflineDashboard.tsx', "{tab === 'journals' && <OfflinePreparationWorkspace authorName={authorName} refreshToken={prepRefresh} section=\"match\" onSectionChange={() => {}} workspaceMode=\"journal-center\" onPaperCreated={refreshPapers} />}", "{tab === 'journals' && <OfflineJournalCenterWorkspace refreshToken={prepRefresh} onChanged={() => setPrepRefresh(value => value + 1)} />}")

console.log('workspace recovery preflight applied')
