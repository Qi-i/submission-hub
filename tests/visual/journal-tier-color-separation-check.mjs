import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'

const here = dirname(fileURLToPath(import.meta.url))
const css = readFileSync(resolve(here, '../../src/components/JournalCatalogCardDetail.css'), 'utf8')

function tierAccent(tier) {
  const escaped = tier.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const pattern = new RegExp(`\\[data-surface-tier=['\"]${escaped}['\"]\\][^{]*\\{[^}]*--journal-surface-accent:\\s*(#[0-9a-fA-F]{6})`, 'm')
  const match = css.match(pattern)
  if (!match) throw new Error(`Missing surface accent for ${tier}`)
  return match[1]
}

function rgb(hex) {
  const value = Number.parseInt(hex.slice(1), 16)
  return [(value >> 16) & 255, (value >> 8) & 255, value & 255]
}

function distance(a, b) {
  return Math.sqrt(a.reduce((sum, channel, index) => sum + ((channel - b[index]) ** 2), 0))
}

const q1 = tierAccent('jcr-q1')
const q2 = tierAccent('jcr-q2')
const q3 = tierAccent('jcr-q3')
const q4 = tierAccent('jcr-q4')
const q1q2Distance = distance(rgb(q1), rgb(q2))

const failures = []
if (q1q2Distance < 95) failures.push(`Q1/Q2 accent separation is too small: ${q1q2Distance.toFixed(1)} (${q1} vs ${q2})`)
if (new Set([q1, q2, q3, q4]).size !== 4) failures.push('JCR Q1-Q4 must use four distinct accents')

const lightSurfaceMix = /color-mix\(in srgb, var\(--journal-(?:surface-accent|card-accent)[^)]*\)\s+(\d+(?:\.\d+)?)%/g
const percentages = [...css.matchAll(lightSurfaceMix)].map(match => Number(match[1]))
if (percentages.some(value => value > 10)) failures.push(`Journal tier surface mix is too strong: ${Math.max(...percentages)}%`)

console.log(JSON.stringify({ q1, q2, q3, q4, q1q2Distance, failures }, null, 2))
if (failures.length) throw new Error(failures.join(' | '))
