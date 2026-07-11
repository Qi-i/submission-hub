export type MainSubmissionStatus = 'preparing' | 'submitted' | 'under_review' | 'revision' | 'accepted' | 'rejected' | 'withdrawn'

const terminalAccepted = /(正式录用|已录用|录用通知|接收发表|accepted|acceptance|published|online published|proof received|校样|见刊|在线发表)/i
const tentativeAccepted = /(拟录用|建议录用|待录用|录用待定)/i
const rejected = /(不予录用|拒绝录用|退稿|拒稿|被拒|reject|rejected|declined)/i
const withdrawn = /(撤稿|撤回投稿|withdraw|withdrawn)/i
const revisionRequest = /(major revision|minor revision|required revision|revision required|revise and resubmit|大修|小修|退修|返修|修回通知|要求修改|修改后重审|修改后再审|退改|修改稿件)/i
const revisionSubmission = /(revision submitted|revised manuscript submitted|修回稿已提交|修回稿提交|修改稿已提交|修改稿提交|返修稿已提交|返修稿提交)/i
const reviewOrDecision = /(with journal administrator|with editor|editor invited|out for review|under review|required reviews complete|review complete|decision pending|初审|编辑部处理中|编辑处理中|待分稿|分稿中|责任编辑处理中|送外审|外审|专家评审|同行评议|审稿中|专家审回|复审|终审|主编终审|编委会审定|等待决定|决策中|审定中)/i
const submitted = /(submitted|submission received|new submission|manuscript received|投稿成功|已投稿|收稿|稿件已收|新稿件|待编辑处理)/i
const preparing = /(draft|preparing|准备中|尚未投稿|投稿准备)/i

function eventText(line: string) {
  const withoutDate = line.trim().replace(/^\d{4}[-/.]\d{1,2}[-/.]\d{1,2}\s*/, '')
  return withoutDate.split(/\s+-\s+/)[0]?.trim() || withoutDate
}

export function inferMainSubmissionStatus(systemStatus?: string | null, currentStatus: string = 'preparing'): MainSubmissionStatus {
  const text = (systemStatus || '').trim()
  const fallback = (['preparing', 'submitted', 'under_review', 'revision', 'accepted', 'rejected', 'withdrawn'].includes(currentStatus)
    ? currentStatus
    : 'preparing') as MainSubmissionStatus
  if (!text) return fallback

  // More specific Chinese phrases are evaluated before broad words such as “退” or “修改”.
  if (terminalAccepted.test(text)) return 'accepted'
  if (tentativeAccepted.test(text)) return 'under_review'
  if (withdrawn.test(text)) return 'withdrawn'
  if (revisionRequest.test(text) || revisionSubmission.test(text)) return 'revision'
  if (rejected.test(text)) return 'rejected'
  if (reviewOrDecision.test(text)) return 'under_review'
  if (submitted.test(text)) return 'submitted'
  if (preparing.test(text)) return 'preparing'
  return fallback
}

export function isRevisionRequestStatus(value?: string | null) {
  return revisionRequest.test(value || '') && !revisionSubmission.test(value || '')
}

export function inferRevisionRound(timeline?: string | null, systemStatus?: string | null, fallback = 0) {
  const lines = (timeline || '').split('\n').map(line => line.trim()).filter(Boolean)
  let rounds = 0
  let roundOpen = false
  let reviewedAfterSubmission = false

  for (const line of lines) {
    const event = eventText(line)
    if (isRevisionRequestStatus(event)) {
      if (!roundOpen && (rounds === 0 || reviewedAfterSubmission)) {
        rounds += 1
        roundOpen = true
        reviewedAfterSubmission = false
      }
      continue
    }

    if (revisionSubmission.test(event)) {
      if (roundOpen) roundOpen = false
      reviewedAfterSubmission = false
      continue
    }

    if (!roundOpen && rounds > 0 && reviewOrDecision.test(event)) reviewedAfterSubmission = true
  }

  if (rounds === 0 && isRevisionRequestStatus(systemStatus)) rounds = 1
  if (rounds > 0) return rounds
  return Math.max(0, Math.trunc(Number.isFinite(fallback) ? fallback : 0))
}

export const CHINESE_SUBMISSION_STATUS_PRESETS = [
  '投稿成功', '稿件已收', '待分稿', '编辑部处理中', '责任编辑处理中', '初审中',
  '送外审', '外审中', '专家评审', '同行评议', '专家审回', '复审中',
  '主编终审', '编委会审定', '等待决定', '决策中', '拟录用',
  '退修', '大修', '小修', '修改后重审', '修回稿已提交',
  '正式录用', '已录用', '退稿', '不予录用', '撤稿',
]
