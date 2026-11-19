/** Compare only business fields the author changed, never server-owned metadata. */
type Fields = Record<string, unknown>
const serverFields = new Set(['id', 'user_id', 'created_at', 'updated_at', 'row_version'])

function comparable(value: unknown): unknown {
  if (value === '' || value == null) return null
  if (Array.isArray(value)) {
    const values = value.map(comparable)
    return values.length === 0 || values.every(item => item === null) ? null : values
  }
  if (typeof value === 'object') {
    return Object.fromEntries(Object.entries(value as Fields)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, field]) => [key, comparable(field)]))
  }
  return value
}

export function paperFieldEqual(left: unknown, right: unknown): boolean {
  return JSON.stringify(comparable(left)) === JSON.stringify(comparable(right))
}

export function changedPaperFields(opened: Fields, submitted: Fields): Fields {
  return Object.fromEntries(Object.entries(submitted)
    .filter(([key, value]) => !serverFields.has(key) && !paperFieldEqual(value, opened[key])))
}

export function rebasePaperFields(opened: Fields, latest: Fields, changes: Fields) {
  const patch: Fields = {}
  const conflicts: string[] = []
  for (const [field, desired] of Object.entries(changes)) {
    if (serverFields.has(field) || paperFieldEqual(latest[field], desired)) continue
    if (!paperFieldEqual(opened[field], latest[field])) conflicts.push(field)
    else patch[field] = desired
  }
  return { patch, conflicts }
}

/** Every manuscript write from this client advances its timestamp at least 1ms. */
export function nextPaperUpdatedAt(observed?: string | null, now = Date.now()) {
  const previous = Date.parse(observed || '')
  return new Date(Math.max(now, Number.isFinite(previous) ? previous + 1 : now)).toISOString()
}
