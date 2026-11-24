import XLSX from 'xlsx'
import fs from 'node:fs'
import { fetchClubRoster, SERIE_A_CLUBS, sleep, SORARE_REQUEST_DELAY_MS } from '../lib/sorare.js'
const source = XLSX.readFile('Quotazioni_Fantacalcio_Stagione_2026_27.xlsx')
const old = XLSX.readFile('listone_slug.xlsx')
const rows = XLSX.utils.sheet_to_json(old.Sheets[old.SheetNames[0]])
const byId = new Map(rows.map(r=>[String(r.id),r]))
if(byId.size!==rows.length)throw Error('ID duplicati nel listone precedente')
const norm = s => String(s??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]/g,'')
const words = s => String(s??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().split(/[^a-z0-9]+/).filter(Boolean)
const read = sheet => XLSX.utils.sheet_to_json(source.Sheets[sheet],{range:1}).filter(r=>Number.isInteger(Number(r.Id))&&r.Nome&&r.Squadra)
const active=read('Tutti'), departed=read('Ceduti')
if(active.length<500||new Set(active.map(r=>String(r.Id))).size!==active.length)throw Error('Listone ufficiale incompleto o duplicato')
const roster=new Map()
for(const c of SERIE_A_CLUBS){
 const players=await fetchClubRoster(c.slug)
 if(!players.length)throw Error('Rosa Sorare vuota: '+c.team)
 roster.set(c.team,players)
 console.log('ROSTER '+c.team+' '+players.length)
 await sleep(SORARE_REQUEST_DELAY_MS)
}
// Learn role conversion only when the same Classic/Mantra combination has
// exactly one observed Fantastats role set in the existing listone.
const roleMap=new Map()
for(const r of rows){
 if(!r.role_fantastats)continue
 const k=String(r.role_classic)+'|'+String(r.role_mantra)
 if(!roleMap.has(k))roleMap.set(k,new Set())
 roleMap.get(k).add(String(r.role_fantastats).split(';').map(x=>x.trim()).sort().join(';'))
}
const out=[], review=[], historical=[]
for(const q of active){
 const prev=byId.get(String(q.Id))
 const club=roster.get(q.Squadra)??[]
 const slug=prev?.sorare_slug
 const rosterMatch=slug?club.find(p=>p.slug===slug):null
 const names=words(q.Nome), surname=names[0]??''
 const candidates=club.filter(p=>{
  if([p.displayName,p.lastName,p.firstName].some(n=>norm(n)===norm(q.Nome)))return true
  const parts=words(p.displayName+' '+p.lastName)
  return surname.length>=3&&parts.includes(surname)&&names.slice(1).every(n=>parts.some(w=>w.startsWith(n)))
 })
 const unique=[...new Map(candidates.map(p=>[p.slug,p])).values()]
 const roleChoices=[...(roleMap.get(String(q.R)+'|'+String(q.RM))??[])]
 const sameRoles=prev&&String(prev.role_classic)===String(q.R)&&String(prev.role_mantra)===String(q.RM)
 const role=sameRoles?prev.role_fantastats??'':''
 // Preserve verified historical identity by ID; new matches remain proposals.
 const row={...prev,id:q.Id,nome:q.Nome,squadra:q.Squadra,role_classic:q.R,role_mantra:q.RM,role_fantastats:role,sorare_slug:slug??'',sorare_display_name:rosterMatch?.displayName??prev?.sorare_display_name??''}
 out.push(row)
 if(!prev||!slug||!rosterMatch||!role||prev.nome!==q.Nome||prev.squadra!==q.Squadra){
  review.push({id:q.Id,nome:q.Nome,squadra:q.Squadra,old_name:prev?.nome??'',old_team:prev?.squadra??'',old_slug:slug??'',roster_verified:!!rosterMatch,role_classic:q.R,role_mantra:q.RM,old_role_fantastats:prev?.role_fantastats??'',suggested_role_fantastats:roleChoices.length===1?roleChoices[0]:'',candidate_count:unique.length,candidate_slugs:unique.map(p=>p.slug).join('; '),candidate_names:unique.map(p=>p.displayName).join('; '),review_reason:[!prev?'new_id':'',!slug?'missing_slug':'',slug&&!rosterMatch?'slug_not_in_current_roster':'',!role?'role_review':'',prev&&prev.squadra!==q.Squadra?'team_changed':'',prev&&prev.nome!==q.Nome?'name_changed':''].filter(Boolean).join(';')})
 }
}
const activeIds=new Set(active.map(r=>String(r.Id)))
for(const r of rows)if(!activeIds.has(String(r.id)))historical.push(r)
for(const q of departed)if(!byId.has(String(q.Id))&&!activeIds.has(String(q.Id)))historical.push({id:q.Id,nome:q.Nome,squadra:q.Squadra,role_classic:q.R,role_mantra:q.RM,role_fantastats:'',sorare_slug:'',sorare_display_name:''})
const wb=XLSX.utils.book_new()
const headers=['id','nome','squadra','role_classic','role_mantra','role_fantastats','sorare_slug','sorare_display_name']
XLSX.utils.book_append_sheet(wb,XLSX.utils.json_to_sheet(out,{header:headers}),'Listone')
XLSX.utils.book_append_sheet(wb,XLSX.utils.json_to_sheet(review),'Da verificare')
XLSX.utils.book_append_sheet(wb,XLSX.utils.json_to_sheet(historical,{header:headers}),'Storico')
fs.mkdirSync('listone-review',{recursive:true})
XLSX.writeFile(wb,'listone-review/listone_proposta.xlsx')
const summary={active:active.length,old:rows.length,review:review.length,newIds:active.filter(r=>!byId.has(String(r.Id))).length,missingSlug:out.filter(r=>!r.sorare_slug).length,missingRole:out.filter(r=>!r.role_fantastats).length,historical:historical.length}
console.log('LISTONE_SUMMARY '+JSON.stringify(summary))
console.log('LISTONE_REVIEW '+JSON.stringify(review))
fs.writeFileSync('listone-review/report.json',JSON.stringify({summary,review},null,2))
