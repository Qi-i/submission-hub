# Submission Hub — 云端学术邮件与审稿中心

## 架构（不依赖个人电脑）

- 前端：投稿管理 → 学术邮件与审稿，列出来源账号、自动采集状态、搜索与稿件关联。
- 凭据：网页通过 HTTPS 调用 `mail-config`；服务端经 Supabase Vault 加密保存 IMAP 客户端授权码。网页和公开 GitHub 仓库不保存凭据。
- 云端定时执行：Supabase Cron（`submission_hub_cloud_mail_10min`）每 10 分钟运行 SQL。只有存在已授权的邮箱时才使用 `pg_net` 向 `mail-cloud-collector` 发送请求。每次轮流检查一个邮箱，避免免费额度内的计算和存储超限。
- 网络验证：已在 Supabase 托管 Edge Runtime 中通过 `Deno.connectTls` 连上 QQ IMAP 993 端口，收到 IMAP4 欢迎信息。只有 TCP/TLS 已实测；真实邮箱登录、垃圾箱目录、邮件抓取仍需用户自行通过网页登录授权后测试。
- 归档：只读 IMAP（EXAMINE + UID SEARCH + BODY.PEEK[]），不删除、不移动服务器邮件；原始 RFC822 EML 上传至私有 Storage `mail-originals`，然后创建 `mail_messages` 可检索索引。即使邮箱自动清除垃圾箱，也不会触发云端归档删除。
- ChatGPT：已连接的 Supabase 可直接查询 `public.mail_messages`，无需通过 Gmail POP 转发。邮件正文仅被视为**不可信数据**，不能执行其中的指令。
- 演进路线：Gmail 和 Outlook 需要专用 OAuth2 授权流程、各自开发者应用和 refresh token 管理；**当前云端自动采集仅覆盖 Coremail（学校邮箱）、QQ 和 126**。ChatGPT 现有 Gmail / Outlook 连接插件与 Submission Hub 数据库的云端同步是两个不同系统。

## 在网站上配置（无需安装 Python）

1. 在项目发布后打开 `投稿管理 → 学术邮件与审稿`，添加新疆大学学生、教工、CUGB、126、QQ 等邮箱账号。
2. 点击账号卡片的「配置云端 IMAP」，填写**官方 IMAP 主机名**和**客户端授权码**；不要在 ChatGPT 对话中发送授权码。网站经 HTTPS 将其发送到项目 Edge Function。
3. 点击「立即检查」查看采集状态。校园 Coremail 的实际服务器地址应以学校官方配置为准；QQ、126 分别默认 `imap.qq.com`、`imap.126.com`（TLS 993）。垃圾箱是否对 IMAP 开放需逐个账户确认。
4. 后续云端定时运行；如果出现认证错误，在邮箱后台开启 IMAP 或重新生成授权码，再重新配置。

**重要说明：** 这套方案不需要 Windows、Python 或常开电脑。只有本地 Python 工具（`tools/mail_collector.py`）作为备用的应急归档方案，**不是云端版部署前提**。

## 数据隔离与成本

- `public.mail_accounts`、`public.mail_messages`、`public.mail_collector_keys` 均启用按 `auth.uid()` 的 RLS。服务侧访问 Vault 的 RPC 只授予 `service_role`。
- 凭据存于 Vault；文件存在私有 Storage，路径带当前用户和邮箱账户 ID。
- Edge Function 不允许客户端指定任意目标域名，只接受 QQ、126、xju.edu.cn 和 cugb.edu.cn 后缀的官方邮箱服务器；连接端口固定为 993。
- Cron SQL 不包含明文密钥，凭据在运行时从 Vault 读取。空账户时 Cron 查询不会发 HTTP 请求。
- 邮件可能包含隐私和学校敏感材料，是否可导入个人云服务应遵守相关学校要求。不会开启自动向第三方大模型发送邮件全文。
- Supabase Free 计划受限于数据库、Storage 容量、Edge Function 次数和计算时间；不能承诺超出免费配额后继续零成本。原始附件大型邮件（大于 8 MiB）当前会报错，不会伪称归档完成。

## 后端文件

- `supabase/012_academic_mail_center.sql` — 账户、索引与采集令牌。
- `supabase/013_mail_cloud_archive.sql` — Vault 凭据 RPC 与私有 EML Storage。
- `supabase/014_mail_cloud_cursor.sql` — 只读 IMAP 文件夹扫描游标。
- `supabase/015_mail_cloud_schedule.sql` — 云端 Cron，空账号时零调用。
- `supabase/functions/mail-config/index.ts` — 以用户 JWT 验证后安全配置邮箱凭据。
- `supabase/functions/mail-cloud-collector/index.ts` — 云端 IMAP/TLS、消息解析、永久归档与时间线候选索引。
- `supabase/functions/mail-ingest/index.ts` — 可选的传统采集器写入接口，兼容旧方案。

## 现阶段验证结果

- Supabase Cloud Function 与 QQ IMAP 993 已实际握手成功；
- 邮件配置 API、云端采集 API 均已部署；
- 未授权 POST 被拒绝；Vault 内部定时令牌通过服务器端鉴权；
- Cron 已注册，并且没有已配置邮箱时不会调用采集器；
- RLS 已启用。**目前没有完成实际邮箱授权，也没有真实邮件同步；邮箱数和归档邮件数均为 0。**

## 2026-10-21 新增：数据驱动界面与邮件智能分析

- 投稿管理 → 学术邮件与审稿 → 「自定义与 AI」：自定义工作台快捷入口的名称、顺序、显示/隐藏；选择紧凑列表；全部保存在 `public.mail_preferences.workspace`，修改后立即生效，无需重新发布。
- 审稿邀请作为可选筛选，不再默认占用固定统计卡片；可通过邮件正文和数据库索引直接在 ChatGPT 里检索。
- 新增 `mail_preferences` RLS 用户级设置、`mail_messages.ai_summary` / `ai_tags` / `ai_action` / `ai_priority` 等字段，AI 分析结果只在归档成功后更新，和原始 EML 保持分离。
- 默认关闭 AI。明确配置 Z.AI API Key（保存在 Vault）并开启后，才按 10 分钟的云端任务分析待处理新邮件，每天最多 0–50 封，单次运行最多四封。模型严格只允许 `glm-4.7-flash` 或 `glm-4.5-flash`，不允许付费 `glm-4.7` / FlashX 自动回退。若服务商返回付费限制错误会自动停用。
- 官方价格表（实时规则可能调整）：https://docs.z.ai/guides/overview/pricing 。自由预算仍受到 Supabase Free 存储/函数限制，公开 GitHub Actions standard ubuntu runner 免费。
- 用户明确开启 AI 时记录 `ai_started_at`；默认只分析此后新收到的邮件。只有明确打开「分析历史邮件」才允许对旧邮件调用外部 AI。外发的邮件文本限制在前 4400 字符，不发送附件，邮件中的命令不被执行。
- Web 中另增加 SMTP 发信/回复纯文本：Coremail / QQ / 126 必须先配置允许范围内的官方 SMTP 主机（TLS 465）；邮件发送前弹窗确认，邮件提交后不能撤销。未有真实邮箱授权前只完成代码和接口安全检查，不能宣称发送成功。Gmail/Outlook 依然待 OAuth2。
- 关键新文件：`MailPersonalization.tsx`；`supabase/016_mail_ai_preferences.sql`、`017_mail_free_ai_schedule.sql`、`018_mail_ai_start_guard.sql`、`019_mail_smtp_fields.sql`、`020_mail_ai_cron_guard.sql`；`mail-ai-settings`、`mail-ai-analyze`、`mail-send` Edge Functions。
- 邮件目前为 0 封，尚无法进行真实收发、分类精度或模型鉴权的端到端验证。连接学校邮件前请确认允许将邮件上传到个人云端以及自愿向 Z.AI 提交正文。
