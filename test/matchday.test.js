import test from 'node:test'
import assert from 'node:assert/strict'
import { matchFixtures, retrieveMatchday } from '../lib/matchday.js'
const teams=['Atalanta BC','Bologna FC 1909','Cagliari Calcio','Como 1907','ACF Fiorentina','Frosinone Calcio','Genoa CFC','FC Internazionale Milano','Juventus FC','SS Lazio','US Lecce','AC Milan','AC Monza','SSC Napoli','Parma Calcio 1913','AS Roma','US Sassuolo Calcio','Torino FC','Udinese Calcio','Venezia FC']
const date='2026-11-21T17:00:00Z'
const matches=Array.from({length:10},(_,i)=>({homeTeam:{name:teams[i*2]},awayTeam:{name:teams[i*2+1]},utcDate:date,score:{fullTime:{home:1,away:5}}}))
const games=matches.map((m,i)=>({id:'Game:'+i,date,statusTyped:'played',homeTeam:m.homeTeam,awayTeam:m.awayTeam,homeScore:1,awayScore:5}))
test('matching indipendente dall ordine e con alias',()=>{
 const shuffled=[...games].reverse()
 shuffled.find(g=>g.id==='Game:1').awayTeam={name:'Calcio Como'}
 assert.deepEqual(matchFixtures(matches,shuffled).map(g=>g.id),games.map(g=>g.id))
})
test('rifiuta partite mancanti e ambigue',()=>{
 assert.throws(()=>matchFixtures(matches,games.slice(1)),/Matching/)
 assert.throws(()=>matchFixtures(matches,[...games,{...games[0],id:'Game:duplicate'}]),/Matching/)
})
test('paginazione e quattro gol',async()=>{
 let pages=0
 const result=await retrieveMatchday({season:2026,matchday:12,getCalendar:async()=>matches,
 getPage:async()=>++pages===1?{nodes:games.slice(0,5),pageInfo:{hasNextPage:true,endCursor:'5'}}:{nodes:games.slice(5),pageInfo:{hasNextPage:false}},
 getStats:async id=>{const g=games.find(x=>x.id===id);return {...g,scored:true,playerGameScores:Array.from({length:22},(_,i)=>({anyPlayer:{slug:id==='Game:7'&&i===0?'donyell-malen':id+'-'+i},anyPlayerGameStats:{minsPlayed:90,goals:id==='Game:7'&&i===0?4:0}}))}},
 pause:async()=>{}})
 assert.equal(pages,2)
 assert.equal(result.games.length,10)
 assert.equal(result.statsBySlug.get('donyell-malen').goals,4)
})
test('blocca statistiche non elaborate',async()=>{
 await assert.rejects(retrieveMatchday({season:2026,matchday:12,getCalendar:async()=>matches,getPage:async()=>({nodes:games,pageInfo:{hasNextPage:false}}),getStats:async()=>({scored:false}),pause:async()=>{}}),/non pronte/)
})
