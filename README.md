# Submission Hub

<p align="center">
  <img src="public/logo.svg" alt="Submission Hub Logo" width="96" height="96" />
</p>

<p align="center">
  <strong>Submission Hub</strong><br />
  学术投稿、审稿时间线、版本链与成果归档管理平台
</p>

<p align="center">
  <a href="https://qi-i.github.io/submission-hub/">在线使用</a> ·
  <a href="https://github.com/Qi-i/submission-hub/releases">Release</a>
</p>

## 项目定位

Submission Hub 是一个面向科研论文投稿流程的轻量管理工具，用于集中记录论文从准备、投稿、审稿、修回、接收、拒稿、改投到成果归档的全过程。系统重点服务于个人或课题组的投稿进度管理、审稿周期追踪、版本链梳理和个人投稿统计。

## 设计语言

Submission Hub 采用白色与浅灰为基础背景，蓝色到紫色渐变作为主强调色，界面使用玻璃态卡片、圆角胶囊、轻阴影和高对比度文字层级。Logo 采用“文档 + 折角 + hub 节点”的图形语言，表达投稿材料、审稿流程和成果关联。

## 核心功能

- **投稿记录管理**：记录准备中、已投稿、审稿中、修回中、已接收、被拒、已撤稿等状态。
- **审稿时间线**：记录 Submitted、With Editor、Out for Review、Decision Pending、Revision 等节点。
- **距今自动统计**：仍在审稿流程中时，自动显示最后一次状态更新到今天的间隔，以及首投至今的累计天数。
- **自动状态推断**：根据时间线最后一条记录推断主状态和下一步行动。
- **版本链追踪**：支持被拒、撤稿、改投后的前后版本关联。
- **期刊档案复用**：复用历史期刊系统、官网、APC 和备注信息。
- **成果归档**：记录 DOI、见刊链接、卷期页码和引用格式。
- **个人投稿统计**：统计投稿总数、接收率、拒稿率、审稿周期、进行中周期、期刊分布等投稿相关指标。
- **作者身份识别**：识别本人、一作、通讯作者，并用于个人统计。
- **JSON 导入 / 导出**：支持数据备份和迁移。
- **离线版本**：提供单文件 HTML 版本，数据存储在本地浏览器。

## 技术栈

- **前端**：React 18 + TypeScript + Vite
- **数据服务**：Supabase（PostgreSQL + Auth）
- **统计图表**：Recharts
- **图标与交互**：Lucide React + CSS Design System
- **部署**：GitHub Pages + GitHub Actions
- **离线构建**：vite-plugin-singlefile

## 项目结构

```text
src/
├── components/
│   ├── Dashboard.tsx             # 在线版主界面
│   ├── OfflineDashboard.tsx      # 离线版主界面
│   ├── Login.tsx                 # 登录与演示入口
│   ├── PaperCardEnhanced.tsx     # 投稿卡片
│   ├── PaperFormArchive.tsx      # 新增/编辑投稿记录表单
│   ├── Timeline.tsx              # 审稿时间线
│   ├── PersonalStatsStable.tsx   # 个人投稿统计
│   └── AdminPanel.tsx            # 后台管理
├── lib/
│   ├── supabase.ts               # Supabase 客户端
│   ├── auth.tsx                  # 认证上下文
│   ├── theme.tsx                 # 主题上下文
│   ├── types.ts                  # 类型、状态、推断规则
│   ├── local-store.ts            # 离线版 localStorage 数据层
│   └── demo-data.ts              # 演示数据
├── main.tsx                      # 在线版入口
└── offline.tsx                   # 离线版入口

public/
├── logo.svg                      # 官方 Logo
└── favicon.svg                   # 浏览器图标

supabase/
├── 001_init.sql
├── 002_author_identity.sql
└── 006_publication_archive_fields.sql
```

## 本地运行

```bash
npm install
npm run dev
```

需要配置 `.env`：

```env
VITE_SUPABASE_URL=你的 Supabase 项目 URL
VITE_SUPABASE_ANON_KEY=你的 Supabase 匿名 key
```

构建在线版：

```bash
npm run build
```

构建离线版：

```bash
npm run build:offline
```

## Supabase 数据库设置

在 Supabase SQL Editor 中依次运行迁移文件：

1. `supabase/001_init.sql`：创建数据表和 RLS 策略。
2. `supabase/002_author_identity.sql`：添加作者身份字段。
3. `supabase/006_publication_archive_fields.sql`：添加 DOI、见刊信息、引用格式和期刊档案字段。

需要在 Supabase Authentication 中配置 GitHub OAuth Provider，并将 Site URL 设置为部署站点地址。

## GitHub Pages 部署

仓库已配置 GitHub Actions。推送到 `main` 分支后会自动执行：

```bash
npm install
npm run build
```

构建成功后发布到 GitHub Pages。

## Version

当前代码版本：`v1.1.0`

本版本包含界面设计统一、Logo 更新、投稿卡片布局修复、审稿时间线“距今”统计、个人统计页重构、成果归档字段和 GitHub Pages 部署修复。

## License

MIT
