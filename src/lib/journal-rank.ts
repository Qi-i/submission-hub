export interface JournalRankItem {
  key: string
  label: string
  value: string
  group: 'official' | 'custom'
  selected?: boolean
}

export interface JournalRankLookupResult {
  items: JournalRankItem[]
  values: Record<string, string>
  fetchedAt: string
  cached: boolean
}

const OFFICIAL_LABELS: Record<string, string> = {
  sci: 'JCR 分区',
  ssci: 'SSCI 分区',
  sciif: 'JCR 影响因子',
  sciif5: 'JCR 五年影响因子',
  jci: 'JCI',
  sciwarn: '中科院预警',
  sciBase: '中科院基础版',
  sciUp: '中科院升级版',
  sciUpSmall: '中科院升级版小类',
  sciUpTop: '中科院 Top',
  eii: 'EI',
  cscd: 'CSCD',
  pku: '北大核心',
  zhongguokejihexin: '科技核心',
  cssci: 'CSSCI',
  ahci: 'A&HCI',
  esi: 'ESI 学科',
  ajg: 'ABS / AJG',
  utd24: 'UTD24',
  ft50: 'FT50',
  fms: 'FMS',
  xju: '新疆大学',
  cug: '中国地质大学',
  cju: '长江大学',
  xr: '新锐学术',
  xrWarn: '新锐预警',
  xrTop: '新锐 Top',
  xrSmall: '新锐小类',
}

const PRIORITY_KEYS = [
  'sci', 'ssci', 'sciUp', 'sciBase', 'sciUpTop', 'sciUpSmall', 'sciif', 'sciif5',
  'sciwarn', 'eii', 'cscd', 'pku', 'zhongguokejihexin', 'cssci', 'ahci', 'esi',
]

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {}
}

function text(value: unknown) {
  if (value === null || value === undefined) return ''
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') return String(value).trim()
  return ''
}

function customRankValue(info: Record<string, unknown>, rank: number) {
  const names = ['oneRankText', 'twoRankText', 'threeRankText', 'fourRankText', 'fiveRankText']
  return text(info[names[rank - 1]]) || String(rank)
}

export function parseJournalRankResponse(response: unknown): JournalRankLookupResult {
  const envelope = asRecord(response)
  const payload = asRecord(envelope.data)
  const officialRank = asRecord(payload.officialRank)
  const all = asRecord(officialRank.all)
  const selected = asRecord(officialRank.select)
  const officialValues = { ...all, ...selected }
  const selectedKeys = new Set(Object.keys(selected))
  const values: Record<string, string> = {}
  const items: JournalRankItem[] = []

  Object.entries(officialValues).forEach(([key, raw]) => {
    const value = text(raw)
    if (!value) return
    values[key] = value
    items.push({ key, label: OFFICIAL_LABELS[key] || key, value, group: 'official', selected: selectedKeys.has(key) })
  })

  const customRank = asRecord(payload.customRank)
  const rankInfo = Array.isArray(customRank.rankInfo) ? customRank.rankInfo.map(asRecord) : []
  const infoMap = new Map(rankInfo.map(info => [text(info.uuid), info]))
  const rankRows = Array.isArray(customRank.rank) ? customRank.rank : []

  rankRows.forEach(raw => {
    const [uuid, rankText] = text(raw).split('&&&')
    const rank = Number(rankText)
    const info = infoMap.get(uuid)
    if (!info || !Number.isInteger(rank) || rank < 1 || rank > 5) return
    const label = text(info.abbName) || '自定义等级'
    const value = customRankValue(info, rank)
    const key = `custom:${uuid}`
    values[key] = value
    items.push({ key, label, value, group: 'custom' })
  })

  items.sort((left, right) => {
    const leftPriority = PRIORITY_KEYS.indexOf(left.key)
    const rightPriority = PRIORITY_KEYS.indexOf(right.key)
    if (left.selected !== right.selected) return Number(right.selected) - Number(left.selected)
    if (leftPriority !== rightPriority) {
      if (leftPriority < 0) return 1
      if (rightPriority < 0) return -1
      return leftPriority - rightPriority
    }
    return left.label.localeCompare(right.label, 'zh-CN')
  })

  return {
    items,
    values,
    fetchedAt: text(envelope.fetchedAt) || new Date().toISOString(),
    cached: envelope.cached === true,
  }
}

function hasMeaningfulValue(value: string | undefined) {
  if (!value) return false
  const normalized = value.toLocaleLowerCase()
  return !['否', 'no', 'false', '0', 'none', '无', '未收录'].includes(normalized)
}

export function rankFieldSuggestions(values: Record<string, string>) {
  const indexing: string[] = []
  if (hasMeaningfulValue(values.sci)) indexing.push('SCIE')
  if (hasMeaningfulValue(values.ssci)) indexing.push('SSCI')
  if (hasMeaningfulValue(values.eii)) indexing.push('EI')
  if (hasMeaningfulValue(values.cscd)) indexing.push('CSCD')
  if (hasMeaningfulValue(values.pku)) indexing.push('北大核心')
  if (hasMeaningfulValue(values.zhongguokejihexin)) indexing.push('科技核心')

  const impactMatch = values.sciif?.match(/\d+(?:\.\d+)?/)
  return {
    jcr: values.sci || values.ssci || '',
    cas: values.sciUp || values.sciBase || '',
    impactFactor: impactMatch ? impactMatch[0] : '',
    indexing,
    risk: hasMeaningfulValue(values.sciwarn) || hasMeaningfulValue(values.xrWarn) ? 'warning' as const : undefined,
  }
}
