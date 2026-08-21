import fs from 'node:fs'

function replaceExact(file, before, after) {
  const source = fs.readFileSync(file, 'utf8')
  if (!source.includes(before)) throw new Error(`Missing expected block in ${file}: ${before.slice(0, 160)}`)
  fs.writeFileSync(file, source.replace(before, after))
}

const file = 'src/components/PreparationWorkspace.tsx'
replaceExact(file,
`import PreparationNavigation, { type PreparationSection } from './preparation/PreparationNavigation'`,
`import PreparationNavigation, { type PreparationSection } from './preparation/PreparationNavigation'\nimport PreparationOverviewModules from './preparation/PreparationOverviewModules'\nimport PreparationProductivityPanel from './PreparationProductivityPanel'`)

const oldBlock = `      <section className="prep-panel prep-panel-topic prep-topic-overview">\n        <PanelHead title="选题推进" subtitle="综合创新性、数据、方法、可行性与时间条件" onClick={() => setSection('topics')} />\n        <div className="prep-topic-strip">\n          {orderedTopics.slice(0, 5).map(topic => <TopicCard\n            key={topic.id}\n            topic={topic}\n            onClick={() => setEditor({ type: 'topic', value: topic })}\n            onCreateDraft={() => void createDraftFromTopic(topic)}\n            creating={creatingTopicId === topic.id}\n            compact\n          />)}\n          {!orderedTopics.length && <Empty text="尚无研究选题" action="新增选题" onClick={() => setEditor({ type: 'topic', value: 'new' })} />}\n        </div>\n      </section>`

const newBlock = `      <PreparationOverviewModules\n        assistant={<PreparationProductivityPanel snapshot={normalized} loading={loading} onSaveDraft={onSaveDraft} />}\n        topics={<section className="prep-panel prep-panel-topic prep-topic-overview">\n          <PanelHead title="选题推进" subtitle="综合创新性、数据、方法、可行性与时间条件" onClick={() => setSection('topics')} />\n          <div className="prep-topic-strip">\n            {orderedTopics.slice(0, 5).map(topic => <TopicCard\n              key={topic.id}\n              topic={topic}\n              onClick={() => setEditor({ type: 'topic', value: topic })}\n              onCreateDraft={() => void createDraftFromTopic(topic)}\n              creating={creatingTopicId === topic.id}\n              compact\n            />)}\n            {!orderedTopics.length && <Empty text="尚无研究选题" action="新增选题" onClick={() => setEditor({ type: 'topic', value: 'new' })} />}\n          </div>\n        </section>}\n      />`
replaceExact(file, oldBlock, newBlock)

console.log('Integrated overview modules into the React tree.')
