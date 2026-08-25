import { DEFAULT_BORDER_SETTINGS, DEFAULT_LABEL_SETTINGS, type FigureProject, type RuntimeFigureAsset, type StoredFigureAsset } from './types'

const DB_NAME = 'submission-hub-figure-composer'
const DB_VERSION = 1
const PROJECT_STORE = 'projects'
const ASSET_STORE = 'assets'

type LegacyFigureProject = Omit<FigureProject, 'publicationLabel' | 'labelDefaults' | 'borderDefaults' | 'canvas'> & {
  publicationLabel?: string | null
  labelDefaults?: FigureProject['labelDefaults']
  borderDefaults?: FigureProject['borderDefaults']
  canvas: Omit<FigureProject['canvas'], 'panelWidth' | 'layoutScale'> & {
    panelWidth?: number
    layoutScale?: number
  }
}

function normalizeFigureProject(project: LegacyFigureProject): FigureProject {
  const legacyPublicationLabel = /^(?:Figure \d+|Supplementary Figure S\d+)$/i.test(project.name)
    ? project.name
    : null
  return {
    ...project,
    publicationLabel: project.publicationLabel ?? legacyPublicationLabel,
    canvas: {
      ...project.canvas,
      panelWidth: Math.max(100, Number(project.canvas.panelWidth) || 560),
      layoutScale: Math.max(25, Math.min(400, Number(project.canvas.layoutScale) || 100)),
    },
    labelDefaults: { ...DEFAULT_LABEL_SETTINGS, ...(project.labelDefaults || {}) },
    borderDefaults: { ...DEFAULT_BORDER_SETTINGS, ...(project.borderDefaults || {}) },
  }
}

function requestValue<T>(request: IDBRequest<T>) {
  return new Promise<T>((resolve, reject) => {
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error || new Error('IndexedDB request failed'))
  })
}

function transactionDone(transaction: IDBTransaction) {
  return new Promise<void>((resolve, reject) => {
    transaction.oncomplete = () => resolve()
    transaction.onerror = () => reject(transaction.error || new Error('IndexedDB transaction failed'))
    transaction.onabort = () => reject(transaction.error || new Error('IndexedDB transaction aborted'))
  })
}

export function openFigureProjectDatabase() {
  return new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION)
    request.onupgradeneeded = () => {
      const db = request.result
      if (!db.objectStoreNames.contains(PROJECT_STORE)) {
        const projects = db.createObjectStore(PROJECT_STORE, { keyPath: 'id' })
        projects.createIndex('draftId', 'draftId', { unique: false })
        projects.createIndex('updatedAt', 'updatedAt', { unique: false })
      }
      if (!db.objectStoreNames.contains(ASSET_STORE)) {
        const assets = db.createObjectStore(ASSET_STORE, { keyPath: 'id' })
        assets.createIndex('projectId', 'projectId', { unique: false })
      }
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error || new Error('无法打开组图工程数据库'))
  })
}

export async function saveFigureProject(project: FigureProject, assets?: Iterable<RuntimeFigureAsset>) {
  const db = await openFigureProjectDatabase()
  try {
    const transaction = db.transaction([PROJECT_STORE, ASSET_STORE], 'readwrite')
    transaction.objectStore(PROJECT_STORE).put({ ...project, updatedAt: new Date().toISOString() })
    if (assets) {
      const assetStore = transaction.objectStore(ASSET_STORE)
      for (const asset of assets) {
        const stored: StoredFigureAsset = {
          id: asset.id,
          projectId: project.id,
          name: asset.name,
          mime: asset.mime,
          blob: asset.blob,
          naturalWidth: asset.naturalWidth,
          naturalHeight: asset.naturalHeight,
          svgText: asset.svgText,
        }
        assetStore.put(stored)
      }
    }
    await transactionDone(transaction)
  } finally {
    db.close()
  }
}

export async function listFigureProjects(draftId?: string | null): Promise<FigureProject[]> {
  const db = await openFigureProjectDatabase()
  try {
    const transaction = db.transaction(PROJECT_STORE, 'readonly')
    const store = transaction.objectStore(PROJECT_STORE)
    const projects = draftId === undefined
      ? await requestValue(store.getAll()) as LegacyFigureProject[]
      : await requestValue(store.index('draftId').getAll(draftId)) as LegacyFigureProject[]
    return projects
      .map(normalizeFigureProject)
      .sort((a, b) => a.role.localeCompare(b.role) || a.sequence - b.sequence || b.updatedAt.localeCompare(a.updatedAt))
  } finally {
    db.close()
  }
}

export async function countFigureProjectsForDraft(draftId: string) {
  const db = await openFigureProjectDatabase()
  try {
    const transaction = db.transaction(PROJECT_STORE, 'readonly')
    return await requestValue(transaction.objectStore(PROJECT_STORE).index('draftId').count(draftId))
  } finally {
    db.close()
  }
}

export async function loadFigureProject(projectId: string): Promise<{ project: FigureProject; assets: Map<string, RuntimeFigureAsset> } | null> {
  const db = await openFigureProjectDatabase()
  try {
    const transaction = db.transaction([PROJECT_STORE, ASSET_STORE], 'readonly')
    const storedProject = await requestValue(transaction.objectStore(PROJECT_STORE).get(projectId)) as LegacyFigureProject | undefined
    if (!storedProject) return null
    const project = normalizeFigureProject(storedProject)
    const stored = await requestValue(transaction.objectStore(ASSET_STORE).index('projectId').getAll(projectId)) as StoredFigureAsset[]
    const assets = new Map<string, RuntimeFigureAsset>()
    for (const asset of stored) {
      assets.set(asset.id, {
        ...asset,
        objectUrl: URL.createObjectURL(asset.blob),
      })
    }
    return { project, assets }
  } finally {
    db.close()
  }
}

export async function deleteFigureProject(projectId: string) {
  const db = await openFigureProjectDatabase()
  try {
    const read = db.transaction(ASSET_STORE, 'readonly')
    const ids = await requestValue(read.objectStore(ASSET_STORE).index('projectId').getAllKeys(projectId))
    await transactionDone(read)

    const transaction = db.transaction([PROJECT_STORE, ASSET_STORE], 'readwrite')
    transaction.objectStore(PROJECT_STORE).delete(projectId)
    const assetStore = transaction.objectStore(ASSET_STORE)
    for (const id of ids) assetStore.delete(id)
    await transactionDone(transaction)
  } finally {
    db.close()
  }
}

export async function deleteFigureAsset(projectId: string, assetId: string) {
  const db = await openFigureProjectDatabase()
  try {
    const transaction = db.transaction([PROJECT_STORE, ASSET_STORE], 'readwrite')
    transaction.objectStore(ASSET_STORE).delete(assetId)
    const projectStore = transaction.objectStore(PROJECT_STORE)
    const storedProject = await requestValue(projectStore.get(projectId)) as LegacyFigureProject | undefined
    if (storedProject) {
      const project = normalizeFigureProject(storedProject)
      projectStore.put({
        ...project,
        panels: project.panels.filter(panel => panel.assetId !== assetId),
        selectedPanelIds: project.selectedPanelIds.filter(id => project.panels.some(panel => panel.id === id && panel.assetId !== assetId)),
        updatedAt: new Date().toISOString(),
      })
    }
    await transactionDone(transaction)
  } finally {
    db.close()
  }
}
