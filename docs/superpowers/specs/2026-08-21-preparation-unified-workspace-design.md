# Submission Hub 投稿准备统一工作区重构设计

日期：2026-08-21

## 1. 目标

本轮重构不再为“投稿准备”或“科研组图”追加局部 CSS，而是从第一性原则重新定义投稿准备工作区的页面骨架、导航状态、组件边界、视觉语言与两套界面适配方式，使总览、论文准备、投稿材料、期刊匹配、投稿前检查、科研组图在功能、状态和视觉上属于同一套程序。

核心原则：

1. 同一功能只有一个真实实现。
2. 同一层级只有一种视觉语义。
3. Luminous 与 Luminous X 只能有布局差异，不能有功能、状态和交互逻辑差异。
4. 科研组图是通用工具，不属于任何一篇论文，也不能默认泄露或展示真实论文题名。
5. 数据合同冻结：现有 Supabase 投稿准备数据、投稿转入流程、Figure Composer 本地 IndexedDB 资源、布局与导出能力均保留。

## 2. 当前问题与根因

### 2.1 投稿准备内部存在多套 UI 语言

当前总览、论文准备、投稿材料、期刊匹配、投稿前检查分别由不同时期样式塑形；科研组图又维护独立 `--fc-*` 变量、按钮、输入框、面板、圆角与色彩。最终外观由多层 CSS 级联覆盖决定，而不是由一套明确设计合同决定。

### 2.2 Luminous X 使用 DOM 代理而非共享状态

当前 Luminous X 投稿准备控制条通过查找真实按钮、MutationObserver 和模拟 click 同步状态。这会导致两个视图在导航、激活态、响应式和新增功能时逐步漂移。

### 2.3 PreparationWorkspace 责任过重

当前组件同时承担数据归一化、筛选、路由、统计、五个业务页、隐藏子页、编辑器、组图入口和大量卡片渲染；PreparationWorkspaceSuite 又通过 DOM append/Portal/MutationObserver 注入额外模块。组件树不能直接表达最终页面结构。

### 2.4 科研组图被错误地绑定到真实草稿

当前 Figure Composer 以 `initialDraftId || drafts[0]?.id || null` 初始化，导致没有用户操作时也会自动关联第一篇真实草稿。工作台因此出现真实论文题名，破坏了通用工具边界。

### 2.5 `Figure 1` 被错误地当作工程身份

当前空工程通过 `figureDisplayName(role, sequence)` 自动命名为 `Figure 1`。投稿编号属于出版语义，不应成为新建组图工程的默认身份。

## 3. P0 不可违反约束

以下约束必须写入自动化测试，任何一条失败均不得合并。

### 3.1 科研组图必须彻底通用化

- 新建组图默认 `draftId = null`。
- 禁止自动选择 `drafts[0]` 或任何真实草稿。
- 工作台主标题、面包屑、状态栏、默认工程信息中禁止出现真实论文题名。
- “关联草稿”只能由用户主动选择。
- 关联成功后，论文题名只允许出现在明确的关联选择控件或管理列表中；不得作为工作台主标题或长期悬挂副标题。
- 草稿关联只用于工程管理、`figure_count` 统计与回到投稿准备时的上下文，不得决定组图 UI 身份。

### 3.2 工程身份与出版编号必须分离

- 新工程 `name` 默认：`未命名组图`。
- 主标题默认显示：`未命名组图`。
- 禁止新工程默认显示 `Figure 1`、`Supplementary Figure S1`。
- FigureProject 持久化模型继续保留现有 `name` 字段，明确把它定义为“工程名称”，避免破坏现有 IndexedDB 工程。
- FigureProject v2 新增可空 `publicationLabel: string | null`，用于 `Figure 1`、`Supplementary Figure S1` 等出版编号。
- 现有 `role` / `sequence` 保留为出版元数据，但不得再驱动新工程默认 `name`。
- `publicationLabel` 默认 `null`，必须由用户主动启用、选择或编辑。
- 旧 v1 工程若 `name = Figure N`，保持原名，不强制改写；加载时可从旧 `role/sequence` 推断 publicationLabel，但默认不把它提升为工作台身份。

### 3.3 进入科研组图后隐藏五个业务工作条

- `section === figures` 时，不渲染五个业务导航条。
- 工作台只保留 Submission Hub 全局主导航，以及组图内部统一上下文头：`投稿准备 / 科研组图`、返回入口、工程级操作。
- 进入 figures 前记录 `returnSection`；返回时恢复原业务页，而不是强制总览。

### 3.4 五个业务工作条统一布局与初始底色

业务导航固定为：

1. 总览
2. 论文准备
3. 投稿材料
4. 期刊匹配
5. 投稿前检查

每个按钮必须使用相同的三槽内部网格：

- 左槽：固定宽度图标区域。
- 中槽：固定居中的文字标签。
- 右槽：固定宽度计数/状态区域，即使无计数也保留占位。

因此“论文准备 2”“期刊匹配 12”不能把文字中心线挤偏。

非激活态也必须有稳定、低饱和度初始底色，不允许五个按钮全部白色：

- 总览：sky/cyan soft
- 论文准备：blue soft
- 投稿材料：violet soft
- 期刊匹配：magenta soft
- 投稿前检查：amber soft

激活态统一提升边框、亮度和局部光晕，不改变结构、字号、按钮高度或文字对齐。

## 4. 信息架构

投稿准备只保留一套真实路由状态：

`overview | paper | materials | match | check | figures`

历史内部 `topics | drafts | journals | compare` 不再作为一级工作区路由；应转为对应业务页内部局部状态、抽屉或二级内容。

层级：

- Submission Hub 全局主导航
  - 投稿准备
    - 总览
    - 论文准备
    - 投稿材料
    - 期刊匹配
    - 投稿前检查
    - 科研组图（工具入口，不占业务导航条）

## 5. 统一页面骨架

### 5.1 PreparationShell

所有普通业务页共享：

1. Workspace Header
   - 标题“投稿准备”
   - 一行简洁说明
   - 科研组图显著工具入口
   - 搜索 / 页面相关主操作
2. Business Navigation
   - 五个统一业务工作条
3. Page Header
   - 当前页标题
   - 当前页说明
   - 页面级主操作
4. Page Content
   - 使用统一 Panel / Card / EmptyState / Metric / Toolbar

页面切换只改变 Page Header 与 Page Content，不改变骨架几何。

### 5.2 科研组图工作台骨架

进入科研组图后：

- 隐藏普通 Workspace Header 中的搜索、收藏期刊、新建草稿等业务操作。
- 隐藏五个 Business Navigation 工作条。
- 使用统一工作台 Header：
  - 面包屑：`投稿准备 / 科研组图`
  - 返回投稿准备
  - 工程名称：默认 `未命名组图`
  - 工程操作：新建、保存、预检、导出
- 不显示真实论文题名。
- 不显示默认 Figure 1。

中央科学画布保持中性灰工作环境和白色 paper，这是功能性工作区；外围左栏、右栏、toolbar、input、select、badge、预检、按钮全部使用 Submission Hub 统一视觉 token。

## 6. 统一视觉系统

### 6.1 取消 Figure Composer 独立品牌色系统

Figure Composer 不再自建平行品牌体系。外围 UI 映射到统一 Preparation token：

- `--prep-surface`
- `--prep-surface-elevated`
- `--prep-surface-soft`
- `--prep-border`
- `--prep-border-strong`
- `--prep-text`
- `--prep-text-muted`
- `--prep-accent-cyan`
- `--prep-accent-blue`
- `--prep-accent-violet`
- `--prep-accent-magenta`
- `--prep-accent-amber`
- `--prep-radius-sm/md/lg`
- `--prep-shadow-soft/card`

这些 token 在 Luminous 与 Luminous X 中分别映射到现有全局 UI 变量，保证同品牌、不同布局。

### 6.2 色彩使用原则

- 不追求全白或全灰。
- 不通过大面积强渐变制造“另一套软件”。
- 导航、主要操作、选中态、预检状态、图层选中、导入区域使用主 UI 的 cyan → blue → violet → magenta 体系。
- 画布本体继续保持白色；外围工作区使用冷灰/蓝灰与低饱和品牌色。
- Luminous X 可增加更明显的边缘光、透明度和空间层次，但组件语义和尺寸不改变。

### 6.3 几何合同

统一：

- 页面左右边距
- 顶部标题高度
- 二级导航高度
- 卡片圆角
- 面板标题高度
- 表单高度
- 按钮高度
- 图标尺寸
- grid gap
- hover / focus / active 状态

禁止同一级组件在不同子页面拥有不同圆角、不同文字基线、不同按钮高度。

## 7. 组件架构

目标组件树：

- `PreparationWorkspaceController`
  - 数据、筛选、唯一 route state、编辑器状态、returnSection
- `PreparationShell`
  - 统一页面框架
- `PreparationNavigation`
  - 五个业务工作条，唯一真实导航
- `PreparationHeaderActions`
  - 科研组图、搜索、页面上下文操作
- `PreparationOverview`
- `PaperPreparationView`
- `SubmissionMaterialsView`
- `JournalMatchView`
- `PreflightView`
- `FigureComposerView`
  - `FigureWorkbenchHeader`
  - `FigureSidebar`
  - `FigureToolbar`
  - `FigureCanvas`
  - `FigureInspector`
  - `FigurePreflight`
  - `FigureExport`

共享 primitives：

- `PrepPanel`
- `PrepSectionHeader`
- `PrepActionButton`
- `PrepField`
- `PrepBadge`
- `PrepMetric`
- `PrepEmptyState`

## 8. 两套视图实现

### 8.1 Luminous

使用横向布局：Workspace Header + 五项横向业务导航 + 内容区。

### 8.2 Luminous X

保留左侧主控制轨和 X 的空间语言，但投稿准备内部直接消费同一个 React route state，不再通过 querySelector / MutationObserver / 模拟 click 代理真实按钮。

Luminous X 可以把 Preparation Header Actions 放到 X status 区，但必须是同一个 React 组件/同一组 props，而不是 DOM portal 找按钮再点击。

### 8.3 功能一致性

两视图必须共享：

- 同一导航顺序
- 同一页面内容
- 同一表单
- 同一 CRUD
- 同一科研组图工程
- 同一预检
- 同一导出
- 同一返回逻辑

只允许位置、宽度、背景层次、边缘光和响应式排列不同。

## 9. PreparationWorkspaceSuite 清理

当前通过 MutationObserver、appendChild、createPortal 动态注入“论文准备助手”和选题折叠/拖动控件的方式需要移除。

重构后这些模块直接进入 React 组件树：

- 顺序状态仍可保存在 localStorage。
- 拖动仍可保留。
- 折叠仍可保留。
- 不再动态创建 DOM 按钮和 host。

## 10. 科研组图数据边界与兼容

### 10.1 新工程

FigureProject v2 新工程：

- `draftId = null`
- `name = '未命名组图'`
- `publicationLabel = null`
- `title = ''`
- `caption = ''`
- `role = 'main'` 可作为隐式出版元数据保留，但不得显示为默认 Figure 编号。
- `sequence = 1` 可保留内部数值，但不得自动生成可见工程名。

### 10.2 主动关联草稿

用户可在“工程信息 > 关联”区域主动选择草稿。

关联后：

- 更新 `draftId`
- 保存时同步 figure_count
- 管理区可显示“已关联草稿”状态
- 只有用户展开关联选择器或工程管理列表时显示具体题名
- 主标题始终显示工程名称，不显示论文题名

解除关联后 `draftId = null`，不影响工程内容。

### 10.3 旧工程迁移

- IndexedDB v1 工程继续可加载。
- v1 `name = Figure N` 的旧工程保持原名。
- v1 缺少 `publicationLabel` 时，可从旧 role/sequence 推断 publicationLabel，但默认不把它提升为工作台标题。
- 保存为 v2 后补齐 `publicationLabel` 字段。
- 不删除旧工程资源，不改变图片 blob。

## 11. CSS 收口

不得再新建 `final-final-hotfix.css` 叠加覆盖。

目标结构：

- `src/styles/preparation/tokens.css`
- `src/styles/preparation/shell.css`
- `src/styles/preparation/components.css`
- `src/styles/preparation/workbench.css`
- `src/styles/preparation/luminous.css`
- `src/styles/preparation/luminous-x.css`
- `src/styles/preparation/responsive.css`

迁移完成后删除或停止加载被替代的 Preparation 专用 hotfix / nav balance / X override。全局非 Preparation 页面不做无关 CSS 清理。

## 12. 响应式与密度

重点视口：

- 1280 × 720
- 1440 × 900
- 1707 × 960（约等效 2560×1440 / 150%）
- 1920 × 1080
- 2560 × 1440

要求：

- 五个业务工作条无文字挤压、无对齐漂移。
- 计数存在与否不改变标签中心线。
- 科研组图工作台进入后五个工作条不可见。
- 三栏工作台优先保证中间画布空间。
- 右栏可在窄视口下转为底部 inspector，但不能遮挡画布。
- 无页面级横向 overflow。

## 13. 自动化测试门禁

### 13.1 通用组图语义

新建工作台必须断言：

- 不出现任意真实草稿题名。
- 不出现默认 `Figure 1`。
- 显示 `未命名组图`。
- `draftId === null`。
- `publicationLabel === null`。

### 13.2 导航合同

两视图分别断言：

- 五项业务导航顺序一致。
- 五项均有非透明初始底色。
- 内部 icon/label/count 使用相同 grid geometry。
- label 中心坐标误差在允许范围内。
- 进入 figures 后五项业务条不可见。
- 返回后恢复进入 figures 之前的业务页。

### 13.3 UI 几何

检查：Header 高度、nav 高度、button 高度、border-radius、gap、panel padding、表单高度、overflow。

### 13.4 科研组图交互

浏览器自动执行：

- 新建未命名工程
- 导入横图/竖图
- 2×2
- 4×4
- A|B/C
- span
- 比例锁定/自由尺寸
- 多选对齐/分布
- snapping
- 添加 `(a)` 标签
- 300/600/1200 DPI
- PNG/SVG 导出
- 保存/打开
- 主动关联草稿
- 解除关联
- 返回投稿准备

## 14. 多轮审查

至少五轮：

1. 架构与状态：单一实现、无投稿准备 DOM 代理。
2. 视觉系统：两视图、五子页、工作台统一。
3. 交互：导航、编辑、组图、返回、保存、导出。
4. 响应式与暗色：1280/1440/1707/1920/2560，light/dark。
5. 回归与发布：投稿管理、期刊中心、个人统计不受影响；CI 全绿；Pages SHA 精确验证。

## 15. 非目标

本轮不：

- 重构投稿管理核心数据结构。
- 重构期刊中心数据库。
- 改写 Figure Composer 科学布局算法，除非为 UI 状态解耦所必需。
- 删除已冻结 v2.0.1 offline release。
- 恢复任何新的 offline 构建链。

## 16. 最终验收标准

只有同时满足以下条件才能合并：

1. 投稿准备五个业务子页使用统一页面骨架与视觉 primitive。
2. 科研组图默认完全通用，不显示真实论文题名，不默认 Figure 1。
3. 科研组图进入后五个业务工作条隐藏，返回恢复原业务页。
4. 五个工作条非激活态有低饱和度区分色，所有文字/图标/计数几何一致。
5. Figure Composer 外围 UI 使用 Submission Hub token，与两个视图各自风格一致；中央画布保持专业中性环境。
6. Luminous 与 Luminous X 共享同一 React 状态和功能实现，不再使用 DOM proxy 同步投稿准备导航。
7. 所有核心功能、数据和导出能力保留。
8. 五轮审查通过，CI 全绿，Pages 在线 SHA 与 merge SHA 精确一致。