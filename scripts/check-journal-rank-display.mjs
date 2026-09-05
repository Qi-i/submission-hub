import { readFileSync } from 'node:fs'

const read = path => readFileSync(path, 'utf8')
const checks = [
  ['src/lib/journal-rank.ts', ['DEFAULT_HIDDEN_RANK_KEYS', "'sciBase', 'sciUpSmall'", 'readRankDisplayKeys', 'writeRankDisplayKeys']],
  ['src/lib/journal-display.ts', ['isRankItemVisible(values, item.key)']],
  ['src/components/JournalFormEnhanced.tsx', ['卡片外显', '恢复默认', '默认隐藏“中科院基础版”和“中科院升级版小类”', 'effectiveRankDisplayKeys', 'Field label="缩写"']],
  ['src/components/JournalCatalogCard.tsx', ['prep-journal-card', 'prep-journal-local-identity', 'prep-journal-publisher', 'prep-journal-rank-blocks', 'prep-journal-facts']],
  ['src/components/PreparationWorkspace.tsx', ['JournalCatalogCard']],
  ['src/components/JournalCenterWorkspace.tsx', ['JournalCatalogCard']],
  ['src/components/OfflineJournalCenterWorkspace.tsx', ['JournalCatalogCard']],
  ['src/components/JournalComparison.tsx', ["label: '缩写'"]],
  ['tests/visual/journal-library-density-check.mjs', ['中文译名', '缩写', '中文简介翻译', '选刊标签', '选刊备注']],
  ['src/journal-identity-order.ts', ['shouldShowAbbreviation', 'isRecognizedAcronym', '短刊名可留空', 'data-chinese-only']],
  ['src/journal-identity-order.css', ["'identity identity'", 'grid-area: identity', 'white-space: normal', 'border-left: 3px solid var(--accent)']],
]
const failures = []
for (const [path, tokens] of checks) {
  const source = read(path)
  for (const token of tokens) if (!source.includes(token)) failures.push(path + ': missing ' + token)
}
if (failures.length) throw new Error(failures.join(' | '))
console.log('Journal rank display customization verified.')
