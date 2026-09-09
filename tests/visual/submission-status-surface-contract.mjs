import { readFileSync } from 'node:fs'

const coherenceCss = readFileSync(new URL('../../src/styles/submission-status-surface-coherence.css', import.meta.url), 'utf8')
const appStyles = readFileSync(new URL('../../src/app-styles.ts', import.meta.url), 'utf8')
const failures = []

const requireToken = (source, token, label) => {
  if (!source.includes(token)) failures.push(`${label}: missing ${token}`)
}

const forbidToken = (source, token, label) => {
  if (source.includes(token)) failures.push(`${label}: stale heavy token remains ${token}`)
}

// One canonical late coherence layer owns the effective submission-card treatment.
// It deliberately sits after the two theme-specific implementations and before the
// Journal Center tier layer, keeping the two card families independent but coherent.
const coherenceImport = "import './styles/submission-status-surface-coherence.css'"
const journalTierImport = "import './styles/journal-tier-contrast-final.css'"
requireToken(appStyles, coherenceImport, 'app-styles')
requireToken(appStyles, journalTierImport, 'app-styles')
if (appStyles.indexOf(coherenceImport) > appStyles.indexOf(journalTierImport)) {
  failures.push('app-styles: submission coherence must load before Journal Center tier styling')
}

// Light mode: identical 14% -> 6% wash in Luminous and Luminous X.
requireToken(coherenceCss, "html[data-ui='luminous'][data-theme='light']", 'Luminous selector')
requireToken(coherenceCss, "html[data-ui='luminous-x'][data-theme='light']", 'Luminous X selector')
requireToken(coherenceCss, 'color-mix(in srgb, var(--paper-status-color) 14%, #ffffff)', 'shared light surface')
requireToken(coherenceCss, 'color-mix(in srgb, var(--paper-status-color) 6%, #ffffff)', 'shared light surface')
requireToken(coherenceCss, 'color-mix(in srgb, var(--paper-status-color) 34%, transparent)', 'Luminous light edge')
requireToken(coherenceCss, 'color-mix(in srgb, var(--paper-status-color) 18%, transparent)', 'Luminous light edge')
requireToken(coherenceCss, '--paper-card-border: color-mix(in srgb, var(--paper-status-color) 34%, var(--lx-line))', 'Luminous X light edge')
requireToken(coherenceCss, 'color-mix(in srgb, var(--paper-status-color) 9%, transparent)', 'Luminous X corner glow')

// Board, list and journal-group containers must resolve through the same Luminous X rule.
for (const container of ['.paper-grid', '.lx-board-stack', '.lx-journal-group-grid']) {
  requireToken(coherenceCss, container, `Luminous X container ${container}`)
}

// Dark cards stay neutral, using only a restrained 20% semantic edge cue.
requireToken(coherenceCss, "html[data-ui='luminous'][data-theme='dark']", 'Luminous dark selector')
requireToken(coherenceCss, "html[data-ui='luminous-x'][data-theme='dark']", 'Luminous X dark selector')
requireToken(coherenceCss, 'color-mix(in srgb, var(--paper-status-color) 20%, transparent)', 'Luminous dark edge')
requireToken(coherenceCss, '--paper-card-border: color-mix(in srgb, var(--paper-status-color) 20%, #455463)', 'Luminous X dark edge')

// Prevent the canonical coherence layer from drifting back to the heavier PR #125 scale.
for (const token of [' 20%, #ffffff', ' 46%, transparent', ' 42%, var(--lx-line)', ' 13%, transparent', ' 26%, #455463']) {
  forbidToken(coherenceCss, token, 'coherence layer')
}

if (failures.length) {
  console.error('Submission status surface contract failed:')
  failures.forEach(item => console.error(`- ${item}`))
  process.exit(1)
}

console.log('Submission status surface contract passed.')
