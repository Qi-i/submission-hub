import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8')
const ui=read('src/components/AcademicMailCenter.tsx')
const settings=read('src/components/MailPersonalization.tsx')
const cfg=read('supabase/functions/mail-config/index.ts')
const oauth=read('supabase/functions/mail-outlook-oauth/index.ts')
const collector=read('supabase/functions/mail-cloud-collector/index.ts')
const cron=read('supabase/038_mail_due_only_cron.sql')
const sql=read('supabase/036_mail_gpt_on_demand.sql')
const realtime=read('supabase/037_mail_realtime_inserts.sql')
const tests=[
 ['NetEase 126 IMAP declares client identity before mailbox access',collector.includes("imap.cmd('ID (\"name\" \"Submission Hub\"")&&cfg.includes('A003 ID (')&&cfg.includes('A004 EXAMINE "INBOX"')],
 ['Mailbox settings open in a secondary dialog',ui.includes('detailAccountId')&&ui.includes('am-account-overview')&&ui.includes('am-account-dialog')&&ui.includes('am-account-summary')],
 ['Mail archive reports missing folders instead of false successful sync',collector.includes('openedFolders===0')&&collector.includes('advertisedMessages>0&&foundUids===0')],
 ['Mail archive strips null bytes before PostgreSQL index insert',collector.includes('replaceAll(String.fromCharCode(0)')&&collector.includes('Mail index save failed (DB ')],
 ['No repeated focus/60-second polling', !ui.includes('window.setInterval(')&&!ui.includes("addEventListener('focus',onReturn)")&&ui.includes('visibilitychange')],
 ['New mail triggers one debounced UI refresh',ui.includes("event:'INSERT'")&&ui.includes('postgres_changes')&&realtime.includes('alter publication supabase_realtime add table public.mail_messages')],
 ['CUGB official student mailbox can be selected',ui.includes('imap.email.cugb.edu.cn')&&ui.includes('smtp.email.cugb.edu.cn')&&cfg.includes("domain==='email.cugb.edu.cn'")],
 ['CUGB connection error distinguishes DNS/TLS/auth failures',cfg.includes('域名解析失败')&&cfg.includes('TLS 握手')&&cfg.includes('服务器拒绝账号认证')],
 ['Microsoft login no longer foregrounds Azure developer portal',ui.includes('<details className="am-oauth-help">')&&oauth.includes('MAIL_MICROSOFT_CLIENT_ID')],
 ['No misleading automatic model enablement',settings.includes('后台 AI 定时分析已停用')&&!settings.includes('onUpdate({ai_enabled:e.target.checked')],
 ['IMAP UID queries are serialized on a single connection',!collector.includes('Promise.all([\n      searchIds')&&collector.includes("searches.push(await searchIds('UID '+(savedRecent+1)+':*'))")],
 ['Historical cursor uses only successfully archived UIDs',collector.includes('const processedOld:number[]=[]')&&collector.includes('const processedNew:number[]=[]')&&collector.includes('Math.min(...processedOld)')&&collector.includes('Math.max(recent,...processedNew,0)')],
 ['Interrupted batches persist progress without skipping pending mail',collector.includes("if(!completed)break")&&collector.indexOf('if(!completed)break')>collector.indexOf("if(save.error)throw new Error('Scan cursor update failed')")],
 ['Empty historical UID ranges are marked complete',collector.includes("p_folder_key:key,p_recent:savedRecent,p_before:0")],
 ['IMAP incremental check avoids repeated SEARCH ALL',collector.includes("searches.push(await searchIds('UID '+(savedRecent+1)+':*'))")&&collector.includes('if(savedBefore>1)searches.push(await searchIds')&&collector.includes("else searches.push(await searchIds('ALL'))")],
 ['Scheduled collector skips mailboxes in backoff',cron.includes('next_attempt_at <= now()')],
 ['Shared Microsoft application takes precedence',oauth.includes('managedId||body.client_id||account.oauth_client_id')],
 ['AI worker cron is removed without affecting collection cron',sql.includes("cron.unschedule('submission_hub_mail_free_ai_10min')")&&!sql.includes("cron.unschedule('submission_hub_cloud_mail_10min')")]
]
for(const [name,passed] of tests)assert.ok(passed,'Mail on-demand regression: '+name)
console.log('Mail on-demand/CUGB contracts: '+tests.length+' passed')
