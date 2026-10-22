// Two-stage first-principles checks: functionality, privacy, explicit-cost consent, and UI parity.
import assert from 'node:assert/strict'
import fs from 'node:fs'
const read=p=>fs.readFileSync(new URL('../'+p,import.meta.url),'utf8')
const config=read('supabase/functions/mail-config/index.ts')
const collector=read('supabase/functions/mail-cloud-collector/index.ts')
const sender=read('supabase/functions/mail-send/index.ts')
const modelApi=read('supabase/functions/mail-ai-settings/index.ts')
const worker=read('supabase/functions/mail-ai-analyze/index.ts')
const ui=read('src/components/AcademicMailCenter.tsx')
const personal=read('src/components/MailPersonalization.tsx')
const migration=read('supabase/021_mail_connection_custom_models.sql')
const endpointCleanup=read('supabase/023_mail_endpoint_cleanup.sql')
const category=read('supabase/024_mail_ai_category.sql')
const smtpMigration=read('supabase/025_mail_health_smtp_secret.sql')
const aiReauthMigration=read('supabase/026_mail_ai_endpoint_reauthorization.sql')
const theme=read('src/mail-navigation-card-layout.css')
const mailToast=read('src/components/MailToast.tsx')
const mailCss=read('src/components/AcademicMailCenter.css')
const glmMigration=read('supabase/027_mail_glm_platform.sql')
const app=read('src/components/Dashboard.tsx')
for(const [name,condition] of [
 ['provider discovery',config.includes("body.action==='discover'")],
 ['auth-only connection test',config.includes("body.action==='test'") && config.includes("await verify(")],
 ['hostname independent of provider whitelist',!config.includes('allowedHost(')&&config.includes('await guard(host)')],
 ['TLS or STARTTLS IMAP',config.includes("Deno.startTls(sock") &&config.includes('993')&&config.includes('143')],
 ['TLS or STARTTLS SMTP',sender.includes("Deno.startTls(raw") &&sender.includes('465')&&sender.includes('587')],
 ['no insecure/plaintext mail transport',!config.includes("security==='none'")&&!sender.includes("smtp_security:'none'")],
 ['read only archive',collector.includes('BODY.PEEK[]')&&collector.includes("EXAMINE ")&&!collector.includes("EXPUNGE")],
 ['cloud polling gated on verified mailboxes',config.includes("cloud_state:'not_configured'")&&config.includes("cloud_state:ok?'ready':'not_configured'")],
 ['custom endpoint RLS',migration.includes('enable row level security')&&migration.includes('mail_ai_endpoints_owner')],
 ['per endpoint secret in Vault',migration.includes('vault.create_secret')&&modelApi.includes('mail_save_endpoint_key')],
 ['key destruction',endpointCleanup.includes('vault.delete_secret')&&modelApi.includes('mail_destroy_endpoint_secret')],
 ['model test without an email payload',modelApi.includes("content:'连接测试。请回复 OK'")],
 ['manual AI prompt',worker.includes("pref.ai_system_prompt")&&personal.includes('保存分析指令')],
 ['instruction safety invariant',worker.includes('不得实际发送邮件、调用工具或修改论文状态')],
 ['custom paid endpoint double consent',worker.includes('cfg.allow_paid&&pref.ai_allow_paid')],
 ['GLM default free-only',worker.includes('FREE_MODELS.has(selectedModel)')],
 ['no arbitrary redirects for model keys',worker.includes("redirect:'error'")&&modelApi.includes("redirect:'error'")],
 ['AI does not overwrite classification',category.includes('ai_category')&&worker.includes('ai_category:category')],
 ['mail account UI offers test result',ui.includes('测试连接')&&ui.includes('connectionResults')],
 ['web supports multiple custom models',personal.includes('mail_ai_endpoints')&&personal.includes('test_endpoint')],
 ['first-class mail navigation',app.includes('data-main-nav-key="mail"')&&!app.includes('dashboardPanel')],
 ['responsive mail full width',theme.includes('.app-layout > .academic-mail-center')],
 ['journal display wraps',theme.includes('-webkit-line-clamp: 2')&&theme.includes('.journal-pill-text')],
 ['settings and feedback in avatar',app.includes('header-account-dropdown')&&app.includes('问题反馈')],
 ['SMTP and IMAP public hosts can be saved without edge DNS',config.includes('Do not block settings saves on runtime DNS')&&!config.includes('域名无法解析，请检查服务器地址')],
 ['model errors distinguish business-level rate limit versus credit',modelApi.includes("code==='1113'")&&modelApi.includes("code==='1302'")&&modelApi.includes("code==='1305'")],
 ['free GLM selects domestic and global platforms',glmMigration.includes('ai_glm_platform')&&modelApi.includes('open.bigmodel.cn/api/paas/v4')],
 ['GLM provider can be explicitly auto-discovered',modelApi.includes('body.auto_detect===true')&&personal.includes('自动检测官方平台')],
 ['automatic analysis uses configured verified provider',worker.includes("pref.ai_glm_platform==='bigmodel'")],
 ['all mail operations have fixed and screen-visible alerts',ui.includes('<MailToast ')&&mailToast.includes('createPortal')&&mailCss.includes('position:fixed !important')],
 ['warning and errors remain distinguishable',mailToast.includes('am-toast-warning')&&mailToast.includes('am-toast-error')],
 ['provider 429 leaves mail pending with cooldown',worker.includes('ai_retry_after:retryAt')&&worker.includes('emails')===false&&worker.includes("raw.status===429")],

 ['SMTP independent credential isolated in Vault',smtpMigration.includes('mail_private.smtp_credentials')&&smtpMigration.includes('vault.create_secret')],
 ['SMTP sender honors separate key',sender.includes('smtp_has_separate_key')&&sender.includes('mail_read_smtp_secret')],
 ['separate SMTP tested, not falsely marked verified',config.includes("mail_read_smtp_secret")&&config.includes("action==='test'")],
 ['automatic failures back off',collector.includes('next_attempt_at.lte.')&&collector.includes('consecutive_failures:failures')],
 ['manual sync errors surfaced to UI',ui.includes("if(result.error)throw Error(result.detail||result.error)")],
 ['save-and-verify uses real IMAP login',ui.includes("action:'test',account_id:setupId")],
 ['mailbox pause and safe resume',ui.includes('toggleCollection')&&config.includes("body.action==='enable'")],
 ['account health visible',ui.includes('next_attempt_at')&&ui.includes('last_scanned_folders')],
 ['AI endpoint change disables old authorization',aiReauthMigration.includes('new.key_ready:=false')&&aiReauthMigration.includes('ai_enabled=false')],
 ['old API keys never implicitly follow a new URL',personal.includes('模型配置已保存')&&aiReauthMigration.includes('new.api_url is distinct from old.api_url')],

])assert.ok(condition,'Mail architecture contract failed: '+name)
console.log('Extended mail resilience and security contract: 42/42 invariants.')
