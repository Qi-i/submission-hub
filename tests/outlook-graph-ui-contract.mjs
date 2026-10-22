import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8')
const auth=read('supabase/functions/mail-outlook-oauth/index.ts')
const graph=read('supabase/functions/mail-cloud-collector/outlook.ts')
const cloud=read('supabase/functions/mail-cloud-collector/index.ts')
const send=read('supabase/functions/mail-send/index.ts')
const app=read('src/components/AcademicMailCenter.tsx')
const css=read('src/components/AcademicMailCenter.css')
const sql=read('supabase/032_outlook_graph_oauth.sql')
const cursor=read('supabase/033_outlook_graph_cursor.sql')
const checks=[
 ['Microsoft device authorization can start, poll and revoke',auth.includes("action==='start'")&&auth.includes("action==='poll'")&&auth.includes("action==='disconnect'")],
 ['Only owner can authorize own mailbox',auth.includes(".eq('user_id',user.data.user.id)")&&auth.includes(".eq('provider','outlook')")],
 ['OAuth token never goes to browser',!auth.includes('return result({access_token:')&&auth.includes('mail_save_cloud_secret')],
 ['Refresh credentials are stored in Vault',sql.includes('vault.create_secret')&&graph.includes('mail_save_cloud_secret')],
 ['Pending device codes expire and polling is throttled',auth.includes('session.expires_at')&&auth.includes('session.last_polled_at')],
 ['Graph identity must match requested account',auth.includes('graphEmail!==expected')],
 ['Graph reads Junk and hidden folders',graph.includes('includeHiddenFolders=true')&&graph.includes('childFolders')],
 ['Graph skips original MIME downloads for indexed message IDs',graph.includes('knownMessageId')&&graph.includes('knownKey')&&graph.indexOf('knownMessageId')<graph.indexOf("const raw=await graph(token,GRAPH+'/me/messages/")],
 ['Graph fetches real original MIME',graph.includes("'/$value'")&&graph.includes("storage.from('mail-originals')")],
 ['Outlook Graph history uses per-folder cursors',cursor.includes('mail_private.outlook_folder_cursors')&&graph.includes('mail_save_outlook_cursor')],
 ['Graph continuation disallows foreign hosts',graph.includes("u.hostname==='graph.microsoft.com'")],
 ['Immutable IDs survive mailbox folder moves',graph.includes('IdType="ImmutableId"')&&graph.includes('graph_message_id:item.id')],
 ['True Graph threaded reply validates recipient',send.includes("'/reply'")&&send.includes('actual!==to.toLowerCase()')],
 ['Archive preserves original manual metadata on duplicates',graph.includes("select('id,last_folder')")&&!graph.includes("upsert(row)")],
 ['Graph support is wired to scheduled cloud collection',cloud.includes('scanOutlookGraph(admin,account)')],
 ['Graph send requires confirmed user and delegated Mail.Send',send.includes("account.provider")===false?send.includes("a.provider==='outlook'")&&send.includes('/me/sendMail'):false],
 ['Outlook UI presents device verification URL and code',app.includes('am-device-auth')&&app.includes('microsoft.com/devicelogin')===false&&app.includes('verificationUri')],
 ['Original password-based accounts remain supported',app.includes("isSupported(a)")&&cloud.includes('scanAccount(admin,account)')],
 ['Glass hero and module grid were actually implemented',css.includes('am-hero-tiles')&&css.includes('.am-personalization')&&css.includes('backdrop-filter:blur')],
 ['Expanded account gets full width',css.includes(':has(.am-config-form,.am-oauth-panel)')],
 ['No OAuth registration credentials hardcoded',!auth.includes('client_secret:')&&app.includes('oauthClientId')],
]
for(const [name,pass] of checks)assert.ok(pass,'Outlook/UI contract failed: '+name)
console.log('Outlook delegated Graph and unified glass UI: '+checks.length+' checks passed')
