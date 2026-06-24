// ═══════════════════════════════════════════════════════════
// AIStudio → Submission Hub 数据迁移脚本
// 使用方法：在 Submission Hub 登录后，打开浏览器控制台粘贴运行
// ═══════════════════════════════════════════════════════════

(async () => {
  const SUPABASE_URL = 'https://grrwxtlauqcfnerckijn.supabase.co';
  const ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imdycnd4dGxhdXFjZm5lcmNraWpuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODIzMDgwNDMsImV4cCI6MjA5Nzg4NDA0M30.XtorrrWsaUIeIbKJKjCgSphuYP1q3Tm0SlSn2Z0UkgY';

  // 获取当前登录用户
  const { data: { session } } = await fetch(`${SUPABASE_URL}/auth/v1/session`, {
    headers: { 'apikey': ANON_KEY }
  }).then(() => {
    // 使用 supabase client（如果页面已加载）
    if (window.supabase) return window.supabase.auth.getSession();
    throw new Error('请在 Submission Hub 页面打开控制台');
  }).catch(() => {
    throw new Error('请先登录 Submission Hub');
  });

  if (!session?.user) {
    console.error('❌ 未检测到登录状态，请先登录');
    return;
  }

  const userId = session.user.id;
  console.log('✅ 当前用户 ID:', userId);

  // 原始数据
  const oldPapers = [
    {
      id: "mnob1rn2arwz5",
      title: "Landslide Susceptibility Assessment in the Altai Mountains, Xinjiang, China: Integrating Multi-Source Conditioning Factors and Interpretable Machine Learning",
      title_zh: "基于多源因子与可解释机器学习的新疆阿尔泰山地区斜坡地质灾害易发性评价",
      journal: "Geomatics, Natural Hazards and Risk",
      status: "under_review",
      lang: "en",
      quartile_jcr: "Q1",
      quartile_cas: "二区",
      quartile_new: "二区",
      quartile_cust: "无",
      quartile_zh: ["", "", "", ""],
      authors: ["刘智奇", "张紫昭", "陈凯", "黄芃", "陈砺锋", "鹿晓伟", "王阔奥"],
      submitted_date: "2026-01-06",
      resolve_date: null,
      deadline: "2026-05-10",
      tracking_url: "https://rp.tandfonline.com/dashboard/",
      timeline: "2026-01-06 Submitted\n2026-01-14 With Editor\n2026-01-28 Out for Review\n2026-04-05 Decision Pending\n2026/04/12 Major Revision\n2026/05/10 Revision Submitted",
      notes: "",
      prev_id: null,
      files: [{ n: "中文第一次提交定稿.docx", p: "D:\\Ollama\\data\\submit_attachments\\中文第一次提交定稿.docx" }],
    },
    {
      id: "mnob6pnpsvra6",
      title: "Correlation analysis and prediction models for loess compressibility in Ili region, Xinjiang",
      title_zh: "新疆伊犁地区黄土压缩性相关性及预测模型",
      journal: "PLoS One",
      status: "accepted",
      lang: "en",
      quartile_jcr: "Q2",
      quartile_cas: "三区",
      quartile_new: "三区",
      quartile_cust: "无",
      quartile_zh: ["", "", "", ""],
      authors: ["刘智奇", "陈砺锋", "陈凯", "张紫昭", "常金雨"],
      submitted_date: "2025-11-27",
      resolve_date: "2026-03-09",
      deadline: null,
      tracking_url: "https://www.editorialmanager.com/pone/default2.aspx",
      timeline: "2025-11-27 Submitted\n2026-03-09 Accepted",
      notes: "",
      prev_id: "mnocbrqpb12qf",
      files: [
        { n: "见刊论文", p: "journal.pone.0345028_1.pdf" },
        { n: "检索证明", p: "刘智奇-SCI-2038472747314352132.PDF" }
      ],
    },
    {
      id: "mnocbrqpb12qf",
      title: "Correlation analysis and prediction models for loess compressibility in Ili region, Xinjiang",
      title_zh: "新疆伊犁地区黄土压缩性相关性及预测模型",
      journal: "Scientific Reports",
      status: "withdrawn",
      lang: "en",
      quartile_jcr: "Q1",
      quartile_cas: "三区",
      quartile_new: "三区",
      quartile_cust: "无",
      quartile_zh: ["", "", "", ""],
      authors: ["刘智奇", "陈砺锋", "陈凯", "张紫昭", "常金雨"],
      submitted_date: "2025-06-07",
      resolve_date: "2025-11-28",
      deadline: null,
      tracking_url: "",
      timeline: "2025-06-07 Submitted\n2025-11-28 Withdrawn",
      notes: "",
      prev_id: null,
      files: [],
    },
    {
      id: "mnudmt1b1ftmm",
      title: "基于AHP-INF模型的吉木乃县地质灾害风险评价研究",
      title_zh: "",
      journal: "新疆地质",
      status: "accepted",
      lang: "zh",
      quartile_jcr: "未定",
      quartile_cas: "未定",
      quartile_new: "无",
      quartile_cust: "无",
      quartile_zh: ["CSCD扩展", "", "", ""],
      authors: ["刘智奇", "陈凯", "张紫昭", "常金雨", "陈砺锋", "赵萌萌", "黄宇航", "鹿晓伟", "黄芃"],
      submitted_date: "2024-11-19",
      resolve_date: "2025-04-28",
      deadline: null,
      tracking_url: "",
      timeline: "2024/11/19 Submitted\n2025/04/28 Accepted",
      notes: "",
      prev_id: null,
      files: [{ n: "见刊论文", p: "基于AHP-INF模型的吉木乃县地质灾害风险评价研究.pdf" }],
    },
    {
      id: "mnobn11bp3aqs",
      title: "Susceptibility assessment of Geohazards in the Kunlun Mountain region of Xinjiang, China, based on the analytic hierarchy process and information quantity model",
      title_zh: "基于AHP-INF模型的新疆昆仑山地区地质灾害易发性评价研究",
      journal: "Earth Surface Processes and Landforms",
      status: "accepted",
      lang: "en",
      quartile_jcr: "未定",
      quartile_cas: "未定",
      quartile_new: "无",
      quartile_cust: "无",
      quartile_zh: ["", "", "", ""],
      authors: ["刘智奇", "陈凯", "陈砺锋", "张紫昭", "常金雨"],
      submitted_date: "2024-10-13",
      resolve_date: "2025-06-08",
      deadline: null,
      tracking_url: "",
      timeline: "2024-10-13 Submitted\n2024-11-08 Major Revision\n2025-02-17 Revision Submitted\n2025-04-17 Minor Revision\n2025-04-23 Revision Submitted\n2025-06-08 Accepted",
      notes: "",
      prev_id: "mnockdn9hy7gv",
      files: [
        { n: "见刊论文", p: "Susceptibility assessment of Geohazards in the Kunlun Mountain region.pdf" },
        { n: "检索证明", p: "刘智奇 佐证材料-SCI三区论文检索证明.jpg" },
        { n: "中文定稿版", p: "[昆仑山中文]基于AHP-INF模型的新疆昆仑山地区地质灾害易发性评价研究.docx" }
      ],
    },
    {
      id: "mnockdn9hy7gv",
      title: "Susceptibility assessment of Geohazards in the Kunlun Mountain region of Xinjiang, China, based on the analytic hierarchy process and information quantity model",
      title_zh: "基于AHP-INF模型的新疆昆仑山地区地质灾害易发性评价研究",
      journal: "Geomatics, Natural Hazards and Risk",
      status: "rejected",
      lang: "en",
      quartile_jcr: "未定",
      quartile_cas: "未定",
      quartile_new: "无",
      quartile_cust: "无",
      quartile_zh: ["", "", "", ""],
      authors: ["刘智奇", "陈凯", "陈砺锋", "张紫昭", "常金雨"],
      submitted_date: "2024-06-11",
      resolve_date: "2024-10-12",
      deadline: null,
      tracking_url: "",
      timeline: "2024-06-11 Submitted\n2024-06-22 With Editor\n2024-07-02 Out for Review\n2024-08-26 Decision Pending\n2024-08-26 Major Revision\n2024-09-12 Revision Submitted\n2024-09-13 With Editor\n2024-09-20 Out for Review\n2024-10-10 Decision Pending\n2024-10-12 Rejected",
      notes: "",
      prev_id: null,
      files: [],
    }
  ];

  // 生成确定性 UUID（基于旧 ID 映射）
  const idMap = {};
  oldPapers.forEach(p => { idMap[p.id] = crypto.randomUUID(); });

  const now = new Date().toISOString();
  const rows = oldPapers.map(p => ({
    id: idMap[p.id],
    user_id: userId,
    title: p.title,
    title_zh: p.title_zh || null,
    journal: p.journal || null,
    status: p.status,
    lang: p.lang || 'en',
    quartile_jcr: p.quartile_jcr || '未定',
    quartile_cas: p.quartile_cas || '未定',
    quartile_new: p.quartile_new || '无',
    quartile_cust: p.quartile_cust || '无',
    quartile_zh: (p.quartile_zh || []).filter(Boolean),
    authors: p.authors || [],
    submitted_date: p.submitted_date || null,
    resolve_date: p.resolve_date || null,
    deadline: p.deadline || null,
    tracking_url: p.tracking_url || null,
    timeline: p.timeline || '',
    notes: p.notes || '',
    prev_id: p.prev_id ? idMap[p.prev_id] || null : null,
    files: JSON.stringify((p.files || []).filter(f => f.n)),
    created_at: now,
    updated_at: now,
  }));

  // 插入数据
  const res = await fetch(`${SUPABASE_URL}/rest/v1/papers`, {
    method: 'POST',
    headers: {
      'apikey': ANON_KEY,
      'Authorization': `Bearer ${session.access_token}`,
      'Content-Type': 'application/json',
      'Prefer': 'return=representation',
    },
    body: JSON.stringify(rows),
  });

  if (res.ok) {
    console.log(`✅ 成功迁移 ${rows.length} 篇论文！`);
    rows.forEach(r => console.log(`  • ${r.title.slice(0, 60)}... [${r.status}]`));
    console.log('🔄 刷新页面即可看到数据');
    location.reload();
  } else {
    const err = await res.json();
    console.error('❌ 迁移失败:', err);
  }
})();
