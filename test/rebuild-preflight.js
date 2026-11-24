import XLSX from 'xlsx'
import fs from 'node:fs'
import {makePlayerResolver} from '../lib/playerIdentity.js'
const w=XLSX.readFile('listone_slug.xlsx')
const rows=XLSX.utils.sheet_to_json(w.Sheets[w.SheetNames[0]])
const resolve=makePlayerResolver(rows,w.Sheets.Alias_storici?XLSX.utils.sheet_to_json(w.Sheets.Alias_storici):[])
const expected=[['Malencastro',true],['Parmigian Buongrado',false],['Real Canil',true],['Ostia Liedholm',false],['Liverpollio',true],['Falarsenal',false],['Schiaffield Wednesday',true],['Ejaculazio',false],['Rotten Wreck Squad',true],['Parmigian Buongrado',true],['Real Canil',false],['Ostia Liedholm',true]]
const own='Hellas Madonna 7 Sorelle', missing=[], shape=[]
for(let gw=1;gw<=12;gw++){
 const f='formazioni/formazioni_GW'+gw+'.xlsx'
 if(!fs.existsSync(f))throw Error('Missing '+f)
 const b=XLSX.readFile(f), cal=XLSX.utils.sheet_to_json(b.Sheets.calendario_classic)
 const [opp,home]=expected[gw-1]
 if(!cal.some(r=>r.home===(home?own:opp)&&r.away===(home?opp:own)))throw Error('Calendar mismatch GW'+gw)
 if(cal.length!==5||new Set(cal.flatMap(r=>[r.home,r.away])).size!==10)throw Error('Bad Classic calendar GW'+gw)
 for(const league of ['Classic','Mantra']){
  const rr=XLSX.utils.sheet_to_json(b.Sheets[league])
  const users=new Set(rr.map(r=>r.utente))
  if(users.size!==(league==='Classic'?10:6))throw Error('Bad team count GW'+gw+' '+league)
  for(const user of users){
   const team=rr.filter(r=>r.utente===user)
   const n=team.filter(r=>String(r.tipo).toLowerCase().startsWith('tit')).length
   if(n!==11)shape.push({gw,league,user,starters:n,rows:team})
  }
  for(const r of rr){
   const hit=resolve(r.giocatore,r.squadra)
   if(!hit||!hit.sorare_slug||!hit.role_fantastats)missing.push({gw,league,user:r.utente,tipo:r.tipo,name:r.giocatore,team:r.squadra,id:hit?.id,reason:!hit?'unresolved':!hit.sorare_slug?'no_slug':'no_role',candidates:rows.filter(p=>String(p.nome).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]/g,'')===String(r.giocatore).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]/g,'')).map(p=>({id:p.id,name:p.nome,team:p.squadra,slug:p.sorare_slug}))})
  }
 }
}
fs.mkdirSync('rebuild-results',{recursive:true})
fs.writeFileSync('rebuild-results/preflight.json',JSON.stringify({missing,shape},null,2))
console.log('REBUILD_MISSING '+JSON.stringify(missing))
console.log('REBUILD_SHAPE '+JSON.stringify(shape))
if(shape.length)throw Error('Incomplete lineups: see REBUILD_SHAPE')
if(missing.length)throw Error('Resolve preflight identities before rebuilding')
