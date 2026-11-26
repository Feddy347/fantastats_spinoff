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

/** Historical-only estimate: recent weighted FP conditional on play, multiplied by
 * observed recent appearance fraction, blended with season values. Missing records
 * are not assumed to be injuries; participation is an empirical proxy. */
export function forecastSeven(roster,histories,gws,modules,{excluded=[],recentWeight=.65,window=5}={}){
 const ex=new Set(excluded.map(String)),weeks=[...new Set(gws.map(Number))].sort((a,b)=>a-b),recent=weeks.slice(-window),rows=[];
 for(const p of roster){
  const id=String(p.id??'');if(!id||ex.has(id))continue;
  const roles=String(p.ruolo_fantastats||'').split(';').map(r=>r.trim()).filter(Boolean);if(!roles.length)continue;
  const records=(histories[id]||[]).filter(r=>weeks.includes(Number(r.gw))&&Number(r.minuti)>0&&r.scores?.fantastats?.fp!=null&&Number.isFinite(Number(r.scores.fantastats.fp)));
  if(!records.length)continue;
  const tail=records.filter(r=>recent.includes(Number(r.gw))),mean=rs=>rs.reduce((s,r)=>s+Number(r.scores.fantastats.fp),0)/rs.length;
  const seasonAvg=mean(records),recentAvg=tail.length?mean(tail):seasonAvg;
  const participation=weeks.length?records.length/weeks.length:0,recentParticipation=recent.length?tail.length/recent.length:0;
  const expected=(recentWeight*recentAvg+(1-recentWeight)*seasonAvg)*(recentWeight*recentParticipation+(1-recentWeight)*participation);
  rows.push({id,roles,score:Math.round(expected*100)/100,seasonAvg,recentAvg,participation,recentParticipation,played:records.length});
 }
 const best=bestLegal(rows,modules);
 return {best,rows,unknown:roster.filter(p=>!ex.has(String(p.id))&&!rows.some(r=>r.id===String(p.id))).map(p=>p.id)};
}

export const HOME_MODES={normal:'punteggio_classic',fantastats:'punteggio_fantastats',flop:'punteggio_flop_classic'}
export function macroRoles(value){return [...new Set(String(value??'').toUpperCase().split(/[;,/\s]+/).filter(x=>['P','D','C','A'].includes(x)))]}
export function playerLeaders(rows,limit=5){
 const accum=new Map()
 for(const r of rows){
  if(r.id==null||!(Number(r.minuti)>0))continue
  for(const role of macroRoles(r.ruolo_classic??r.ruolo))for(const [mode,field] of Object.entries(HOME_MODES)){
   const raw=r[field];if(raw==null||raw===''||!Number.isFinite(Number(raw)))continue
   const key=mode+'|'+role+'|'+r.id,entry=accum.get(key)||{id:r.id,role,mode,fp:0,played:0}
   entry.fp+=Number(raw);entry.played++;accum.set(key,entry)
  }
 }
 return Object.fromEntries(Object.keys(HOME_MODES).map(mode=>[mode,Object.fromEntries(['P','D','C','A'].map(role=>[role,[...accum.values()].filter(r=>r.mode===mode&&r.role===role).map(({id,fp,played})=>({id,fp:Math.round(fp*100)/100,played})).sort((a,b)=>b.fp-a.fp||String(a.id).localeCompare(String(b.id))).slice(0,limit)]))]))
}
export function unlimitedGoalProgress(score,thresholds){if(score==null||!Number.isFinite(Number(score))||thresholds?.length<2)return null;const first=Number(thresholds[0]),step=Number(thresholds[1])-first,s=Number(score);if(!Number.isFinite(first)||!(step>0))return null;const goals=s<first?0:1+Math.floor((s-first)/step),nextThreshold=first+goals*step;return {goals,nextThreshold,missing:Math.round(Math.max(0,nextThreshold-s)*100)/100,progress:Math.max(0,Math.min(100,100*(s-(nextThreshold-step))/step))}}
export function historyPoint(row,key){if(!row||row.minuti==null)return null;if(Number(row.minuti)===0)return 0;const v=row.scores?.[key]?.fp;return v==null||v===''||!Number.isFinite(Number(v))?null:Number(v)}
export function valueTones(values,direction=1){const clean=values.filter(v=>v!=null&&v!==''&&Number.isFinite(Number(v))).map(Number);const hi=Math.max(...clean),lo=Math.min(...clean);return values.map(v=>v==null||v===''||!Number.isFinite(Number(v))||clean.length<2||hi===lo?'':Number(v)===(direction>0?hi:lo)?'positive':Number(v)===(direction>0?lo:hi)?'negative':'')}
