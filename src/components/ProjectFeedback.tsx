import { useEffect, useRef, useState } from 'react'
import { Bug, ExternalLink, Github, Lightbulb, MessageSquareText, X } from 'lucide-react'
import '../project-feedback.css'

const REPOSITORY_URL = 'https://github.com/Qi-i/submission-hub'
const BUG_REPORT_URL = `${REPOSITORY_URL}/issues/new?template=bug_report.yml`
const FEATURE_REQUEST_URL = `${REPOSITORY_URL}/issues/new?template=feature_request.yml`

export default function ProjectFeedback() {
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return

    const closeOnPointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false)
    }
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false)
    }

    document.addEventListener('pointerdown', closeOnPointerDown)
    document.addEventListener('keydown', closeOnEscape)
    return () => {
      document.removeEventListener('pointerdown', closeOnPointerDown)
      document.removeEventListener('keydown', closeOnEscape)
    }
  }, [open])

  const closeMenu = () => setOpen(false)

  return (
    <div className="project-feedback" ref={rootRef}>
      {open && (
        <section className="project-feedback-menu" aria-label="GitHub 项目与反馈">
          <header className="project-feedback-header">
            <div>
              <strong>项目与反馈</strong>
              <span>查看源码、报告问题或提出建议</span>
            </div>
            <button className="project-feedback-close" type="button" onClick={closeMenu} aria-label="关闭项目与反馈菜单">
              <X size={16} />
            </button>
          </header>

          <a className="project-feedback-item" href={REPOSITORY_URL} target="_blank" rel="noreferrer noopener" onClick={closeMenu}>
            <span className="project-feedback-icon"><Github size={18} /></span>
            <span><strong>GitHub 项目</strong><small>查看源码、更新说明与参与方式</small></span>
            <ExternalLink size={15} />
          </a>

          <a className="project-feedback-item" href={BUG_REPORT_URL} target="_blank" rel="noreferrer noopener" onClick={closeMenu}>
            <span className="project-feedback-icon"><Bug size={18} /></span>
            <span><strong>反馈 Bug</strong><small>提交可复现的问题和页面异常</small></span>
            <ExternalLink size={15} />
          </a>

          <a className="project-feedback-item" href={FEATURE_REQUEST_URL} target="_blank" rel="noreferrer noopener" onClick={closeMenu}>
            <span className="project-feedback-icon"><Lightbulb size={18} /></span>
            <span><strong>功能建议</strong><small>提出新功能或交互改进建议</small></span>
            <ExternalLink size={15} />
          </a>
        </section>
      )}

      <button
        className={`project-feedback-trigger ${open ? 'active' : ''}`}
        type="button"
        aria-expanded={open}
        aria-haspopup="dialog"
        onClick={() => setOpen(value => !value)}
      >
        <MessageSquareText size={18} />
        <span>项目与反馈</span>
      </button>
    </div>
  )
}
