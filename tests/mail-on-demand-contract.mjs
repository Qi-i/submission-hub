import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8')
const ui=read('src/components/AcademicMailCenter.tsx')
const settings=read('src/components/MailPersonalization.tsx')
const cfg=read('supabase/functions/mail-config/index.ts')
const oauth=read('supabase/functions/mail-outlook-oauth/index.ts')
const sql=read('supabase/036_mail_gpt_on_demand.sql')
const tests=[
 ['No 60-second mail UI polling', !ui.includes('window.setInterval(')&&ui.includes('visibilitychange')],
 ['CUGB official student mailbox can be selected',ui.includes('www.email.cugb.edu.cn')&&cfg.includes("domain==='email.cugb.edu.cn'")],
 ['CUGB connection error distinguishes DNS failure',cfg.includes('服务器域名无法解析')],
 ['Microsoft login no longer foregrounds Azure developer portal',ui.includes('<details className="am-oauth-help">')&&oauth.includes('MAIL_MICROSOFT_CLIENT_ID')],
 ['No misleading automatic model enablement',settings.includes('后台 AI 定时分析已停用')&&!settings.includes('onUpdate({ai_enabled:e.target.checked')],
 ['AI worker cron is removed without affecting collection cron',sql.includes("cron.unschedule('submission_hub_mail_free_ai_10min')")&&!sql.includes("cron.unschedule('submission_hub_cloud_mail_10min')")]
]
for(const [name,passed] of tests)assert.ok(passed,'Mail on-demand regression: '+name)
console.log('Mail on-demand/CUGB contracts: '+tests.length+' passed')
