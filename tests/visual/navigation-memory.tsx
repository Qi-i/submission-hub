import React, { useState } from 'react'
import ReactDOM from 'react-dom/client'
import NavigationMemory from '../../src/components/NavigationMemory'

type Page = 'preparation' | 'journals' | 'dashboard' | 'stats'
type Section = 'overview' | 'paper' | 'materials' | 'match' | 'check'
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
      <button className={page === 'journals' ? 'active' : ''} onClick={() => setPage('journals')}>期刊中心</button>
      <button className={page === 'dashboard' ? 'active' : ''} onClick={() => setPage('dashboard')}>投稿管理</button>
      <button className={page === 'stats' ? 'active' : ''} onClick={() => setPage('stats')}>个人统计</button>
    </nav>

    {page === 'dashboard' && <section className="lx-status-bar" data-page="dashboard"><div className="lx-view-switch" role="group" aria-label="投稿记录视图">
      <button className={layout === 'workflow' ? 'active' : ''} onClick={() => setLayout('workflow')}>工作流视图</button>
      <button className={layout === 'board' ? 'active' : ''} onClick={() => setLayout('board')}>看板视图</button>
      <button className={layout === 'journal' ? 'active' : ''} onClick={() => setLayout('journal')}>按期刊视图</button>
    </div></section>}

    {page === 'journals' && <section className="journal-center-workspace" data-page="journals">独立期刊中心</section>}

    {page === 'preparation' && <div className="preparation-workspace" data-section={section}>
      <div className="prep-nav prep-nav-primary prep-business-nav">
        <button data-tone="overview" onClick={() => setSection('overview')}>总览</button>
        <button data-tone="paper" onClick={() => setSection('paper')}>论文准备</button>
        <button data-tone="materials" onClick={() => setSection('materials')}>投稿材料</button>
        <button data-tone="match" onClick={() => setSection('match')}>期刊匹配</button>
        <button data-tone="check" onClick={() => setSection('check')}>投稿前检查</button>
      </div>
    </div>}
  </main>
}

ReactDOM.createRoot(document.getElementById('root')!).render(<React.StrictMode><App /></React.StrictMode>)
