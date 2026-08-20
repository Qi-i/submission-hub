import fs from 'node:fs'

const path = 'tests/visual/ui-geometry-contract-check.mjs'
let source = fs.readFileSync(path, 'utf8')
const before = `        const required = ['总览', '选题池', '草稿准备', '期刊比较']
        if (report.prepLabels.length !== 4) fail(\`${'${ui}'}: Preparation does not expose exactly four routes (${'${report.prepLabels.join(\' / \')}'} )\`)
        for (const label of required) if (!report.prepLabels.some(item => item.includes(label))) fail(\`${'${ui}'}: Preparation route ${'${label}'} is missing\`)
        if (report.prepLabels.some(item => item.includes('期刊库'))) fail(\`${'${ui}'}: duplicate journal-library route remains in Preparation\`)`

// Match without depending on whitespace inside the diagnostic interpolation.
const pattern = /        const required = \['总览', '选题池', '草稿准备', '期刊比较'\]\n        if \(report\.prepLabels\.length !== 4\) fail\(`\$\{ui\}: Preparation does not expose exactly four routes \(\$\{report\.prepLabels\.join\(' \/ '\)\}\)`\)\n        for \(const label of required\) if \(!report\.prepLabels\.some\(item => item\.includes\(label\)\)\) fail\(`\$\{ui\}: Preparation route \$\{label\} is missing`\)\n        if \(report\.prepLabels\.some\(item => item\.includes\('期刊库'\)\)\) fail\(`\$\{ui\}: duplicate journal-library route remains in Preparation`\)/
const after = `        const required = ['总览', '论文准备', '科研组图', '投稿材料', '期刊匹配', '投稿前检查']
        if (report.prepLabels.length !== 6) fail(\`${'${ui}'}: Preparation does not expose exactly six core routes (${'${report.prepLabels.join(\' / \')}'} )\`)
        for (const label of required) if (!report.prepLabels.some(item => item.includes(label))) fail(\`${'${ui}'}: Preparation route ${'${label}'} is missing\`)
        if (report.prepLabels.some(item => ['选题池', '草稿准备', '期刊库', '期刊比较'].some(legacy => item.includes(legacy)))) fail(\`${'${ui}'}: legacy secondary Preparation routes remain in the primary navigation\`)
        const figureRoute = report.prepLabels.findIndex(item => item.includes('科研组图'))
        if (figureRoute !== 2) fail(\`${'${ui}'}: Figure Composer is not the third first-class Preparation route\`)`

if (!pattern.test(source)) {
  console.error(before)
  throw new Error('Unable to locate the legacy four-route Preparation contract')
}
source = source.replace(pattern, after)
fs.writeFileSync(path, source)
console.log('Updated UI geometry contract for the six v2.1 Preparation routes.')
