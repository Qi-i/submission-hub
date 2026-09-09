import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'

const here = dirname(fileURLToPath(import.meta.url))
const detailCss = readFileSync(resolve(here, '../../src/components/JournalCatalogCardDetail.css'), 'utf8')
const polishCss = readFileSync(resolve(here, '../../src/styles/journal-submission-layout-polish.css'), 'utf8')
const displayTs = readFileSync(resolve(here, '../../src/lib/journal-display.ts'), 'utf8')

function tierAccent(tier) {
  const escaped = tier.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const pattern = new RegExp(`\\[data-surface-tier=['\"]${escaped}['\"]\\][^{]*\\{[^}]*--journal-surface-accent:\\s*(#[0-9a-fA-F]{6})`, 'm')
  const match = detailCss.match(pattern)
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
const pairDistances = {
  q1q2: distance(rgb(q1), rgb(q2)),
  q1q3: distance(rgb(q1), rgb(q3)),
  q2q3: distance(rgb(q2), rgb(q3)),
}

const failures = []
for (const [pair, value] of Object.entries(pairDistances)) {
  if (value < 110) failures.push(`${pair.toUpperCase()} accent separation is too small: ${value.toFixed(1)}`)
}
if (new Set([q1, q2, q3]).size !== 3) failures.push('JCR Q1-Q3 must use three distinct accents')
if (detailCss.includes("data-surface-tier='jcr-q4'") || detailCss.includes('data-surface-tier="jcr-q4"')) {
  failures.push('JCR Q4 must not have a dedicated Journal Center surface')
}
if (displayTs.includes("| 'jcr-q4'") || displayTs.includes("tier: 'jcr-q4'")) {
  failures.push('Journal surface classification must only dedicate JCR surfaces to Q1-Q3')
}

const surfaceBlockStart = polishCss.indexOf('/* Card surfaces use a stable journal identity accent.')
const darkBlockStart = polishCss.indexOf("html[data-theme='dark']", surfaceBlockStart)
const lightSurfaceBlock = polishCss.slice(surfaceBlockStart, darkBlockStart)
const backgroundStart = lightSurfaceBlock.indexOf('background:')
const lightBackground = lightSurfaceBlock.slice(backgroundStart)
const lightMixPercentages = [...lightBackground.matchAll(/\)\s+(\d+(?:\.\d+)?)%,/g)].map(match => Number(match[1]))
const [primaryMix = 0, secondaryMix = 0] = lightMixPercentages
if (primaryMix < 12) failures.push(`Primary journal surface tint is too weak: ${primaryMix}%`)
if (secondaryMix < 6) failures.push(`Secondary journal surface tint is too weak: ${secondaryMix}%`)
if (primaryMix > 18) failures.push(`Primary journal surface tint is too strong: ${primaryMix}%`)

const accentBlockStart = polishCss.indexOf('/* Journal Center uses one consistent inset top accent')
const accentBlock = polishCss.slice(accentBlockStart, polishCss.indexOf('/* APC is one compact', accentBlockStart))
const height = Number(accentBlock.match(/height:\s*(\d+(?:\.\d+)?)px/)?.[1] || 0)
const opacity = Number(accentBlock.match(/opacity:\s*(\d+(?:\.\d+)?)/)?.[1] || 0)
if (height < 3) failures.push(`Journal tier top accent is too thin: ${height}px`)
if (opacity < 0.8) failures.push(`Journal tier top accent is too faint: ${opacity}`)

console.log(JSON.stringify({ q1, q2, q3, pairDistances, primaryMix, secondaryMix, height, opacity, failures }, null, 2))
if (failures.length) throw new Error(failures.join(' | '))