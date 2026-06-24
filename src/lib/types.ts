export interface Database {
  public: {
    Tables: {
      user_profiles: {
        Row: {
          id: string
          username: string
          display_name: string | null
          avatar_url: string | null
          created_at: string
        }
        Insert: {
          id: string
          username: string
          display_name?: string | null
          avatar_url?: string | null
          created_at?: string
        }
        Update: {
          username?: string
          display_name?: string | null
          avatar_url?: string | null
        }
      }
      papers: {
        Row: {
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
        Insert: Omit<Database['public']['Tables']['papers']['Row'], 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Database['public']['Tables']['papers']['Row']>
      }
      timeline_events: {
        Row: {
          id: string
          paper_id: string
          user_id: string
          event_date: string
          event_label: string
          event_note: string | null
          created_at: string
        }
        Insert: Omit<Database['public']['Tables']['timeline_events']['Row'], 'id' | 'created_at'>
        Update: Partial<Database['public']['Tables']['timeline_events']['Row']>
      }
    }
    Views: Record<string, never>
    Functions: Record<string, never>
    Enums: Record<string, never>
  }
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

export type Paper = Database['public']['Tables']['papers']['Row']
export type PaperInsert = Database['public']['Tables']['papers']['Insert']
export type PaperUpdate = Database['public']['Tables']['papers']['Update']
export type UserProfile = Database['public']['Tables']['user_profiles']['Row']
export type TimelineEvent = Database['public']['Tables']['timeline_events']['Row']
