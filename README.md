# Submission Hub

<p align="center">
  <img src="public/logo.svg" alt="Submission Hub Logo" width="108" height="108" />
</p>

<p align="center">
  <img src="public/wordmark.svg" alt="Submission Hub" width="460" />
</p>

<p align="center">
  💡 选题准备 · 🏛️ 期刊决策 · ✍️ 草稿管理 · 🧭 投稿跟踪 · 📚 成果归档
</p>

<p align="center">
  <a href="https://qi-i.github.io/submission-hub/">🌐 在线使用</a> ·
  <a href="https://github.com/Qi-i/submission-hub/releases/latest">📦 离线版下载</a> ·
  <a href="#interfaces">🖼️ 双界面预览</a> ·
  <a href="#usage">📘 使用方法</a> ·
  <a href="docs/releases/v2.0.0.md">📋 v2.0.0 更新说明</a>
</p>

<p align="center">
  <img alt="Version" src="https://img.shields.io/badge/version-v2.0.0-8b5cf6?style=for-the-badge" />
  <img alt="React" src="https://img.shields.io/badge/React-18-61dafb?style=for-the-badge&logo=react&logoColor=white" />
  <img alt="TypeScript" src="https://img.shields.io/badge/TypeScript-5.x-3178c6?style=for-the-badge&logo=typescript&logoColor=white" />
  <img alt="Supabase" src="https://img.shields.io/badge/Supabase-Online-3ecf8e?style=for-the-badge&logo=supabase&logoColor=white" />
</p>

## 项目定位

Submission Hub 用于管理科研论文从选题到见刊的完整过程：

**研究选题 → 草稿准备 → 目标期刊筛选 → 投稿材料检查 → 正式投稿 → 审稿与修回 → 改投 → 录用与成果归档**

| 版本 | 数据位置 | 使用方式 |
|---|---|---|
| 在线版 | Supabase 云端 | GitHub 或邮箱登录，多设备同步，私有附件存储 |
| 离线版 | 当前浏览器本地存储 | 下载单 HTML 文件，直接打开，手动导入导出备份 |

v2.0.0 的一级主菜单统一为：

**投稿管理 → 期刊中心 → 投稿准备 → 个人统计 → 后台管理**

<a id="interfaces"></a>

## 双界面

Luminous 与 Luminous X 使用同一套数据、功能和业务逻辑。界面切换按钮位于页面右侧边缘，选择结果保存在账户偏好中。

| 界面 | 布局特点 | 适用方式 |
|---|---|---|
| **Luminous** | 顶部导航、横向页面结构、信息密度紧凑 | 传统网页操作习惯，快速切换五个主模块 |
| **Luminous X** | 固定左侧栏、顶部状态控制区、工作流视图更突出 | 长时间管理多篇稿件，强调状态扫描与集中操作 |

两套界面的主菜单顺序、页面语义、按钮状态和核心操作保持一致；具体空间结构分别遵循顶部导航与固定侧栏的布局特点。

所有桌面截图统一使用 **1440 × 900** 画布并按单张通栏展示；移动端截图使用 **390 × 700** 画布并单独展示。

### Luminous

#### 投稿管理

![Luminous 投稿管理](docs/screenshots/luminous-dashboard.png)

#### 投稿准备

![Luminous 投稿准备](docs/screenshots/luminous-preparation.png)

#### 期刊中心

![Luminous 期刊中心](docs/screenshots/luminous-journals.png)

#### 个人统计

![Luminous 个人统计](docs/screenshots/luminous-statistics.png)

### Luminous X

#### 投稿管理

![Luminous X 投稿管理](docs/screenshots/luminous-x-dashboard.png)

#### 投稿准备

![Luminous X 投稿准备](docs/screenshots/luminous-x-preparation.png)

#### 期刊中心

![Luminous X 期刊中心](docs/screenshots/luminous-x-journals.png)

#### 个人统计

![Luminous X 个人统计](docs/screenshots/luminous-x-statistics.png)

### 其他界面

#### 暗色模式

![Luminous X 暗色模式](docs/screenshots/luminous-x-dark.png)

#### 投稿记录编辑

![投稿记录编辑](docs/screenshots/luminous-x-editor.png)

#### 期刊资料与公开审稿指标

![期刊资料与公开审稿指标](docs/screenshots/luminous-x-review-lookup.png)

#### 移动端

<p align="center">
  <img src="docs/screenshots/luminous-x-mobile.png" alt="Luminous X 移动端" width="300" />
</p>

> 所有文档截图由自动视觉测试使用虚构数据生成，不包含真实用户、论文题名、稿件编号、邮箱或附件内容。

<a id="usage"></a>

## 使用方法

### 在线版快速开始

1. 打开 <https://qi-i.github.io/submission-hub/>。
2. 使用 GitHub 或邮箱登录。
3. 在页面右侧边缘选择 **Luminous** 或 **Luminous X**，再选择亮色或暗色。
4. 打开“投稿准备”，从选题池建立研究选题。
5. 将选题转为草稿，补充摘要、提纲、作者、图表、参考文献和投稿前检查项。
6. 打开一级“期刊中心”，建立目标期刊档案，填写中文名、缩写、简介翻译、分区、OA、APC、审稿周期、选刊标签和备注。
7. 返回“投稿准备 → 期刊比较”，并列核对质量、费用、速度、收录和风险信息，确定主投期刊。
8. 正式投出后将草稿转入投稿管理，系统建立 Submitted 时间线并回写草稿状态。
9. 每次状态变化都在投稿记录中新增时间线节点，并更新后台原始状态、截止日期、附件和下一步。
10. 录用后填写 DOI、见刊链接、卷期页码和引用格式，归档录用通知、校样、检索证明和见刊文件。

### 离线版快速开始

1. 打开 <https://github.com/Qi-i/submission-hub/releases/latest>。
2. 下载 `submission-hub-offline.html`。
3. 用 Chrome、Edge 或 Firefox 打开文件。
4. 在离线工作区建立投稿、期刊、选题和草稿记录。
5. 定期使用“导出备份”保存 JSON 文件。
6. 在其他浏览器中使用“导入备份”恢复全部数据。

### 日常维护顺序

| 阶段 | 主要页面 | 记录内容 |
|---|---|---|
| 选题论证 | 投稿准备 → 选题池 | 研究问题、文献缺口、创新点、数据、方法和计划节点 |
| 论文写作 | 投稿准备 → 草稿准备 | 摘要、提纲、作者、字数、图表、参考文献、协作链接和检查项 |
| 期刊建档 | 期刊中心 | 双语期刊资料、分区、收录、OA、APC、速度、标签、来源和风险 |
| 期刊决策 | 投稿准备 → 期刊比较 | 并列比较候选期刊并确定主投与备选顺序 |
| 正式投稿 | 投稿管理 | 投稿日期、稿件编号、后台状态、期刊入口和投稿文件 |
| 审稿修回 | 投稿管理 → 时间线 | 外审节点、轮次耗时、决定日期、修回截止、回复信和修回稿 |
| 录用见刊 | 投稿管理 → 成果归档 | DOI、出版链接、卷期页码、引用格式和归档文件 |

## 核心功能

| 模块 | 功能 |
|---|---|
| 研究选题池 | 记录研究问题、文献缺口、创新点、方法、数据来源和计划节点，并进行多维评分 |
| 草稿准备 | 管理摘要、提纲、作者、字数、图表、参考文献、计划投稿日期和协作链接 |
| 投稿就绪度 | 综合检查摘要、作者、主投期刊、写作进度和投稿材料，生成阻碍项与下一步 |
| 期刊中心 | 管理全部期刊档案，并按重点期刊、投稿自动收录和手动记录分类筛选 |
| 自动期刊档案 | 从投稿历史生成简易期刊记录，按规范化名称聚合并允许后续补全 |
| 双语期刊资料 | 保存英文名、中文名、缩写、英文简介、中文简介翻译、选刊标签和选刊备注 |
| 卡片外显 | 独立控制 EasyScholar 标签；中文名优先显示，缩写按简洁识别原则显示 |
| 审稿指标读取 | 从公开页面读取首轮决定、投稿至接收周期和接收率，并保存来源地址 |
| 期刊比较 | 并列比较四本期刊的质量、费用、速度、开放获取、收录、双语资料和风险信息 |
| 投稿管理 | 工作流、看板和按期刊三种视图统一管理主状态、后台原文、作者、时长和下一步 |
| 后台快捷操作 | 状态和显式按钮优先打开稿件专属后台，缺失时回退到期刊通用投稿入口 |
| 期刊悬浮详情 | 支持悬停、键盘聚焦、固定、关闭、跳转期刊中心和直接编辑期刊档案 |
| 审稿时间线 | 自动排序中英文状态节点，计算节点间隔、累计天数和最后更新距今 |
| 轮次与区间分析 | 识别每轮返意见耗时，并支持任意两条时间线事件的自定义间隔分析 |
| 私有附件 | R2 主存储与 Supabase Storage 回退存储共同完成上传、预览、替换、删除和清理 |
| 成果归档 | 管理 DOI、见刊链接、卷期页码、引用格式、检索证明和见刊文件 |
| 账户资料 | GitHub 与邮箱身份关联，显示名、头像、界面、主题和引导状态同步 |
| 项目与反馈 | 从页面工具区进入 GitHub 仓库、标准化 Bug 报告和功能建议表单 |
| 完整备份 | v3 JSON 同时包含投稿、期刊、选题和草稿，并兼容旧版备份 |

## v2.0.0 更新

- 将期刊中心提升为唯一一级入口，统一五个主模块的信息架构。
- 完成 Luminous 与 Luminous X 的主菜单、工具区、新增操作和项目反馈交互统一。
- 修复普通视图投稿准备二级菜单错位、跨列、覆盖层拦截和无法返回总览的问题。
- 将期刊中心升级为完整档案库，增加稳定分类筛选、自动入库、紧凑卡片和标准顶栏间距。
- 优化投稿卡片的期刊身份、主状态、出版社、稿件后台和悬浮详情层级。
- 新增审稿轮次耗时和自定义时间线区间分析。
- 完善 2K、浏览器缩放、超宽屏、暗色和移动端响应式几何。
- 修复截图工作流可能回退版本号、Release 工作流硬编码旧版本的问题。
- 新增发布元数据一致性检查，并将自动期刊档案和附件生命周期纳入正式发布验证。

完整记录见 [docs/releases/v2.0.0.md](docs/releases/v2.0.0.md)。

## 本地开发

```bash
npm ci
npm run dev
```

构建与验证：

```bash
npm run build
npm run build:offline
npm run verify
```

`npm run verify` 依次执行发布元数据一致性、示例数据隐私、投稿历史自动期刊档案、期刊字段契约、卡片外显规则、附件生命周期、在线构建、离线构建和离线隔离检查。

## 在线部署

1. 在 Supabase SQL Editor 中按编号执行 `supabase/001` 至 `supabase/012`。
2. 部署 `admin-stats`、`reset-password`、`r2-upload` 和 `journal-rank` Edge Functions。
3. 在 GitHub Pages 环境中设置 `VITE_SUPABASE_URL`、`VITE_SUPABASE_ANON_KEY` 和 `VITE_ADMIN_ID`。
4. 在 Supabase Auth Redirect URLs 中登记 `https://qi-i.github.io/submission-hub/`。
5. 在 Supabase Edge Function Secrets 中设置 `EASYSCHOLAR_SECRET_KEY`。
6. GitHub Actions 完成构建、Pages 部署和线上 SHA 核验。

## 发布机制

- `package.json` 是版本号唯一来源。
- `public/release-info.json`、README 和 `docs/releases/vX.Y.Z.md` 必须与版本号一致。
- 合并版本号变更到 `main` 后，Release 工作流执行完整验证，生成 `submission-hub-offline.html` 并创建对应 GitHub Release。
- 文档截图工作流按当前版本同步 `package-lock.json`，不会再写入固定旧版本。

## 技术栈

React 18 · TypeScript · Vite · Supabase · Recharts · Lucide React · vite-plugin-singlefile · GitHub Pages · GitHub Actions · Playwright

## 版本

当前版本：`v2.0.0`

## License

MIT
