# 学术邮件中心：独立采集与 ChatGPT 直接检索

## 当前结构

- `投稿管理 → 学术邮件与审稿` 以当前 Supabase 登录身份读取邮件索引，支持邮箱/分类/主题与正文检索、审稿响应状态、投稿关联。
- `public.mail_accounts` 保存来源邮箱和同步状态；`public.mail_messages` 保存可检索正文、分类、来源和稿件关联；`public.mail_collector_keys` 只存随机令牌的 SHA-256 摘要。
- 邮箱密码、IMAP 授权码、OAuth access/refresh token **不进入数据库、网页、GitHub 仓库或 ChatGPT 对话**。
- `tools/mail_collector.py` 只读 IMAP，先将原始 EML 写入本地归档，再提交索引到已部署的 `/functions/v1/mail-ingest`。服务器删除的邮件**不会**触发本地同步删除。
- 邮件索引包含真实邮件内容，严格按 `auth.uid() = user_id` 启用 RLS；不公开、不作为演示数据。

## 首次部署

数据库迁移文件：`supabase/012_academic_mail_center.sql`。

Edge Function：`supabase/functions/mail-ingest/index.ts`。**Function 设置 `verify_jwt = false` 是有意的**，因采集客户端不持有用户登录 JWT；函数内部必须校验 256-bit 独立随机令牌及其 SHA-256 摘要，并用对应账户所有者身份写入。不要移除这段校验，也不要泄露服务器 secret。

在「学术邮件与审稿」中：

1. 添加邮箱账户（可以先添加新疆大学学生和教工、CUGB、126、QQ、Gmail、Outlook 等 7 个账户）。
2. 点击「生成采集令牌」，将唯一显示的一次性 64 位十六进制 token 存放在**本地**凭据管理器，绝不要发到聊天。
3. 每个账户点击「复制账户 ID」，填入**本地**采集配置文件。

本机准备：复制 `tools/mail_collector.example.json` 为 `tools/mail_collector.json`（此文件已在 .gitignore 中），填入真实邮箱地址、官方 IMAP 服务器、账户 ID 和用于读取密码/授权码的环境变量名。所有 Coremail 主机按各学校文档填写，不应猜测主机。普通密码/授权码仅通过环境变量获取。

配置环境变量 `MAIL_INGEST_TOKEN` 和 `MAIL_INGEST_URL`；不同邮箱按 `password_env` 设置各自环境变量。不要写在 JSON 文件或终端命令历史中。现有示例只示范两条账户，按相同结构追加所有账户。

本机首次先运行：

```powershell
python tools/mail_collector.py --config tools/mail_collector.json --dry-run
```

确认全部收件箱及垃圾箱已正确归档后，移除 `--dry-run` 执行上传。后续可在 Windows「任务计划程序」中设置每小时执行一次，最好在垃圾邮件周清理前至少每天成功运行一次。电脑关机期间不会采集。

`auth = "xoauth2"` 的邮箱需自行在本机提供已授权的短期 OAuth2 access token，`token_env` 指定环境变量，或 `oauth_token_command` 提供返回新 access token 的外部认证助手参数数组。**此仓库不代替 Google/Microsoft OAuth 授权，不支持把 ChatGPT 的 Gmail/Outlook 连接授权直接转给采集端**。实际接入 7 个邮箱须逐一授权。

## ChatGPT 直接查询

已连接的 Supabase 连接可以直接查询 Submission Hub 项目 `grrwxtlauqcfnerckijn` 的 `public.mail_messages`。例如（只读）：

```sql
select a.address, m.received_at, m.subject, m.sender_address,
       m.category, m.deadline, m.snippet, m.paper_id
from public.mail_messages m
join public.mail_accounts a on a.id=m.account_id
where m.category in ('review_invite','submission_update')
order by m.received_at desc
limit 100;
```

对于敏感学术内容，优先返回摘要和任务而不是全文公开展示。原始 EML 和所有附件不自动上传 Supabase；ChatGPT 只有索引数据库中已同步的正文可读，不能直接读取本机归档文件。若要查询附件，需要另建受控授权服务。

## 重要限制

- Gmail/Outlook 连接到 ChatGPT 只让 ChatGPT 直接搜索对应邮箱，不等于自动将它们归档进 Submission Hub。
- 采集器保持只读，**绝不能**使用服务器删除/移动邮件或向垃圾箱发送恢复指令。
- 规则式分类为候选，不等于真实审稿邀请；假冒编辑部邮件应结合发件域名、期刊官网和稿件平台核实。
- 采集服务须常在线才能应对垃圾邮件自动清理；建议本地磁盘启用 BitLocker 等加密与独立备份。
- 免费 Supabase 计划有数据库大小、Edge Function 执行次数及网络流量限制。对历史超大邮箱请分批同步并检查用量，不承诺永远零费用。
- 公开 GitHub 仓库不能存邮件内容、私人配置、密钥或具有真实身份的数据。
- 页面每 60 秒刷新一次，服务器端对完整索引执行筛选，每次最多显示 300 条结果；没有启用额外 AI API 付费分类功能。
