import { readFileSync } from 'node:fs'

const luminousCss = readFileSync(new URL('../../src/luminous-ui.css', import.meta.url), 'utf8')
const luminousXCss = readFileSync(new URL('../../src/luminous-x-rebuild-corrections.css', import.meta.url), 'utf8')
const failures = []

const requireToken = (source, token, label) => {
  if (!source.includes(token)) failures.push(`${label}: missing ${token}`)
}

const forbidToken = (source, token, label) => {
  if (source.includes(token)) failures.push(`${label}: stale heavy surface remains ${token}`)
}

// Submission Management uses one restrained semantic surface scale in both UI families.
// The 14% -> 6% wash is enough to scan by status without turning cards into colour blocks;
// borders stay at 34%, corner glow at 9%, and dark-mode status edges at 20%.
for (const [label, source] of [['Luminous', luminousCss], ['Luminous X', luminousXCss]]) {
  requireToken(source, 'color-mix(in srgb, var(--paper-status-color) 14%, #ffffff)', label)
  requireToken(source, 'color-mix(in srgb, var(--paper-status-color) 6%, #ffffff)', label)
}

requireToken(luminousCss, 'color-mix(in srgb, var(--paper-status-color) 34%, transparent)', 'Luminous')
requireToken(luminousCss, 'color-mix(in srgb, var(--paper-status-color) 18%, transparent)', 'Luminous')
requireToken(luminousCss, 'color-mix(in srgb, var(--paper-status-color) 20%, transparent)', 'Luminous dark')

requireToken(luminousXCss, '--paper-card-border: color-mix(in srgb, var(--paper-status-color) 34%, var(--lx-line))', 'Luminous X')
requireToken(luminousXCss, 'color-mix(in srgb, var(--paper-status-color) 9%, transparent)', 'Luminous X')
requireToken(luminousXCss, '--paper-card-border: color-mix(in srgb, var(--paper-status-color) 20%, #455463)', 'Luminous X dark')

for (const token of [
  'color-mix(in srgb, var(--paper-status-color) 20%, #ffffff)',
  'color-mix(in srgb, var(--paper-status-color) 9%, #ffffff)',
  'color-mix(in srgb, var(--paper-status-color) 46%, transparent)',
]) forbidToken(luminousCss, token, 'Luminous')

for (const token of [
  '--paper-card-start: color-mix(in srgb, var(--paper-status-color) 20%, #ffffff)',
  '--paper-card-end: color-mix(in srgb, var(--paper-status-color) 8%, #ffffff)',
  '--paper-card-border: color-mix(in srgb, var(--paper-status-color) 42%, var(--lx-line))',
  'color-mix(in srgb, var(--paper-status-color) 13%, transparent)',
  '--paper-card-border: color-mix(in srgb, var(--paper-status-color) 26%, #455463)',
]) forbidToken(luminousXCss, token, 'Luminous X')

if (failures.length) {
  console.error('Submission status surface contract failed:')
  failures.forEach(item => console.error(`- ${item}`))
  process.exit(1)
}

console.log('Submission status surface contract passed.')
