import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8')
const ui=read('src/components/AcademicMailCenter.tsx')
const settings=read('src/components/MailPersonalization.tsx')
const translator=read('supabase/functions/mail-translate/index.ts')
const chunkSchema=read('supabase/042_mail_resumable_translation.sql')
const cfg=read('supabase/functions/mail-config/index.ts')
const oauth=read('supabase/functions/mail-outlook-oauth/index.ts')
const collector=read('supabase/functions/mail-cloud-collector/index.ts')
const cron=read('supabase/038_mail_due_only_cron.sql')
const noRetry=read('supabase/039_mail_manual_error_recovery.sql')
const uiStyles=read('src/components/AcademicMailCenter.css')
const sql=read('supabase/036_mail_gpt_on_demand.sql')
const realtime=read('supabase/037_mail_realtime_inserts.sql')
const providerProbe=read('supabase/functions/mail-model-probe/index.ts')
const tests=[
 ['MagicZotero tests require secret cron token and an existing free account',
  providerProbe.includes("mail_check_cron_token")&&providerProbe.includes(".eq('declared_free',true)")&&
  providerProbe.includes(".eq('allow_paid',false)")&&providerProbe.includes("mail_read_endpoint_key")],
 ['MagicZotero diagnostics do not expose the API key or email contents',
  !providerProbe.includes('json?.choices?.[0]?.message?.content}')&&
  providerProbe.includes('synthetic=medium')&&providerProbe.includes("network_error:true")],
 ['Transient model network errors retry once without repeating HTTP 429',
  translator.includes('fetchWithConnectionRetry')&&translator.includes('await new Promise(resolve=>setTimeout(resolve,900))')&&
  !translator.includes('retry(429)')],
 ['Outlook manual connector imports are distinguished from Graph OAuth',
  ui.includes('ChatGPT 手动归档')&&ui.includes('网站自动同步尚未授权')],

 ['Translation opens automatically with Chinese target',ui.includes("else {setTranslationLang('zh');setTranslationVisible(true)}")&&ui.includes('if(translationVisible&&active)void runTranslation()')],
 ['Switching translation language cancels old result',ui.includes('[selected,translationLang,translationVisible]')],
 ['MagicZotero preset uses stated model and endpoint only',settings.includes('https://gpt.magiczotero.top/v1/chat/completions')&&settings.includes('magic-translate-gpt')&&settings.includes('setEndpointKey(\'\')')],
 ['MagicZotero requires test success before selecting route',settings.includes('candidate?.declared_free')&&settings.includes('if(id&&r.ok)')],

 ['Mail translation no longer uses arbitrary site daily quota',
  !translator.includes('mail_claim_ai_slot')&&!translator.includes('source.slice(0,8500)')&&!settings.includes('每日 AI 请求上限')],
 ['Full mail translation is chunked and resumable',
  translator.includes('chunksOf(source)')&&translator.includes('chunkIndex')&&
  translator.includes('mail_translation_chunks')&&ui.includes('已完成 ')&&ui.includes('chunk_index:index')],
 ['Long translations have dynamic output budget and no 25k result truncation',
  translator.includes('max_tokens:Math.min(6500')&&chunkSchema.includes('drop constraint if exists mail_translations_translated_text_check')],
 ['Provider 429 preserves error code instead of treating it as app daily limit',
  translator.includes('safeUpstreamCode')&&translator.includes('limitMeaning(code,route.url)')&&
  translator.includes('与网站翻译次数无关')],

 ['Background collection excludes failed accounts',collector.includes("query=query.eq('cloud_state','ready')")&&noRetry.includes("cloud_state = 'ready'")],
 ['Failure stops retries and retains last successful timestamp',collector.includes("next_attempt_at:null,last_processed:0")&&!collector.includes("retryAfter")&&noRetry.includes("set next_attempt_at=null")],
 ['Failed mailboxes may be checked manually without renewed password',collector.includes("query=query.eq('user_id',userId).eq('id',preferred).in('cloud_state',['ready','error'])")],
 ['UI distinguishes last success from newly imported count',ui.includes('最近检查 / 本次新增')&&ui.includes('上次新增 ')&&ui.includes('成功同步 ')&&ui.includes('自动重试已停止')],
 ['Per-account dialog does not inherit two-column grid',uiStyles.includes('.am-account-dialog .am-account-list')&&uiStyles.includes('grid-template-columns:minmax(0,1fr)')],
 ['Mail progress shows archive totals, last additions and historical backfill',ui.includes("mail_account_progress")&&ui.includes("archived_count")&&ui.includes("last_added_at")&&ui.includes("history_complete")],
 ['No automatic external images in mail overview',!ui.includes('<img ')&&ui.includes('am-account-metrics')],
 ['Source mailbox opens trusted webmail',ui.includes('webmailHome')&&ui.includes('https://mail.google.com/mail/')&&ui.includes('https://outlook.live.com/mail/')&&ui.includes('https://mail.qq.com/')],
 ['Storage policy archives only academic priority and minimizes bulk mail',collector.includes('mailStoragePolicy')&&collector.includes('BODY.PEEK[HEADER]')&&collector.includes('storage_tier:mode')&&read('supabase/functions/mail-cloud-collector/storage-policy.ts').includes("tier:'index'")],
 ['Outlook Graph classifies before full MIME download',read('supabase/functions/mail-cloud-collector/outlook.ts').includes("mailStoragePolicy('outlook'")],
 ['NetEase 126 IMAP declares client identity before mailbox access',collector.includes("imap.cmd('ID (\"name\" \"Submission Hub\"")&&cfg.includes('A003 ID (')&&cfg.includes('A004 EXAMINE "INBOX"')],
 ['Mailbox settings open in a secondary dialog',ui.includes('detailAccountId')&&ui.includes('am-account-overview')&&ui.includes('am-account-dialog')&&ui.includes('am-account-summary')],
 ['Mail archive reports missing folders instead of false successful sync',collector.includes('openedFolders===0')&&collector.includes('advertisedMessages>0&&foundUids===0')],
 ['Mail archive strips null bytes before PostgreSQL index insert',collector.includes('replaceAll(String.fromCharCode(0)')&&collector.includes('Mail index save failed (DB ')],
 ['No repeated focus/60-second polling', !ui.includes('window.setInterval(')&&!ui.includes("addEventListener('focus',onReturn)")&&ui.includes('visibilitychange')],
 ['New mail triggers one debounced UI refresh',ui.includes("event:'INSERT'")&&ui.includes('postgres_changes')&&realtime.includes('alter publication supabase_realtime add table public.mail_messages')],
 ['CUGB official student mailbox can be selected',ui.includes('imap.email.cugb.edu.cn')&&ui.includes('smtp.email.cugb.edu.cn')&&cfg.includes("domain==='email.cugb.edu.cn'")],
 ['CUGB connection error distinguishes DNS/TLS/auth failures',cfg.includes('域名解析失败')&&cfg.includes('TLS 握手')&&cfg.includes('服务器拒绝账号认证')],
 ['Microsoft login no longer foregrounds Azure developer portal',ui.includes('<details className="am-oauth-help">')&&oauth.includes('MAIL_MICROSOFT_CLIENT_ID')],
 ['No misleading automatic model enablement',settings.includes('ai_enabled:false')&&!settings.includes('onUpdate({ai_enabled:e.target.checked')],
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
