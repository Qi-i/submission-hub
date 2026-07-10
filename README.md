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
| ✅ 投稿待办中心 | 自动汇总逾期修回、临近截止、编辑处理偏久、外审周期偏长和待补见刊信息 |
| ⏱️ 审稿时间线 | Submitted、With Editor、Out for Review、Decision Pending、Revision 等节点 |
| 📅 距今统计 | 按本地日期计算最后一次状态更新距今天数和首投累计天数 |
| 🔁 版本链 | 支持拒稿、撤稿、改投后的前后版本关联，并阻止循环链 |
| 📚 成果归档 | DOI、见刊链接、卷期页码和引用格式 |
| 🏛️ 期刊档案 | 期刊官网、投稿系统、APC 和备注信息 |
| 👥 作者身份 | 本人、一作、通讯作者识别 |
| 📊 统计分析 | 投稿数量、已决接收率、已决拒稿率、审稿周期和期刊分布 |
| 💾 版本化备份 | 新版备份包含格式版本和导出时间，同时兼容旧版数组 JSON |
| 🔒 离线隔离检查 | 发布前自动确认离线 HTML 不包含 Supabase、R2 或外部脚本依赖 |

<a id="online"></a>

## 🌐 在线版

在线版地址：<https://qi-i.github.io/submission-hub/>

在线版部署在 GitHub Pages，使用 Supabase 提供注册登录、云端保存和跨设备访问。

部署前需要：

1. 在 Supabase SQL Editor 中按编号依次执行 `supabase/001` 至 `supabase/007` 迁移文件。
2. 部署 `admin-stats`、`reset-password` 和 `r2-upload` Edge Functions；不使用相应功能时可不部署 R2 上传函数。
3. 配置 GitHub Pages 环境变量 `VITE_SUPABASE_URL`、`VITE_SUPABASE_ANON_KEY` 和 `VITE_ADMIN_ID`。

<a id="offline"></a>

## 📦 离线版

离线版下载：<https://github.com/Qi-i/submission-hub/releases>

Release 附件文件名为 `submission-hub-offline.html`。下载后直接用浏览器打开即可使用。

离线版不包含登录、Supabase 云同步和 R2 上传。所有投稿数据与个人设置均保存在当前浏览器的本地存储中，建议定期使用“备份”按钮导出 JSON 文件。

<a id="dev"></a>

## 🧑‍💻 本地开发

```bash
npm install
npm run dev
```

分别构建在线版与离线版：

```bash
npm run build
npm run build:offline
```

执行完整验证：

```bash
npm run verify
```

`verify` 会依次完成在线版构建、离线版构建和离线包隔离检查。

## 🧱 技术栈

React 18 · TypeScript · Vite · Supabase · Recharts · Lucide React · vite-plugin-singlefile · GitHub Pages · GitHub Actions

<a id="release"></a>

## 🚢 发布

| 发布对象 | Workflow | 触发方式 | 输出 |
|---|---|---|---|
| 🌐 在线版 | Deploy to GitHub Pages | 应用代码变更后自动执行，也可手动运行 | GitHub Pages 站点 |
| 📦 离线版 | Release Offline HTML | 手动运行并填写版本标签 | `submission-hub-offline.html` |
| 🧪 质量检查 | Verify Online and Offline Builds | 应用代码变更和 Pull Request | 在线构建、离线构建与隔离检查 |

## 🏷️ 版本

当前版本：`v1.2.0`

## 📄 License

MIT
