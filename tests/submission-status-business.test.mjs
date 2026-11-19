import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import ts from 'typescript'

function loadTypeScript(relativePath, mocks = {}, suffix = '') {
  const source = readFileSync(new URL(`../${relativePath}`, import.meta.url), 'utf8') + suffix
  const compiled = ts.transpileModule(source, {
    fileName: relativePath,
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.ReactJSX },
  }).outputText
  const module = { exports: {} }
  const resolveMock = id => {
    if (Object.hasOwn(mocks, id)) return mocks[id]
    throw new Error(`Unexpected runtime import in ${relativePath}: ${id}`)
  }
  new Function('module', 'exports', 'require', compiled)(module, module.exports, resolveMock)
  return module.exports
}

const intelligence = loadTypeScript('src/lib/submission-intelligence.ts')
const { mergePaperWithJournalProfile } = loadTypeScript('src/lib/journal-paper-sync.ts', {
  './journal-display': { isDomesticJournal: () => false, primaryJournalRankItems: () => [] },
  './submission-intelligence': intelligence,
})

const { __analyseTimelineForTests: analyseTimeline } = loadTypeScript('src/components/Timeline.tsx', {
  react: { useState: () => [] },
  'lucide-react': {},
  '../lib/types': { TIMELINE_PRESETS: [] },
  '../lib/submission-intelligence': intelligence,
  'react/jsx-runtime': { jsx: () => null, jsxs: () => null },
}, '\nexport const __analyseTimelineForTests = analyseTimeline;')

const basicPaper = {
  status: 'under_review',
  system_status: '拟录用',
  resolve_date: null,
  last_status_date: '2026-03-15',
  timeline: '2026-02-01 投稿成功\n2026-03-15 拟录用',
}

test('preliminary decisions and submission receipts are not terminal', () => {
  for (const status of ['拟录用', '拟录用通知', '建议录用', 'Acceptance Pending', 'Provisionally Accepted', '稿件已接收', 'Submission Received', '修回稿已提交']) {
    assert.equal(intelligence.isTerminalSubmissionEvent(status), false, status)
  }
  for (const status of ['正式录用', 'Accepted', 'Published', '退稿', 'Withdrawn', 'Not Accepted', '返修后拒稿']) {
    assert.equal(intelligence.isTerminalSubmissionEvent(status), true, status)
  }
  assert.equal(intelligence.inferMainSubmissionStatus('拟录用', 'under_review'), 'under_review')
  assert.equal(intelligence.inferMainSubmissionStatus('稿件已接收', 'preparing'), 'submitted')
  assert.equal(intelligence.inferMainSubmissionStatus('Acceptance Pending', 'accepted'), 'under_review')
  assert.equal(intelligence.inferMainSubmissionStatus('Not Accepted', 'under_review'), 'rejected')
  assert.equal(intelligence.inferMainSubmissionStatus('返修后拒稿', 'under_review'), 'rejected')
})

test('nonterminal decision never infers a resolution date', () => {
  assert.equal(mergePaperWithJournalProfile(basicPaper).resolve_date, null)
  assert.equal(mergePaperWithJournalProfile({
    ...basicPaper,
    system_status: '稿件已接收',
    timeline: '2026-02-01 Submission Received',
  }).resolve_date, null)
})

test('definitive decision resolves at its dated event, not a later preliminary note', () => {
  const paper = {
    ...basicPaper,
    status: 'accepted',
    system_status: '正式录用',
    timeline: '2026-02-01 投稿成功\n2026-03-10 正式录用\n2026-03-15 拟录用',
  }
  assert.equal(mergePaperWithJournalProfile(paper).resolve_date, '2026-03-10')
  assert.equal(mergePaperWithJournalProfile({ ...paper, timeline: '' }).resolve_date, '2026-03-15')
  assert.equal(mergePaperWithJournalProfile({
    ...basicPaper,
    resolve_date: '2026-03-01',
  }).resolve_date, '2026-03-01', 'an explicitly saved date must remain untouched')
})

test('revision cycle counting deduplicates requests but counts a request after resubmission', () => {
  const events = [
    '2026-01-04 投稿成功',
    '2026-01-15 大修',
    '2026-01-16 大修',
    '2026-01-20 修回稿提交',
    '2026-02-02 小修',
    '2026-02-03 小修',
  ]
  assert.equal(intelligence.inferRevisionRound(events.join('\n')), 2)
  assert.equal(intelligence.inferRevisionRound([...events].reverse().join('\n')), 2)
  assert.equal(intelligence.inferRevisionRound('2026-01-15 大修\n2026-01-20 resubmitted\n2026-02-02 Minor Revision'), 2)
  assert.equal(intelligence.inferRevisionRound('未知状态', '', 3), 3)
  assert.equal(intelligence.inferRevisionRound('2026-01-15 大修\n未注明日期\n2026-01-20 修回稿提交'), 1)
})

test('timeline reviewer response is measured from submission, not the duplicate receipt', () => {
  const events = [
    { date: '2026-01-01', event: 'Submitted' },
    { date: '2026-01-02', event: 'Submission Received' },
    { date: '2026-01-11', event: 'Major Revision' },
    { date: '2026-01-12', event: 'Major Revision' },
    { date: '2026-01-15', event: 'Revision Submitted' },
    { date: '2026-02-01', event: 'Minor Revision' },
  ]
  const analysis = analyseTimeline(events, Date.UTC(2026, 1, 2), true)
  assert.equal(analysis.firstResponseDays, 10)
  assert.equal(analysis.completedRounds.length, 2)
  assert.equal(analysis.revisionCount, 2)
})

test('timeline UI uses the shared classification and cycle-count kernel', () => {
  const source = readFileSync(new URL('../src/components/Timeline.tsx', import.meta.url), 'utf8')
  assert.match(source, /!isTerminalSubmissionEvent\(lastItem\.event\)/)
  assert.match(source, /revisionCount: inferRevisionRound\(/)
  assert.doesNotMatch(source, /items\.filter\(item => isRevisionOutcomeEvent\(/)
})
