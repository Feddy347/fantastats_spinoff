import XLSX from 'xlsx'
import {makePlayerResolver} from '../lib/playerIdentity.js'
import {MODULES} from '../lib/modules.js'
const w=XLSX.readFile('listone_slug.xlsx'),rows=XLSX.utils.sheet_to_json(w.Sheets[w.SheetNames[0]])
const resolve=makePlayerResolver(rows,XLSX.utils.sheet_to_json(w.Sheets.Alias_storici))
for(let gw=6;gw<=12;gw++){
const b=XLSX.readFile('formazioni/formazioni_GW'+gw+'.xlsx')
const p=XLSX.utils.sheet_to_json(b.Sheets.Classic).filter(r=>r.utente==='Schiaffield Wednesday').map(r=>({name:r.giocatore,team:r.squadra,type:r.tipo,roles:resolve(r.giocatore,r.squadra)?.role_fantastats}))
const pool=p.map((r,i)=>({...r,i,roles:(r.roles||'').split(';')}))
function max(slots,i=0,used=new Set()){if(i===slots.length)return 0;let n=max(slots,i+1,used);for(const r of pool)if(!used.has(r.i)&&r.roles.includes(slots[i])){const u=new Set(used);u.add(r.i);n=Math.max(n,1+max(slots,i+1,u));if(n===slots.length-i)break}return n}
console.log('FS7_HIST '+JSON.stringify({gw,players:p,modules:MODULES.map(m=>({id:m.id,filled:max(m.slots)}))}))
}
