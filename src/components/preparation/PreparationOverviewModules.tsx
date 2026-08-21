import { cloneElement, useState, type DragEvent, type ReactElement, type ReactNode } from 'react'
import { ArrowUpDown, ChevronDown, ChevronUp, GripVertical } from 'lucide-react'

type ModuleKey = 'assistant' | 'topics'

const ORDER_KEY = 'submission-hub:preparation-overview-order'
const TOPIC_COLLAPSE_KEY = 'submission-hub:topic-overview-collapsed'
const DRAG_MIME = 'application/x-submission-hub-module'

function readOrder(): ModuleKey[] {
  try {
    const parsed = JSON.parse(localStorage.getItem(ORDER_KEY) || 'null')
    if (Array.isArray(parsed) && parsed.length === 2 && parsed.includes('assistant') && parsed.includes('topics')) return parsed as ModuleKey[]
  } catch { /* preference storage is optional */ }
  return ['assistant', 'topics']
}

function readTopicCollapsed() {
  try { return localStorage.getItem(TOPIC_COLLAPSE_KEY) === '1' } catch { return false }
}

interface Props {
  assistant: ReactElement<{ reorderControls?: ReactNode }>
  topics: ReactNode
}

export default function PreparationOverviewModules({ assistant, topics }: Props) {
  const [order, setOrder] = useState<ModuleKey[]>(readOrder)
  const [dragging, setDragging] = useState<ModuleKey | null>(null)
  const [topicCollapsed, setTopicCollapsed] = useState(readTopicCollapsed)

  const persistOrder = (next: ModuleKey[]) => {
    setOrder(next)
    try { localStorage.setItem(ORDER_KEY, JSON.stringify(next)) } catch { /* optional */ }
  }

  const moveModule = (source: ModuleKey, target: ModuleKey) => {
    if (source === target) return
    const next = order.filter(item => item !== source)
    next.splice(Math.max(0, next.indexOf(target)), 0, source)
    persistOrder(next)
  }

  const swap = () => persistOrder([order[1], order[0]])

  const beginDrag = (event: DragEvent<HTMLElement>, key: ModuleKey) => {
    event.dataTransfer.setData(DRAG_MIME, key)
    event.dataTransfer.setData('text/plain', key)
    event.dataTransfer.effectAllowed = 'move'
    setDragging(key)
  }

  const dropOn = (event: DragEvent<HTMLElement>, target: ModuleKey) => {
    event.preventDefault()
    const source = (event.dataTransfer.getData(DRAG_MIME) || event.dataTransfer.getData('text/plain')) as ModuleKey
    if (source === 'assistant' || source === 'topics') moveModule(source, target)
    setDragging(null)
  }

  const assistantControls = <>
    <button type="button" className="prep-module-order-control" draggable onDragStart={event => beginDrag(event, 'assistant')} onDragEnd={() => setDragging(null)} title="拖动调整模块顺序"><GripVertical size={13} /> 拖动</button>
    <button type="button" className="prep-module-order-control" onClick={swap} title="交换论文准备助手与选题推进顺序"><ArrowUpDown size={13} /> 交换</button>
  </>

  const moduleMap: Record<ModuleKey, ReactNode> = {
    assistant: <div
      key="assistant"
      className={`prep-overview-module prep-reorder-module prep-reorder-assistant${dragging === 'assistant' ? ' is-dragging' : ''}`}
      data-module="assistant"
      onDragOver={event => { event.preventDefault(); event.dataTransfer.dropEffect = 'move' }}
      onDrop={event => dropOn(event, 'assistant')}
    >{cloneElement(assistant, { reorderControls: assistantControls })}</div>,
    topics: <div
      key="topics"
      className={`prep-overview-module prep-reorder-module prep-reorder-topic${topicCollapsed ? ' is-collapsed' : ''}${dragging === 'topics' ? ' is-dragging' : ''}`}
      data-module="topics"
      onDragOver={event => { event.preventDefault(); event.dataTransfer.dropEffect = 'move' }}
      onDrop={event => dropOn(event, 'topics')}
    >
      <div className="prep-overview-module-toolbar">
        <span>选题推进模块</span>
        <div>
          <button type="button" className="prep-module-order-control" draggable onDragStart={event => beginDrag(event, 'topics')} onDragEnd={() => setDragging(null)} title="拖动调整模块顺序"><GripVertical size={13} /> 拖动</button>
          <button type="button" className="prep-module-order-control" aria-expanded={!topicCollapsed} onClick={() => setTopicCollapsed(value => {
            const next = !value
            try { localStorage.setItem(TOPIC_COLLAPSE_KEY, next ? '1' : '0') } catch { /* optional */ }
            return next
          })}>{topicCollapsed ? <><ChevronDown size={13} /> 展开</> : <><ChevronUp size={13} /> 收起</>}</button>
        </div>
      </div>
      {!topicCollapsed && topics}
    </div>,
  }

  return <div className="prep-overview-modules" aria-label="可排序论文准备模块">
    {order.map(key => moduleMap[key])}
  </div>
}
