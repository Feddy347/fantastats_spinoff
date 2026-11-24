import XLSX from 'xlsx'
import { MODULES } from '../lib/modules.js'
const read=(p,s)=>{const w=XLSX.readFile(p);return XLSX.utils.sheet_to_json(w.Sheets[s??w.SheetNames[0]])}
const key=(n,t)=>String(n).trim().toLowerCase()+'|'+String(t).trim().toLowerCase()
const list=new Map(read('listone_slug.xlsx').map(r=>[key(r.nome,r.squadra),r]))
const roles=r=>String(r?.role_fantastats??'').split(';').map(s=>s.trim()).filter(Boolean)
function solve(slots,pool,greedy=false,used=new Set(),i=0){
 if(i===slots.length)return []
 const choices=pool.filter(p=>!used.has(p.id)&&p.roles.includes(slots[i]))
 for(const p of greedy?choices.slice(0,1):choices){
  const next=new Set(used);next.add(p.id)
  const rest=solve(slots,pool,greedy,next,i+1)
  if(rest)return [p.name,...rest]
 }
 return null
}
for(const league of ['Classic','Mantra']){
 const rows=read('formazioni/formazioni_GW12.xlsx',league)
 for(const user of new Set(rows.map(r=>String(r.utente).trim()))){
  const own=rows.filter(r=>String(r.utente).trim()===user)
  const starters=own.filter(r=>String(r.tipo).trim().toLowerCase().startsWith('tit'))
  const pool=rr=>rr.map(r=>{const p=list.get(key(r.giocatore,r.squadra));return {id:p?.id,name:r.giocatore,team:r.squadra,roles:roles(p),slug:p?.sorare_slug}}).filter(p=>p.id!=null)
  const p=pool(starters), all=pool(own)
  const greedy=MODULES.map(m=>solve(m.slots,p,true)).find(Boolean)
  const exact=MODULES.map(m=>solve(m.slots,p)).find(Boolean)
  const bench=MODULES.map(m=>solve(m.slots,all)).find(Boolean)
  const counts=Object.fromEntries(['POR','DC','T','C','ES','Tq','ATT'].map(role=>[role,p.filter(x=>x.roles.includes(role)).length]))
  console.log('FS7_DIAG '+JSON.stringify({league,user,starters:starters.length,matched:p.length,missing:starters.filter(r=>!list.has(key(r.giocatore,r.squadra))).map(r=>[r.giocatore,r.squadra]),roles:p.map(x=>[x.name,x.roles]),counts,greedy:!!greedy,exact:!!exact,bench:!!bench,exactLineup:exact,benchLineup:bench}))
 }
}
