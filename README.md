# Submission Hub

<p align="center">
  <img src="public/logo.svg" alt="Submission Hub Logo" width="108" height="108" />
</p>

<p align="center">
  <strong>Submission Hub</strong><br />
  🧭 学术投稿 · ⏱️ 审稿时间线 · 🔁 版本链 · 📚 成果归档
</p>

<p align="center">
  <a href="https://qi-i.github.io/submission-hub/">🌐 在线使用</a> ·
  <a href="https://github.com/Qi-i/submission-hub/releases">📦 离线版下载</a> ·
  <a href="CHANGELOG.md">📝 更新日志</a>
</p>

<p align="center">
  <img alt="Version" src="https://img.shields.io/badge/version-v1.1.0-8b5cf6?style=for-the-badge" />
  <img alt="React" src="https://img.shields.io/badge/React-18-61dafb?style=for-the-badge&logo=react&logoColor=white" />
  <img alt="TypeScript" src="https://img.shields.io/badge/TypeScript-5.x-3178c6?style=for-the-badge&logo=typescript&logoColor=white" />
  <img alt="Supabase" src="https://img.shields.io/badge/Supabase-Online-3ecf8e?style=for-the-badge&logo=supabase&logoColor=white" />
</p>

## ✨ 概述

Submission Hub 是一个面向科研论文投稿流程的轻量管理工具，用于记录论文从准备、投稿、审稿、修回、接收、拒稿、改投到成果归档的全过程。

它分为两种形态：

| 版本 | 使用场景 | 数据位置 | 核心特点 |
|---|---|---|---|
| 🌐 在线版 | 多设备、长期维护、云端同步 | Supabase | 登录认证、云端保存、跨设备访问 |
| 📦 离线版 | 单机使用、临时记录、本地备份 | 浏览器本地存储 | 单 HTML 文件、无需服务器、不连接 Supabase |

## 🖼️ 界面预览

### 🔐 登录页面

![登录页面](docs/screenshots/login-page.png)

### 📄 投稿管理

![投稿管理](docs/screenshots/dashboard-papers.png)

### 📊 个人统计

![个人统计](docs/screenshots/statistics-page.png)

## 🚀 功能亮点

| 模块 | 功能 |
|---|---|
| 📌 投稿状态 | 准备中、已投稿、审稿中、修回中、已接收、被拒、已撤稿 |
| ⏱️ 审稿时间线 | 记录 Submitted、With Editor、Out for Review、Decision Pending、Revision 等节点 |
| 📅 距今统计 | 自动计算最后一次状态更新距今天数和首投累计天数 |
| 🔁 版本链 | 支持拒稿、撤稿、改投后的前后版本关联 |
| 📚 成果归档 | 记录 DOI、见刊链接、卷期页码和引用格式 |
| 🏛️ 期刊档案 | 保存期刊官网、投稿系统、APC 和备注信息 |
| 👥 作者身份 | 识别本人、一作、通讯作者，并用于个人统计 |
| 📊 统计分析 | 投稿数量、接收率、拒稿率、审稿周期、期刊分布等指标 |
| 💾 数据备份 | 支持 JSON 导入、导出和迁移 |

## 🌐 在线版

在线版入口：

```text
https://qi-i.github.io/submission-hub/
```

在线版依赖 Supabase，适合正式使用。它支持注册登录、云端保存、跨设备访问和多人维护。

## 📦 离线版

离线版在 GitHub Releases 中发布，附件文件名为：

```text
submission-hub-offline.html
```

下载后直接用浏览器打开即可使用。离线版不连接 Supabase，不提供登录和云同步，所有数据保存在浏览器本地存储中。

## 🧑‍💻 本地开发

安装依赖：

```bash
npm install
```

启动开发环境：

```bash
npm run dev
```

构建在线版：

```bash
npm run build
```

构建离线版：

```bash
npm run build:offline
```

离线版构建产物位于：

```text
dist-offline/offline.html
```

## 🔑 环境变量

在线版需要配置 Supabase：

```env
VITE_SUPABASE_URL=你的 Supabase 项目 URL
VITE_SUPABASE_ANON_KEY=你的 Supabase 匿名 key
```

离线版不需要 Supabase 环境变量。

## 🧱 技术栈

| 类别 | 技术 |
|---|---|
| 前端框架 | React 18 |
| 开发语言 | TypeScript |
| 构建工具 | Vite |
| 云端服务 | Supabase |
| 图表 | Recharts |
| 图标 | Lucide React |
| 离线构建 | vite-plugin-singlefile |
| 部署 | GitHub Pages + GitHub Actions |

## 📁 主要目录

```text
src/
├── components/
│   ├── Dashboard.tsx          # 在线版主界面
│   ├── OfflineDashboard.tsx   # 离线版主界面
│   ├── Login.tsx              # 登录页面
│   ├── PaperCard.tsx          # 投稿卡片
│   ├── PaperForm.tsx          # 投稿记录表单
│   ├── Timeline.tsx           # 审稿时间线
│   ├── PersonalStats.tsx      # 个人统计
│   └── AdminPanel.tsx         # 后台管理
├── lib/
│   ├── supabase.ts            # Supabase 客户端
│   ├── auth.tsx               # 认证上下文
│   ├── theme.tsx              # 主题上下文
│   ├── types.ts               # 类型、状态和推断规则
│   ├── local-store.ts         # 离线版本地存储
│   └── demo-data.ts           # 演示数据
├── main.tsx                   # 在线版入口
└── offline.tsx                # 离线版入口

public/
├── logo.svg
└── favicon.svg
```

## 🚢 发布

| 发布对象 | Workflow | 输出 |
|---|---|---|
| 🌐 在线版 | `Deploy to GitHub Pages` | GitHub Pages 站点 |
| 📦 离线版 | `Release Offline HTML` | `submission-hub-offline.html` Release 附件 |

## 🏷️ 版本

当前版本：`v1.1.0`

完整变更见 [CHANGELOG.md](CHANGELOG.md)。

## 📄 License

MIT
