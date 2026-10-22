import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8')
const ui=read('src/components/AcademicMailCenter.tsx')
const settings=read('src/components/MailPersonalization.tsx')
const cfg=read('supabase/functions/mail-config/index.ts')
const oauth=read('supabase/functions/mail-outlook-oauth/index.ts')
const sql=read('supabase/036_mail_gpt_on_demand.sql')
const realtime=read('supabase/037_mail_realtime_inserts.sql')
const tests=[
 ['No repeated focus/60-second polling', !ui.includes('window.setInterval(')&&!ui.includes("addEventListener('focus',onReturn)")&&ui.includes('visibilitychange')],
 ['New mail triggers one debounced UI refresh',ui.includes("event:'INSERT'")&&ui.includes('postgres_changes')&&realtime.includes('alter publication supabase_realtime add table public.mail_messages')],
 ['CUGB official student mailbox can be selected',ui.includes('imap.email.cugb.edu.cn')&&ui.includes('smtp.email.cugb.edu.cn')&&cfg.includes("domain==='email.cugb.edu.cn'")],
 ['CUGB connection error distinguishes DNS/TLS/auth failures',cfg.includes('域名解析失败')&&cfg.includes('TLS 握手')&&cfg.includes('服务器拒绝账号认证')],
 ['Microsoft login no longer foregrounds Azure developer portal',ui.includes('<details className="am-oauth-help">')&&oauth.includes('MAIL_MICROSOFT_CLIENT_ID')],
 ['No misleading automatic model enablement',settings.includes('后台 AI 定时分析已停用')&&!settings.includes('onUpdate({ai_enabled:e.target.checked')],
 ['AI worker cron is removed without affecting collection cron',sql.includes("cron.unschedule('submission_hub_mail_free_ai_10min')")&&!sql.includes("cron.unschedule('submission_hub_cloud_mail_10min')")]
]
for(const [name,passed] of tests)assert.ok(passed,'Mail on-demand regression: '+name)
console.log('Mail on-demand/CUGB contracts: '+tests.length+' passed')
