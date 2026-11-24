// Partial FS7 lineup: maximize covered slots, then minimize reserve use.
// No match statistics are consulted. Ties preserve bench order, module order and input order.
export function bestPartialLineup(first,reserve,modules,roles){
 const pool=[...first,...reserve], n=first.length
 const count=mask=>{let k=0;while(mask){k+=mask&1;mask>>=1}return k}
 const cmp=(a,b)=>{for(let i=0;i<Math.min(a.length,b.length);i++)if(a[i]!==b[i])return a[i]-b[i];return a.length-b.length}
 const benchIndices=a=>a.filter(i=>i>=n).sort((x,y)=>x-y)
 function preference(a,b){
  const aa=benchIndices(a),bb=benchIndices(b)
  return aa.length-bb.length||cmp(aa,bb)||cmp(a.map(i=>i<0?pool.length:i),b.map(i=>i<0?pool.length:i))
 }
 let best=null
 for(const [moduleIndex,m] of modules.entries()){
  const slots=m.slotObjs.map(s=>s.roles[0]), size=slots.length
  let states=new Map([[0,Array(size).fill(-1)]])
  for(const [i,id] of pool.entries()){
   const next=new Map(states), allowed=roles(id)
   for(const [mask,assignment] of states)for(let j=0;j<size;j++){
    if((mask&(1<<j))||!allowed.includes(slots[j]))continue
    const newMask=mask|(1<<j), a=assignment.slice();a[j]=i
    if(!next.has(newMask)||preference(a,next.get(newMask))<0)next.set(newMask,a)
   }
   states=next
  }
  for(const [mask,a] of states){
   const covered=count(mask)
   if(!best||covered>best.covered||(covered===best.covered&&(
    benchIndices(a).length<benchIndices(best.a).length||
    (benchIndices(a).length===benchIndices(best.a).length&&(
     cmp(benchIndices(a),benchIndices(best.a))<0||
     (cmp(benchIndices(a),benchIndices(best.a))===0&&moduleIndex===best.moduleIndex&&preference(a,best.a)<0)
    ))
   )))best={covered,a,slots,moduleIndex}
  }
 }
 if(!best)throw Error('No Fantastats7 modules configured')
 const selected=new Set(best.a.filter(i=>i>=0))
 return {starters:best.a.map((i,slotIndex)=>({playerId:i<0?null:pool[i],slotIndex,slotRole:best.slots[slotIndex]})),bench:pool.filter((_,i)=>!selected.has(i)).map(playerId=>({playerId})),covered:best.covered}
}
