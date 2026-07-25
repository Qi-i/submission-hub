import { readFileSync } from 'node:fs'

const read = path => readFileSync(path, 'utf8')
const checks = [
  ['src/lib/preparation.ts', ['name_zh:', 'official_abbreviation:', 'scope_zh:', 'selection_tags:', 'selection_notes:']],
  ['src/components/JournalFormEnhanced.tsx', ['中文译名', 'Field label="缩写"', '中文简介翻译', '选刊标签', '选刊备注']],
  ['src/components/PreparationWorkspace.tsx', ['item.name_zh', 'item.official_abbreviation', 'item.scope_zh', 'item.selection_tags', 'item.selection_notes']],
  ['src/components/JournalComparison.tsx', ["label: '中文译名'", "label: '缩写'", "label: '中文简介翻译'", "label: '选刊标签'", "label: '选刊备注'"]],
  ['supabase/012_journal_selection_metadata.sql', ['ADD COLUMN IF NOT EXISTS name_zh', 'ADD COLUMN IF NOT EXISTS official_abbreviation', 'ADD COLUMN IF NOT EXISTS scope_zh', 'ADD COLUMN IF NOT EXISTS selection_tags', 'ADD COLUMN IF NOT EXISTS selection_notes']],
]

const failures = []
for (const [path, tokens] of checks) {
  const source = read(path)
  for (const token of tokens) if (!source.includes(token)) failures.push(`${path}: missing ${token}`)
}
if (failures.length) throw new Error(failures.join(' | '))
console.log('Journal selection metadata contract verified.')
