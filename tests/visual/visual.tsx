const params = new URLSearchParams(window.location.search)
const view = params.get('view') || 'dashboard'
const theme = params.get('theme') === 'dark' ? 'dark' : 'light'

const pad = (value: number) => String(value).padStart(2, '0')
const dateOffset = (days: number) => {
  const date = new Date()
  date.setDate(date.getDate() + days)
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}
const timestamp = new Date().toISOString()
const demoAuthor = 'Alex Chen'

const papers = [
  {
    id: 'paper-review', user_id: 'offline',
    title: 'Adaptive calibration of urban air-quality sensor networks using multi-source observations',
    title_zh: '基于多源观测的城市空气质量传感器网络自适应校准',
    journal: 'Environmental Modelling & Software', manuscript_no: 'DEMO-2026-0142', submission_system: 'Editorial Manager',
    system_status: 'Out for Review', last_status_date: dateOffset(-18), next_action: '等待外审意见', reminder_level: 'watch',
    apc_amount: null, apc_currency: 'USD', revision_round: 1, followup_log: null, doi: null, publication_info: null, citation: null,
    journal_url: 'https://example.com/journal-a', journal_apc_note: '示例：混合开放获取', status: 'under_review', lang: 'en',
    quartile_jcr: 'Q1', quartile_cas: '二区', quartile_new: 'TOP', quartile_cust: '推荐', quartile_zh: [],
    authors: [demoAuthor, 'Maya Patel', 'Jordan Lee'], corresponding_author: 'Maya Patel',
    submitted_date: dateOffset(-118), resolve_date: null, deadline: null, tracking_url: 'https://example.com/submission-a', published_url: null,
    timeline: `${dateOffset(-118)} Submitted\n${dateOffset(-114)} With Editor\n${dateOffset(-18)} Out for Review`, notes: null, prev_id: null,
    files: [{ n: 'revised-manuscript.docx', p: '', t: '修回稿' }], created_at: timestamp, updated_at: timestamp,
  },
  {
    id: 'paper-revision', user_id: 'offline',
    title: 'Benchmarking multimodal retrieval models for domain-specific knowledge discovery',
    title_zh: '面向领域知识发现的多模态检索模型基准评估',
    journal: 'Information Processing & Management', manuscript_no: 'DEMO-2026-0278', submission_system: 'ScholarOne',
    system_status: 'Major Revision', last_status_date: dateOffset(-5), next_action: '提交修回稿', reminder_level: 'urgent',
    apc_amount: null, apc_currency: 'USD', revision_round: 1, followup_log: null, doi: null, publication_info: null, citation: null,
    journal_url: 'https://example.com/journal-b', journal_apc_note: '示例：订阅制，可选 OA', status: 'revision', lang: 'en',
    quartile_jcr: 'Q1', quartile_cas: '一区', quartile_new: 'TOP', quartile_cust: '重点', quartile_zh: [],
    authors: [demoAuthor, 'Sofia Kim'], corresponding_author: 'Sofia Kim',
    submitted_date: dateOffset(-74), resolve_date: null, deadline: dateOffset(6), tracking_url: 'https://example.com/submission-b', published_url: null,
    timeline: `${dateOffset(-74)} Submitted\n${dateOffset(-68)} With Editor\n${dateOffset(-55)} Under Review\n${dateOffset(-5)} Major Revision`,
    notes: '示例备注：补充跨数据集稳健性实验。', prev_id: null,
    files: [{ n: 'response-to-reviewers.docx', p: '', t: '审稿回复' }], created_at: timestamp, updated_at: timestamp,
  },
  {
    id: 'paper-accepted', user_id: 'offline',
    title: 'An open and reproducible workflow for short-term hydrological forecasting',
    title_zh: '面向短期水文预测的开放可复现工作流',
    journal: 'Journal of Open Research Software', manuscript_no: 'DEMO-2025-0812', submission_system: 'Open Journal Systems', system_status: 'Published',
    last_status_date: dateOffset(-140), next_action: '无', reminder_level: 'none', apc_amount: null, apc_currency: 'USD', revision_round: 2,
    followup_log: null, doi: '10.0000/demo.2026.001', publication_info: '12(2), 101–118',
    citation: 'Chen A. et al. (2026). An open and reproducible workflow for short-term hydrological forecasting.',
    journal_url: 'https://example.com/journal-c', journal_apc_note: '示例出版信息', status: 'accepted', lang: 'en',
    quartile_jcr: 'Q2', quartile_cas: '三区', quartile_new: '无', quartile_cust: '已发表', quartile_zh: [],
    authors: [demoAuthor, 'Jordan Lee', 'Maya Patel'], corresponding_author: demoAuthor,
    submitted_date: dateOffset(-310), resolve_date: dateOffset(-140), deadline: null, tracking_url: null, published_url: 'https://example.com/article',
    timeline: `${dateOffset(-310)} Submitted\n${dateOffset(-140)} Accepted\n${dateOffset(-120)} Published`, notes: null, prev_id: null,
    files: [], created_at: timestamp, updated_at: timestamp,
  },
  {
    id: 'paper-submitted', user_id: 'offline',
    title: 'Graph-based anomaly detection for resilient energy-management systems',
    title_zh: '面向韧性能量管理系统的图异常检测方法',
    journal: 'Pattern Recognition Letters', manuscript_no: 'DEMO-2026-0618', submission_system: 'Elsevier Editorial System',
    system_status: 'With Editor', last_status_date: dateOffset(-9), next_action: '等待编辑处理', reminder_level: 'none',
    apc_amount: null, apc_currency: 'USD', revision_round: 0, followup_log: null, doi: null, publication_info: null, citation: null,
    journal_url: null, journal_apc_note: null, status: 'submitted', lang: 'en', quartile_jcr: 'Q2', quartile_cas: '三区', quartile_new: '无', quartile_cust: '无', quartile_zh: [],
    authors: ['Maya Patel', demoAuthor], corresponding_author: 'Maya Patel', submitted_date: dateOffset(-12), resolve_date: null, deadline: null,
    tracking_url: null, published_url: null, timeline: `${dateOffset(-12)} Submitted\n${dateOffset(-9)} With Editor`, notes: null, prev_id: null,
    files: [], created_at: timestamp, updated_at: timestamp,
  },
  {
    id: 'paper-rejected', user_id: 'offline',
    title: 'Privacy-preserving federated optimisation for distributed clinical analytics',
    title_zh: '面向分布式临床分析的隐私保护联邦优化',
    journal: 'Applied Soft Computing', manuscript_no: 'DEMO-2025-3481', submission_system: 'Editorial Manager', system_status: 'Rejected',
    last_status_date: dateOffset(-44), next_action: '准备改投', reminder_level: 'warn', apc_amount: null, apc_currency: 'USD', revision_round: 0,
    followup_log: null, doi: null, publication_info: null, citation: null, journal_url: null, journal_apc_note: null,
    status: 'rejected', lang: 'en', quartile_jcr: 'Q2', quartile_cas: '三区', quartile_new: '无', quartile_cust: '无', quartile_zh: [],
    authors: [demoAuthor], corresponding_author: demoAuthor, submitted_date: dateOffset(-160), resolve_date: dateOffset(-44), deadline: null,
    tracking_url: null, published_url: null, timeline: `${dateOffset(-160)} Submitted\n${dateOffset(-44)} Rejected`,
    notes: '示例备注：重新定位研究贡献后改投。', prev_id: null, files: [], created_at: timestamp, updated_at: timestamp,
  },
  {
    id: 'paper-preparing', user_id: 'offline',
    title: '基于多源开放数据的城市公共空间活力评估', title_zh: '基于多源开放数据的城市公共空间活力评估',
    journal: '地理科学进展', manuscript_no: null, submission_system: null, system_status: null, last_status_date: null,
    next_action: '完成实验与初稿', reminder_level: 'none', apc_amount: null, apc_currency: 'CNY', revision_round: 0,
    followup_log: null, doi: null, publication_info: null, citation: null, journal_url: null, journal_apc_note: null,
    status: 'preparing', lang: 'zh', quartile_jcr: null, quartile_cas: null, quartile_new: null, quartile_cust: null,
    quartile_zh: ['北大核心', 'CSCD'], authors: [demoAuthor, 'Jordan Lee'], corresponding_author: 'Jordan Lee',
    submitted_date: null, resolve_date: null, deadline: dateOffset(46), tracking_url: null, published_url: null,
    timeline: '', notes: null, prev_id: null, files: [], created_at: timestamp, updated_at: timestamp,
  },
]

const journals = [
  {
    id: 'journal-a', user_id: 'offline', name: 'Environmental Modelling & Software', publisher: 'Elsevier', website_url: 'https://example.com/journal-a',
    author_guide_url: 'https://example.com/journal-a/guide', submission_url: 'https://example.com/journal-a/submit',
    third_party_links: [{ label: '第三方介绍', url: 'https://example.com/journal-a/profile' }], issn: '1364-8152', eissn: null,
    scope: 'Environmental modelling, decision support and reproducible software', subject_tags: ['环境模型', '软件', '决策支持'],
    indexing: ['SCIE'], jcr_quartile: 'Q1', cas_quartile: '二区', impact_factor: 4.9, oa_type: 'hybrid', apc_amount: 3500, apc_currency: 'USD',
    fee_notes: '示例数据，仅用于界面演示', first_decision_days: 36, total_review_days: 128, acceptance_rate: 19, risk_level: 'normal',
    is_favorite: true, priority: 'critical', notes: '适合方法、软件和应用结合的研究。', rank_data: { sci: 'Q1', sciUp: '2区', eii: '是' },
    rank_updated_at: timestamp, created_at: timestamp, updated_at: timestamp,
  },
  {
    id: 'journal-b', user_id: 'offline', name: 'Information Processing & Management', publisher: 'Elsevier', website_url: 'https://example.com/journal-b',
    author_guide_url: 'https://example.com/journal-b/guide', submission_url: 'https://example.com/journal-b/submit', third_party_links: [],
    issn: '0306-4573', eissn: null, scope: 'Information science, retrieval, analytics and human-centred systems',
    subject_tags: ['信息检索', '机器学习', '知识发现'], indexing: ['SCIE', 'SSCI'], jcr_quartile: 'Q1', cas_quartile: '一区', impact_factor: 7.4,
    oa_type: 'hybrid', apc_amount: 4100, apc_currency: 'USD', fee_notes: '示例数据', first_decision_days: 30, total_review_days: 116,
    acceptance_rate: 17, risk_level: 'normal', is_favorite: true, priority: 'high', notes: null,
    rank_data: { sci: 'Q1', sciUp: '1区', sciif: '7.4' }, rank_updated_at: timestamp, created_at: timestamp, updated_at: timestamp,
  },
  {
    id: 'journal-c', user_id: 'offline', name: 'Journal of Open Research Software', publisher: 'Ubiquity Press', website_url: 'https://example.com/journal-c',
    author_guide_url: 'https://example.com/journal-c/guide', submission_url: 'https://example.com/journal-c/submit', third_party_links: [],
    issn: '2049-9647', eissn: null, scope: 'Research software and reproducible workflows', subject_tags: ['开放科学', '研究软件', '可复现性'],
    indexing: ['Scopus'], jcr_quartile: 'Q2', cas_quartile: '三区', impact_factor: 2.1, oa_type: 'gold', apc_amount: 900,
    apc_currency: 'GBP', fee_notes: '示例数据', first_decision_days: 24, total_review_days: 82, acceptance_rate: null,
    risk_level: 'watch', is_favorite: true, priority: 'medium', notes: '适合开放软件与工作流论文。',
    rank_data: { sci: 'Q2', sciUp: '3区' }, rank_updated_at: timestamp, created_at: timestamp, updated_at: timestamp,
  },
]

const topics = [
  {
    id: 'topic-sensors', user_id: 'offline', title: '低成本环境传感器的数据质量与自适应校准',
    research_question: '如何在参考站点稀疏时保持低成本传感器网络的长期稳定性？',
    objective: '构建跨季节、跨区域的自适应校准和不确定性评估流程。', novelty: '将漂移检测与多源观测融合到统一校准框架。',
    background: '低成本传感器易受环境和器件老化影响。', keywords: ['传感器校准', '数据融合', '不确定性'],
    methods: ['时序建模', '迁移学习', '误差传播'], data_sources: ['开放监测站', '气象数据', '移动传感器'],
    target_audience: '环境信息与数据科学研究者', expected_output: '方法与应用研究论文', status: 'analysis', priority: 'critical',
    novelty_score: 5, feasibility_score: 4, data_score: 4, method_score: 4, timeline_score: 4, deadline: dateOffset(80),
    links: [], notes: null, created_at: timestamp, updated_at: timestamp,
  },
  {
    id: 'topic-retrieval', user_id: 'offline', title: '领域多模态知识检索的可复现评测框架',
    research_question: '如何公平比较不同多模态检索模型在专业领域中的泛化能力？',
    objective: '建立公开数据、统一指标和错误分析流程。', novelty: '把检索性能、可解释性和计算成本纳入同一基准。',
    background: null, keywords: ['多模态检索', '基准测试', '知识发现'], methods: ['对比学习', '消融实验', '误差分析'],
    data_sources: ['开放图文数据集', '公开知识库'], target_audience: '信息检索研究者', expected_output: '基准研究论文',
    status: 'literature', priority: 'high', novelty_score: 4, feasibility_score: 4, data_score: 4, method_score: 4, timeline_score: 3,
    deadline: dateOffset(130), links: [], notes: null, created_at: timestamp, updated_at: timestamp,
  },
  {
    id: 'topic-urban', user_id: 'offline', title: '开放数据驱动的城市公共空间活力评价',
    research_question: '如何在保护隐私的前提下刻画公共空间的时空活力？', objective: null, novelty: null, background: null,
    keywords: ['城市活力', '开放数据', '空间分析'], methods: ['空间统计', '多源数据融合'], data_sources: ['开放街道数据', '公共交通数据'],
    target_audience: null, expected_output: '应用研究论文', status: 'idea', priority: 'medium', novelty_score: 3, feasibility_score: 3,
    data_score: 4, method_score: 3, timeline_score: 3, deadline: null, links: [], notes: null, created_at: timestamp, updated_at: timestamp,
  },
]

const checklist = (doneCount: number) => [
  ['title', '题名准确、简洁并符合期刊风格'], ['abstract', '摘要结构、字数和核心结论完整'], ['keywords', '关键词数量与格式符合要求'],
  ['structure', '正文结构、字数和章节完整'], ['references', '参考文献格式、DOI 与近年文献已核对'], ['authors', '作者顺序、单位和通讯作者已确认'],
  ['figures', '图件分辨率、字体、编号和图注合格'], ['funding', '基金项目、利益冲突和致谢已核对'], ['template', '已按目标期刊模板和作者指南排版'],
  ['cover-letter', 'Cover Letter 已准备'], ['files', '主文、图、表、补充材料和文件命名完整'],
].map(([id, label], index) => ({ id, category: index < 5 ? 'manuscript' : index < 7 ? 'authors' : index < 8 ? 'data' : index < 9 ? 'ethics' : 'submission', label, required: true, done: index < doneCount }))

const drafts = [
  {
    id: 'draft-sensors', user_id: 'offline', topic_id: 'topic-sensors',
    title: 'Adaptive calibration of low-cost environmental sensor networks under sparse references',
    article_type: 'Research Article', language: 'en', stage: 'journal_adaptation',
    abstract: 'This study develops an adaptive calibration framework for low-cost sensor networks under sparse reference observations.',
    keywords: ['sensor calibration', 'data fusion', 'uncertainty'], outline: '1. Introduction\n2. Data\n3. Methods\n4. Results\n5. Discussion',
    authors: [demoAuthor, 'Maya Patel'], target_word_count: 8000, current_word_count: 7350, figure_count: 8, table_count: 4, reference_count: 72,
    deadline: dateOffset(21), external_links: [], target_journal_ids: ['journal-a', 'journal-b'], primary_journal_id: 'journal-a',
    checklist: checklist(9), notes: '补充跨季节稳定性和误差传播分析。', submitted_paper_id: null, created_at: timestamp, updated_at: timestamp,
  },
  {
    id: 'draft-retrieval', user_id: 'offline', topic_id: 'topic-retrieval',
    title: 'A reproducible benchmark for multimodal retrieval in domain-specific knowledge discovery',
    article_type: 'Methods Paper', language: 'en', stage: 'writing',
    abstract: 'A reproducible benchmark is proposed for evaluating multimodal retrieval models in domain-specific settings.',
    keywords: ['multimodal retrieval', 'benchmark', 'knowledge discovery'], outline: null, authors: [demoAuthor, 'Jordan Lee'],
    target_word_count: 7500, current_word_count: 4280, figure_count: 6, table_count: 2, reference_count: 48,
    deadline: dateOffset(62), external_links: [], target_journal_ids: ['journal-b'], primary_journal_id: 'journal-b',
    checklist: checklist(5), notes: '仍需增加计算成本和失败案例分析。', submitted_paper_id: null, created_at: timestamp, updated_at: timestamp,
  },
  {
    id: 'draft-urban', user_id: 'offline', topic_id: 'topic-urban',
    title: '开放数据驱动的城市公共空间活力评估', article_type: '研究论文', language: 'zh', stage: 'outline',
    abstract: null, keywords: ['城市活力', '开放数据'], outline: '研究问题与数据可行性仍需论证。', authors: [], target_word_count: 7000,
    current_word_count: 450, figure_count: 1, table_count: 0, reference_count: 18, deadline: null, external_links: [],
    target_journal_ids: [], primary_journal_id: null, checklist: checklist(1), notes: '暂不确定部分数据的长期可获得性。',
    submitted_paper_id: null, created_at: timestamp, updated_at: timestamp,
  },
]

localStorage.setItem('submission-hub-papers', JSON.stringify(papers))
localStorage.setItem('submission-hub-prep-journals', JSON.stringify(journals))
localStorage.setItem('submission-hub-prep-topics', JSON.stringify(topics))
localStorage.setItem('submission-hub-prep-drafts', JSON.stringify(drafts))
localStorage.setItem('sh-offline-author', demoAuthor)
localStorage.setItem('sh-prefs', JSON.stringify({ mode: theme }))
localStorage.setItem('submission-hub-stats-modules', JSON.stringify({ overview: true, process: true, trend: true, charts: true }))
document.documentElement.dataset.visualTest = 'true'

void import('../../src/offline').then(() => {
  const target = view === 'stats' ? '个人统计' : view === 'preparation' ? '投稿准备' : '投稿管理'
  const switchTab = (attempt = 0) => {
    const button = Array.from(document.querySelectorAll<HTMLButtonElement>('.tab-btn')).find(item => item.textContent?.includes(target))
    if (button) {
      button.click()
      window.scrollTo(0, 0)
      document.documentElement.dataset.visualReady = 'true'
      return
    }
    if (attempt < 30) window.setTimeout(() => switchTab(attempt + 1), 50)
  }
  window.setTimeout(() => switchTab(), 0)
})
