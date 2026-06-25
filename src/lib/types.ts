// ── Loose Database type to avoid Supabase createClient type inference issues ──
export interface Database {
  public: {
    Tables: {
      user_profiles: {
        Row: Record<string, any>
        Insert: Record<string, any>
        Update: Record<string, any>
      }
      papers: {
        Row: Record<string, any>
        Insert: Record<string, any>
        Update: Record<string, any>
      }
      timeline_events: {
        Row: Record<string, any>
        Insert: Record<string, any>
        Update: Record<string, any>
      }
    }
    Views: Record<string, any>
    Functions: Record<string, any>
    Enums: Record<string, any>
  }
}

// ── Admin ──
export const ADMIN_ID = 'c207de09-6b0c-470d-85a6-90ff4304c1ba'

// ── Application types ──
export interface UserProfile {
  id: string
  username: string
  display_name: string | null
  avatar_url: string | null
  created_at: string
  is_admin?: boolean
}

export interface Paper {
  id: string
  user_id: string
  title: string
  title_zh: string | null
  journal: string | null
  status: string
  lang: string
  quartile_jcr: string | null
  quartile_cas: string | null
  quartile_new: string | null
  quartile_cust: string | null
  quartile_zh: string[] | null
  authors: string[] | null
  submitted_date: string | null
  resolve_date: string | null
  deadline: string | null
  tracking_url: string | null
  timeline: string | null
  notes: string | null
  prev_id: string | null
  files: { n: string; p: string }[] | null
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

// ── Status definitions ──
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
  'Submitted', 'With Editor', 'Under Review', 'Review Complete',
  'Minor Revision', 'Major Revision', 'Revision Submitted',
  'Accepted', 'Rejected', 'Withdrawn',
  'Decision Pending', 'Proof Received', 'Published', 'Out for Review',
]
