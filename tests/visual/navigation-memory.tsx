import React, { useState } from 'react'
import ReactDOM from 'react-dom/client'
import NavigationMemory from '../../src/components/NavigationMemory'

type Page = 'preparation' | 'dashboard' | 'stats'
type Section = 'overview' | 'topics' | 'drafts' | 'journals' | 'compare'
type Layout = 'workflow' | 'board' | 'journal'

const scope = new URLSearchParams(window.location.search).get('scope') || 'visual'

function App() {
  const [page, setPage] = useState<Page>('dashboard')
  const [section, setSection] = useState<Section>('overview')
  const [layout, setLayout] = useState<Layout>('workflow')

  return <main data-current-page={page} data-current-layout={layout}>
    <NavigationMemory scope={scope} />

    <nav className="header-tabs" aria-label="主导航">
      <button className={page === 'preparation' ? 'active' : ''} onClick={() => setPage('preparation')}>投稿准备</button>
      <button className={page === 'dashboard' ? 'active' : ''} onClick={() => setPage('dashboard')}>投稿管理</button>
      <button className={page === 'stats' ? 'active' : ''} onClick={() => setPage('stats')}>个人统计</button>
    </nav>

    {page === 'dashboard' && <section className="lx-status-bar" data-page="dashboard">
      <div className="lx-view-switch" role="group" aria-label="投稿记录视图">
        <button className={layout === 'workflow' ? 'active' : ''} onClick={() => setLayout('workflow')}>工作流视图</button>
        <button className={layout === 'board' ? 'active' : ''} onClick={() => setLayout('board')}>看板视图</button>
        <button className={layout === 'journal' ? 'active' : ''} onClick={() => setLayout('journal')}>按期刊视图</button>
      </div>
    </section>}

    {page === 'preparation' && <>
      <section className="lx-status-bar" data-page="preparation">
        <div className="lx-page-proxy-controls" role="group" aria-label="投稿准备模块">
          <button onClick={() => setSection('overview')}>总览</button>
          <button onClick={() => setSection('topics')}>选题池</button>
          <button onClick={() => setSection('drafts')}>草稿准备</button>
          <button onClick={() => setSection('journals')}>期刊库</button>
          <button onClick={() => setSection('compare')}>期刊比较</button>
        </div>
      </section>
      <div className="preparation-workspace" data-section={section}>
        <div className="prep-nav">
          <button className={section === 'overview' ? 'active' : ''} onClick={() => setSection('overview')}>总览</button>
          <button className={section === 'topics' ? 'active' : ''} onClick={() => setSection('topics')}>选题池</button>
          <button className={section === 'drafts' ? 'active' : ''} onClick={() => setSection('drafts')}>草稿准备</button>
          <button className={section === 'journals' ? 'active' : ''} onClick={() => setSection('journals')}>期刊库</button>
          <button className={section === 'compare' ? 'active' : ''} onClick={() => setSection('compare')}>期刊比较</button>
        </div>
      </div>
    </>}
  </main>
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
