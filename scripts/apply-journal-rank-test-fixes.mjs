import { readFileSync, writeFileSync, unlinkSync } from 'node:fs'

function patch(path, before, after) {
  const source = readFileSync(path, 'utf8')
  if (!source.includes(before)) throw new Error(`Missing patch target in ${path}`)
  writeFileSync(path, source.replace(before, after))
}

patch(
  'tests/visual/journal-library-density-check.mjs',
  "for (const label of ['中文译名', '官方缩写', '中文简介翻译', '选刊标签', '选刊备注'])",
  "for (const label of ['中文译名', '缩写', '中文简介翻译', '选刊标签', '选刊备注'])",
)

patch(
  'src/journal-library-runtime-fixes.ts',
  "const journalName = inputByLabel(modal, '期刊名称')",
  "const journalName = inputByLabel(modal, /期刊名/)",
)

unlinkSync('scripts/apply-journal-rank-test-fixes.mjs')
unlinkSync('.github/workflows/apply-journal-rank-test-fixes.yml')
