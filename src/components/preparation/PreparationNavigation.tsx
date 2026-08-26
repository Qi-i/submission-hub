import { ClipboardCheck, FilePenLine, LayoutDashboard, PackageCheck, Target, type LucideIcon } from 'lucide-react'

export type PreparationSection = 'overview' | 'paper' | 'materials' | 'match' | 'check' | 'figures'

interface NavigationItem {
  key: Exclude<PreparationSection, 'figures'>
  label: string
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

export const PREPARATION_BUSINESS_SECTIONS: Array<Exclude<PreparationSection, 'figures'>> = ['overview', 'paper', 'materials', 'match', 'check']

export default function PreparationNavigation({ section, draftCount, journalCount, onChange, className = '' }: Props) {
  const items: NavigationItem[] = [
    { key: 'overview', label: '总览', icon: LayoutDashboard },
    { key: 'paper', label: '论文准备', icon: FilePenLine, meta: draftCount },
    { key: 'materials', label: '投稿材料', icon: PackageCheck },
    { key: 'match', label: '期刊匹配', icon: Target, meta: journalCount },
    { key: 'check', label: '投稿前检查', icon: ClipboardCheck },
  ]

  return <nav className={`preparation-business-rail ${className}`.trim()} data-preparation-business-rail aria-label="投稿准备核心工作区">
    {items.map(item => {
      const Icon = item.icon
      return <button key={item.key} type="button" className={`preparation-business-rail__item${section === item.key ? ' active' : ''}`} data-section-key={item.key} aria-current={section === item.key ? 'page' : undefined} onClick={() => onChange(item.key)}>
        <span className="preparation-business-rail__icon" aria-hidden="true"><Icon size={14} /></span>
        <span className="preparation-business-rail__label">{item.label}</span>
        {item.meta != null && <span className="preparation-business-rail__meta" aria-label={`${item.meta}`}>{item.meta}</span>}
      </button>
    })}
  </nav>
}
