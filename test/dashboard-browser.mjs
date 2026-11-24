import { chromium } from 'playwright'
import assert from 'node:assert/strict'
const browser=await chromium.launch({headless:true,args:['--no-sandbox']})
try{
const page=await browser.newPage({timezoneId:'Europe/Rome'})
const errors=[]
page.on('pageerror',e=>errors.push(e.message))
await page.clock.setFixedTime(new Date('2026-11-24T21:00:00Z'))
await page.goto('http://127.0.0.1:8765/dashboard.html')
await page.waitForFunction(()=>document.querySelector('#next-gw')?.textContent.includes('GW13'))
assert.match(await page.locator('#next-gw').innerText(),/Venezia.*Bologna/)
assert.match(await page.locator('#next-kick').innerText(),/20:45/)
await page.clock.setFixedTime(new Date('2026-11-27T19:45:01Z'))
await page.evaluate(()=>countdown())
assert(! (await page.locator('#next-gw').innerText()).includes('GW13'))
const info=await page.evaluate(()=>{const d=window.FANTASTATS_DATA;return {competitions:d.competitions.map(c=>({id:c.id,gws:c.gws,teams:c.standings.length})),rows:d.playerGw.length,malen:d.playerGw.find(r=>r.gw===12&&r.nome==='Malen'),partial:d.details['6'].C_fanta7['Schiaffield Wednesday'].map(r=>({id:r.player_id,role:r.ruolo,score:r.punteggio}))}})
assert.equal(info.competitions.length,10)
for(const c of info.competitions){assert.deepEqual(c.gws,Array.from({length:12},(_,i)=>i+1));assert.equal(c.teams,c.id.startsWith('C_')?10:6)}
assert.equal(info.rows,3784)
assert.equal(info.malen.gol,4)
assert.equal(info.partial.length,7)
assert.equal(info.partial.filter(r=>r.id==null||r.id==='').length,1)
for(const hash of ['league/classic','league/mantra','comp/C_scontri','comp/M_scontri','comp/C_fanta7','gw/C_fanta7/6','gw/M_scontri/12','players','rosters','home']){
await page.evaluate(h=>location.hash=h,hash)
await page.waitForTimeout(150)
assert((await page.locator('#view').innerText()).trim().length>30,hash)
if(hash==='gw/C_fanta7/6'){
 const match=page.locator('.match-card').filter({has:page.locator('.teamname').getByText('Schiaffield Wednesday',{exact:true})})
 assert.equal(await match.count(),1)
 await match.getByRole('button',{name:/Mostra formazioni e voti/}).click()
 const lineup=match.locator('.lineup').filter({has:page.getByRole('heading',{name:'Schiaffield Wednesday',exact:true})})
 const empty=lineup.locator('.player-row').filter({hasText:'Posizione scoperta'})
 await empty.waitFor({state:'visible'})
 assert.equal(await empty.count(),1)
 assert.match(await empty.innerText(),/0 FP/)
 assert.match(await empty.innerText(),/\bC\b/)
 console.log('EMPTY_SLOT_UI_OK '+await empty.innerText())
}
}
assert.deepEqual(errors,[])
console.log('DASHBOARD_OK '+JSON.stringify({competitions:info.competitions,playerRows:info.rows,malenGoals:info.malen.gol,partial:info.partial}))
}finally{await browser.close()}
