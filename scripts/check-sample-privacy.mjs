import { readFile } from 'node:fs/promises'

const sampleFiles = [
  'tests/visual/visual.tsx',
  'src/lib/demo-data.ts',
]

const emailPattern = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi
const phonePattern = /(?<!\d)(?:\+?86[-\s]?)?1[3-9]\d{9}(?!\d)/g
const orcidPattern = /\b\d{4}-\d{4}-\d{4}-\d{3}[\dX]\b/gi
const secretPattern = /(?:secret[_-]?key|api[_-]?key|token|password)\s*[:=]\s*['"][^'"]{8,}['"]/gi

const failures = []

for (const file of sampleFiles) {
  const content = await readFile(file, 'utf8')

  for (const [label, pattern] of [
    ['email address', emailPattern],
    ['mobile number', phonePattern],
    ['ORCID', orcidPattern],
    ['embedded secret', secretPattern],
  ]) {
    const matches = content.match(pattern) || []
    if (matches.length > 0) failures.push(`${file}: contains ${label}: ${matches.join(', ')}`)
  }
}

const visual = await readFile('tests/visual/visual.tsx', 'utf8')
const demo = await readFile('src/lib/demo-data.ts', 'utf8')

const manuscriptValues = [...visual.matchAll(/manuscript_no:\s*'([^']+)'/g)].map(match => match[1])
for (const value of manuscriptValues) {
  if (!value.startsWith('DEMO-')) failures.push(`tests/visual/visual.tsx: manuscript number is not privacy-safe: ${value}`)
}

const visualUrls = [...visual.matchAll(/https:\/\/[^'"\s)]+/g)].map(match => match[0])
for (const url of visualUrls) {
  if (!url.startsWith('https://example.com/')) failures.push(`tests/visual/visual.tsx: non-example external URL found: ${url}`)
}

// Match only the standalone `id` property, not `user_id`, `topic_id`, etc.
const visualIds = [...visual.matchAll(/\bid:\s*'([^']+)'/g)].map(match => match[1])
for (const value of visualIds) {
  if (!/^(paper|journal|topic|draft)-/.test(value)) failures.push(`tests/visual/visual.tsx: unexpected sample id: ${value}`)
}

if (!visual.includes("const demoAuthor = 'Alex Chen'")) {
  failures.push('tests/visual/visual.tsx: expected fixed fictional demo identity is missing')
}
if (!visual.includes("user_id: 'offline'")) {
  failures.push('tests/visual/visual.tsx: visual samples must use the offline test user')
}

for (const required of [
  "const DEMO_USER_ID = 'demo-user-001'",
  "const DEMO_USERNAME = 'researcher'",
  "display_name: 'Demo Researcher'",
]) {
  if (!demo.includes(required)) failures.push(`src/lib/demo-data.ts: missing privacy-safe demo marker: ${required}`)
}

const demoIds = [...demo.matchAll(/\bid:\s*'([^']+)'/g)].map(match => match[1])
for (const value of demoIds) {
  if (!value.startsWith('demo-')) failures.push(`src/lib/demo-data.ts: non-demo id found: ${value}`)
}

if (failures.length > 0) {
  console.error('Sample privacy check failed:')
  failures.forEach(item => console.error(`- ${item}`))
  process.exit(1)
}

console.log('Sample privacy check passed: fictional identities, demo IDs, example URLs, and no contact details or embedded secrets.')
