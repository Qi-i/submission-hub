/**
 * Small, field-scoped three-way reconciliation for manuscript forms.
 *
 * A form contains every column, but submitting that complete snapshot causes
 * unnecessary writes and false CAS conflicts when another tab edits an
 * unrelated column. Compare the values opened in the form with its current
 * values, send only genuinely edited columns, then rebase those columns over
 * the newest row if necessary.
 *
 * This is NOT timestamp-based last-writer-wins. An overlapping change with
 * different values still requires manual review.
 */
type Fields = Record<string, unknown>;
const serverFields = new Set(["id", "user_id", "created_at", "updated_at"]);

function comparable(value: unknown): unknown {
  if (value == null || value === "") return null;
  if (Array.isArray(value)) {
    const values = value.map(comparable);
    return values.length === 0 || values.every(item => item === null) ? null : values;
  }
  if (value && typeof value === "object") {
    const fields = Object.entries(value as Fields)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, field]) => [key, comparable(field)]);
    return Object.fromEntries(fields);
  }
  return value;
}

export function paperFieldEqual(left: unknown, right: unknown): boolean {
  return JSON.stringify(comparable(left)) === JSON.stringify(comparable(right));
}

/** Only keys the form really changed; no automatic updated_at edits. */
export function changedPaperFields(
  opened: Fields, submitted: Fields,
): Fields {
  return Object.fromEntries(Object.entries(submitted)
    .filter(([key, value]) =>
      !serverFields.has(key) && !paperFieldEqual(value, opened[key])));
}

export interface PaperRebaseResult {
  patch: Fields;
  conflicts: string[];
}

/**
 * Rebase a minimal edit onto the newest server row:
 * - unchanged remote key: apply our edit
 * - remote already equals our desired value: no write
 * - remote differs from both opened and desired: genuine overlap
 */
export function rebasePaperFields(
  opened: Fields, latest: Fields, edits: Fields,
): PaperRebaseResult {
  const patch: Fields = {};
  const conflicts: string[] = [];
  for (const [key, desired] of Object.entries(edits)) {
    if (serverFields.has(key)) continue;
    if (paperFieldEqual(desired, latest[key])) continue;
    if (!paperFieldEqual(opened[key], latest[key])) {
      conflicts.push(key);
      continue;
    }
    patch[key] = desired;
  }
  return { patch, conflicts };
}
