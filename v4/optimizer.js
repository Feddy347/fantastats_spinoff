export function candidate(r,system,flop=false){
 const score=r?.['punteggio_'+(flop?'flop_':'')+system],roleString=r?.['ruolo_'+system]||'',roles=String(roleString).split(';').map(x=>x.trim()).filter(Boolean)
 if(!r||!(Number(r.minuti)>0)||score==null||!Number.isFinite(Number(score))||!roles.length)return null
 const keeper={classic:'P',mantra:'Por',fantastats:'POR'}[system]
 const primaryKeeper=roles[0]===keeper
 const compatible=roles.filter(x=>(x===keeper)===primaryKeeper)
 return {id:r.id??r.player_id,roles:compatible,score:Number(score)}
}
export function bestLegal(pool,modules){
 pool=pool.filter(x=>x&&x.id!=null);const distinct=[...new Map(pool.map(x=>[String(x.id),x])).values()]
 let best=null
 const pop=m=>{let n=0;while(m){n+=m&1;m>>=1}return n}
 for(const mod of modules){
 const slots=mod.slotObjs.map(x=>x.roles),size=slots.length
 // For a slot, keeping its top size candidates suffices: at most size-1 other players can be occupied.
 const kept=new Set()
 for(const rs of slots)for(const p of distinct.filter(p=>p.roles.some(r=>rs.includes(r))).sort((a,b)=>b.score-a.score).slice(0,size))kept.add(p)
 let states=new Map([[0,{score:0,players:Array(size).fill(null)}]])
 for(const p of kept){
 const next=new Map(states)
 for(const [mask,state] of states)for(let j=0;j<size;j++){
 if(mask&(1<<j))continue
 const role=p.roles.find(r=>slots[j].includes(r));if(!role)continue
 const m=mask|(1<<j),score=state.score+p.score
 if(!next.has(m)||score>next.get(m).score+1e-8){const players=state.players.slice();players[j]={id:p.id,role,fp:p.score};next.set(m,{score,players})}
 }
 states=next
 }
 for(const [mask,state] of states){const covered=pop(mask);if(!best||covered>best.covered||(covered===best.covered&&state.score>best.score+1e-8))best={...state,covered,size,module:mod.id}}
 }
 return best?{...best,score:Math.round(best.score*100)/100}:null
}
