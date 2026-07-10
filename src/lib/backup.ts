import type { Paper } from './types'
import type { PreparationSnapshot } from './preparation'

export const BACKUP_SCHEMA = 'submission-hub-backup'
export const BACKUP_VERSION = 3

export type BackupMode = 'online' | 'offline'

export interface BackupEnvelope {
  schema: typeof BACKUP_SCHEMA
  version: number
  exported_at: string
  mode: BackupMode
  app_version: string
  papers: Paper[]
  preparation?: PreparationSnapshot
}

export interface ParsedBackupBundle {
  papers: unknown[]
  preparation: PreparationSnapshot | null
  version: number
}

function emptyPreparation(): PreparationSnapshot {
  return { journals: [], topics: [], drafts: [] }
}

export function createBackup(papers: Paper[], mode: BackupMode, preparation?: PreparationSnapshot, appVersion = '1.3.0') {
  const backup: BackupEnvelope = {
    schema: BACKUP_SCHEMA,
    version: BACKUP_VERSION,
    exported_at: new Date().toISOString(),
    mode,
    app_version: appVersion,
    papers,
    preparation: preparation || emptyPreparation(),
  }
  return JSON.stringify(backup, null, 2)
}

export function parseBackupBundle(json: string): ParsedBackupBundle {
  const parsed: unknown = JSON.parse(json)

  // Backward compatibility with v1 exports, whose root value was the paper array.
  if (Array.isArray(parsed)) {
    return { papers: parsed, preparation: null, version: 1 }
  }

  if (!parsed || typeof parsed !== 'object') {
    throw new Error('备份文件格式不正确。')
  }

  const record = parsed as Record<string, unknown>
  if (record.schema !== BACKUP_SCHEMA) {
    throw new Error('无法识别的备份文件。')
  }

  const version = Number(record.version)
  if (!Number.isInteger(version) || version < 1 || version > BACKUP_VERSION) {
    throw new Error(`不支持的备份版本：${String(record.version ?? '未知')}`)
  }
  if (!Array.isArray(record.papers)) {
    throw new Error('备份中缺少 papers 数据。')
  }

  let preparation: PreparationSnapshot | null = null
  if (record.preparation && typeof record.preparation === 'object') {
    const source = record.preparation as Record<string, unknown>
    preparation = {
      journals: Array.isArray(source.journals) ? source.journals as PreparationSnapshot['journals'] : [],
      topics: Array.isArray(source.topics) ? source.topics as PreparationSnapshot['topics'] : [],
      drafts: Array.isArray(source.drafts) ? source.drafts as PreparationSnapshot['drafts'] : [],
    }
  }

  return { papers: record.papers, preparation, version }
}

export function parseBackup(json: string): unknown[] {
  return parseBackupBundle(json).papers
}
