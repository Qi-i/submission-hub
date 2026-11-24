import assert from 'node:assert/strict'
import {buildMime,parseAttachments,MAX_ATTACHMENT_BYTES} from '../supabase/functions/mail-send/mime.mjs'
const common={from:'a@example.com',to:'b@example.com',subject:'科研邮件',content:'正文',replyTo:'<original@example.com>',boundary:'test-boundary',id:'new@example.com',date:'Wed, 25 Nov 2026 00:00:00 GMT'}
const files=parseAttachments([{name:'稿件.pdf',content_type:'application/pdf',content_base64:'JVBERg=='}])
const mime=buildMime({...common,attachments:files})
assert.match(mime,/multipart\/mixed/)
assert.match(mime,/In-Reply-To: <original@example.com>/)
assert.match(mime,/filename\*0\*=UTF-8''%E7%A8%BF/)
assert.match(mime,/JVBERg==/)
assert.ok(mime.endsWith('--test-boundary--\r\n'))
assert.doesNotMatch(buildMime({...common}),/multipart\/mixed/)
assert.throws(()=>parseAttachments([{name:'bad\r\nX: header',content_base64:'YQ=='}]))
assert.throws(()=>parseAttachments([{name:'bad',content_base64:'!'}]))
assert.throws(()=>parseAttachments([{name:'large',content_base64:Buffer.alloc(MAX_ATTACHMENT_BYTES+1).toString('base64')}]))
assert.equal(parseAttachments([{name:'limit',content_base64:Buffer.alloc(MAX_ATTACHMENT_BYTES).toString('base64')}]).length,1)
assert.throws(()=>parseAttachments([{name:'bad-padding',content_base64:'Y=Q='}]))
assert.throws(()=>parseAttachments(Array.from({length:11},()=>({name:'a',content_base64:'YQ=='}))))
console.log('mail attachment MIME contract passed')
