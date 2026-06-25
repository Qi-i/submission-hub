# Submission Hub

学术投稿与成果管理平台 — 独立部署版

在线访问：[https://qi-i.github.io/submission-hub/](https://qi-i.github.io/submission-hub/)

## 功能特性

- 论文全生命周期管理：准备中 → 已投稿 → 审稿中 → 修回中 → 已接收 / 被拒 / 已撤稿
- 支持中英文论文，JCR / 中科院 / 自定义分区标注
- 审稿时间线可视化记录
- 修回倒计时提醒
- 版本链追踪（改投后关联前次投稿）
- 文件上传与归档（支持 Cloudflare R2 云存储）
- 个人统计面板：状态分布、时间趋势、分区统计、作者贡献图
- 后台管理面板（管理员专属）：用户管理、论文统计、密码重置
- JSON 导入/导出，支持数据迁移
- 浅色 / 深色 / 跟随系统主题切换
- 访客演示模式：无需注册即可体验全部功能
- 多用户隔离，数据安全

## 技术架构

- **前端**：React 18 + TypeScript + Vite
- **样式**：纯 CSS，浅色/深色双主题
- **后端**：Supabase（PostgreSQL + Auth + Edge Functions）
- **文件存储**：Cloudflare R2（可选，通过 Edge Function 签发预签名 URL）
- **认证**：GitHub OAuth + 邮箱/密码
- **部署**：GitHub Pages（GitHub Actions 自动构建）
- **统计图表**：Recharts

## 项目结构

```
src/
├── components/
│   ├── Dashboard.tsx      # 主面板：标签页导航、搜索过滤、统计栏
│   ├── Login.tsx          # 登录/注册页面（含演示入口）
│   ├── PaperCard.tsx      # 论文卡片展示
│   ├── PaperForm.tsx      # 论文新增/编辑表单（含文件上传）
│   ├── Timeline.tsx       # 审稿时间线组件
│   ├── PersonalStats.tsx  # 个人统计图表
│   └── AdminPanel.tsx     # 后台管理面板
├── lib/
│   ├── supabase.ts        # Supabase 客户端
│   ├── auth.tsx           # 认证上下文（含演示模式）
│   ├── theme.tsx          # 主题上下文（浅色/深色/系统）
│   ├── types.ts           # 类型定义与常量
│   ├── storage.ts         # R2 文件上传封装
│   └── demo-data.ts       # 演示模式示例数据
supabase/
├── migrations/
│   └── 001_init.sql       # 数据库初始化（表 + RLS 策略）
└── functions/
    ├── admin-stats/       # 管理员统计 Edge Function
    ├── reset-password/    # 管理员重置密码 Edge Function
    └── r2-upload/         # R2 文件上传签名 Edge Function
```

## 本地运行

```bash
npm install
npm run dev
```

需要配置 `.env` 文件：

```
VITE_SUPABASE_URL=你的supabase项目URL
VITE_SUPABASE_ANON_KEY=你的supabase匿名key
```

## Supabase 数据库设置

在 Supabase SQL Editor 中运行 `supabase/migrations/001_init.sql`，创建数据表和 RLS 策略。

需要在 Supabase Authentication 中配置 GitHub OAuth Provider，并将 Site URL 设置为 `https://qi-i.github.io`。

## 文件存储配置（可选）

默认情况下，文件上传只保存文件名占位符。如需真正的云存储，可配置 Cloudflare R2：

1. 登录 [Cloudflare Dashboard](https://dash.cloudflare.com/) → R2 对象存储
2. 创建 bucket（如 `submission-hub`），设置公开访问或绑定自定义域名
3. 创建 API Token（Object Read & Write 权限），获取 `Access Key ID` 和 `Secret Access Key`
4. 记录你的 Account ID（Dashboard 首页可见）
5. 配置 R2 bucket 的 CORS 策略，允许来源 `https://qi-i.github.io`，允许方法 `PUT, GET`
6. 在 Supabase Edge Functions → Secrets 中添加：
   - `R2_ACCOUNT_ID`
   - `R2_ACCESS_KEY_ID`
   - `R2_SECRET_ACCESS_KEY`
   - `R2_BUCKET_NAME`（默认 `submission-hub`）
   - `R2_PUBLIC_URL`（R2 公开域名或自定义域名）
7. 部署 Edge Function：`supabase functions deploy r2-upload --no-verify-jwt`

配置完成后，用户在论文表单中上传文件时会自动通过 R2 存储，论文卡片上的文件图标可直接点击下载。

未配置 R2 时，文件上传仍可使用（保存文件名），但无法在线下载。

## GitHub Pages 部署

仓库已配置 GitHub Actions，推送到 `main` 分支自动构建部署。工作流文件位于 `.github/workflows/deploy.yml`。

## License

MIT
