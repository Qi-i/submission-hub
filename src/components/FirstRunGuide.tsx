import { useEffect, useMemo, useState } from 'react'
import { ArrowLeft, ArrowRight, BarChart3, Check, Cloud, Columns3, FileText, Lightbulb, Palette, ShieldCheck, Sparkles, X } from 'lucide-react'
import { useAuth } from '../lib/auth'

export const FIRST_RUN_GUIDE_VERSION = 'luminous-x-guide-v1'

const STEPS = [
  {
    eyebrow: 'WELCOME', title: '从 Luminous X 开始', icon: Sparkles,
    description: '新版界面已经设为默认，内容保持高对比度，霓虹色只用于导航、状态和重点操作。',
    points: [
      { icon: Palette, title: '界面与明暗模式', text: '在线账户会同步界面版本和浅色、深色设置。' },
      { icon: ShieldCheck, title: '原有功能不变', text: '投稿数据、期刊库、备份、导入和统计逻辑保持一致。' },
    ],
  },
  {
    eyebrow: 'CORE AREAS', title: '按研究流程组织工作', icon: Lightbulb,
    description: '左侧导航对应论文从准备、投稿到统计的完整流程。',
    points: [
      { icon: Lightbulb, title: '投稿准备', text: '管理选题、草稿、目标期刊和投稿前检查。' },
      { icon: FileText, title: '投稿管理', text: '跟踪稿件状态、版本链、作者和下一步行动。' },
      { icon: BarChart3, title: '个人统计', text: '查看投稿周期、接收率、期刊分布和长期趋势。' },
    ],
  },
  {
    eyebrow: 'RECORD VIEWS', title: '三种方式查看投稿', icon: Columns3,
    description: '顶部三种视图只改变呈现方式，不会改变任何投稿数据。',
    points: [
      { icon: FileText, title: '工作流视图', text: '适合逐篇阅读完整投稿信息。' },
      { icon: Columns3, title: '看板视图', text: '按状态分组，并在当前页面完整换行展示。' },
      { icon: BarChart3, title: '按期刊视图', text: '按投稿期刊聚合，便于查看改投和版本关系。' },
    ],
  },
  {
    eyebrow: 'READY', title: '设置会跟随你的账户', icon: Cloud,
    description: '使用 GitHub 或邮箱登录同一账户时，界面偏好都会自动恢复。',
    points: [
      { icon: Cloud, title: '账户同步', text: '界面版本、明暗模式和指引完成状态会保存到账户。' },
      { icon: Palette, title: '随时切换', text: '右下角可在经典、Luminous 和 Luminous X 之间切换。' },
      { icon: ShieldCheck, title: '备份不受影响', text: '导入、备份和离线数据仍按原方式工作。' },
    ],
  },
]

function isVisualReview() {
  return typeof window !== 'undefined' && window.location.pathname.includes('/tests/visual/')
}

function isForcedGuide() {
  return typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('guide') === '1'
}

function readDone(key: string) {
  try { return localStorage.getItem(key) === '1' } catch { return false }
}

function markDone(key: string) {
  try { localStorage.setItem(key, '1') } catch { /* optional */ }
}

function GuideShell({ scope, onDone }: { scope: 'account' | 'offline'; onDone: () => void | Promise<void> }) {
  const [step, setStep] = useState(0)
  const current = STEPS[step]
  const CurrentIcon = current.icon
  const isLast = step === STEPS.length - 1

  useEffect(() => {
    const oldOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') void onDone()
      if (event.key === 'ArrowRight' && step < STEPS.length - 1) setStep(value => value + 1)
      if (event.key === 'ArrowLeft' && step > 0) setStep(value => value - 1)
    }
    window.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = oldOverflow
      window.removeEventListener('keydown', onKey)
    }
  }, [onDone, step])

  return <div className="first-run-overlay">
    <section className="first-run-guide" role="dialog" aria-modal="true" aria-labelledby="first-run-title">
      <aside className="first-run-rail">
        <div className="first-run-brand"><span><Sparkles size={17} /></span><div><b>Submission Hub</b><small>首次使用指引</small></div></div>
        <div className="first-run-progress">
          {STEPS.map((item, index) => {
            const Icon = item.icon
            return <button key={item.title} type="button" className={index === step ? 'active' : index < step ? 'done' : ''} onClick={() => setStep(index)}>
              <span>{index < step ? <Check size={13} /> : <Icon size={13} />}</span>
              <div><small>0{index + 1}</small><b>{item.title}</b></div>
            </button>
          })}
        </div>
        <div className="first-run-sync-note"><Cloud size={15} /><span>{scope === 'account' ? '账户偏好已启用' : '本地偏好已启用'}</span></div>
      </aside>

      <main className="first-run-content">
        <button type="button" className="first-run-close" aria-label="跳过指引" onClick={() => void onDone()}><X size={18} /></button>
        <div className="first-run-hero-icon"><CurrentIcon size={26} /></div>
        <small className="first-run-eyebrow">{current.eyebrow}</small>
        <h2 id="first-run-title">{current.title}</h2>
        <p className="first-run-description">{current.description}</p>
        <div className="first-run-points">
          {current.points.map(point => {
            const Icon = point.icon
            return <article key={point.title}><span><Icon size={17} /></span><div><b>{point.title}</b><p>{point.text}</p></div></article>
          })}
        </div>
        <footer className="first-run-footer">
          <button type="button" className="first-run-skip" onClick={() => void onDone()}>跳过指引</button>
          <div>
            <button type="button" className="first-run-back" disabled={step === 0} onClick={() => setStep(value => Math.max(0, value - 1))}><ArrowLeft size={15} /> 上一步</button>
            <button type="button" className="first-run-next" onClick={() => isLast ? void onDone() : setStep(value => value + 1)}>
              {isLast ? <><Check size={15} /> 开始使用</> : <>下一步 <ArrowRight size={15} /></>}
            </button>
          </div>
        </footer>
      </main>
    </section>
  </div>
}

export function OnlineFirstRunGuideGate() {
  const { user, isDemo, experiencePreferences, updateExperiencePreferences } = useAuth()
  const key = useMemo(() => user ? `submission-hub:onboarding:${user.id}:${FIRST_RUN_GUIDE_VERSION}` : '', [user])
  const forced = isForcedGuide()
  const [open, setOpen] = useState(false)

  useEffect(() => {
    if (!user || isDemo) return setOpen(false)
    if (forced) return setOpen(true)
    if (isVisualReview()) return setOpen(false)
    setOpen(experiencePreferences.onboardingVersion !== FIRST_RUN_GUIDE_VERSION && !readDone(key))
  }, [user, isDemo, forced, experiencePreferences.onboardingVersion, key])

  const complete = async () => {
    if (key) markDone(key)
    setOpen(false)
    if (user && !isDemo) await updateExperiencePreferences({ onboardingVersion: FIRST_RUN_GUIDE_VERSION })
  }

  return open ? <GuideShell scope="account" onDone={complete} /> : null
}

export function OfflineFirstRunGuideGate() {
  const key = `submission-hub:onboarding:offline:${FIRST_RUN_GUIDE_VERSION}`
  const forced = isForcedGuide()
  const [open, setOpen] = useState(false)

  useEffect(() => {
    if (forced) return setOpen(true)
    if (isVisualReview()) return setOpen(false)
    setOpen(!readDone(key))
  }, [forced])

  const complete = () => {
    markDone(key)
    setOpen(false)
  }

  return open ? <GuideShell scope="offline" onDone={complete} /> : null
}
