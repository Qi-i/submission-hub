import type { Paper } from './types'

export const BACKUP_SCHEMA = 'submission-hub-backup'
export const BACKUP_VERSION = 2

export type BackupMode = 'online' | 'offline'

export interface BackupEnvelope {
  schema: typeof BACKUP_SCHEMA
  version: number
  exported_at: string
  mode: BackupMode
  app_version: string
  papers: Paper[]
}

export function createBackup(papers: Paper[], mode: BackupMode, appVersion = '1.2.0') {
  const backup: BackupEnvelope = {
    schema: BACKUP_SCHEMA,
    version: BACKUP_VERSION,
    exported_at: new Date().toISOString(),
    mode,
    app_version: appVersion,
    papers,
  }
  return JSON.stringify(backup, null, 2)
}

export function parseBackup(json: string): unknown[] {
  const parsed = JSON.parse(json)

  // Backward compatibility with v1 exports, whose root value was the paper array.
  if (Array.isArray(parsed)) return parsed

  if (!parsed || typeof parsed !== 'object') {
    throw new Error('备份文件格式不正确。')
  }

  const record = parsed as Record<string, unknown>
  if (record.schema !== BACKUP_SCHEMA) {
    throw new Error('无法识别的备份文件。')
  }
  if (!Number.isInteger(record.version) || Number(record.version) < 1 || Number(record.version) > BACKUP_VERSION) {
    throw new Error(`不支持的备份版本：${String(record.version ?? '未知')}`)
  }
  if (!Array.isArray(record.papers)) {
    throw new Error('备份中缺少 papers 数据。')
  }

  return record.papers
}
