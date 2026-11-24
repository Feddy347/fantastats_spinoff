import fs from 'node:fs'
const key=process.env.FOOTBALL_DATA_API_KEY
if(!key)throw Error('FOOTBALL_DATA_API_KEY mancante')
const res=await fetch('https://api.football-data.org/v4/competitions/SA/matches?season=2026',{headers:{'X-Auth-Token':key}})
if(!res.ok)throw Error('Football-Data HTTP '+res.status)
const data=await res.json()
if(!Array.isArray(data.matches)||data.matches.length!==380||new Set(data.matches.map(m=>m.id)).size!==380)throw Error('Calendario non completo')
const matches=data.matches.map(m=>({id:m.id,matchday:m.matchday,kickoff:m.utcDate,status:m.status,home:m.homeTeam.shortName||m.homeTeam.name,away:m.awayTeam.shortName||m.awayTeam.name}))
fs.writeFileSync('serie-a-calendar.json',JSON.stringify({season:2026,updatedAt:new Date().toISOString(),matches}))
console.log('CALENDAR_UPDATED '+JSON.stringify({matches:matches.length,next:matches.filter(m=>m.status==='TIMED'&&Date.parse(m.kickoff)>Date.now()).sort((a,b)=>Date.parse(a.kickoff)-Date.parse(b.kickoff))[0]}))
