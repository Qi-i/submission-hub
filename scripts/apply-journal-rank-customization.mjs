import { readFileSync, writeFileSync, unlinkSync } from 'node:fs'

const read = path => readFileSync(path, 'utf8')
const write = (path, content) => writeFileSync(path, content)
const replace = (source, before, after, label) => {
  if (!source.includes(before)) throw new Error(`Missing patch target: ${label}`)
  return source.replace(before, after)
}

// 1) Rank display policy and per-journal preference stored inside rank_data.
{
  const path = 'src/lib/journal-rank.ts'
  let source = read(path)
  source = replace(source,
`const PRIORITY_KEYS = [
  'sci', 'ssci', 'sciUp', 'sciBase', 'sciUpTop', 'sciUpSmall', 'sciif', 'sciif5',
  'sciwarn', 'eii', 'cscd', 'pku', 'zhongguokejihexin', 'cssci', 'ahci', 'esi',
]
`,
`const PRIORITY_KEYS = [
  'sci', 'ssci', 'sciUp', 'sciBase', 'sciUpTop', 'sciUpSmall', 'sciif', 'sciif5',
  'sciwarn', 'eii', 'cscd', 'pku', 'zhongguokejihexin', 'cssci', 'ahci', 'esi',
]

export const RANK_DISPLAY_KEYS_METRIC = 'metric_display_rank_keys'
export const DEFAULT_HIDDEN_RANK_KEYS = new Set(['sciBase', 'sciUpSmall'])

export function defaultRankDisplayKeys(items: JournalRankItem[]) {
  return items.filter(item => !DEFAULT_HIDDEN_RANK_KEYS.has(item.key)).map(item => item.key)
}

export function readRankDisplayKeys(values: Record<string, string> | null | undefined): string[] | null {
  if (!values || !(RANK_DISPLAY_KEYS_METRIC in values)) return null
  const raw = String(values[RANK_DISPLAY_KEYS_METRIC] || '').trim()
  if (!raw) return []
  return Array.from(new Set(raw.split(',').map(item => item.trim()).filter(Boolean)))
}

export function writeRankDisplayKeys(values: Record<string, string>, keys: string[] | null) {
  const next = { ...values }
  if (keys === null) delete next[RANK_DISPLAY_KEYS_METRIC]
  else next[RANK_DISPLAY_KEYS_METRIC] = Array.from(new Set(keys)).join(',')
  return next
}

export function isRankItemVisible(values: Record<string, string> | null | undefined, key: string) {
  const configured = readRankDisplayKeys(values)
  return configured === null ? !DEFAULT_HIDDEN_RANK_KEYS.has(key) : configured.includes(key)
}
`, 'journal rank display helpers')
  write(path, source)
}

// 2) Apply preference to all card/summary renderers.
{
  const path = 'src/lib/journal-display.ts'
  let source = read(path)
  source = replace(source,
"import { rankItemsFromValues, type JournalRankItem } from './journal-rank'",
"import { isRankItemVisible, rankItemsFromValues, type JournalRankItem } from './journal-rank'",
'journal display import')
  source = replace(source,
`  allItems.forEach(item => uniquePush(result, item))
  return result.slice(0, limit)
`,
`  allItems.forEach(item => uniquePush(result, item))
  return result
    .filter(item => item.key.startsWith('profile:') || item.key.startsWith('index:') || isRankItemVisible(values, item.key))
    .slice(0, limit)
`, 'journal display filtering')
  write(path, source)
}

// 3) Form label, rank-display controls, and persistence in rank_data.
{
  const path = 'src/components/JournalFormEnhanced.tsx'
  let source = read(path)
  source = replace(source,
"import { rankFieldSuggestions, rankItemsFromValues, type JournalRankLookupResult } from '../lib/journal-rank'",
"import { defaultRankDisplayKeys, rankFieldSuggestions, rankItemsFromValues, readRankDisplayKeys, writeRankDisplayKeys, type JournalRankLookupResult } from '../lib/journal-rank'",
'form rank imports')
  source = replace(source,
`  const [rankData, setRankData] = useState<Record<string, string>>(source?.rank_data || {})
  const [rankUpdatedAt, setRankUpdatedAt] = useState(source?.rank_updated_at || '')
`,
`  const [rankData, setRankData] = useState<Record<string, string>>(source?.rank_data || {})
  const [rankDisplayKeys, setRankDisplayKeys] = useState<string[] | null>(() => readRankDisplayKeys(source?.rank_data || {}))
  const [rankUpdatedAt, setRankUpdatedAt] = useState(source?.rank_updated_at || '')
`, 'rank display state')
  source = replace(source,
`  const hint = useMemo(() => journalLookupHint(lookupInput), [lookupInput])
  const rankItems = useMemo(() => rankItemsFromValues(rankData), [rankData])
  const busy = saving || lookingUp || rankLookingUp || metricLookingUp
`,
`  const hint = useMemo(() => journalLookupHint(lookupInput), [lookupInput])
  const rankItems = useMemo(() => rankItemsFromValues(rankData), [rankData])
  const effectiveRankDisplayKeys = useMemo(() => rankDisplayKeys ?? defaultRankDisplayKeys(rankItems), [rankDisplayKeys, rankItems])
  const busy = saving || lookingUp || rankLookingUp || metricLookingUp

  const toggleRankDisplay = (key: string, checked: boolean) => {
    setRankDisplayKeys(previous => {
      const current = previous ?? defaultRankDisplayKeys(rankItems)
      return checked ? Array.from(new Set([...current, key])) : current.filter(item => item !== key)
    })
  }
`, 'effective display keys')
  source = replace(source,
`      const publicMetricsRankData = writeJournalPublicMetrics(rankData, {
`,
`      const rankDataWithDisplay = writeRankDisplayKeys(rankData, rankDisplayKeys)
      const publicMetricsRankData = writeJournalPublicMetrics(rankDataWithDisplay, {
`, 'save display preference')
  source = source.replaceAll('官方缩写', '缩写')
  source = source.replace('英文名与缩写可由 DOI 识别；中文信息需人工核对', '英文名与缩写可由 DOI 识别；中文信息需人工核对')
  source = replace(source,
`          {rankItems.length > 0 ? <div className="journal-rank-chips">{rankItems.slice(0, 18).map(item => <span key={item.key} data-group={item.group}><b>{item.label}</b>{item.value}</span>)}</div> : <div className="journal-rank-empty">暂无等级快照，可点击查询或在下方填写 JCR 分区、中科院分区和影响因子。</div>}
          {rankMessage && <small className={\`journal-rank-time \${rankMessageError ? 'danger' : ''}\`} role="status" aria-live="polite">{rankMessage}</small>}
`,
`          {rankItems.length > 0 ? <>
            <div className="journal-rank-chips">{rankItems.slice(0, 18).map(item => <span key={item.key} data-group={item.group}><b>{item.label}</b>{item.value}</span>)}</div>
            <div className="journal-rank-display-control">
              <div className="journal-rank-display-head"><span><b>卡片外显</b><small>默认隐藏“中科院基础版”和“中科院升级版小类”</small></span><button type="button" className="btn btn-ghost btn-sm" onClick={() => setRankDisplayKeys(null)}>恢复默认</button></div>
              <div className="journal-rank-display-options">{rankItems.map(item => <label key={item.key} className={effectiveRankDisplayKeys.includes(item.key) ? 'selected' : ''}><input type="checkbox" checked={effectiveRankDisplayKeys.includes(item.key)} onChange={event => toggleRankDisplay(item.key, event.target.checked)} /><span><b>{item.label}</b>{item.value}</span></label>)}</div>
            </div>
          </> : <div className="journal-rank-empty">暂无等级快照，可点击查询或在下方填写 JCR 分区、中科院分区和影响因子。</div>}
          {rankMessage && <small className={\`journal-rank-time \${rankMessageError ? 'danger' : ''}\`} role="status" aria-live="polite">{rankMessage}</small>}
`, 'rank display controls')
  write(path, source)
}

// 4) Make Chinese name and abbreviation a visible identity line on cards.
{
  const path = 'src/components/PreparationWorkspace.tsx'
  let source = read(path)
  source = replace(source,
`        <span><b>{journal.name}</b><small>{[journal.name_zh, journal.official_abbreviation, journal.publisher || journal.scope_zh || journal.scope].filter(Boolean).join(' · ') || '未填写中文名、缩写或出版社'}</small></span>
`,
`        <span className="prep-overview-journal-copy"><b>{journal.name}</b>{(journal.name_zh || (journal.official_abbreviation && journal.official_abbreviation.toLocaleLowerCase() !== journal.name.toLocaleLowerCase())) && <span className="prep-journal-local-identity">{journal.name_zh && <strong>{journal.name_zh}</strong>}{journal.official_abbreviation && journal.official_abbreviation.toLocaleLowerCase() !== journal.name.toLocaleLowerCase() && <em>{journal.official_abbreviation}</em>}</span>}<small>{journal.publisher || journal.scope_zh || journal.scope || '未填写出版社或期刊范围'}</small></span>
`, 'overview journal identity')
  source = replace(source,
`  const oa = OA_OPTIONS.find(item => item.key === journal.oa_type)?.label || '未确认'
  const identityLine = [journal.name_zh, journal.official_abbreviation, journal.publisher].filter(Boolean).join(' · ') || journal.scope_zh || journal.scope || '尚未填写中文名、缩写或出版社'
`,
`  const oa = OA_OPTIONS.find(item => item.key === journal.oa_type)?.label || '未确认'
  const showAbbreviation = !!journal.official_abbreviation && journal.official_abbreviation.toLocaleLowerCase() !== journal.name.toLocaleLowerCase()
  const publisherLine = journal.publisher || journal.scope_zh || journal.scope || '尚未填写出版社或期刊范围'
`, 'journal identity variables')
  source = replace(source,
`      <h3>{journal.name}</h3>
      <p title={identityLine}>{identityLine}</p>
`,
`      <h3>{journal.name}</h3>
      {(journal.name_zh || showAbbreviation) && <div className="prep-journal-local-identity">{journal.name_zh && <strong>{journal.name_zh}</strong>}{showAbbreviation && <em>{journal.official_abbreviation}</em>}</div>}
      <p className="prep-journal-publisher" title={publisherLine}>{publisherLine}</p>
`, 'journal card identity markup')
  write(path, source)
}

// 5) Rename the comparison field.
{
  const path = 'src/components/JournalComparison.tsx'
  let source = read(path)
  source = source.replaceAll("label: '官方缩写'", "label: '缩写'")
  source = source.replaceAll('中文名、缩写或出版社', '中文名、缩写或出版社')
  write(path, source)
}

// 6) Shared styling across both themes.
{
  const path = 'src/journal-selection-metadata.css'
  let source = read(path)
  source += `

/* Stronger bilingual identity and per-journal EasyScholar display controls. */
.prep-journal-local-identity {
  min-width: 0;
  display: flex;
  align-items: center;
  gap: 6px;
  margin-top: 3px;
  line-height: 1.25;
}

.prep-journal-local-identity strong {
  min-width: 0;
  overflow: hidden;
  color: var(--text-primary);
  font-size: 12px;
  font-weight: 850;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.prep-journal-local-identity em {
  flex: 0 0 auto;
  max-width: 48%;
  overflow: hidden;
  padding: 2px 7px;
  border: 1px solid color-mix(in srgb, var(--accent) 20%, var(--border-subtle));
  border-radius: 999px;
  color: var(--accent);
  background: color-mix(in srgb, var(--accent-bg) 74%, transparent);
  font-size: 10px;
  font-style: normal;
  font-weight: 820;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.prep-overview-journal-copy {
  min-width: 0;
  display: grid !important;
}

.prep-journal-card-main > .prep-journal-local-identity {
  margin: -1px 0 3px;
}

.prep-journal-card-main > .prep-journal-publisher {
  margin-top: 0 !important;
}

.journal-rank-display-control {
  display: grid;
  gap: 8px;
  margin-top: 10px;
  padding: 9px 10px;
  border: 1px solid var(--border-subtle);
  border-radius: 12px;
  background: color-mix(in srgb, var(--bg-elevated) 74%, transparent);
}

.journal-rank-display-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
}

.journal-rank-display-head > span {
  min-width: 0;
  display: grid;
  gap: 2px;
}

.journal-rank-display-head b { font-size: 11px; }
.journal-rank-display-head small { color: var(--text-muted); font-size: 10px; }

.journal-rank-display-options {
  display: flex;
  flex-wrap: wrap;
  gap: 5px;
}

.journal-rank-display-options label {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 4px 7px;
  border: 1px solid var(--border-subtle);
  border-radius: 8px;
  color: var(--text-muted);
  background: var(--bg-card);
  cursor: pointer;
  font-size: 10px;
}

.journal-rank-display-options label.selected {
  border-color: color-mix(in srgb, var(--accent) 28%, var(--border-subtle));
  color: var(--text-primary);
  background: var(--accent-bg);
}

.journal-rank-display-options input { margin: 0; }
.journal-rank-display-options span { display: inline-flex; gap: 3px; }
.journal-rank-display-options b { font-weight: 800; }

@media (max-width: 720px) {
  .journal-rank-display-head { align-items: flex-start; }
  .prep-journal-local-identity strong { font-size: 11px; }
}
`
  write(path, source)
}

// 7) Focused regression check and package verify hook.
write('scripts/check-journal-rank-display.mjs', `import { readFileSync } from 'node:fs'\n\nconst read = path => readFileSync(path, 'utf8')\nconst checks = [\n  ['src/lib/journal-rank.ts', ['DEFAULT_HIDDEN_RANK_KEYS', "'sciBase', 'sciUpSmall'", 'readRankDisplayKeys', 'writeRankDisplayKeys']],\n  ['src/lib/journal-display.ts', ['isRankItemVisible(values, item.key)']],\n  ['src/components/JournalFormEnhanced.tsx', ['卡片外显', '恢复默认', 'effectiveRankDisplayKeys', 'Field label="缩写"']],\n  ['src/components/PreparationWorkspace.tsx', ['prep-journal-local-identity', 'prep-journal-publisher']],\n  ['src/components/JournalComparison.tsx', ["label: '缩写'"]],\n]\nconst failures = []\nfor (const [path, tokens] of checks) {\n  const source = read(path)\n  for (const token of tokens) if (!source.includes(token)) failures.push(path + ': missing ' + token)\n}\nif (failures.length) throw new Error(failures.join(' | '))\nconsole.log('Journal rank display customization verified.')\n`)

{
  const path = 'package.json'
  let source = read(path)
  source = replace(source,
`    "verify": "npm run check:privacy && npm run check:journal-selection && npm run build && npm run build:offline && npm run check:offline",
    "preview": "vite preview",
    "check:journal-selection": "node scripts/check-journal-selection-metadata.mjs"
`,
`    "verify": "npm run check:privacy && npm run check:journal-selection && npm run check:journal-rank-display && npm run build && npm run build:offline && npm run check:offline",
    "preview": "vite preview",
    "check:journal-selection": "node scripts/check-journal-selection-metadata.mjs",
    "check:journal-rank-display": "node scripts/check-journal-rank-display.mjs"
`, 'package verify hook')
  write(path, source)
}

// Remove this one-shot machinery from the resulting commit.
unlinkSync('scripts/apply-journal-rank-customization.mjs')
unlinkSync('.github/workflows/apply-journal-rank-customization.yml')
