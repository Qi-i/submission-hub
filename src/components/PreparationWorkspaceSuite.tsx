import {
  useCallback, useEffect, useRef, useState,
  type ComponentProps, type DragEvent as ReactDragEvent,
} from 'react'
import { createPortal } from 'react-dom'
import { ArrowUpDown, GripVertical } from 'lucide-react'
import PreparationProductivityPanel from './PreparationProductivityPanel'
import PreparationWorkspace from './PreparationWorkspace'

type Props = ComponentProps<typeof PreparationWorkspace>
type ModuleKey = 'assistant' | 'topics'

const ORDER_KEY = 'submission-hub:preparation-overview-order'
const TOPIC_COLLAPSE_KEY = 'submission-hub:topic-overview-collapsed'
const DRAG_MIME = 'application/x-submission-hub-module'

function readOrder(): ModuleKey[] {
  try {
    const parsed = JSON.parse(localStorage.getItem(ORDER_KEY) || 'null')
    if (Array.isArray(parsed) && parsed.length === 2 && parsed.includes('assistant') && parsed.includes('topics')) {
      return parsed as ModuleKey[]
    }
  } catch {
    // Ignore malformed local preferences.
  }
  return ['assistant', 'topics']
}

function readTopicCollapsed() {
  try {
    return localStorage.getItem(TOPIC_COLLAPSE_KEY) === '1'
  } catch {
    return false
  }
}

export default function PreparationWorkspaceSuite(props: Props) {
  const suiteRef = useRef<HTMLDivElement>(null)
  const [workspace, setWorkspace] = useState<HTMLElement | null>(null)
  const [portalHost, setPortalHost] = useState<HTMLDivElement | null>(null)
  const [isOverview, setIsOverview] = useState(false)
  const [order, setOrder] = useState<ModuleKey[]>(readOrder)
  const [dragging, setDragging] = useState<ModuleKey | null>(null)
  const [topicCollapsed, setTopicCollapsed] = useState(readTopicCollapsed)

  const persistOrder = useCallback((next: ModuleKey[]) => {
    setOrder(next)
    try { localStorage.setItem(ORDER_KEY, JSON.stringify(next)) } catch { /* local storage is optional */ }
  }, [])

  const moveModule = useCallback((source: ModuleKey, target: ModuleKey) => {
    if (source === target) return
    setOrder(current => {
      const next = current.filter(item => item !== source)
      const targetIndex = Math.max(0, next.indexOf(target))
      next.splice(targetIndex, 0, source)
      try { localStorage.setItem(ORDER_KEY, JSON.stringify(next)) } catch { /* local storage is optional */ }
      return next
    })
  }, [])

  const swapOrder = useCallback(() => {
    persistOrder([order[1], order[0]])
  }, [order, persistOrder])

  useEffect(() => {
    const suite = suiteRef.current
    if (!suite) return

    let currentWorkspace: HTMLElement | null = null
    let currentHost: HTMLDivElement | null = null

    const sync = () => {
      const nextWorkspace = suite.querySelector<HTMLElement>('.preparation-workspace')
      if (!nextWorkspace) return

      if (nextWorkspace !== currentWorkspace || !currentHost?.isConnected) {
        currentHost?.remove()
        currentWorkspace = nextWorkspace
        currentHost = document.createElement('div')
        currentHost.className = 'prep-productivity-host'
        currentHost.dataset.module = 'assistant'
        nextWorkspace.appendChild(currentHost)
        setWorkspace(nextWorkspace)
        setPortalHost(currentHost)
      }

      const overview = nextWorkspace.dataset.section === 'overview'
      currentHost.hidden = !overview
      setIsOverview(overview)
    }

    sync()
    const observer = new MutationObserver(sync)
    observer.observe(suite, { childList: true, subtree: true, attributes: true, attributeFilter: ['data-section'] })

    return () => {
      observer.disconnect()
      currentHost?.remove()
    }
  }, [props.loading])

  useEffect(() => {
    if (!workspace || !portalHost) return

    portalHost.style.order = String(30 + order.indexOf('assistant'))
    const topic = workspace.querySelector<HTMLElement>('.prep-topic-overview')
    if (!topic || !isOverview) return

    topic.style.order = String(30 + order.indexOf('topics'))
    topic.classList.add('prep-reorder-topic')
    topic.classList.toggle('is-collapsed', topicCollapsed)
    topic.dataset.module = 'topics'

    const head = topic.querySelector<HTMLElement>('.prep-panel-head')
    if (!head) return

    const existingViewButton = head.querySelector<HTMLButtonElement>(':scope > button')
    const dragHandle = document.createElement('button')
    dragHandle.type = 'button'
    dragHandle.className = 'prep-module-order-control prep-topic-drag-handle'
    dragHandle.draggable = true
    dragHandle.title = '拖动调整“论文准备助手”和“选题推进”的上下顺序'
    dragHandle.setAttribute('aria-label', '拖动调整模块顺序')
    dragHandle.textContent = '⠿'

    const collapseButton = document.createElement('button')
    collapseButton.type = 'button'
    collapseButton.className = 'prep-module-order-control prep-topic-collapse-toggle'
    collapseButton.textContent = topicCollapsed ? '展开' : '收起'
    collapseButton.setAttribute('aria-expanded', String(!topicCollapsed))

    if (existingViewButton) {
      head.insertBefore(dragHandle, existingViewButton)
      head.insertBefore(collapseButton, existingViewButton)
    } else {
      head.append(dragHandle, collapseButton)
    }

    const handleDragStart = (event: DragEvent) => {
      event.dataTransfer?.setData(DRAG_MIME, 'topics')
      event.dataTransfer?.setData('text/plain', 'topics')
      if (event.dataTransfer) event.dataTransfer.effectAllowed = 'move'
      setDragging('topics')
      topic.classList.add('is-dragging')
    }
    const handleDragEnd = () => {
      setDragging(null)
      topic.classList.remove('is-dragging', 'is-drag-target')
    }
    const handleDragOver = (event: DragEvent) => {
      event.preventDefault()
      topic.classList.add('is-drag-target')
      if (event.dataTransfer) event.dataTransfer.dropEffect = 'move'
    }
    const handleDragLeave = () => topic.classList.remove('is-drag-target')
    const handleDrop = (event: DragEvent) => {
      event.preventDefault()
      const source = (event.dataTransfer?.getData(DRAG_MIME) || event.dataTransfer?.getData('text/plain')) as ModuleKey
      if (source === 'assistant' || source === 'topics') moveModule(source, 'topics')
      topic.classList.remove('is-drag-target')
      setDragging(null)
    }
    const handleCollapse = () => {
      setTopicCollapsed(value => {
        const next = !value
        try { localStorage.setItem(TOPIC_COLLAPSE_KEY, next ? '1' : '0') } catch { /* local storage is optional */ }
        return next
      })
    }

    dragHandle.addEventListener('dragstart', handleDragStart)
    dragHandle.addEventListener('dragend', handleDragEnd)
    topic.addEventListener('dragover', handleDragOver)
    topic.addEventListener('dragleave', handleDragLeave)
    topic.addEventListener('drop', handleDrop)
    collapseButton.addEventListener('click', handleCollapse)

    return () => {
      dragHandle.removeEventListener('dragstart', handleDragStart)
      dragHandle.removeEventListener('dragend', handleDragEnd)
      topic.removeEventListener('dragover', handleDragOver)
      topic.removeEventListener('dragleave', handleDragLeave)
      topic.removeEventListener('drop', handleDrop)
      collapseButton.removeEventListener('click', handleCollapse)
      dragHandle.remove()
      collapseButton.remove()
    }
  }, [workspace, portalHost, isOverview, order, topicCollapsed, moveModule])

  const handleAssistantDragStart = (event: ReactDragEvent<HTMLButtonElement>) => {
    event.dataTransfer.setData(DRAG_MIME, 'assistant')
    event.dataTransfer.setData('text/plain', 'assistant')
    event.dataTransfer.effectAllowed = 'move'
    setDragging('assistant')
  }

  const assistantPortal = portalHost && isOverview
    ? createPortal(
      <div
        className={`prep-reorder-module prep-reorder-assistant ${dragging === 'assistant' ? 'is-dragging' : ''}`}
        onDragOver={event => {
          event.preventDefault()
          event.dataTransfer.dropEffect = 'move'
          event.currentTarget.classList.add('is-drag-target')
        }}
        onDragLeave={event => event.currentTarget.classList.remove('is-drag-target')}
        onDrop={event => {
          event.preventDefault()
          const source = (event.dataTransfer.getData(DRAG_MIME) || event.dataTransfer.getData('text/plain')) as ModuleKey
          if (source === 'assistant' || source === 'topics') moveModule(source, 'assistant')
          event.currentTarget.classList.remove('is-drag-target')
          setDragging(null)
        }}
      >
        <PreparationProductivityPanel
          snapshot={props.snapshot}
          loading={props.loading}
          onSaveDraft={props.onSaveDraft}
          reorderControls={<>
            <button
              type="button"
              className="prep-module-order-control"
              draggable
              title="拖动调整模块顺序"
              aria-label="拖动调整模块顺序"
              onDragStart={handleAssistantDragStart}
              onDragEnd={() => setDragging(null)}
            ><GripVertical size={13} /> 拖动</button>
            <button type="button" className="prep-module-order-control" title="交换两个模块的上下顺序" onClick={swapOrder}>
              <ArrowUpDown size={13} /> 交换
            </button>
          </>}
        />
      </div>,
      portalHost,
    )
    : null

  return <div ref={suiteRef} className="preparation-suite" data-preparation-suite="productivity-v3">
    <PreparationWorkspace {...props} />
    {assistantPortal}
  </div>
}
