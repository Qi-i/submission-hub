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

const papers = [
  {
    id: 'paper-review', user_id: 'offline',
    title: 'Landslide Susceptibility Assessment in the Altai Mountains, Xinjiang, China: Integrating Multi-Source Conditioning Factors and Interpretable Machine Learning',
    title_zh: '中国新疆阿尔泰山滑坡易发性评价：融合多源条件因子与可解释机器学习',
    journal: 'Geomatics, Natural Hazards and Risk', manuscript_no: '267558945', submission_system: 'Taylor & Francis Submission Portal',
    system_status: 'Out for Review', last_status_date: dateOffset(-18), next_action: '等待外审意见', reminder_level: 'watch',
    apc_amount: null, apc_currency: 'USD', revision_round: 1, followup_log: null, doi: null, publication_info: null, citation: null,
    journal_url: 'https://example.com/journal', journal_apc_note: '混合 OA；通常无强制 APC', status: 'under_review', lang: 'en',
    quartile_jcr: 'Q1', quartile_cas: '二区', quartile_new: 'TOP', quartile_cust: '推荐', quartile_zh: [],
    authors: ['Liu Zhiqi', 'Chen Kai', 'Zhang Zhen'], corresponding_author: 'Chen Kai',
    submitted_date: dateOffset(-118), resolve_date: null, deadline: null, tracking_url: 'https://example.com/submission', published_url: null,
    timeline: `${dateOffset(-118)} Submitted\n${dateOffset(-114)} With Editor\n${dateOffset(-18)} Out for Review`, notes: null, prev_id: null,
    files: [{ n: 'Revised manuscript.docx', p: '', t: '修回稿' }], created_at: timestamp, updated_at: timestamp,
  },
  {
    id: 'paper-revision', user_id: 'offline', title: 'Rapid regional prediction of rainfall-induced landslides using a simulation-informed surrogate model',
    title_zh: '基于模拟代理模型的降雨诱发滑坡区域快速预测', journal: 'Engineering Geology', manuscript_no: 'ENGEO-D-26-01428',
    submission_system: 'Editorial Manager', system_status: 'Major Revision', last_status_date: dateOffset(-5), next_action: '提交修回稿', reminder_level: 'urgent',
    apc_amount: null, apc_currency: 'USD', revision_round: 1, followup_log: null, doi: null, publication_info: null, citation: null,
    journal_url: 'https://example.com/engeo', journal_apc_note: '订阅制；可选 OA', status: 'revision', lang: 'en', quartile_jcr: 'Q1', quartile_cas: '一区',
    quartile_new: 'TOP', quartile_cust: '重点', quartile_zh: [], authors: ['Liu Zhiqi', 'Wang Tao'], corresponding_author: 'Wang Tao',
    submitted_date: dateOffset(-74), resolve_date: null, deadline: dateOffset(6), tracking_url: 'https://example.com/editorial-manager', published_url: null,
    timeline: `${dateOffset(-74)} Submitted\n${dateOffset(-68)} With Editor\n${dateOffset(-55)} Under Review\n${dateOffset(-5)} Major Revision`,
    notes: '重点核对审稿人 2 的方法验证意见。', prev_id: null, files: [{ n: 'Response to reviewers.docx', p: '', t: '审稿回复' }], created_at: timestamp, updated_at: timestamp,
  },
  {
    id: 'paper-accepted', user_id: 'offline', title: 'Kunlun geohazard susceptibility assessment using an AHP-INF framework', title_zh: '基于 AHP-INF 框架的昆仑山地质灾害易发性评价',
    journal: 'Earth Surface Processes and Landforms', manuscript_no: 'ESP-25-0812', submission_system: 'Wiley Author Services', system_status: 'Published',
    last_status_date: dateOffset(-140), next_action: '无', reminder_level: 'none', apc_amount: null, apc_currency: 'USD', revision_round: 2, followup_log: null,
    doi: '10.1002/esp.70113', publication_info: '50(8), Article 70113', citation: 'Liu Z. et al. (2025). Kunlun geohazard susceptibility assessment.',
    journal_url: 'https://example.com/espl', journal_apc_note: '订阅制', status: 'accepted', lang: 'en', quartile_jcr: 'Q1', quartile_cas: '二区', quartile_new: 'TOP', quartile_cust: '已发表', quartile_zh: [],
    authors: ['Liu Zhiqi', 'Chen Kai', 'Zhang Zhen', 'Chen Li'], corresponding_author: 'Chen Kai', submitted_date: dateOffset(-310), resolve_date: dateOffset(-140), deadline: null,
    tracking_url: null, published_url: 'https://example.com/article', timeline: `${dateOffset(-310)} Submitted\n${dateOffset(-140)} Accepted\n${dateOffset(-120)} Published`, notes: null,
    prev_id: null, files: [], created_at: timestamp, updated_at: timestamp,
  },
  {
    id: 'paper-submitted', user_id: 'offline', title: 'Spatiotemporal evolution of fractional vegetation cover in representative mining areas of the central Tianshan Mountains',
    title_zh: '天山中部典型矿区植被覆盖度时空演化', journal: 'International Journal of Mining Science and Technology', manuscript_no: 'IJMST-26-00618',
    submission_system: 'Elsevier Editorial System', system_status: 'With Editor', last_status_date: dateOffset(-9), next_action: '等待编辑送审', reminder_level: 'none',
    apc_amount: null, apc_currency: 'USD', revision_round: 0, followup_log: null, doi: null, publication_info: null, citation: null, journal_url: null,
    journal_apc_note: null, status: 'submitted', lang: 'en', quartile_jcr: 'Q1', quartile_cas: '二区', quartile_new: '无', quartile_cust: '无', quartile_zh: [],
    authors: ['Liu Zhiqi', 'Wang Tao'], corresponding_author: 'Wang Tao', submitted_date: dateOffset(-12), resolve_date: null, deadline: null, tracking_url: null,
    published_url: null, timeline: `${dateOffset(-12)} Submitted\n${dateOffset(-9)} With Editor`, notes: null, prev_id: null, files: [], created_at: timestamp, updated_at: timestamp,
  },
  {
    id: 'paper-rejected', user_id: 'offline', title: 'Physical-model-based debris-flow susceptibility mapping in a loess mountain catchment', title_zh: '黄土山区流域基于物理模型的泥石流易发性制图',
    journal: 'Natural Hazards', manuscript_no: 'NHAZ-D-25-03481', submission_system: 'Springer Nature Snapp', system_status: 'Rejected', last_status_date: dateOffset(-44),
    next_action: '准备改投', reminder_level: 'warn', apc_amount: null, apc_currency: 'USD', revision_round: 0, followup_log: null, doi: null, publication_info: null,
    citation: null, journal_url: null, journal_apc_note: null, status: 'rejected', lang: 'en', quartile_jcr: 'Q2', quartile_cas: '三区', quartile_new: '无', quartile_cust: '无', quartile_zh: [],
    authors: ['Liu Zhiqi'], corresponding_author: 'Liu Zhiqi', submitted_date: dateOffset(-160), resolve_date: dateOffset(-44), deadline: null, tracking_url: null,
    published_url: null, timeline: `${dateOffset(-160)} Submitted\n${dateOffset(-44)} Rejected`, notes: '需强化样本独立验证。', prev_id: null, files: [], created_at: timestamp, updated_at: timestamp,
  },
  {
    id: 'paper-preparing', user_id: 'offline', title: 'Ili Valley loess landslide inventory enhancement with positive-unlabeled learning', title_zh: '基于正–未标记学习的伊犁河谷黄土滑坡清单增强',
    journal: 'Landslides', manuscript_no: null, submission_system: null, system_status: null, last_status_date: null, next_action: '完成实验与初稿', reminder_level: 'none',
    apc_amount: null, apc_currency: 'USD', revision_round: 0, followup_log: null, doi: null, publication_info: null, citation: null, journal_url: null,
    journal_apc_note: null, status: 'preparing', lang: 'en', quartile_jcr: 'Q1', quartile_cas: '一区', quartile_new: 'TOP', quartile_cust: '博士课题', quartile_zh: [],
    authors: ['Liu Zhiqi', 'Wang Tao'], corresponding_author: 'Wang Tao', submitted_date: null, resolve_date: null, deadline: dateOffset(46), tracking_url: null,
    published_url: null, timeline: '', notes: null, prev_id: null, files: [], created_at: timestamp, updated_at: timestamp,
  },
]

const journals = [
  {
    id: 'journal-landslides', user_id: 'offline', name: 'Landslides', publisher: 'Springer Nature', website_url: 'https://example.com/landslides',
    author_guide_url: 'https://example.com/landslides/guide', submission_url: 'https://example.com/landslides/submit', third_party_links: [{ label: 'LetPub', url: 'https://example.com/letpub' }],
    issn: '1612-510X', eissn: '1612-5118', scope: 'Landslide science, hazard assessment, monitoring and risk mitigation', subject_tags: ['滑坡', '地质灾害', '风险评价'],
    indexing: ['SCIE', 'EI'], jcr_quartile: 'Q1', cas_quartile: '一区', impact_factor: 5.8, oa_type: 'hybrid', apc_amount: 3290, apc_currency: 'USD',
    fee_notes: '混合 OA；传统订阅模式可不支付 APC', first_decision_days: 42, total_review_days: 160, acceptance_rate: 18, risk_level: 'normal', is_favorite: true,
    priority: 'critical', notes: '优先考虑高质量滑坡方法与区域应用论文。', rank_data: { sci: '1区', sciUp: '1区', sciUpTop: 'Top', eii: '是' }, rank_updated_at: timestamp,
    created_at: timestamp, updated_at: timestamp,
  },
  {
    id: 'journal-engeo', user_id: 'offline', name: 'Engineering Geology', publisher: 'Elsevier', website_url: 'https://example.com/engeo',
    author_guide_url: 'https://example.com/engeo/guide', submission_url: 'https://example.com/engeo/submit', third_party_links: [], issn: '0013-7952', eissn: null,
    scope: 'Engineering geology, geohazards and geoenvironmental engineering', subject_tags: ['工程地质', '滑坡', '物理模型'], indexing: ['SCIE', 'EI'],
    jcr_quartile: 'Q1', cas_quartile: '一区', impact_factor: 6.9, oa_type: 'hybrid', apc_amount: 3960, apc_currency: 'USD', fee_notes: '可选 OA',
    first_decision_days: 28, total_review_days: 120, acceptance_rate: 16, risk_level: 'normal', is_favorite: true, priority: 'high', notes: null,
    rank_data: { sci: 'Q1', sciUp: '1区', sciif: '6.9', eii: '是' }, rank_updated_at: timestamp, created_at: timestamp, updated_at: timestamp,
  },
  {
    id: 'journal-gnhr', user_id: 'offline', name: 'Geomatics, Natural Hazards and Risk', publisher: 'Taylor & Francis', website_url: 'https://example.com/gnhr',
    author_guide_url: 'https://example.com/gnhr/guide', submission_url: 'https://example.com/gnhr/submit', third_party_links: [], issn: '1947-5705', eissn: '1947-5713',
    scope: 'Geomatics and multi-hazard risk assessment', subject_tags: ['遥感', 'GIS', '风险'], indexing: ['SCIE'], jcr_quartile: 'Q1', cas_quartile: '二区', impact_factor: 4.2,
    oa_type: 'gold', apc_amount: 2390, apc_currency: 'USD', fee_notes: '全 OA', first_decision_days: 35, total_review_days: 145, acceptance_rate: null,
    risk_level: 'watch', is_favorite: true, priority: 'medium', notes: '关注 APC 与编辑处理时长。', rank_data: { sci: 'Q1', sciUp: '2区', sciif: '4.2' },
    rank_updated_at: timestamp, created_at: timestamp, updated_at: timestamp,
  },
]

const topics = [
  {
    id: 'topic-pu', user_id: 'offline', title: '伊犁河谷黄土滑坡清单增强与 PU 学习易发性评价', research_question: '在正样本不完整、可靠负样本缺失时，如何提高区域滑坡易发性模型的稳健性？',
    objective: '构建遥感识别、PU 学习与可解释易发性评价的一体化路线。', novelty: '将清单不完整性显式纳入样本学习与不确定性分析。',
    background: '现有区域评价通常默认负样本可靠，难以反映滑坡清单漏判。', keywords: ['PU 学习', '黄土滑坡', '易发性'], methods: ['遥感解译', 'PU Bagging', 'SHAP'],
    data_sources: ['政府编录', 'Sentinel-2', 'DEM'], target_audience: '地质灾害与遥感研究者', expected_output: '高水平 SCI 研究论文', status: 'analysis', priority: 'critical',
    novelty_score: 5, feasibility_score: 4, data_score: 3, method_score: 4, timeline_score: 4, deadline: dateOffset(80), links: [], notes: null, created_at: timestamp, updated_at: timestamp,
  },
  {
    id: 'topic-rainfall', user_id: 'offline', title: '降雨触发黄土滑坡的物理约束代理模型', research_question: '如何兼顾区域尺度计算效率与物理过程可解释性？',
    objective: '通过数值模拟样本训练代理模型并开展区域快速预测。', novelty: '把物理模拟响应面与空间易发性评价连接。', background: null,
    keywords: ['降雨', '代理模型', '物理约束'], methods: ['渗流稳定分析', '机器学习代理模型'], data_sources: ['降雨记录', '土体参数', 'DEM'],
    target_audience: '工程地质研究者', expected_output: '方法论文', status: 'literature', priority: 'high', novelty_score: 4, feasibility_score: 3, data_score: 3,
    method_score: 4, timeline_score: 3, deadline: dateOffset(130), links: [], notes: null, created_at: timestamp, updated_at: timestamp,
  },
  {
    id: 'topic-insar', user_id: 'offline', title: '灌溉与降雨共同作用下黄土斜坡形变响应', research_question: '如何从 InSAR 时序中区分气候与人类活动驱动？',
    objective: null, novelty: null, background: null, keywords: ['InSAR', '灌溉', '形变'], methods: ['SBAS-InSAR'], data_sources: ['Sentinel-1'], target_audience: null,
    expected_output: '研究论文', status: 'idea', priority: 'medium', novelty_score: 3, feasibility_score: 2, data_score: 4, method_score: 3, timeline_score: 2,
    deadline: null, links: [], notes: null, created_at: timestamp, updated_at: timestamp,
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
    id: 'draft-pu', user_id: 'offline', topic_id: 'topic-pu', title: 'Positive-unlabeled learning for loess landslide susceptibility under incomplete inventories',
    article_type: 'Research Article', language: 'en', stage: 'journal_adaptation', abstract: 'This study develops a positive-unlabeled learning framework for regional landslide susceptibility assessment under incomplete inventories.',
    keywords: ['positive-unlabeled learning', 'loess landslide', 'susceptibility'], outline: '1. Introduction\n2. Study area and inventory\n3. Methods\n4. Results\n5. Discussion',
    authors: ['Liu Zhiqi', 'Wang Tao'], target_word_count: 8000, current_word_count: 7350, figure_count: 9, table_count: 4, reference_count: 76,
    deadline: dateOffset(21), external_links: [], target_journal_ids: ['journal-landslides', 'journal-engeo'], primary_journal_id: 'journal-landslides', checklist: checklist(9),
    notes: '补充空间交叉验证与样本不确定性讨论。', submitted_paper_id: null, created_at: timestamp, updated_at: timestamp,
  },
  {
    id: 'draft-rainfall', user_id: 'offline', topic_id: 'topic-rainfall', title: 'Simulation-informed surrogate modelling for rapid rainfall-induced landslide prediction',
    article_type: 'Methods Paper', language: 'en', stage: 'writing', abstract: 'A simulation-informed surrogate model is proposed to accelerate regional prediction.',
    keywords: ['rainfall-induced landslide', 'surrogate model', 'regional prediction'], outline: null, authors: ['Liu Zhiqi', 'Wang Tao'], target_word_count: 7500,
    current_word_count: 4280, figure_count: 6, table_count: 2, reference_count: 48, deadline: dateOffset(62), external_links: [], target_journal_ids: ['journal-engeo'],
    primary_journal_id: 'journal-engeo', checklist: checklist(5), notes: '方法验证仍需增加不同降雨情景。', submitted_paper_id: null, created_at: timestamp, updated_at: timestamp,
  },
  {
    id: 'draft-idea', user_id: 'offline', topic_id: 'topic-insar', title: 'Irrigation and rainfall controls on loess slope deformation', article_type: 'Research Article', language: 'en',
    stage: 'outline', abstract: null, keywords: ['InSAR', 'loess slope'], outline: '研究问题与数据可行性仍需论证。', authors: [], target_word_count: 7000, current_word_count: 450,
    figure_count: 1, table_count: 0, reference_count: 18, deadline: null, external_links: [], target_journal_ids: [], primary_journal_id: null, checklist: checklist(1),
    notes: '暂不确定灌溉数据可获得性。', submitted_paper_id: null, created_at: timestamp, updated_at: timestamp,
  },
]

localStorage.setItem('submission-hub-papers', JSON.stringify(papers))
localStorage.setItem('submission-hub-prep-journals', JSON.stringify(journals))
localStorage.setItem('submission-hub-prep-topics', JSON.stringify(topics))
localStorage.setItem('submission-hub-prep-drafts', JSON.stringify(drafts))
localStorage.setItem('sh-offline-author', 'Liu Zhiqi')
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
