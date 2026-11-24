import XLSX from 'xlsx'
import assert from 'node:assert/strict'
const path='formazioni/formazioni_GW12.xlsx'
const wb=XLSX.readFile(path), ws=wb.Sheets.Mantra
const data=XLSX.utils.sheet_to_json(ws,{header:1,defval:null})
const header=data[0], ix=Object.fromEntries(header.map((v,i)=>[v,i]))
const target=r=>r[ix.utente]==='TORO LOCO'&&r[ix.tipo]==='Titolare'
const rows=data.filter(target)
const old=['Milinkovic-Sa.','De Winter','Akanji','Ramon','Floriani Muss.','Milla','Couto','Mastantuono','Pulisic','Martinez L.']
const expected=[...old.slice(0,5),'Zielinski',...old.slice(5)]
if(rows.length===11){assert.deepEqual(rows.map(r=>r[ix.giocatore]),expected);console.log('TORO already corrected');process.exit(0)}
assert.deepEqual(rows.map(r=>r[ix.giocatore]),old)
const list=XLSX.readFile('listone_slug.xlsx')
const players=XLSX.utils.sheet_to_json(list.Sheets[list.SheetNames[0]])
const z=players.filter(p=>p.sorare_slug==='piotr-zielinski'||String(p.nome).toLowerCase()==='zielinski')
assert.equal(z.length,1,'Zielinski identity must be unique')
assert(String(z[0].role_mantra).split(';').includes('C'))
const newRow=rows[5].slice()
newRow[ix.giocatore]=z[0].nome
newRow[ix.squadra]=z[0].squadra
newRow[ix.ruolo]='C'
newRow[ix.slot_index]=5
for(const r of rows){
 if(Number(r[ix.slot_index])>=5)r[ix.slot_index]=Number(r[ix.slot_index])+1
 if(r[ix.giocatore]==='Floriani Muss.')r[ix.ruolo]='E'
 if(r[ix.giocatore]==='Couto')r[ix.ruolo]='E'
 if(r[ix.giocatore]==='Martinez L.')r[ix.ruolo]='Pc'
}
data.splice(data.indexOf(rows[5]),0,newRow)
wb.Sheets.Mantra=XLSX.utils.aoa_to_sheet(data)
XLSX.writeFile(wb,path)
console.log('TORO_REPAIRED '+JSON.stringify(data.filter(target).map(r=>({name:r[ix.giocatore],team:r[ix.squadra],role:r[ix.ruolo],slot:r[ix.slot_index]}))))
