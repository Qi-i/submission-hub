import { readFile, writeFile, unlink } from 'node:fs/promises'

async function replaceOnce(path, from, to) {
  const source = await readFile(path, 'utf8')
  if (source.includes(to)) return
  if (!source.includes(from)) throw new Error(`Expected source text not found in ${path}`)
  await writeFile(path, source.replace(from, to), 'utf8')
}

await replaceOnce(
  'src/components/OnlinePreparationWorkspace.tsx',
  "import PreparationWorkspace from './PreparationWorkspace'",
  "import PreparationWorkspaceSuite from './PreparationWorkspaceSuite'",
)
await replaceOnce(
  'src/components/OnlinePreparationWorkspace.tsx',
  'return <PreparationWorkspace snapshot={snapshot} loading={loading} onSaveJournal={saveJournal} onDeleteJournal={deleteJournal} onSaveTopic={saveTopic} onDeleteTopic={deleteTopic} onSaveDraft={saveDraft} onDeleteDraft={deleteDraft} onPromoteDraft={promoteDraft} onLookupJournalRanks={lookupJournalRanks} />',
  'return <PreparationWorkspaceSuite snapshot={snapshot} loading={loading} onSaveJournal={saveJournal} onDeleteJournal={deleteJournal} onSaveTopic={saveTopic} onDeleteTopic={deleteTopic} onSaveDraft={saveDraft} onDeleteDraft={deleteDraft} onPromoteDraft={promoteDraft} onLookupJournalRanks={lookupJournalRanks} />',
)
await replaceOnce(
  'src/components/OfflinePreparationWorkspace.tsx',
  "import PreparationWorkspace from './PreparationWorkspace'",
  "import PreparationWorkspaceSuite from './PreparationWorkspaceSuite'",
)
await replaceOnce(
  'src/components/OfflinePreparationWorkspace.tsx',
  'return <PreparationWorkspace snapshot={snapshot} onSaveJournal={saveJournal} onDeleteJournal={deleteJournal} onSaveTopic={saveTopic} onDeleteTopic={deleteTopic} onSaveDraft={saveDraft} onDeleteDraft={deleteDraft} onPromoteDraft={promoteDraft} />',
  'return <PreparationWorkspaceSuite snapshot={snapshot} onSaveJournal={saveJournal} onDeleteJournal={deleteJournal} onSaveTopic={saveTopic} onDeleteTopic={deleteTopic} onSaveDraft={saveDraft} onDeleteDraft={deleteDraft} onPromoteDraft={promoteDraft} />',
)

const stylesPath = 'src/app-styles.ts'
const styles = await readFile(stylesPath, 'utf8')
if (!styles.includes("import './preparation-productivity.css'")) {
  await writeFile(stylesPath, `${styles.trimEnd()}\nimport './preparation-productivity.css'\n`, 'utf8')
}

await unlink('scripts/apply-preparation-productivity.mjs')
await unlink('.github/workflows/apply-preparation-productivity.yml')
