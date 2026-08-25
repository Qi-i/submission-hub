export const FIGURE_PROJECT_VERSION = 1 as const
export const BASE_DPI = 96

export type FigureUnit = 'mm' | 'cm' | 'inch'
export type FigureRole = 'main' | 'supplementary'
export type FigureLayoutMode = 'grid' | 'manual'
export type FigureLayoutPreset = 'auto' | 'uniform' | 'hero-right-stack'
export type FigureExportFormat = 'png' | 'jpeg' | 'webp' | 'tiff' | 'pdf' | 'svg'
export type FigureLabelStyle = 'parena' | 'a' | 'parenA' | 'A'
export type FigureLabelPosition = 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right'
export type AlignMode = 'left' | 'right' | 'top' | 'bottom' | 'horizontal-center' | 'vertical-center'
export type DistributionAxis = 'horizontal' | 'vertical'
export type SnapGuideAxis = 'x' | 'y'
export type PreflightSeverity = 'error' | 'warning' | 'info'

export interface FigureLabelSettings {
  visible: boolean
  textOverride: string | null
  style: FigureLabelStyle
  fontFamily: string
  fontSize: number
  fontWeight: 400 | 500 | 600 | 700
  position: FigureLabelPosition
  color: string
  offsetX: number
  offsetY: number
}

export interface FigureBorderSettings {
  enabled: boolean
  color: string
  width: number
  style: 'solid' | 'dashed'
}

export interface FigurePanel {
  id: string
  assetId: string
  name: string
  sourceType: string
  naturalWidth: number
  naturalHeight: number
  originalAspectRatio: number
  x: number
  y: number
  width: number
  height: number
  lockAspectRatio: boolean
  gridRow: number
  gridColumn: number
  rowSpan: number
  colSpan: number
  fit: 'contain' | 'cover'
  label: FigureLabelSettings
  border: FigureBorderSettings
}

export interface FigureText {
  id: string
  text: string
  x: number
  y: number
  fontFamily: string
  fontSize: number
  fontWeight: 400 | 500 | 600 | 700
  color: string
}

export interface FigureCanvasSettings {
  width: number
  height: number
  margin: number
  gap: number
  panelWidth: number
  layoutScale: number
  background: string
  layoutMode: FigureLayoutMode
  layoutPreset: FigureLayoutPreset
  gridColumns: number
  gridRows: number
  autoWrap: boolean
}

export interface PublicationPreset {
  id: 'single-column' | 'double-column' | 'custom'
  label: string
  width: number
  height: number | null
  unit: FigureUnit
}

export interface FigureExportSettings {
  format: FigureExportFormat
  dpi: number
  physicalWidth: number
  physicalHeight: number | null
  unit: FigureUnit
  allowedFormats: FigureExportFormat[]
}

export interface FigureProject {
  version: typeof FIGURE_PROJECT_VERSION
  id: string
  draftId: string | null
  role: FigureRole
  sequence: number
  name: string
  publicationLabel: string | null
  title: string
  caption: string
  canvas: FigureCanvasSettings
  labelDefaults: FigureLabelSettings
  borderDefaults: FigureBorderSettings
  exportSettings: FigureExportSettings
  panels: FigurePanel[]
  texts: FigureText[]
  selectedPanelIds: string[]
  selectedTextId: string | null
  createdAt: string
  updatedAt: string
}

export interface RuntimeFigureAsset {
  id: string
  name: string
  mime: string
  blob: Blob
  objectUrl: string
  naturalWidth: number
  naturalHeight: number
  svgText?: string
}

export interface StoredFigureAsset {
  id: string
  projectId: string
  name: string
  mime: string
  blob: Blob
  naturalWidth: number
  naturalHeight: number
  svgText?: string
}

export interface ImportedFigureAsset extends RuntimeFigureAsset {
  sourceFileName: string
}

export interface FigureSnapGuide {
  axis: SnapGuideAxis
  position: number
  from: number
  to: number
  kind: 'edge' | 'center' | 'gap'
}

export interface SnapResult {
  x: number
  y: number
  guides: FigureSnapGuide[]
}

export interface FigurePreflightIssue {
  code: 'resolution' | 'size' | 'label' | 'bounds' | 'overlap' | 'stretch' | 'caption' | 'format'
  severity: PreflightSeverity
  message: string
  panelIds: string[]
}

export const DEFAULT_LABEL_SETTINGS: FigureLabelSettings = {
  visible: true,
  textOverride: null,
  style: 'parena',
  fontFamily: 'Times New Roman',
  fontSize: 18,
  fontWeight: 700,
  position: 'top-left',
  color: '#111827',
  offsetX: 8,
  offsetY: 8,
}

export const DEFAULT_BORDER_SETTINGS: FigureBorderSettings = {
  enabled: false,
  color: '#111827',
  width: 1,
  style: 'solid',
}

export const PUBLICATION_PRESETS: PublicationPreset[] = [
  { id: 'single-column', label: '单栏 85 mm', width: 85, height: null, unit: 'mm' },
  { id: 'double-column', label: '双栏 178 mm', width: 178, height: null, unit: 'mm' },
  { id: 'custom', label: '自定义', width: 178, height: null, unit: 'mm' },
]

export function automaticPanelLabel(index: number, style: FigureLabelStyle = 'parena') {
  const lower = style === 'a' || style === 'parena'
  const letter = String.fromCharCode((lower ? 97 : 65) + (index % 26))
  return style === 'parena' || style === 'parenA' ? `(${letter})` : letter
}

export function figureDisplayName(role: FigureRole, sequence: number) {
  return role === 'supplementary' ? `Supplementary Figure S${sequence}` : `Figure ${sequence}`
}

export function createEmptyFigureProject(draftId: string | null = null, sequence = 1, role: FigureRole = 'main'): FigureProject {
  const now = new Date().toISOString()
  return {
    version: FIGURE_PROJECT_VERSION,
    id: crypto.randomUUID(),
    draftId,
    role,
    sequence,
    name: '未命名组图',
    publicationLabel: null,
    title: '',
    caption: '',
    canvas: {
      width: 672,
      height: 480,
      margin: 16,
      gap: 32,
      panelWidth: 560,
      layoutScale: 100,
      background: '#ffffff',
      layoutMode: 'grid',
      layoutPreset: 'auto',
      gridColumns: 2,
      gridRows: 2,
      autoWrap: true,
    },
    labelDefaults: { ...DEFAULT_LABEL_SETTINGS },
    borderDefaults: { ...DEFAULT_BORDER_SETTINGS },
    exportSettings: {
      format: 'png',
      dpi: 300,
      physicalWidth: 178,
      physicalHeight: null,
      unit: 'mm',
      allowedFormats: ['png', 'jpeg', 'webp', 'tiff', 'pdf', 'svg'],
    },
    panels: [],
    texts: [],
    selectedPanelIds: [],
    selectedTextId: null,
    createdAt: now,
    updatedAt: now,
  }
}
