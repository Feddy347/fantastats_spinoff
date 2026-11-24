import fs from 'node:fs'
import path from 'node:path'
import {fileURLToPath} from 'node:url'
import XLSX from 'xlsx'
import {generateDashboardData} from './genera-dashboard-data.js'
import {calculateScore} from './lib/scoreEngine.js'
import {fsRateFromPoints} from './lib/fsRate.js'
const systems=['classic','mantra','fantastats']
const num=v=>Number(v)||0
export function generateV4(out='v4/data'){
 const d=generateDashboardData({write:false,compact:true})
 const target=path.resolve(out), stage=target+'.tmp'
 fs.rmSync(stage,{recursive:true,force:true});fs.mkdirSync(stage,{recursive:true})
 const sizes={}
 const put=(name,value)=>{const p=path.join(stage,name+'.json');fs.mkdirSync(path.dirname(p),{recursive:true});const s=JSON.stringify(value);fs.writeFileSync(p,s);sizes[name]=Buffer.byteLength(s)}
 const list=XLSX.readFile('listone_slug.xlsx')
 const catalog=XLSX.utils.sheet_to_json(list.Sheets[list.SheetNames[0]])
 const players=new Map(d.players.map(p=>[String(p.id),p]))
 for(const r of catalog){if(!players.has(String(r.id)))players.set(String(r.id),{id:r.id,nome:r.nome,squadra:r.squadra,ruolo:r.role_classic,ruolo_classic:r.role_classic,ruolo_mantra:r.role_mantra,ruolo_fantastats:r.role_fantastats})}
 const owners={}
 for(const [league,teams] of Object.entries(d.rosters))for(const [team,rs] of Object.entries(teams))for(const r of rs){if(r.id==null)continue;const id=String(r.id);(owners[id]??=[]).push({league,team,costo:r.costo});if(!players.has(id))players.set(id,{id:r.id,nome:r.giocatore,squadra:r.squadra,ruolo:r.ruolo_classic,ruolo_classic:r.ruolo_classic,ruolo_mantra:r.ruolo_mantra,ruolo_fantastats:r.ruolo_fantastats})}
 const history=new Map(), contexts=new Map()
 for(const r of d.playerGw){const {raw_stats,...record}=r;const scores={};for(const sys of systems)for(const flop of [false,true]){
 const key=(flop?'flop_':'')+sys, fp=r['punteggio_'+key]; if(fp==null)continue;const rating=fsRateFromPoints(Number(fp),flop)
 const val={fp:Number(fp),rate:rating.rate,label:rating.label}
 if(raw_stats){try{const roles=r['ruolo_'+sys]||'',slot=roles.split(';')[0].trim();const calc=calculateScore(JSON.parse(raw_stats),roles,slot,flop,sys);if(Math.abs(calc.totalScore-val.fp)<0.005){val.actions=calc.actionDetails;val.breakdown=calc.breakdown}}catch{}}
 scores[key]=val
 }
 const id=String(r.id);if(!history.has(id))history.set(id,[]);history.get(id).push({...record,scores})
 }
 const summaries={}
 for(const gw of d.availableGws){const details=d.details[String(gw)]||{},formations=d.formations[String(gw)]||{}, games={}
 for(const c of d.competitions){games[c.id]=c.gameweeks[String(gw)];for(const [team,rs] of Object.entries(details[c.id]||{}))for(const r of rs){if(r.player_id==null||r.player_id==='')continue;const id=String(r.player_id);if(!contexts.has(id))contexts.set(id,[]);contexts.get(id).push({gw,comp:c.id,team,role:r.ruolo,fp:r.punteggio,rate:r.fs_rate,sub:r.sostituzione})}}
 for(const ts of Object.values(formations))for(const rs of Object.values(ts))for(const r of rs){if(r.stats){r.stats={minuti:r.stats.minuti,punteggio:r.stats.punteggio,punteggio_classic:r.stats.punteggio_classic,punteggio_mantra:r.stats.punteggio_mantra,punteggio_fantastats:r.stats.punteggio_fantastats,punteggio_flop_classic:r.stats.punteggio_flop_classic,punteggio_flop_mantra:r.stats.punteggio_flop_mantra,punteggio_flop_fantastats:r.stats.punteggio_flop_fantastats}}}
 const actionPool=[],actionMap=new Map();for(const ts of Object.values(details))for(const rs of Object.values(ts))for(const r of rs){const key=JSON.stringify(r.action_details||[]);if(!actionMap.has(key)){actionMap.set(key,actionPool.length);actionPool.push(r.action_details||[])}r.actionRef=actionMap.get(key);delete r.action_details}
 put('gw/'+gw,{details,formations,actionPool})
 const stats=d.playerGw.filter(r=>Number(r.gw)===gw&&num(r.minuti)>0).map(r=>({id:r.id,fp:r.punteggio_fantastats,flop:r.punteggio_flop_fantastats,minutes:r.minuti,goals:r.gol}))
 summaries[gw]={games,top:stats.slice().sort((a,b)=>num(b.fp)-num(a.fp)).slice(0,10),flop:stats.slice().sort((a,b)=>num(b.flop)-num(a.flop)).slice(0,10)}
 }
 const index=[...players.values()].map(p=>{const h=(history.get(String(p.id))||[]).sort((a,b)=>a.gw-b.gw), profile=d.playerPerformance[String(p.id)]?.systems||{}, last=h.at(-1);const metrics={};for(const s of systems)for(const m of ['normal','flop']){const k=(m==='flop'?'flop_':'')+s;const vals=h.filter(r=>num(r.minuti)>0&&r.scores[k]).map(r=>r.scores[k].fp);metrics[k]={...profile[s]?.[m],total:vals.length?Math.round(vals.reduce((a,b)=>a+b,0)*100)/100:null,last:last?.scores[k]?.fp??null,lastGw:last?.gw??null};delete metrics[k].last5}
 const item={...p,owners:owners[String(p.id)]||[],metrics};put('players/'+p.id,{history:h,contexts:contexts.get(String(p.id))||[]});return item})
 const competitions=d.competitions.map(({gameweeks,...c})=>c)
 put('core',{generated:d.generated,leagues:d.leagues,competitions,rosters:d.rosters,players:index,availableGws:d.availableGws,gameweeks:summaries})
 const total=Object.values(sizes).reduce((a,b)=>a+b,0)
 fs.rmSync(target,{recursive:true,force:true});fs.renameSync(stage,target)
 console.log('V4_DATA '+JSON.stringify({core:sizes.core,total,files:Object.keys(sizes).length,players:index.length,gws:d.availableGws,contexts:[...contexts.values()].reduce((a,b)=>a+b.length,0)}))
 return {core:sizes.core,total}
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url))generateV4()
