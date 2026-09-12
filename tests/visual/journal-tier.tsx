import React, { useEffect } from 'react'
import { createRoot } from 'react-dom/client'
import '../../src/app-styles'
import JournalCatalogCard from '../../src/components/JournalCatalogCard'
import type { JournalProfile } from '../../src/lib/preparation'

const now = new Date().toISOString()
const base: JournalProfile = {
  id: 'tier-base', user_id: 'visual', name: '示例期刊', name_zh: null, official_abbreviation: null,
  publisher: '示例出版社', website_url: null, author_guide_url: null, submission_url: null, third_party_links: [],
  issn: null, eissn: null, scope: null, scope_zh: null, subject_tags: [], selection_tags: [], indexing: [],
  jcr_quartile: null, cas_quartile: null, impact_factor: null, oa_type: 'closed', apc_amount: null, apc_currency: null,
  fee_notes: null, first_decision_days: null, total_review_days: null, acceptance_rate: null, risk_level: 'normal',
  is_favorite: false, priority: 'medium', selection_notes: null, notes: null, created_at: now, updated_at: now,
}

const cases = [
  {
    key: 'intl-q1-ei', expected: 'Q1', expectedPublisher: 'Wiley',
    journal: { ...base, id: 'intl-q1-ei', name: 'International Engineering Methods', publisher: 'John Wiley & Sons, Ltd. (Wiley)', indexing: ['EI'], jcr_quartile: 'Q1', rank_data: { eii: '是', sci: 'Q1' } },
  },
  {
    key: 'intl-q2-mdpi', expected: 'Q2', expectedPublisher: 'MDPI',
    journal: { ...base, id: 'intl-q2-mdpi', name: 'Open Methods and Data', publisher: 'MDPI AG (Multidisciplinary Digital Publishing Institute)', indexing: ['SCIE'], jcr_quartile: 'Q2', rank_data: { sci: 'Q2' } },
  },
  {
    key: 'cn-ei-pku', expected: 'EI', expectedPublisher: '',
    journal: { ...base, id: 'cn-ei-pku', name: '工程方法学报', publisher: '科学出版社（北京）', indexing: ['EI', '北大核心', 'CSCD'], rank_data: { eii: '是', pku: '是', cscd: '是' } },
  },
  {
    key: 'cn-pku', expected: '北核', expectedPublisher: '',
    journal: { ...base, id: 'cn-pku', name: '城市科学学报', publisher: '中国科学出版传媒股份有限公司', indexing: ['北大核心', 'CSCD'], rank_data: { pku: '是', cscd: '是' } },
  },
  {
    key: 'cn-core', expected: '核心', expectedPublisher: '',
    journal: { ...base, id: 'cn-core', name: '区域研究学报', publisher: '区域研究杂志社', indexing: ['CSCD'], rank_data: { cscd: '是' } },
  },
  {
    key: 'cn-ordinary', expected: '普通', expectedPublisher: '',
    journal: { ...base, id: 'cn-ordinary', name: '应用研究通讯', publisher: '应用研究编辑部', indexing: [] },
  },
]

function App() {
  useEffect(() => {
    const cards = Array.from(document.querySelectorAll('.journal-center-grid > .journal-center-card'))
    cards.forEach((card, index) => {
      const item = cases[index]
      if (!item || !(card instanceof HTMLElement)) return
      card.dataset.tierCase = item.key
      card.dataset.expected = item.expected
      card.dataset.publisherExpected = item.expectedPublisher
    })
    document.documentElement.dataset.visualReady = 'true'
  }, [])

  return <main style={{ padding: 24 }}>
    <div className="journal-center-workspace">
      <div className="journal-center-grid paper-grid journal-catalog-grid">
        {cases.map(item => <JournalCatalogCard key={item.journal.id} journal={item.journal as JournalProfile} onClick={() => undefined} standalone />)}
      </div>
    </div>
  </main>
}

createRoot(document.getElementById('root')!).render(<App />)
