import { readFileSync } from 'node:fs'

const read = path => readFileSync(path, 'utf8')
const checks = [
  ['src/lib/journal-rank.ts', ['DEFAULT_HIDDEN_RANK_KEYS', "'sciBase', 'sciUpSmall'", 'readRankDisplayKeys', 'writeRankDisplayKeys']],
  ['src/lib/journal-display.ts', ['isRankItemVisible(values, item.key)']],
  ['src/components/JournalFormEnhanced.tsx', ['卡片外显', '恢复默认', '默认隐藏“中科院基础版”和“中科院升级版小类”', 'effectiveRankDisplayKeys', 'Field label="缩写"']],
  ['src/components/PreparationWorkspace.tsx', ['prep-journal-local-identity', 'prep-journal-publisher']],
  ['src/components/JournalComparison.tsx', ["label: '缩写'"]],
  ['tests/visual/journal-library-density-check.mjs', ["['中文译名', '缩写', '中文简介翻译', '选刊标签', '选刊备注']"]],
]
const failures = []
for (const [path, tokens] of checks) {
  const source = read(path)
  for (const token of tokens) if (!source.includes(token)) failures.push(path + ': missing ' + token)
}
if (failures.length) throw new Error(failures.join(' | '))
console.log('Journal rank display customization verified.')
