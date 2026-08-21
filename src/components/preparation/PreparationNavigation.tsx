import { ClipboardCheck, FilePenLine, LayoutDashboard, PackageCheck, Target, type LucideIcon } from 'lucide-react'

export type PreparationSection = 'overview' | 'paper' | 'materials' | 'match' | 'check' | 'figures'

interface NavigationItem {
  key: Exclude<PreparationSection, 'figures'>
  label: string
  tone: 'overview' | 'paper' | 'materials' | 'match' | 'check'
  icon: LucideIcon
  meta?: number | null
}

interface Props {
  section: PreparationSection
  draftCount: number
  journalCount: number
  onChange: (section: PreparationSection) => void
  className?: string
}

export const PREPARATION_BUSINESS_SECTIONS: Array<Exclude<PreparationSection, 'figures'>> = [
  'overview',
  'paper',
  'materials',
  'match',
  'check',
]

export default function PreparationNavigation({ section, draftCount, journalCount, onChange, className = '' }: Props) {
  const items: NavigationItem[] = [
    { key: 'overview', label: '总览', tone: 'overview', icon: LayoutDashboard },
    { key: 'paper', label: '论文准备', tone: 'paper', icon: FilePenLine, meta: draftCount },
    { key: 'materials', label: '投稿材料', tone: 'materials', icon: PackageCheck },
    { key: 'match', label: '期刊匹配', tone: 'match', icon: Target, meta: journalCount },
    { key: 'check', label: '投稿前检查', tone: 'check', icon: ClipboardCheck },
  ]

  return <nav className={`prep-nav prep-nav-primary prep-business-nav ${className}`.trim()} aria-label="投稿准备核心工作区">
    {items.map(item => {
      const Icon = item.icon
      return <button
        key={item.key}
        type="button"
        data-tone={item.tone}
        className={`prep-nav-item${section === item.key ? ' active' : ''}`}
        aria-current={section === item.key ? 'page' : undefined}
        onClick={() => onChange(item.key)}
      >
        <span className="prep-nav-item__icon" aria-hidden="true"><Icon size={15} /></span>
        <span className="prep-nav-item__label">{item.label}</span>
        <span className="prep-nav-item__meta" aria-label={item.meta == null ? undefined : `${item.meta}`}>{item.meta == null ? '' : item.meta}</span>
      </button>
    })}
  </nav>
}
