# Submission Hub

> 学术投稿与成果管理平台 — 独立部署版

[![Deploy](https://img.shields.io/github/actions/workflow/status/Qi-i/submission-hub/deploy.yml?label=Deploy&logo=github)](https://github.com/Qi-i/submission-hub/actions)
[![Live Demo](https://img.shields.io/badge/Live-Demo-brightgreen?logo=vercel)](https://qi-i.github.io/submission-hub/)
[![License](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

Submission Hub 是一款面向科研人员的论文投稿追踪管理工具。支持从投稿准备到录用/拒稿的全生命周期管理，提供期刊分区查询、审稿时间线追踪、多作者协作等功能。

---

## 功能特性

### 投稿全生命周期管理
覆盖 7 种投稿状态：准备中 → 已投稿 → 审稿中 → 修改 → 录用 / 拒稿 / 撤稿。每篇论文可记录投稿日期、审稿截止日、投稿系统链接等完整信息。

### 期刊分区体系
内置 JCR 分区（Q1–Q4）、中科院分区（一区–四区）、新锐分区、中文分区（CSSCI / CSCD 等）以及自定义分类，满足不同学科的评价标准。

### 审稿时间线
以可视化时间线展示每篇论文的审稿历程，包括投稿、编辑初审、外审、修回、录用等关键节点，方便回溯和复盘。

### 版本关联
支持论文版本链追踪——被拒后转投其他期刊的记录可自动关联，清晰展示一篇论文从投稿到最终发表的完整路径。

### 数据导入/导出
支持 JSON 格式的批量导入导出，方便从其他工具迁移或做数据备份。

### 多用户 & 数据隔离
基于 Supabase 的身份认证系统，支持 GitHub OAuth 和邮箱注册。RLS（行级安全）策略确保每位用户只能看到自己的数据，绝不公开。

---

## 技术架构

| 层级 | 技术 |
|------|------|
| 前端 | React 18 + TypeScript + Vite |
| 样式 | 纯 CSS（暗色学术主题 + 多彩状态色） |
| 后端 | Supabase（PostgreSQL + Auth + Storage） |
| 认证 | GitHub OAuth / 邮箱密码 |
| 部署 | GitHub Pages + GitHub Actions |
| 安全 | Row Level Security (RLS)，数据完全私有 |

---

## 快速开始

### 本地开发

```bash
# 克隆仓库
git clone https://github.com/Qi-i/submission-hub.git
cd submission-hub

# 安装依赖
npm install

# 配置环境变量
cp .env.example .env
# 编辑 .env，填入你的 Supabase 项目 URL 和 Anon Key

# 启动开发服务器
npm run dev
```

### 环境变量

创建 `.env` 文件，配置以下内容：

```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

### 部署到 GitHub Pages

1. Fork 本仓库
2. 在仓库 Settings > Pages 中，将 Source 设为 **GitHub Actions**
3. 推送代码到 `main` 分支，GitHub Actions 会自动构建和部署
4. 访问 `https://<your-username>.github.io/submission-hub/`

### Supabase 配置

1. 在 [Supabase](https://supabase.com) 创建新项目
2. 在 SQL Editor 中运行 `supabase/001_init.sql` 创建表结构和 RLS 策略
3. 在 Authentication > Providers 中启用 GitHub，填入你的 GitHub OAuth App 的 Client ID 和 Secret
4. 在 Authentication > URL Configuration 中，将 Site URL 设为你的部署地址
5. 将 Supabase 项目 URL 和 Anon Key 填入 `.env`

---

## 项目结构

```
submission-hub/
├── src/
│   ├── components/
│   │   ├── Dashboard.tsx      # 主面板（论文列表、搜索、筛选）
│   │   ├── Login.tsx          # 登录/注册页面
│   │   ├── PaperCard.tsx      # 论文卡片组件
│   │   ├── PaperForm.tsx      # 论文编辑表单
│   │   └── Timeline.tsx       # 审稿时间线组件
│   ├── lib/
│   │   ├── auth.tsx           # 认证上下文（GitHub OAuth + 邮箱）
│   │   ├── supabase.ts        # Supabase 客户端
│   │   └── types.ts           # 类型定义和常量
│   ├── App.tsx                # 应用入口
│   ├── main.tsx               # React 挂载点
│   └── index.css              # 全局样式（暗色学术主题）
├── supabase/
│   └── 001_init.sql           # 数据库迁移（表 + RLS + 索引）
├── scripts/
│   └── migrate-aistudio.js    # AIStudio 数据迁移脚本
├── .github/
│   └── workflows/
│       └── deploy.yml         # GitHub Pages 自动部署
├── vite.config.ts
└── package.json
```

---

## 数据来源

本项目的前身是 [AIStudio](https://github.com/Qi-i/AIStudio)（科研工作站）中的投稿管理模块。原模块基于 localStorage + SQLite 存储，数据无法跨设备同步。Submission Hub 将其独立为 Web 应用，迁移至 Supabase 云端数据库，实现多端访问和数据安全。

---

## 隐私与安全

- 所有数据存储在 Supabase PostgreSQL 数据库中
- 启用 Row Level Security (RLS)，每个用户只能访问自己的论文数据
- 文件存储使用私有 bucket，仅用户本人可读写
- 不会公开展示任何用户的投稿信息
- 支持数据导出，你随时可以下载自己的完整数据

---

## 开发说明

### 设计系统
采用暗色学术风格设计，以深蓝黑为底色，青色为主色调，7 种投稿状态各有专属颜色标识。所有样式通过 CSS 自定义属性实现主题化。

### TypeScript 注意事项
由于 Supabase 客户端在 TypeScript 5.9+ 下存在类型推断问题，本项目使用 `LooseDatabase` 类型（`Record<string, any>`）绕过。在执行 `.update()` 操作时，需要将 `supabase.from('table')` 转换为 `any`：

```typescript
const { error } = await ((supabase.from('papers') as any).update(data)).eq('id', id)
```

---

## License

MIT
