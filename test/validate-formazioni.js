import XLSX from 'xlsx'
import path from 'node:path'
import fs from 'node:fs'
import {makePlayerResolver} from '../lib/playerIdentity.js'
const file=process.argv[2], gw=Number(process.argv[3])
if(!file||!Number.isInteger(gw)||gw<1||gw>38||path.basename(file)!=='formazioni_GW'+gw+'.xlsx')throw Error('Nome file o GW non validi')
const read=f=>XLSX.readFile(f), rows=(w,s)=>XLSX.utils.sheet_to_json(w.Sheets[s],{defval:null})
const text=v=>String(v??'').trim(), errors=[], warnings=[]
const check=(ok,msg)=>{if(!ok)errors.push(msg)}
const w=read(file), model=read('formazioni/formazioni_GW12.xlsx'), list=read('listone_slug.xlsx'), roster=read('rose.xlsx')
const players=rows(list,list.SheetNames[0]), resolve=makePlayerResolver(players,list.Sheets.Alias_storici?rows(list,'Alias_storici'):[])
const rr=rows(roster,'Rose')
const leagues=['Classic','Mantra'], teams={}
const seq=(values,start)=>values.every(Number.isInteger)&&values.slice().sort((a,b)=>a-b).every((v,i)=>v===i+start)
check(JSON.stringify(w.SheetNames.slice().sort())===JSON.stringify(['Classic','Mantra','calendario_classic'].sort()),'Fogli non conformi')
for(const s of ['Classic','Mantra','calendario_classic']){
 if(!w.Sheets[s])continue
 const header=b=>XLSX.utils.sheet_to_json(b.Sheets[s],{header:1})[0]
 check(JSON.stringify(header(w))===JSON.stringify(header(model)),s+': intestazioni non conformi')
}
for(const league of leagues){
 if(!w.Sheets[league])continue
 const data=rows(w,league), expected=new Set(rr.filter(r=>text(r.lega).toLowerCase()===league.toLowerCase()).map(r=>text(r.utente)))
 teams[league]=new Set(data.map(r=>text(r.utente)))
 check(teams[league].size===(league==='Classic'?10:6)&&[...teams[league]].every(t=>expected.has(t)),league+': fantasquadre errate')
 for(const team of teams[league]){
  const a=data.filter(r=>text(r.utente)===team), prefix=league+' / '+team
  const starters=a.filter(r=>text(r.tipo)==='Titolare'), bench=a.filter(r=>text(r.tipo)==='Panchina')
  check(starters.length===11&&seq(starters.map(r=>r.slot_index),0),prefix+': titolari o slot errati')
  check(seq(bench.map(r=>r.ordine_panchina),1),prefix+': ordine panchina errato')
  check(starters.length+bench.length===a.length,prefix+': tipo non valido')
  const ids=new Set(), rosterIds=new Set(rr.filter(r=>text(r.lega).toLowerCase()===league.toLowerCase()&&text(r.utente)===team).map(r=>String(r.id)))
  for(const r of a){
   const label=prefix+' / '+text(r.giocatore)
   check(text(r.fanta)===league&&!!text(r.giocatore)&&!!text(r.squadra),label+': campi obbligatori')
   const p=resolve(r.giocatore,r.squadra)
   if(!p){errors.push(label+': identità non risolta');continue}
   check(!!p.sorare_slug&&!!p.role_fantastats,label+': slug o ruolo FS mancante')
   check(!ids.has(String(p.id)),label+': duplicato');ids.add(String(p.id))
   if(!rosterIds.has(String(p.id)))warnings.push(label+': non presente nella rosa (verificare aggiornamento)')
   const role=text(r.ruolo), allowed=text(p[league==='Classic'?'role_classic':'role_mantra']).split(/[;/]/).map(x=>x.trim().toLowerCase())
   if(!role||!role.split(/[;/]/).some(x=>allowed.includes(x.trim().toLowerCase())))warnings.push(label+': ruolo da verificare ('+role+')')
  }
 }
}
if(w.Sheets.calendario_classic){
 const cal=rows(w,'calendario_classic'), names=cal.flatMap(r=>[text(r.home),text(r.away)])
 check(cal.length===5&&new Set(names).size===10&&names.every(n=>teams.Classic?.has(n)),'Calendario Classic non valido')
 if(fs.existsSync('calendario_fantacalcio.json')){
  const ref=JSON.parse(fs.readFileSync('calendario_fantacalcio.json','utf8')).find(x=>x.gw===gw)
  if(ref){const keys=a=>a.map(r=>text(r.home)+'|'+text(r.away)).sort();check(JSON.stringify(keys(cal))===JSON.stringify(keys(ref.matches)),'Calendario diverso dal riferimento GW'+gw)}
  else warnings.push('Calendario fantacalcio GW'+gw+' non disponibile: verificare screenshot')
 }
}
console.log(JSON.stringify({gw,errors,warnings},null,2))
if(errors.length)process.exitCode=1
else console.log('VALIDATION_PASS')
