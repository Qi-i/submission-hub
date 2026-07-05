# Submission Hub

<p align="center">
  <img src="public/logo.svg" alt="Submission Hub Logo" width="108" height="108" />
</p>

<p align="center">
  <img src="public/wordmark.svg" alt="Submission Hub" width="460" />
</p>

<p align="center">
  🧭 学术投稿 · ⏱️ 审稿时间线 · 🔁 版本链 · 📚 成果归档
</p>

<p align="center">
  <a href="https://qi-i.github.io/submission-hub/">🌐 在线使用</a> ·
  <a href="https://github.com/Qi-i/submission-hub/releases">📦 离线版下载</a> ·
  <a href="#preview">🖼️ 界面预览</a> ·
  <a href="#features">🚀 功能亮点</a> ·
  <a href="#dev">🧑‍💻 本地开发</a> ·
  <a href="#release">🚢 发布</a>
</p>

## ✨ 概述

Submission Hub 是一个面向科研论文投稿流程的轻量管理工具，用于记录论文从准备、投稿、审稿、修回、接收、拒稿、改投到成果归档的全过程。

| 版本 | 使用场景 | 数据位置 | 核心特点 |
|---|---|---|---|
| 🌐 在线版 | 多设备、长期维护、云端同步 | Supabase | 登录认证、云端保存、跨设备访问 |
| 📦 离线版 | 单机使用、临时记录、本地备份 | 浏览器本地存储 | 单 HTML 文件、无需服务器、不连接 Supabase |

<a id="preview"></a>

## 🖼️ 界面预览

### 🔐 登录页面

![登录页面](docs/screenshots/login-page.png)

### 📄 投稿管理

![投稿管理](docs/screenshots/dashboard-papers.png)

### 📊 个人统计

![个人统计](docs/screenshots/statistics-page.png)

<a id="features"></a>

## 🚀 功能亮点

| 模块 | 功能 |
|---|---|
| 📌 投稿状态 | 准备中、已投稿、审稿中、修回中、已接收、被拒、已撤稿 |
| ⏱️ 审稿时间线 | Submitted、With Editor、Out for Review、Decision Pending、Revision |
| 📅 距今统计 | 计算最后一次状态更新距今天数和首投累计天数 |
| 🔁 版本链 | 支持拒稿、撤稿、改投后的前后版本关联 |
| 📚 成果归档 | DOI、见刊链接、卷期页码和引用格式 |
| 🏛️ 期刊档案 | 期刊官网、投稿系统、APC 和备注信息 |
| 👥 作者身份 | 本人、一作、通讯作者识别 |
| 📊 统计分析 | 投稿数量、接收率、拒稿率、审稿周期、期刊分布 |
| 💾 数据备份 | JSON 导入、导出和迁移 |

<a id="online"></a>

## 🌐 在线版

在线版地址：<https://qi-i.github.io/submission-hub/>

在线版部署在 GitHub Pages，依赖 Supabase，支持注册登录、云端保存、跨设备访问和多人维护。

<a id="offline"></a>

## 📦 离线版

离线版下载：<https://github.com/Qi-i/submission-hub/releases>

离线版在 GitHub Releases 中发布，附件文件名为 `submission-hub-offline.html`。

下载后直接用浏览器打开即可使用。离线版不连接 Supabase，不提供登录和云同步，所有数据保存在浏览器本地存储中。

<a id="dev"></a>

## 🧑‍💻 本地开发

```bash
npm install
npm run dev
npm run build
npm run build:offline
```

## 🧱 技术栈

React 18 · TypeScript · Vite · Supabase · Recharts · Lucide React · vite-plugin-singlefile · GitHub Pages · GitHub Actions

<a id="release"></a>

## 🚢 发布

| 发布对象 | Workflow | 输出 |
|---|---|---|
| 🌐 在线版 | Deploy to GitHub Pages | GitHub Pages 站点 |
| 📦 离线版 | Release Offline HTML | Release 附件 |

## 🏷️ 版本

当前版本：v1.1.0

## 📄 License

MIT
