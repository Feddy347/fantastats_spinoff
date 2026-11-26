import { chromium } from 'playwright'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import XLSX from 'xlsx'
const core=JSON.parse(fs.readFileSync('v4/data/core.json','utf8'))
assert.equal(core.competitions.length,10)
assert.deepEqual(core.availableGws,Array.from({length:12},(_,i)=>i+1))
assert(fs.statSync('v4/data/core.json').size<5*1024*1024,'Core too large')
const wb=XLSX.readFile('fantastats_stagione.xlsx'),src=XLSX.utils.sheet_to_json(wb.Sheets._dati_giornate)
const sourceDetails=XLSX.utils.sheet_to_json(wb.Sheets._dettaglio_giornate)
let checked=0,detailCount=0
for(const r of src){const c=core.gameweeks[r.gw].games[r.modalita],m=c.board?c.board.find(x=>x.team===r.utente):c.matches.find(x=>x.home===r.utente||x.away===r.utente);assert(m);const score=c.board?m.score:m.home===r.utente?m.homeScore:m.awayScore;assert.equal(Number(score),r.punteggio);checked++}
for(const g of core.availableGws){const d=JSON.parse(fs.readFileSync('v4/data/gw/'+g+'.json','utf8'));for(const [cid,teams] of Object.entries(d.details))for(const [team,rs] of Object.entries(teams)){for(const r of rs){const source=sourceDetails.find(s=>s.gw===g&&s.modalita===cid&&s.utente===team&&s.slot_index===r.slot_index);assert(source);assert.equal(r.punteggio,source.punteggio);assert.deepEqual(d.actionPool[r.actionRef],JSON.parse(source.action_details||'[]'));detailCount++}}}
assert.equal(checked,960);assert.equal(detailCount,sourceDetails.length)
for(const c of core.competitions){assert.equal(c.standings.length,c.league==='classic'?10:6);assert.deepEqual(c.standings,XLSX.utils.sheet_to_json(wb.Sheets[c.sheet],{defval:null}))}
const malen=core.players.find(p=>p.nome==='Malen'),ph=JSON.parse(fs.readFileSync('v4/data/players/'+malen.id+'.json','utf8'));assert.equal(ph.history.find(r=>r.gw===12).gol,4)
console.log('V4_PARITY '+JSON.stringify({scores:checked,details:detailCount,competitions:10,malen:malen.id}))
const browser=await chromium.launch({headless:true,args:['--no-sandbox']})
try{
const page=await browser.newPage({viewport:{width:1440,height:960},timezoneId:'Europe/Rome'})
const errors=[],requests=[]
page.on('pageerror',e=>{errors.push(e.message);console.error('BROWSER_ERROR',e.message)});page.on('console',m=>{if(m.type()==='error')console.error('BROWSER_CONSOLE',m.text())});page.on('requestfailed',r=>console.error('REQUEST_FAILED',r.url(),r.failure()));page.on('request',r=>requests.push(r.url()))
await page.clock.setFixedTime(new Date('2026-11-24T21:00:00Z'))
await page.goto('http://127.0.0.1:8765/')
await page.waitForFunction(()=>document.querySelector('#nextTitle')?.textContent.includes('GW13')).catch(async e=>{console.error('HOME_CONTENT',await page.locator('body').innerText());throw e})
assert.match(await page.locator('#kick').innerText(),/20:45/);await page.locator('#nextRound summary').click();assert.equal(await page.locator('#roundMatches .schedule-row').count(),10);await page.locator('#nextRound summary').click();await page.locator('.home-expand>details').first().locator('summary').click();await page.locator('[data-scope=week] [data-leader-mode=fantastats]').click();await page.locator('[data-scope=week] [data-leader-role=A]').click();assert(await page.locator('[data-scope=week] .leader-row').count());assert.equal(await page.locator('[data-scope=week] [data-leader-role=A]').getAttribute('aria-pressed'),'true');await page.locator('.home-expand>details').first().locator('summary').click()
assert(!requests.some(x=>x.includes('/data/gw/')||x.includes('/data/players/')))
fs.mkdirSync('preview-screens',{recursive:true})
await page.screenshot({path:'preview-screens/01-home.png',fullPage:true})
const go=async(hash,pattern)=>{await page.evaluate(h=>location.hash=h,hash);await page.waitForFunction(p=>document.querySelector('h1')&&new RegExp(p,'i').test(document.querySelector('h1').textContent),pattern);assert(!await page.getByText('Pagina non disponibile',{exact:true}).count())}
await go('league/classic','SWOS League');await page.getByRole('link',{name:'Schiaffield Wednesday',exact:false}).first().click();await page.waitForFunction(()=>document.querySelector('h1')?.textContent==='Schiaffield Wednesday')
await page.screenshot({path:'preview-screens/02-team.png',fullPage:true})
await page.getByRole('button',{name:'Segui squadra'}).click()
await go('home','Prossima giornata');assert.equal(await page.locator('.home-tiles .tile').count(),4);assert.equal(await page.locator('.home-expand>details').count(),2);await go('comp/C_scontri','Classic 11');await page.locator('#standingRange').fill('0');assert.equal(await page.locator('#standingsLabel').innerText(),'Dopo GW1')
await go('player/'+malen.id,'Malen');await page.screenshot({path:'preview-screens/03-player.png',fullPage:true})
await page.getByRole('link',{name:'Partite',exact:true}).click();await page.waitForSelector('table');await page.locator('a[href="#performance/'+malen.id+'/12/fantastats/normal"]').first().click();await page.waitForFunction(()=>document.querySelector('h1')?.textContent.includes('GW12'));assert(await page.getByText('Statistiche della partita',{exact:true}).count())
await page.screenshot({path:'preview-screens/04-performance.png',fullPage:true})
await go('lineup/C_fanta7/6/Schiaffield%20Wednesday','Formazione');assert.equal(await page.getByText('Posizione scoperta',{exact:true}).count(),1);assert.equal(await page.getByRole('heading',{name:'Qual era la miglior formazione schierabile?',exact:true}).count(),1)
await page.locator('a.modal-link').first().click();await page.waitForSelector('#performanceDialog[open]');await page.waitForSelector('#performanceDialog >> text=Azioni e contributi al punteggio');assert(await page.locator('#performanceDialog .legend-icons').count());await page.screenshot({path:'preview-screens/05-contribution.png',fullPage:true});await page.keyboard.press('Escape');assert.equal(await page.locator('#performanceDialog[open]').count(),0)
await page.screenshot({path:'preview-screens/05-contribution.png',fullPage:true})
await go('players','Esplora giocatori');await page.locator('#pq').fill('Malen');assert(await page.locator('#playerTable').getByRole('link',{name:'Malen',exact:true}).count());await page.locator('#system').selectOption('mantra')
await go('compare/'+malen.id,'Confronta giocatori');assert(await page.getByRole('heading',{name:'Confronto',exact:true}).count());await page.locator('.compare-query').nth(1).fill('Mctomin');assert(await page.locator('.compare-suggestions button').count());await page.locator('.compare-suggestions button').first().click();await page.waitForFunction(()=>document.querySelectorAll('.remove-compare').length===2);assert.equal(await page.getByText('Media FS',{exact:true}).count(),0);assert(await page.locator('.compare-value.positive').count());assert(await page.locator('.compare-value.negative').count());assert(await page.locator('.chart .zero-line').count())
await go('seven/classic/Schiaffield%20Wednesday','Consigli Fantastats 7');assert(await page.getByRole('heading',{name:'I migliori sette da schierare'}).count());assert.equal(await page.locator('.pitch .pick').count(),7);await page.screenshot({path:'preview-screens/07-seven.png',fullPage:true});await go('day/12','Gameweek 12');assert.equal(await page.getByRole('heading',{name:'Top XI · Classic',exact:true}).count(),1);assert.equal(await page.getByRole('heading',{name:'Flop XI · Classic',exact:true}).count(),1);await go('records','Record della stagione')
await page.locator('#globalSearch').focus();await page.locator('#globalSearch').fill('Malen');await page.locator('#searchResults').getByRole('link',{name:/Malen/}).first().click();await page.waitForFunction(()=>document.querySelector('h1')?.textContent==='Malen')
await page.setViewportSize({width:390,height:844});await go('home','Prossima giornata');await page.screenshot({path:'preview-screens/06-mobile.png',fullPage:true})
assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+2),'Mobile overflow')
assert.deepEqual(errors,[])
console.log('V4_BROWSER_PASS')
}finally{await browser.close()}
