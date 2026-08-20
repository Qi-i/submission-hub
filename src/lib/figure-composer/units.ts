import { BASE_DPI, type FigureUnit } from './types'

export function toInches(value: number, unit: FigureUnit) {
  const safe = Number.isFinite(value) ? value : 0
  if (unit === 'mm') return safe / 25.4
  if (unit === 'cm') return safe / 2.54
  return safe
}

export function fromInches(value: number, unit: FigureUnit) {
  const safe = Number.isFinite(value) ? value : 0
  if (unit === 'mm') return safe * 25.4
  if (unit === 'cm') return safe * 2.54
  return safe
}

export function physicalToLogicalPx(value: number, unit: FigureUnit) {
  return toInches(value, unit) * BASE_DPI
}

export function physicalToOutputPx(value: number, unit: FigureUnit, dpi: number) {
  return Math.max(1, Math.round(toInches(value, unit) * Math.max(1, dpi)))
}

export function logicalPxToPhysical(value: number, unit: FigureUnit) {
  return fromInches(value / BASE_DPI, unit)
}

export function outputScaleForDpi(dpi: number) {
  return Math.max(1, dpi) / BASE_DPI
}

export function effectiveDpi(naturalPixels: number, logicalPixels: number) {
  if (logicalPixels <= 0) return 0
  const physicalInches = logicalPixels / BASE_DPI
  return naturalPixels / physicalInches
}
