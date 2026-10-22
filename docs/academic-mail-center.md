# 邮件聚合 · 在线使用与运维说明

「邮件聚合」是独立于投稿管理的主菜单，不是投稿管理二级页面。Web 使用完整页面宽度，界面采用 Submission Hub 共用的 Luminous/Luminous X 样式，适配移动设备。配置与分类偏好存储在 Supabase，可直接调整，**不需要重新构建前端**。

## 添加与管理邮箱

邮箱与同步 → 添加邮箱 → 配置收发信。支持新疆大学教工/学生、中国地质大学（北京）等 Coremail、QQ、126 以及其他开放 IMAP 的邮箱。Gmail 与 Outlook/Hotmail 的邮箱客户端 OAuth2 仍需独立实现；ChatGPT 连接 Gmail 不会自动同步到本数据库。

IMAP（收信/全部文件夹）：SSL/TLS 993 或 STARTTLS 143。SMTP（发信）：SSL/TLS 465 或 STARTTLS 587。网页登录可分别修改 IMAP/SMTP 主机、端口、加密方式和登录名；服务器必须具有可信 TLS 证书。禁止不加密传输、直连 IP 地址或内部域名。出于防止 SSRF 的要求，服务端在连接前检验域名解析地址，阻断私有/保留 IP。使用自定义域名时，需由用户确认域名属于真实邮件服务商。

「自动发现」尝试服务商预设、邮箱域名候选与 DNS SRV 记录，**返回候选不代表已经通过连接验证**。保存后点击「测试连接」，后端分别检查 IMAP TLS 登录和 SMTP TLS 登录，后者不会发送邮件；只有 IMAP 认证通过的账户才启用云端采集。SMTP 测试不通过不会自动发送任何测试信。现阶段使用同一客户端密码或授权码为 IMAP/SMTP 登录；如两边独立授权码，需使用服务商统一客户端授权码。

既有配置再次修改时授权码可留空，沿用 Vault 中已保存的凭据。不要在 GitHub Issues、聊天、README 或网页 URL 中提交密钥。支持网页撰写和回复**纯文本**邮件，发送前需确认；暂不支持复杂的 HTML 编辑、附件发信、Gmail/Outlook OAuth2。

## 归档、搜索与分析

Supabase Cron 每 10 分钟依次检查已验证的邮箱。采集使用只读 IMAP EXAMINE / BODY.PEEK[]，不会标记已读、删除、移动原邮件；原始 EML 写入私有 Storage `mail-originals`，便于保全服务器定期清空的垃圾邮箱。Web 支持多邮箱全文检索、筛选、阅读原文与手工调整投稿关联。大型 EML （超过 8 MiB）暂不能完整归档，应另行在邮箱提供商原生界面下载保存。容量及配额以 Supabase 实际套餐为准。

在「自定义与 AI」中可新建/重命名/排序/移除快捷视图、紧凑显示、保存用户自己的分类方式。默认的审稿邀请不占固定一级模块，可通过检索或临时快捷入口查看；AI 识别的邮件分类另存为 `ai_category`，不覆盖手工分类。

## 模型 API、测试与自动调用

默认内置 Z.AI `glm-4.7-flash` / `glm-4.5-flash`。已保存的 GLM Key 可在 Web 点击「测试 GLM 连接」；测试会发一个简短的模型提示词，不包含邮箱内容，**可能消耗少量模型额度**。返回有效的 OpenAI 风格 `choices` 才算成功。

自定义模型采用标准 OpenAI Chat Completions 兼容接口（完整 HTTPS `/chat/completions` URL）、模型 ID、昵称及独立加密 Key，可在网站上多账户新增、编辑、删除和逐个测试。不支持未经适配的 Anthropic 或其他非 OpenAI 风格私有协议。删除自定义接口时，服务端删除 Vault 密钥。服务端限制为有效公网 HTTPS、443 端口、可信证书及不跟随跳转，禁止访问内网、IP 或元数据接口。

系统指令可在网页编辑和保存，用户写的分析要求只在固定安全约束之下生效。AI 返回 summary、tags、priority、action、category 后写入邮件索引，原始邮件和已手动编辑的分类保持不变。自动分析**默认关闭**，仅在用户配置凭据、选择模型且主动开启时执行；默认只处理开启后收到的新邮件。每天最多 50 次（用户可以设 0、5、10、20、30、50），后台每轮至多四封邮件。启用「分析历史邮件」后才会回填既有数据。

默认 Flash 不会回退到收费模型；自定义模型若未标明免费则必须在模型级和用户设置中进行两次明确的费用许可。服务商“免费”的实际额度、收费策略会变化；免费声明不构成零费用保证。未经单位允许，不应将敏感学校邮件内容发送给第三方模型服务商。

## 权限与运行

- 邮箱密码、AI Key 存于 Supabase Vault；只能由授权的服务端 Edge Function 访问，不能在 GitHub 仓库、浏览器或公开数据库直接读取。
- 账户、邮件索引、模型信息采用逐用户 Supabase RLS；邮件原文保存在私有 Storage。
- 所有关键 Edge Function 要求用户 JWT 或仅限后台 cron 内部密钥。Cron 查询只在存在可处理邮箱/邮件时调用函数，尽量减少空转。
- AI 输出只作为不可信建议，不执行邮件指令、不自动发送邮件或修改稿件状态。
- Gmail/Outlook OAuth2 尚未接通；真实 IMAP/SMTP 登录、收发与 GLM 模型测试须在用户自己的网页登录态和授权下执行，不能由仓库静态构建代替。

## 配套实现

数据库迁移 `012` 至 `024`；云端 Edge Functions 包括 `mail-config`、`mail-cloud-collector`、`mail-send`、`mail-ai-settings`、`mail-ai-analyze`；React 页面 `AcademicMailCenter` 和 `MailPersonalization`。检查命令 `npm run verify`，新增架构审查已并入现有 `npm run check:mail-center`（独立运行：`node tests/mail-first-principles-contract.mjs`）。

当前在线版保持 `v2.1.0`，此后对邮件模块的修复不会自动创建 GitHub Release 或额外安装包。
