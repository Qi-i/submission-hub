import assert from 'node:assert/strict'
import {chunksOf,nextMissingChunk} from '../supabase/functions/mail-translate/chunks.mjs'
import {readFileSync} from 'node:fs'
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8')
for(const original of [
 '普通中文邮件','中英文 DOI：10.1234/alpha\n同行评议。🎓'.repeat(3000),
 'Sentence and emoji 🎓. '.repeat(10000),
 '没有句读的长文本'.repeat(17000)
]){
 const chunks=chunksOf(original)
 assert.equal(chunks.join(''),original)
 assert.ok(chunks.length>0)
 assert.ok(chunks.every(c=>c.length>0&&c.length<=2601))
 assert.ok(chunks.every(c=>!/[\uD800-\uDBFF]$/.test(c)))
}
assert.equal(nextMissingChunk(8,[0,1,2,4,5,6]),3)
assert.equal(nextMissingChunk(4,[0,1,2,3]),4)
const edge=read('supabase/functions/mail-translate/index.ts')
assert.ok(edge.includes("storage.from('mail-originals').download(path)"))
assert.ok(edge.includes('nextMissingChunk(chunks.length'))
assert.ok(edge.includes('limitMeaning(code,route.url)'))
assert.ok(edge.includes('translated_text:translated,'))
console.log('Mail translation source completeness and cache resume passed.')

const gardenUI=read('src/components/MailPersonalization.tsx')
assert.ok(gardenUI.includes('预填 MagicZotero 翻译 API'))
assert.ok(gardenUI.includes('onClick={()=>void test(e.id)}'))
