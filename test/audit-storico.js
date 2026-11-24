import XLSX from 'xlsx'
import fs from 'node:fs'
import {execFileSync} from 'node:child_process'
import {fetchSerieAMatchday} from '../lib/footballData.js'
import {fetchSerieAPastGames,fetchGameStats,statsFromSorare,sleep,SORARE_REQUEST_DELAY_MS} from '../lib/sorare.js'
import {matchFixtures} from '../lib/matchday.js'
const snapshot='69e56b4c515a176972bae427575d0022c532bea8'
const dir='audit-main/', out='audit-results/'
fs.mkdirSync(out,{recursive:true})
const read=(p,s)=>{const w=XLSX.readFile(p,{sheets:s?[s]:undefined});return XLSX.utils.sheet_to_json(w.Sheets[s??w.SheetNames[0]])}
const formations=[]
for(const f of fs.readdirSync(dir+'formazioni').filter(x=>/^formazioni_GW\d+\.xlsx$/.test(x)).sort((a,b)=>Number(a.match(/\d+/)[0])-Number(b.match(/\d+/)[0]))){
 const gw=Number(f.match(/\d+/)[0])
 const w=XLSX.readFile(dir+'formazioni/'+f)
 const calendar=w.Sheets.calendario_classic?XLSX.utils.sheet_to_json(w.Sheets.calendario_classic):[]
 const upload=execFileSync('git',['log','--diff-filter=A','--format=%aI',snapshot,'--','formazioni/'+f],{encoding:'utf8'}).trim().split('\n').filter(Boolean).at(-1)||null
 const changes=execFileSync('git',['log','--format=%aI %h %s',snapshot,'--','formazioni/'+f],{encoding:'utf8'}).trim().split('\n')
 const info={gw,file:f,upload,changes,calendar,sheets:w.SheetNames,rows:Object.fromEntries(['Classic','Mantra'].filter(s=>w.Sheets[s]).map(s=>[s,XLSX.utils.sheet_to_json(w.Sheets[s]).length]))}
 formations.push(info);console.log('AUDIT_FORM '+JSON.stringify(info))
}
fs.writeFileSync(out+'formations.json',JSON.stringify(formations,null,2))
const old=read(dir+'listone_slug.xlsx')
const newRows=read('listone_slug.xlsx')
const slugById=new Map(newRows.filter(r=>r.sorare_slug).map(r=>[String(r.id),r.sorare_slug]))
for(const r of old)if(r.sorare_slug)slugById.set(String(r.id),r.sorare_slug)
const stats=read(dir+'statistiche_giocatori.xlsx','_per_gw')
const scores=read(dir+'fantastats_stagione.xlsx','_dati_giornate')
const details=read(dir+'fantastats_stagione.xlsx','_dettaglio_giornate')
const gwList=[...new Set([...formations.map(r=>r.gw),...stats.map(r=>Number(r.gw)),...scores.map(r=>Number(r.gw))])].sort((a,b)=>a-b)
const fields={minuti:'mins_played',gol:'goals',assist:'goal_assist',ammonizioni:'yellow_card',espulsioni:'red_card',tiri_in_porta:'ontarget_scoring_att',big_chance_create:'big_chance_created',contrasti_vinti:'won_tackle',intercetti:'interception_won',duelli_vinti:'duel_won',salvataggi_linea:'clearance_off_line',parate:'saves',rigori_parati:'penalty_save',gol_subiti:'goals_conceded',clean_sheet:'clean_sheet',falli:'fouls',autogol:'own_goals',errori_gol:'error_lead_to_goal',dribbling_vinti:'won_contest'}
const calendars=new Map(), real=new Map(), failures=[]
for(let gw=1;gw<=12;gw++){
 try{calendars.set(gw,await fetchSerieAMatchday(process.env.FOOTBALL_DATA_API_KEY,2026,gw));await sleep(7000)}
 catch(e){failures.push({gw,stage:'calendar',error:e.message})}
}
let games=[],after=null
for(let i=0;i<30;i++){
 const p=await fetchSerieAPastGames(after);games.push(...p.nodes)
 if(!p.pageInfo.hasNextPage)break
 if(!p.pageInfo.endCursor||after===p.pageInfo.endCursor)throw Error('Invalid cursor')
 after=p.pageInfo.endCursor
 if([...calendars.values()].every(ms=>{try{matchFixtures(ms,games);return true}catch{return false}}))break
 await sleep(SORARE_REQUEST_DELAY_MS)
}
const cache=new Map()
for(const [gw,ms] of calendars){
 try{
  const matches=matchFixtures(ms,games), bySlug=new Map(), byGame=[]
  for(const g of matches){
   await sleep(SORARE_REQUEST_DELAY_MS)
   const d=await fetchGameStats(g.id)
   if(!d||d.statusTyped!=='played'||!d.scored||d.id.replace(/^Game:/,'')!==g.id.replace(/^Game:/,'')||Date.parse(d.date)!==Date.parse(g.date)||d.homeScore!==g.homeScore||d.awayScore!==g.awayScore)throw Error('Invalid game '+g.id)
   let count=0
   for(const ps of d.playerGameScores??[]){
    const s=statsFromSorare(ps.anyPlayerGameStats), slug=ps.anyPlayer?.slug
    if(!slug||s.mins_played<=0)continue
    if(bySlug.has(slug))throw Error('Duplicate player '+slug)
    bySlug.set(slug,{s,game:g.id});count++
   }
   if(count<22)throw Error('Insufficient players '+g.id)
   byGame.push({id:g.id,date:g.date,home:g.homeTeam.name,away:g.awayTeam.name,score:g.homeScore+'-'+g.awayScore,participants:count})
  }
  real.set(gw,{bySlug,byGame})
  console.log('AUDIT_REAL '+JSON.stringify({gw,games:byGame,players:bySlug.size}))
 }catch(e){failures.push({gw,stage:'stats',error:e.message})}
}
const rankings=[], playerEvidence=[], summaries=[]
for(const gw of gwList){
 const saved=stats.filter(r=>Number(r.gw)===gw&&Number(r.minuti)>0)
 const mapped=saved.filter(r=>slugById.has(String(r.id)))
 const ranks=[]
 for(const [actual,{bySlug}] of real){
  let compared=0,exact=0,matchedFields=0,totalFields=0
  for(const r of mapped){
   const slug=slugById.get(String(r.id)), hit=bySlug.get(slug)
   if(!hit)continue
   const keys=Object.keys(fields).filter(k=>r[k]!=null&&r[k]!=='')
   if(keys.length<5)continue
   compared++
   const equal=keys.filter(k=>Number(r[k])===Number(hit.s[fields[k]])).length
   matchedFields+=equal;totalFields+=keys.length
   if(equal===keys.length)exact++
   if(equal===keys.length)playerEvidence.push({savedGW:gw,realGW:actual,id:r.id,nome:r.nome,slug,minuti:r.minuti,gol:r.gol,game:hit.game,fields:keys.length})
  }
  ranks.push({savedGW:gw,realGW:actual,savedPositive:saved.length,mapped:mapped.length,compared,exact,exactShare:mapped.length?exact/mapped.length:0,matchedFields,totalFields})
 }
 ranks.sort((a,b)=>b.exact-a.exact||b.matchedFields-a.matchedFields)
 rankings.push(...ranks)
 const resultRows=scores.filter(r=>Number(r.gw)===gw), detailRows=details.filter(r=>Number(r.gw)===gw)
 const actualById=new Map(saved.map(r=>[String(r.id),r]))
 let detailCompared=0,detailMinutesAgree=0
 for(const d of detailRows){const p=actualById.get(String(d.player_id));if(p&&Number(d.minuti)>0){detailCompared++;if(Number(d.minuti)===Number(p.minuti))detailMinutesAgree++}}
 const info={gw,savedRows:stats.filter(r=>Number(r.gw)===gw).length,positive:saved.length,mapped:mapped.length,resultRows:resultRows.length,detailRows:detailRows.length,detailCompared,detailMinutesAgree,top:ranks.slice(0,3),examples:playerEvidence.filter(r=>r.savedGW===gw&&r.realGW===ranks[0]?.realGW&&Number(r.gol)>0).slice(0,8)}
 summaries.push(info);console.log('AUDIT_RESULT '+JSON.stringify(info))
}
fs.writeFileSync(out+'audit.json',JSON.stringify({snapshot,formations,summaries,rankings,failures,real:[...real].map(([gw,r])=>({gw,games:r.byGame}))},null,2))
const w=XLSX.utils.book_new()
for(const [n,rows] of [['Calendario Classic',formations.flatMap(f=>f.calendar.map(r=>({gw:f.gw,upload:f.upload,...r})))],['Confronto giornate',rankings],['Evidenze giocatori',playerEvidence],['Partite reali',[...real].flatMap(([gw,r])=>r.byGame.map(g=>({gw,...g})))],['Errori API',failures]])XLSX.utils.book_append_sheet(w,XLSX.utils.json_to_sheet(rows),n)
XLSX.writeFile(w,out+'audit_storico.xlsx')
console.log('AUDIT_FAILURES '+JSON.stringify(failures))
