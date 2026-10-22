export function chunksOf(source,size=2600){
 if(!Number.isSafeInteger(size)||size<32)throw Error('Invalid chunk size')
 const out=[];let pos=0
 while(pos<source.length){
  let end=Math.min(pos+size,source.length)
  if(end<source.length){
   const from=pos+Math.floor(size*.58),look=source.slice(from,end)
   const stop=Math.max(look.lastIndexOf('\n'),look.lastIndexOf('。'),
    look.lastIndexOf('！'),look.lastIndexOf('？'),look.lastIndexOf('. '))
   if(stop>=0)end=from+stop+1
   if(end<source.length&&/^[\uDC00-\uDFFF]$/.test(source[end]))end++
  }
  if(end<=pos)throw Error('No segmentation progress')
  out.push(source.slice(pos,end));pos=end
 }
 return out
}
export function nextMissingChunk(total,indices){
 const known=new Set(indices)
 for(let i=0;i<total;i++)if(!known.has(i))return i
 return total
}
