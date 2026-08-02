import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'

const root = process.cwd()
const readText = file => fs.readFileSync(path.join(root, file), 'utf8')
const readJson = file => JSON.parse(readText(file))
const failures = []
const assert = (condition, message) => {
  if (!condition) failures.push(message)
}

const pkg = readJson('package.json')
const lock = readJson('package-lock.json')
const releaseInfo = readJson('public/release-info.json')
const readme = readText('README.md')
const releaseWorkflow = readText('.github/workflows/release-offline.yml')
const screenshotWorkflow = readText('.github/workflows/update-doc-screenshots.yml')

const version = String(pkg.version || '').trim()
const tag = `v${version}`
const releaseDocument = `docs/releases/${tag}.md`

assert(/^\d+\.\d+\.\d+$/.test(version), `package.json version is not stable semver: ${version || '(empty)'}`)
assert(lock.version === version, `package-lock.json version ${lock.version} does not match ${version}`)
assert(lock.packages?.['']?.version === version, `package-lock root package version ${lock.packages?.['']?.version} does not match ${version}`)
assert(releaseInfo.release === tag, `public/release-info.json release ${releaseInfo.release} does not match ${tag}`)
assert(/^\d{4}-\d{2}-\d{2}$/.test(String(releaseInfo.date || '')), 'public/release-info.json date must use YYYY-MM-DD')
assert(fs.existsSync(path.join(root, releaseDocument)), `${releaseDocument} is missing`)

if (fs.existsSync(path.join(root, releaseDocument))) {
  const releaseNotes = readText(releaseDocument)
  assert(releaseNotes.includes(tag), `${releaseDocument} does not identify ${tag}`)
  assert(releaseNotes.includes('自动验证'), `${releaseDocument} does not document release verification`)
}

assert(readme.includes(`docs/releases/${tag}.md`), `README does not link ${releaseDocument}`)
assert(readme.includes(`version-${tag.replaceAll('-', '--')}`) || readme.includes(`version-${tag}`), `README version badge does not identify ${tag}`)
assert(readme.includes(`当前版本：\`${tag}\``), `README current-version line does not identify ${tag}`)

assert(releaseWorkflow.includes("require('./package.json').version"), 'release workflow does not derive the version from package.json')
assert(releaseWorkflow.includes('docs/releases/v${VERSION}.md'), 'release workflow does not load version-matched release notes')
assert(!/v1\.5\.0/.test(releaseWorkflow), 'release workflow still contains the retired v1.5.0 hardcode')
assert(screenshotWorkflow.includes("require('./package.json').version"), 'screenshot workflow does not derive package-lock version dynamically')
assert(!/npm version\s+1\.5\.0/.test(screenshotWorkflow), 'screenshot workflow can still downgrade the repository to v1.5.0')

if (failures.length) {
  console.error('Release consistency check failed:')
  failures.forEach(item => console.error(`- ${item}`))
  process.exit(1)
}

console.log(`Release consistency check passed for ${tag}.`)
