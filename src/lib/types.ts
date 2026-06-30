// ── Loose Database type to avoid Supabase createClient type inference issues ──
export interface Database {
  public: {
    Tables: {
      user_profiles: { Row: Record<string, any>; Insert: Record<string, any>; Update: Record<string, any> }
      papers: { Row: Record<string, any>; Insert: Record<string, any>; Update: Record<string, any> }
      timeline_events: { Row: Record<string, any>; Insert: Record<string, any>; Update: Record<string, any> }
    }
    Views: Record<string, any>
    Functions: Record<string, any>
    Enums: Record<string, any>
  }
}

export const ADMIN_ID = import.meta.env.VITE_ADMIN_ID || ''

export interface UserProfile {
  id: string
  username: string
  display_name: string | null
  avatar_url: string | null
  author_name: string | null
  created_at: string
  is_admin?: boolean
}

export type PaperFile = { n: string; p: string; t?: string }

export interface Paper {
  id: string
  user_id: string
  title: string
  title_zh: string | null
  journal: string | null
  manuscript_no?: string | null
  submission_system?: string | null
  system_status?: string | null
  last_status_date?: string | null
  next_action?: string | null
  reminder_level?: string | null
  apc_amount?: number | null
  apc_currency?: string | null
  revision_round?: number | null
  followup_log?: string | null
  doi?: string | null
  publication_info?: string | null
  citation?: string | null
  journal_url?: string | null
  journal_apc_note?: string | null
  status: string
  lang: string
  quartile_jcr: string | null
  quartile_cas: string | null
  quartile_new: string | null
  quartile_cust: string | null
  quartile_zh: string[] | null
  authors: string[] | null
  corresponding_author: string | null
  submitted_date: string | null
  resolve_date: string | null
  deadline: string | null
  tracking_url: string | null
  published_url?: string | null
  timeline: string | null
  notes: string | null
  prev_id: string | null
  files: PaperFile[] | null
  created_at: string
  updated_at: string
}

export interface TimelineEvent {
  id: string
  paper_id: string
  user_id: string
  event_date: string
  event_label: string
  event_note: string | null
  created_at: string
}

export const STATUSES = [
  { key: 'preparing',    label: '准备中', emoji: '📝', color: '#6366f1' },
  { key: 'submitted',    label: '已投稿', emoji: '📮', color: '#0ea5e9' },
  { key: 'under_review', label: '审稿中', emoji: '🔬', color: '#f59e0b' },
  { key: 'revision',     label: '修回中', emoji: '🔧', color: '#a855f7' },
  { key: 'accepted',     label: '已接收', emoji: '🎉', color: '#22c55e' },
  { key: 'rejected',     label: '被拒',   emoji: '❌', color: '#ef4444' },
  { key: 'withdrawn',    label: '已撤稿', emoji: '↩️', color: '#64748b' },
] as const

export type StatusKey = typeof STATUSES[number]['key']

export function getStatus(key: string) {
  return STATUSES.find(s => s.key === key) || STATUSES[0]
}

export const JCR_OPTIONS = ['未定', 'Q1', 'Q2', 'Q3', 'Q4']
export const CAS_OPTIONS = ['未定', '一区', '二区', '三区', '四区', '预警']

export const TIMELINE_PRESETS = [
  'Submitted', 'With Journal Administrator', 'With Editor', 'Editor Invited',
  'Out for Review', 'Under Review', 'Required Reviews Complete', 'Review Complete',
  'Decision Pending', 'Minor Revision', 'Major Revision', 'Revision Required',
  'Revision Incomplete', 'Revision Submitted', 'Revised Manuscript Submitted',
  'Proof Received', 'Accepted', 'Published', 'Rejected', 'Withdrawn',
]

export const SYSTEM_STATUS_PRESETS = TIMELINE_PRESETS

export const SUBMISSION_SYSTEM_OPTIONS = [
  'ScholarOne', 'Editorial Manager', 'Taylor & Francis Submission Portal',
  'Elsevier Editorial System', 'Springer Nature Snapp', 'MDPI SuSy',
  'Frontiers', 'Wiley Author Services', '期刊邮箱', '其它',
]

export const FILE_TYPE_OPTIONS = [
  '初稿', '投稿稿', 'Cover Letter', 'Response to Reviewers', '修回稿',
  '审稿意见', '录用通知', 'Proof', '版权协议', 'APC / 发票', '投稿截图', '其它',
]

export const NEXT_ACTION_OPTIONS = [
  '等待编辑处理', '等待外审结果', '准备修回', '上传修回稿', '联系编辑部查询进展',
  '确认版面费 / APC', '校对 Proof', '更新投稿系统状态', '准备改投', '补充见刊信息', '无需处理',
]

export const REMINDER_LEVELS = [
  { key: 'none', label: '普通', color: '#64748b' },
  { key: 'watch', label: '关注', color: '#0ea5e9' },
  { key: 'warn', label: '建议处理', color: '#f59e0b' },
  { key: 'urgent', label: '紧急', color: '#ef4444' },
] as const

export type WorkflowSignal = {
  level: 'info' | 'warn' | 'danger' | 'success'
  text: string
  detail: string
}

function daysSince(date?: string | null) {
  if (!date) return null
  const time = new Date(date).getTime()
  if (!Number.isFinite(time)) return null
  return Math.max(0, Math.floor((Date.now() - time) / 86400000))
}

function daysUntil(date?: string | null) {
  if (!date) return null
  const time = new Date(date).getTime()
  if (!Number.isFinite(time)) return null
  return Math.ceil((time - Date.now()) / 86400000)
}

export function inferNextAction(paper: Partial<Pick<Paper,
  'status' | 'system_status' | 'last_status_date' | 'submitted_date' | 'deadline' | 'published_url' | 'doi' | 'publication_info'
>>): { action: string | null; reminder: string; signal: WorkflowSignal | null } {
  const status = paper.status || ''
  const system = (paper.system_status || '').toLowerCase()
  const baseDays = daysSince(paper.last_status_date || paper.submitted_date)
  const deadlineDays = daysUntil(paper.deadline)

  if (status === 'accepted') {
    if (!paper.published_url || !paper.doi || !paper.publication_info) return { action: '补充见刊信息', reminder: 'watch', signal: { level: 'info', text: '补充见刊信息', detail: '已接收稿件建议补充 DOI、见刊页面、卷期页码或在线发表信息' } }
    return { action: '无需处理', reminder: 'none', signal: null }
  }

  if (status === 'rejected' || status === 'withdrawn') return { action: '准备改投', reminder: 'watch', signal: { level: 'info', text: '准备改投', detail: '该稿件已结束，可记录改投方向或建立前置历史' } }

  if (status === 'revision') {
    if (deadlineDays !== null) {
      if (deadlineDays < 0) return { action: '上传修回稿', reminder: 'urgent', signal: { level: 'danger', text: '修回已逾期', detail: `修回截止已过 ${Math.abs(deadlineDays)} 天，请立即核对处理` } }
      if (deadlineDays <= 3) return { action: '上传修回稿', reminder: 'urgent', signal: { level: 'danger', text: '修回即将截止', detail: `距离修回截止还有 ${deadlineDays} 天` } }
      if (deadlineDays <= 14) return { action: '准备修回', reminder: 'warn', signal: { level: 'warn', text: '准备修回', detail: `距离修回截止还有 ${deadlineDays} 天` } }
    }
    return { action: '准备修回', reminder: 'watch', signal: { level: 'info', text: '准备修回', detail: '当前处于修回阶段，请持续整理修改稿和回复信' } }
  }

  if (system.includes('decision pending') && (baseDays || 0) >= 14) return { action: '联系编辑部查询进展', reminder: 'warn', signal: { level: 'warn', text: '决策等待偏久', detail: `Decision Pending 已 ${baseDays} 天，可查询编辑部进展` } }
  if ((system.includes('with editor') || system.includes('journal administrator')) && (baseDays || 0) >= 30) return { action: '联系编辑部查询进展', reminder: 'warn', signal: { level: 'warn', text: '编辑处理偏久', detail: `当前阶段已 ${baseDays} 天，可查询编辑处理进展` } }
  if ((system.includes('out for review') || system.includes('under review')) && (baseDays || 0) >= 90) return { action: '等待外审结果', reminder: 'watch', signal: { level: 'info', text: '外审周期较长', detail: `外审相关阶段已 ${baseDays} 天，建议持续跟踪` } }

  if (status === 'submitted') return { action: '等待编辑处理', reminder: 'none', signal: null }
  if (status === 'under_review') return { action: '等待外审结果', reminder: 'none', signal: null }
  return { action: null, reminder: 'none', signal: null }
}

export function getWorkflowSignal(paper: Partial<Pick<Paper,
  'status' | 'system_status' | 'last_status_date' | 'submitted_date' | 'deadline' | 'next_action' | 'reminder_level' | 'published_url' | 'doi' | 'publication_info'
>>): WorkflowSignal | null {
  if (paper.reminder_level === 'urgent') return { level: 'danger', text: '紧急处理', detail: paper.next_action || '请尽快处理该稿件' }
  if (paper.reminder_level === 'warn') return { level: 'warn', text: '建议处理', detail: paper.next_action || '建议检查投稿进展' }
  if (paper.next_action && paper.next_action !== '无需处理') return { level: 'info', text: paper.next_action, detail: '已设置下一步行动' }
  return inferNextAction(paper).signal
}
