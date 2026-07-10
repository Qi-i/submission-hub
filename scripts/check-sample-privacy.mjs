import { readFile } from 'node:fs/promises'

const files = [
  'tests/visual/visual.tsx',
  'src/lib/demo-data.ts',
]

const emailPattern = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi
const phonePattern = /(?<!\d)(?:\+?86[-\s]?)?1[3-9]\d{9}(?!\d)/g
const orcidPattern = /\b\d{4}-\d{4}-\d{4}-\d{3}[\dX]\b/gi

const failures = []

for (const file of files) {
  const content = await readFile(file, 'utf8')

  for (const [label, pattern] of [
    ['email address', emailPattern],
    ['mobile number', phonePattern],
    ['ORCID', orcidPattern],
  ]) {
    const matches = content.match(pattern) || []
    if (matches.length > 0) failures.push(`${file}: contains ${label}: ${matches.join(', ')}`)
  }
}

const visual = await readFile('tests/visual/visual.tsx', 'utf8')

const manuscriptValues = [...visual.matchAll(/manuscript_no:\s*'([^']+)'/g)].map(match => match[1])
for (const value of manuscriptValues) {
  if (!value.startsWith('DEMO-')) failures.push(`tests/visual/visual.tsx: manuscript number is not privacy-safe: ${value}`)
}

const urls = [...visual.matchAll(/https:\/\/[^'"\s)]+/g)].map(match => match[0])
for (const url of urls) {
  if (!url.startsWith('https://example.com/')) failures.push(`tests/visual/visual.tsx: non-example external URL found: ${url}`)
}

if (!visual.includes("const demoAuthor = 'Alex Chen'")) {
  failures.push('tests/visual/visual.tsx: expected fixed fictional demo identity is missing')
}

if (failures.length > 0) {
  console.error('Sample privacy check failed:')
  failures.forEach(item => console.error(`- ${item}`))
  process.exit(1)
}

console.log('Sample privacy check passed.')
