import fs from 'node:fs'
import path from 'node:path'
import {fileURLToPath} from 'node:url'
import XLSX from 'xlsx'
import {generateDashboardData} from './genera-dashboard-data.js'
import {deriveFantastats7} from './lib/calcolaModalita.js'
import {makePlayerResolver} from './lib/playerIdentity.js'
import {calculateScore} from './lib/scoreEngine.js'
import {modulesFor} from './lib/roleSystems.js'
import {candidate,bestLegal} from './v4/optimizer.js'
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
 const listone={byId:new Map(catalog.map(r=>[r.id,r])),resolve:makePlayerResolver(catalog,list.Sheets.Alias_storici?XLSX.utils.sheet_to_json(list.Sheets.Alias_storici):[])}
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
 const summaries={},teamAnalytics={},seasonLeaders={},moduleDefs=Object.fromEntries(systems.map(s=>[s,modulesFor(s)]))
 for(const gw of d.availableGws){const details=d.details[String(gw)]||{},formations=d.formations[String(gw)]||{}, games={}
 for(const c of d.competitions){games[c.id]=c.gameweeks[String(gw)];for(const [team,rs] of Object.entries(details[c.id]||{}))for(const r of rs){if(r.player_id==null||r.player_id==='')continue;const id=String(r.player_id);if(!contexts.has(id))contexts.set(id,[]);contexts.get(id).push({gw,comp:c.id,team,role:r.ruolo,fp:r.punteggio,rate:r.fs_rate,sub:r.sostituzione})}}
 for(const ts of Object.values(formations))for(const rs of Object.values(ts))for(const r of rs){if(r.stats){r.stats={minuti:r.stats.minuti,punteggio:r.stats.punteggio,punteggio_classic:r.stats.punteggio_classic,punteggio_mantra:r.stats.punteggio_mantra,punteggio_fantastats:r.stats.punteggio_fantastats,punteggio_flop_classic:r.stats.punteggio_flop_classic,punteggio_flop_mantra:r.stats.punteggio_flop_mantra,punteggio_flop_fantastats:r.stats.punteggio_flop_fantastats,ruolo_classic:r.stats.ruolo_classic,ruolo_mantra:r.stats.ruolo_mantra,ruolo_fantastats:r.stats.ruolo_fantastats}}}
 for(const c of d.competitions){for(const [team,rs] of Object.entries(details[c.id]||{})){const submitted=formations[c.league]?.[team]||[],used=new Set(rs.filter(r=>r.player_id!=null).map(r=>String(r.player_id)));const unused=submitted.filter(r=>!used.has(String(r.player_id))&&num(r.stats?.minuti)>0);const key='punteggio_'+(c.isFlop?'flop_':'')+c.roleSystem;const vals=unused.map(r=>r.stats[key]).filter(v=>v!=null);(teamAnalytics[c.id]??={})[team]??={};teamAnalytics[c.id][team][gw]={subs:rs.filter(r=>num(r.sostituzione)===1).length,vacancies:rs.filter(r=>r.player_id==null||r.player_id==='').length,unused:unused.length,unusedFp:vals.length===unused.length?Math.round(vals.reduce((a,b)=>a+Number(b),0)*100)/100:null}}}
 for(const c of d.competitions.filter(c=>c.roleSystem==='fantastats'))for(const [team,rs] of Object.entries(details[c.id]||{})){
 const submitted=formations[c.league]?.[team]||[],first=submitted.filter(r=>String(r.tipo).toLowerCase().startsWith('tit')).sort((a,b)=>num(a.slot_index)-num(b.slot_index)),bench=submitted.filter(r=>!String(r.tipo).toLowerCase().startsWith('tit')).sort((a,b)=>num(a.ordine_panchina)-num(b.ordine_panchina));
 if(!first.length)continue;const initial=deriveFantastats7(first,bench,listone).starters;
 const consistent=rs.every(r=>num(r.sostituzione)>0||r.player_id==null||String(initial.find(x=>x.slotIndex===Number(r.slot_index))?.playerId)===String(r.player_id));
 if(consistent)for(const r of rs)r.originalPlayerId=initial.find(x=>x.slotIndex===Number(r.slot_index))?.playerId??null;
 }
 const leaders={};
 const realRows=d.playerGw.filter(r=>Number(r.gw)===gw&&num(r.minuti)>0);
 for(const c of d.competitions){const candidates=[];for(const [team,rs] of Object.entries(details[c.id]||{})){for(const r of rs){if(r.player_id==null||num(r.minuti)<=0)continue;const field='punteggio_'+(c.isFlop?'flop_':'')+c.roleSystem;const peers=realRows.filter(p=>String(p.id)!==String(r.player_id)&&String(p['ruolo_'+c.roleSystem]||'').split(';').map(x=>x.trim()).includes(r.ruolo)&&p[field]!=null&&Number.isFinite(Number(p[field])));r.serieRank={rank:1+peers.filter(p=>Number(p[field])>Number(r.punteggio)).length,count:peers.length+1};candidates.push({id:r.player_id,team,fp:Number(r.punteggio)});const map=seasonLeaders[c.id]??={};const item=map[String(r.player_id)]??={id:r.player_id,fp:0};item.fp+=Number(r.punteggio)}}leaders[c.id]=candidates.sort((a,b)=>b.fp-a.fp).slice(0,3)}
 const actionPool=[],actionMap=new Map();for(const ts of Object.values(details))for(const rs of Object.values(ts))for(const r of rs){const key=JSON.stringify(r.action_details||[]);if(!actionMap.has(key)){actionMap.set(key,actionPool.length);actionPool.push(r.action_details||[])}r.actionRef=actionMap.get(key);delete r.action_details}
 put('gw/'+gw,{details,formations,actionPool})
 const stats=d.playerGw.filter(r=>Number(r.gw)===gw&&num(r.minuti)>0).map(r=>({id:r.id,fp:r.punteggio_fantastats,flop:r.punteggio_flop_fantastats,minutes:r.minuti,goals:r.gol}))
 const real=d.playerGw.filter(r=>Number(r.gw)===gw);const bestXI=bestLegal(real.map(r=>candidate(r,'classic')),moduleDefs.classic),flopXI=bestLegal(real.map(r=>candidate(r,'classic',true)),moduleDefs.classic)
 summaries[gw]={games,leaders,bestXI,flopXI,top:stats.slice().sort((a,b)=>num(b.fp)-num(a.fp)).slice(0,10),flop:stats.slice().sort((a,b)=>num(b.flop)-num(a.flop)).slice(0,10)}
 }
 const index=[...players.values()].map(p=>{const h=(history.get(String(p.id))||[]).sort((a,b)=>a.gw-b.gw), profile=d.playerPerformance[String(p.id)]?.systems||{}, last=h.at(-1);const metrics={};for(const s of systems)for(const m of ['normal','flop']){const k=(m==='flop'?'flop_':'')+s;const vals=h.filter(r=>num(r.minuti)>0&&r.scores[k]).map(r=>r.scores[k].fp);metrics[k]={...profile[s]?.[m],total:vals.length?Math.round(vals.reduce((a,b)=>a+b,0)*100)/100:null,last:last?.scores[k]?.fp??null,lastGw:last?.gw??null};delete metrics[k].last5}
 const item={...p,owners:owners[String(p.id)]||[],metrics};put('players/'+p.id,{history:h,contexts:contexts.get(String(p.id))||[]});return item})
 const competitions=d.competitions.map(({gameweeks,...c})=>c)
 put('core',{generated:d.generated,leagues:d.leagues,competitions,rosters:d.rosters,players:index,availableGws:d.availableGws,gameweeks:summaries,teamAnalytics,moduleDefs,seasonLeaders:Object.fromEntries(Object.entries(seasonLeaders).map(([id,rs])=>[id,Object.values(rs).map(r=>({...r,fp:Math.round(r.fp*100)/100})).sort((a,b)=>b.fp-a.fp).slice(0,3)]))})
 const total=Object.values(sizes).reduce((a,b)=>a+b,0)
 fs.rmSync(target,{recursive:true,force:true});fs.renameSync(stage,target)
 console.log('V4_DATA '+JSON.stringify({core:sizes.core,total,files:Object.keys(sizes).length,players:index.length,gws:d.availableGws,contexts:[...contexts.values()].reduce((a,b)=>a+b.length,0)}))
 return {core:sizes.core,total}
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url))generateV4()
