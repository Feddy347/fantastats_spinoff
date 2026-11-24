import fs from 'node:fs'
import path from 'node:path'
import assert from 'node:assert/strict'
import crypto from 'node:crypto'
import XLSX from 'xlsx'
const fingerprint=w=>Object.fromEntries(w.SheetNames.map(s=>{const h=crypto.createHash('sha256');const sh=w.Sheets[s];for(const k of Object.keys(sh).filter(k=>!k.startsWith('!')).sort()){const c=sh[k];h.update(JSON.stringify([k,c.t,c.v,c.f??null]));h.update('\n')}return[s,h.digest('hex')]}))
for(const file of ['fantastats_stagione.xlsx','statistiche_giocatori.xlsx']){
 const orig=fs.statSync(file).size,w=XLSX.readFile(file),before=fingerprint(w),tmp=file.replace('.xlsx','.tmp.xlsx')
 XLSX.writeFile(w,tmp,{compression:true})
 const actual=XLSX.readFile(tmp);assert.deepEqual(actual.SheetNames,w.SheetNames);assert.deepEqual(fingerprint(actual),before)
 const after=fs.statSync(tmp).size
 assert(after<orig,'Compressione senza beneficio: '+file)
 fs.renameSync(tmp,file)
 console.log('WORKBOOK_COMPRESSION '+JSON.stringify({file,before:orig,after,percent:Math.round((1-after/orig)*100),sheets:w.SheetNames.length}))
}
