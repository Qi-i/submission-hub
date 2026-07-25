import { readFileSync } from 'node:fs'

const read = path => readFileSync(path, 'utf8')
const checks = [
  ['src/lib/journal-rank.ts', ['DEFAULT_HIDDEN_RANK_KEYS', "'sciBase', 'sciUpSmall'", 'readRankDisplayKeys', 'writeRankDisplayKeys']],
  ['src/lib/journal-display.ts', ['isRankItemVisible(values, item.key)']],
  ['src/components/JournalFormEnhanced.tsx', ['卡片外显', '恢复默认', 'effectiveRankDisplayKeys', 'Field label="缩写"']],
  ['src/components/PreparationWorkspace.tsx', ['prep-journal-local-identity', 'prep-journal-publisher']],
  ['src/components/JournalComparison.tsx', ["label: '缩写'"]],
]
const failures = []
for (const [path, tokens] of checks) {
  const source = read(path)
  for (const token of tokens) if (!source.includes(token)) failures.push(path + ': missing ' + token)
}
if (failures.length) throw new Error(failures.join(' | '))
console.log('Journal rank display customization verified.')
