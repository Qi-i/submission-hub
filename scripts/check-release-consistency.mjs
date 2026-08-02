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
const releaseAuditDocument = `docs/releases/${tag}-release-audit.md`
const releaseDate = String(releaseInfo.date || '').trim()

assert(/^\d+\.\d+\.\d+$/.test(version), `package.json version is not stable semver: ${version || '(empty)'}`)
assert(lock.version === version, `package-lock.json version ${lock.version} does not match ${version}`)
assert(lock.packages?.['']?.version === version, `package-lock root package version ${lock.packages?.['']?.version} does not match ${version}`)
assert(releaseInfo.release === tag, `public/release-info.json release ${releaseInfo.release} does not match ${tag}`)
assert(/^\d{4}-\d{2}-\d{2}$/.test(releaseDate), 'public/release-info.json date must use YYYY-MM-DD')
assert(fs.existsSync(path.join(root, releaseDocument)), `${releaseDocument} is missing`)
assert(fs.existsSync(path.join(root, releaseAuditDocument)), `${releaseAuditDocument} is missing`)

if (fs.existsSync(path.join(root, releaseDocument))) {
  const releaseNotes = readText(releaseDocument)
  assert(releaseNotes.includes(tag), `${releaseDocument} does not identify ${tag}`)
  assert(releaseNotes.includes(`发布日期：${releaseDate}`), `${releaseDocument} date does not match public/release-info.json`)
  assert(releaseNotes.includes('自动验证'), `${releaseDocument} does not document release verification`)
}

if (fs.existsSync(path.join(root, releaseAuditDocument))) {
  const releaseAudit = readText(releaseAuditDocument)
  assert(releaseAudit.includes(tag), `${releaseAuditDocument} does not identify ${tag}`)
  assert(releaseAudit.includes('第三轮：最终门禁'), `${releaseAuditDocument} does not document the final release gate`)
}

assert(readme.includes(`docs/releases/${tag}.md`), `README does not link ${releaseDocument}`)
assert(readme.includes(`version-${tag.replaceAll('-', '--')}`) || readme.includes(`version-${tag}`), `README version badge does not identify ${tag}`)
assert(readme.includes(`当前版本：\`${tag}\``), `README current-version line does not identify ${tag}`)
assert(readme.includes('投稿管理 → 期刊中心 → 投稿准备 → 个人统计 → 后台管理'), 'README does not document the five-module primary navigation')

assert(releaseWorkflow.includes("require('./package.json').version"), 'release workflow does not derive the version from package.json')
assert(releaseWorkflow.includes('docs/releases/v${VERSION}.md'), 'release workflow does not load version-matched release notes')
assert(releaseWorkflow.includes("paths:\n      - 'package.json'"), 'release workflow is not bound to package-version changes')
assert(!/v1\.5\.0/.test(releaseWorkflow), 'release workflow still contains the retired v1.5.0 hardcode')

assert(screenshotWorkflow.includes("branches: [main, 'release/**']"), 'screenshot workflow does not cover release branches')
assert(screenshotWorkflow.includes('run: npm run check:release'), 'screenshot workflow does not verify release metadata')
assert(screenshotWorkflow.includes('uses: actions/upload-artifact@v4'), 'screenshot workflow does not upload generated screenshots for review')
assert(screenshotWorkflow.includes('contents: read'), 'screenshot workflow does not use read-only repository permissions')
assert(!screenshotWorkflow.includes('contents: write'), 'screenshot workflow still requests repository write permission')
assert(!/\bgit\s+push\b/.test(screenshotWorkflow), 'screenshot workflow still rewrites a branch')
assert(!/\bnpm\s+version\b/.test(screenshotWorkflow), 'screenshot workflow still mutates package metadata')
assert(!/v1\.5\.0/.test(screenshotWorkflow), 'screenshot workflow still contains the retired v1.5.0 hardcode')

if (failures.length) {
  console.error('Release consistency check failed:')
  failures.forEach(item => console.error(`- ${item}`))
  process.exit(1)
}

console.log(`Release consistency check passed for ${tag}.`)
