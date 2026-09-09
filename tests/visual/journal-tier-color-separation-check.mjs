import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'

const here = dirname(fileURLToPath(import.meta.url))
const css = readFileSync(resolve(here, '../../src/styles/journal-tier-contrast-final.css'), 'utf8')
const displayTs = readFileSync(resolve(here, '../../src/lib/journal-display.ts'), 'utf8')

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
if (css.includes('jcr-q4')) failures.push('Terminal Journal Center tier surface must not define JCR Q4')
if (displayTs.includes("| 'jcr-q4'") || displayTs.includes("tier: 'jcr-q4'") || displayTs.includes("code: 'Q4'")) {
  failures.push('Journal surface classification must only dedicate JCR surfaces to Q1-Q3')
}

const lightBlockStart = css.indexOf("html[data-ui] body .journal-center-grid.paper-grid.journal-catalog-grid > .journal-center-card.paper-card-v3 {")
const darkBlockStart = css.indexOf("html[data-theme='dark']", lightBlockStart)
const lightSurfaceBlock = css.slice(lightBlockStart, darkBlockStart)
const backgroundStart = lightSurfaceBlock.indexOf('background:')
const lightBackground = lightSurfaceBlock.slice(backgroundStart)
const lightMixPercentages = [...lightBackground.matchAll(/\)\s+(\d+(?:\.\d+)?)%,/g)].map(match => Number(match[1]))
const [primaryMix = 0, secondaryMix = 0] = lightMixPercentages
if (primaryMix < 16) failures.push(`Primary journal surface tint is too weak: ${primaryMix}%`)
if (secondaryMix < 8) failures.push(`Secondary journal surface tint is too weak: ${secondaryMix}%`)
if (primaryMix > 22) failures.push(`Primary journal surface tint is too strong: ${primaryMix}%`)

const accentBlockStart = css.indexOf('::before')
const accentBlock = css.slice(accentBlockStart, css.indexOf('::after', accentBlockStart))
const height = Number(accentBlock.match(/height:\s*(\d+(?:\.\d+)?)px/)?.[1] || 0)
const opacity = Number(accentBlock.match(/opacity:\s*(\d+(?:\.\d+)?)/)?.[1] || 0)
if (height < 4) failures.push(`Journal tier top accent is too thin: ${height}px`)
if (opacity < 0.9) failures.push(`Journal tier top accent is too faint: ${opacity}`)

console.log(JSON.stringify({ q1, q2, q3, pairDistances, primaryMix, secondaryMix, height, opacity, failures }, null, 2))
if (failures.length) throw new Error(failures.join(' | '))
