# 共享 AI 模型库与任务路由
Web 端统一保存接口、模型、授权与优先级，Android 使用同一 Submission Hub 账号读取云端配置，不下发 Key。支持 Chat Completions、Anthropic Messages、OpenAI Responses、Gemini GenerateContent，含各协议图片输入。
- 公共默认线路沿用现有 mail_preferences 字段；mail_translation、mail_analysis、ledger_text、ledger_vision 可继承或独立设置最多六条有序路线。独立空路线禁用该任务；不隐式回退公共方案。
- 模型记录独立保存，文本及视觉分别验证。新配置版本绑定 Vault 凭据，改变接口、协议、模型、认证或计费后重新授权。翻译永远只用标记免费线路；自动备用只用免费线路，付费手动账单识别需接口许可、任务许可和本次许可，付费分析沿用双重许可。
- ledger-ai-recognize 只接收用户主动选择的文字或图片，使用当前账号的任务配置并返回 transactions 草稿，不写财务数据库，不保存原始账单、不返回 Key。最多5万字、6张图、单张3 MiB、合计6 MiB；返回最多50项。
- 原有 GLM 路由、旧 Chat Completions 行和 Vault 密钥兼容保留。切换任务配置不会自动启用后台任务。现有邮件分析调度策略保持不变。
## 部署依赖
先备份并在测试数据库执行 supabase/044_mail_ai_protocols.sql，核对现有迁移001–043；再同批部署 mail-ai-settings、mail-ai-analyze、mail-translate、mail-model-probe、ledger-ai-recognize 及共享适配器；最后发布 Web、QiHub Android 和中继。修改前后的 Web 配置写入不可混用。未在生产执行迁移或真实模型测试；公网 DNS 预检查不等同于连接层 DNS 固定，需线上验证出站限制。
本地 Web 构建、邮件契约、6项协议及任务策略测试通过。
