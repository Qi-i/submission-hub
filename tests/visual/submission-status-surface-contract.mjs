import { readFileSync } from 'node:fs'

const luminousCss = readFileSync(new URL('../../src/luminous-ui.css', import.meta.url), 'utf8')
const luminousXCss = readFileSync(new URL('../../src/luminous-x-rebuild-corrections.css', import.meta.url), 'utf8')
const failures = []

const requireToken = (source, token, label) => {
  if (!source.includes(token)) failures.push(`${label}: missing ${token}`)
}

const forbidToken = (source, token, label) => {
  if (source.includes(token)) failures.push(`${label}: stale pale surface remains ${token}`)
}

// Submission Management should read by status at a glance without becoming saturated.
// The strong stop stays at 20%, the soft stop remains below 10%, and borders carry
// enough semantic colour to separate adjacent cards on a white canvas.
requireToken(luminousCss, "color-mix(in srgb, var(--paper-status-color) 20%, #ffffff)", 'Luminous')
requireToken(luminousCss, "color-mix(in srgb, var(--paper-status-color) 9%, #ffffff)", 'Luminous')
requireToken(luminousCss, "color-mix(in srgb, var(--paper-status-color) 46%, transparent)", 'Luminous')

requireToken(luminousXCss, "--paper-card-start: color-mix(in srgb, var(--paper-status-color) 20%, #ffffff)", 'Luminous X')
requireToken(luminousXCss, "--paper-card-end: color-mix(in srgb, var(--paper-status-color) 8%, #ffffff)", 'Luminous X')
requireToken(luminousXCss, "--paper-card-border: color-mix(in srgb, var(--paper-status-color) 42%, var(--lx-line))", 'Luminous X')
requireToken(luminousXCss, "color-mix(in srgb, var(--paper-status-color) 13%, transparent)", 'Luminous X')

forbidToken(luminousCss, 'rgba(255, 249, 235, .97)', 'Luminous')
forbidToken(luminousCss, 'rgba(248, 244, 255, .97)', 'Luminous')
forbidToken(luminousXCss, '--paper-card-start: #fff8e9', 'Luminous X')
forbidToken(luminousXCss, '--paper-card-start: #faf1ff', 'Luminous X')

if (failures.length) {
  console.error('Submission status surface contract failed:')
  failures.forEach(item => console.error(`- ${item}`))
  process.exit(1)
}

console.log('Submission status surface contract passed.')
