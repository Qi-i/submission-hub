import { BASE_DPI, type FigureUnit } from './types'

// Figure Composer uses a 96 DPI logical coordinate system. Export DPI scales from this base.
export const LOGICAL_DPI = BASE_DPI // BASE_DPI = 96

export function toInches(value: number, unit: FigureUnit) {
  const safe = Number.isFinite(value) ? value : 0
  if (unit === 'mm') return safe / 25.4
  if (unit === 'cm') return safe / 2.54
  if (unit === 'inch') return safe
  return safe
}

export function fromInches(value: number, unit: FigureUnit) {
  const safe = Number.isFinite(value) ? value : 0
  if (unit === 'mm') return safe * 25.4
  if (unit === 'cm') return safe * 2.54
  if (unit === 'inch') return safe
  return safe
}

export function physicalToLogicalPx(value: number, unit: FigureUnit) {
  return toInches(value, unit) * LOGICAL_DPI
}

export function physicalToOutputPx(value: number, unit: FigureUnit, dpi: number) {
  return Math.max(1, Math.round(toInches(value, unit) * Math.max(1, dpi)))
}

export function logicalPxToPhysical(value: number, unit: FigureUnit) {
  return fromInches(value / LOGICAL_DPI, unit)
}

export function outputScaleForDpi(dpi: number) {
  return Math.max(1, dpi) / LOGICAL_DPI
}

export function effectiveDpi(naturalPixels: number, logicalPixels: number) {
  if (logicalPixels <= 0) return 0
  const physicalInches = logicalPixels / LOGICAL_DPI
  return naturalPixels / physicalInches
}
