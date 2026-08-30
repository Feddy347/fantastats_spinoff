import XLSX from 'xlsx'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const ROOT = process.cwd()
const SEASON_FILE = path.join(ROOT, 'fantastats_stagione.xlsx')
const STATS_FILE = path.join(ROOT, 'statistiche_giocatori.xlsx')
const FORMATIONS_DIR = path.join(ROOT, 'formazioni')
const OUTPUT_FILE = path.join(ROOT, 'dashboard-data.js')

const COMPETITIONS = [
  { id:'C_scontri', league:'classic', title:'Classic 11 — Serie A', subtitle:'Scontri diretti · 3/1/0', sheet:'CL_C_scontri', kind:'direct', scoreMode:'classic' },
  { id:'C_tutti',   league:'classic', title:'Classic 11 — Tutti contro tutti', subtitle:'9 scontri a testa per GW · 3/1/0', sheet:'CL_C_tutti', kind:'roundrobin', scoreMode:'classic' },
  { id:'C_fanta7',  league:'classic', title:'Fantastats 7 — Serie A', subtitle:'Scontri diretti · migliori 7', sheet:'CL_C_fanta7', kind:'direct', scoreMode:'fanta7' },
  { id:'C_f1',      league:'classic', title:'Classic 11 — Formula 1', subtitle:'25-18-15… per piazzamento di giornata', sheet:'CL_C_f1', kind:'formula1', scoreMode:'classic' },
  { id:'C_flop',    league:'classic', title:'Flop XI — Serie A', subtitle:'Scontri diretti · vince chi floppa meglio', sheet:'CL_C_flop', kind:'direct', scoreMode:'flop' },

  { id:'M_scontri', league:'mantra', title:'Mantra 11 — Serie A', subtitle:'Scontri diretti · 3/1/0', sheet:'CL_M_scontri', kind:'direct', scoreMode:'mantra' },
  { id:'M_tutti',   league:'mantra', title:'Mantra 11 — Tutti contro tutti', subtitle:'5 scontri a testa per GW · 3/1/0', sheet:'CL_M_tutti', kind:'roundrobin', scoreMode:'mantra' },
  { id:'M_fanta7',  league:'mantra', title:'Fantastats 7 — Tutti contro tutti', subtitle:'5 scontri a testa per GW · migliori 7', sheet:'CL_M_fanta7', kind:'roundrobin', scoreMode:'fanta7' },
  { id:'M_f1',      league:'mantra', title:'Mantra 11 — Formula 1', subtitle:'25-18-15… per piazzamento di giornata', sheet:'CL_M_f1', kind:'formula1', scoreMode:'mantra' },
  { id:'M_flop',    league:'mantra', title:'Flop XI — Serie A', subtitle:'Scontri diretti · vince chi floppa meglio', sheet:'CL_M_flop', kind:'direct', scoreMode:'flop' },
]

const F1_POINTS = [25,18,15,12,10,8,6,4,2,1]

function rows(wb, sheetName) {
  if (!wb.SheetNames.includes(sheetName)) return []
  return XLSX.utils.sheet_to_json(wb.Sheets[sheetName], { defval: null })
}

function n(v) {
  const x = Number(v)
  return Number.isFinite(x) ? x : 0
}

function roundRobinPairs(users, gw) {
  const arr = [...users].sort()
  if (arr.length % 2 === 1) arr.push('__RIPOSA__')
  const total = arr.length
  if (total < 2) return []
  const rounds = total - 1
  const roundIndex = ((gw - 1) % rounds + rounds) % rounds
  const fixed = arr[0]
  const rest = arr.slice(1)
  const rotated = rest.slice(-roundIndex).concat(rest.slice(0, rest.length - roundIndex))
  const lineup = [fixed, ...rotated]
  const pairs = []
  for (let i = 0; i < total / 2; i++) {
    const home = lineup[i]
    const away = lineup[total - 1 - i]
    if (home === '__RIPOSA__' || away === '__RIPOSA__') continue
    if (Math.floor((gw - 1) / rounds) % 2 === 0) pairs.push({ home, away })
    else pairs.push({ home: away, away: home })
  }
  return pairs
}

function allPairs(users) {
  const out = []
  for (let i = 0; i < users.length; i++) {
    for (let j = i + 1; j < users.length; j++) out.push({ home: users[i], away: users[j] })
  }
  return out
}

function formationFiles() {
  if (!fs.existsSync(FORMATIONS_DIR)) return []
  return fs.readdirSync(FORMATIONS_DIR)
    .map(name => {
      const m = name.match(/^formazioni_GW(\d+)\.xlsx$/i)
      return m ? { gw:Number(m[1]), path:path.join(FORMATIONS_DIR,name) } : null
    })
    .filter(Boolean)
    .sort((a,b)=>a.gw-b.gw)
}

function readFormationData(playerGw) {
  const formations = {}
  const classicCalendars = {}
  const statIndex = new Map()

  for (const r of playerGw) {
    const key = `${n(r.gw)}|${String(r.nome ?? '').trim().toLowerCase()}|${String(r.squadra ?? '').trim().toLowerCase()}`
    statIndex.set(key, r)
  }

  for (const file of formationFiles()) {
    const wb = XLSX.readFile(file.path)
    formations[String(file.gw)] = { classic:{}, mantra:{} }

    for (const [sheet, league] of [['Classic','classic'],['Mantra','mantra']]) {
      for (const r of rows(wb, sheet)) {
        const user = String(r.utente ?? '').trim()
        if (!user) continue
        const rec = { ...r }
        const key = `${file.gw}|${String(r.giocatore ?? '').trim().toLowerCase()}|${String(r.squadra ?? '').trim().toLowerCase()}`
        rec.stats = statIndex.get(key) ?? null
        if (!formations[String(file.gw)][league][user]) formations[String(file.gw)][league][user] = []
        formations[String(file.gw)][league][user].push(rec)
      }
      for (const user of Object.keys(formations[String(file.gw)][league])) {
        formations[String(file.gw)][league][user].sort((a,b)=>n(a.slot_index)-n(b.slot_index))
      }
    }

    const calRows = rows(wb, 'calendario_classic')
    if (calRows.length) {
      classicCalendars[String(file.gw)] = calRows.map(r => {
        const keys = Object.keys(r)
        const home = r.home ?? r.Home ?? r.casa ?? r.Casa ?? r[keys[0]]
        const away = r.away ?? r.Away ?? r.trasferta ?? r.Trasferta ?? r[keys[1]]
        return { home:String(home ?? '').trim(), away:String(away ?? '').trim() }
      }).filter(p=>p.home&&p.away)
    }
  }
  return { formations, classicCalendars }
}

function buildDetails(detailRows) {
  const details = {}
  for (const raw of detailRows) {
    const gw = String(n(raw.gw))
    const comp = String(raw.modalita ?? '')
    const user = String(raw.utente ?? '')
    if (!gw || !comp || !user) continue
    if (!details[gw]) details[gw] = {}
    if (!details[gw][comp]) details[gw][comp] = {}
    if (!details[gw][comp][user]) details[gw][comp][user] = []
    let breakdown = raw.breakdown
    if (typeof breakdown === 'string') {
      try { breakdown = JSON.parse(breakdown) } catch { breakdown = {} }
    }
    details[gw][comp][user].push({ ...raw, breakdown:breakdown ?? {} })
  }
  for (const gw of Object.keys(details)) {
    for (const comp of Object.keys(details[gw])) {
      for (const user of Object.keys(details[gw][comp])) {
        details[gw][comp][user].sort((a,b)=>n(a.slot_index)-n(b.slot_index))
      }
    }
  }
  return details
}

function makeScoreMap(allData, compId, gw) {
  return new Map(
    allData
      .filter(r=>String(r.modalita)===compId && n(r.gw)===gw)
      .map(r=>[String(r.utente), { score:n(r.punteggio), goals:n(r.gol) }])
  )
}

function directGameweek(scoreMap, pairs) {
  return {
    kind:'direct',
    matches:pairs
      .filter(p=>scoreMap.has(p.home)&&scoreMap.has(p.away))
      .map(p=>{
        const h=scoreMap.get(p.home), a=scoreMap.get(p.away)
        return {
          home:p.home,
          result:`${h.goals}-${a.goals}`,
          away:p.away,
          homeScore:h.score.toFixed(2),
          awayScore:a.score.toFixed(2),
        }
      })
  }
}

function roundRobinGameweek(scoreMap) {
  const users=[...scoreMap.keys()]
  const stats=new Map(users.map(u=>[u,{points:0,wins:0,draws:0,losses:0}]))
  const matches=[]
  for (const p of allPairs(users)) {
    const h=scoreMap.get(p.home), a=scoreMap.get(p.away)
    let winner='Pareggio'
    if (h.goals>a.goals) {
      stats.get(p.home).points+=3; stats.get(p.home).wins++; stats.get(p.away).losses++; winner=p.home
    } else if (h.goals<a.goals) {
      stats.get(p.away).points+=3; stats.get(p.away).wins++; stats.get(p.home).losses++; winner=p.away
    } else {
      stats.get(p.home).points++; stats.get(p.away).points++; stats.get(p.home).draws++; stats.get(p.away).draws++
    }
    matches.push({
      home:p.home, away:p.away,
      homeGoals:h.goals, awayGoals:a.goals,
      homeScore:h.score.toFixed(2), awayScore:a.score.toFixed(2), winner
    })
  }
  const board=users.map(team=>({
    team,
    score:scoreMap.get(team).score.toFixed(2),
    goals:scoreMap.get(team).goals,
    points:stats.get(team).points,
    wins:stats.get(team).wins,
    draws:stats.get(team).draws,
    losses:stats.get(team).losses,
  })).sort((a,b)=>b.points-a.points || n(b.score)-n(a.score))
  return { kind:'roundrobin', board, matches }
}

function formulaOneGameweek(scoreMap) {
  const ranked=[...scoreMap.entries()].sort((a,b)=>b[1].score-a[1].score)
  return {
    kind:'formula1',
    board:ranked.map(([team,v],i)=>({team,score:v.score.toFixed(2),position:i+1,points:F1_POINTS[i]??0}))
  }
}

export function generateDashboardData() {
  if (!fs.existsSync(SEASON_FILE)) throw new Error(`File non trovato: ${SEASON_FILE}`)
  if (!fs.existsSync(STATS_FILE)) throw new Error(`File non trovato: ${STATS_FILE}`)

  const seasonWb = XLSX.readFile(SEASON_FILE)
  const statsWb = XLSX.readFile(STATS_FILE)
  const allData = rows(seasonWb, '_dati_giornate')
  const detailRaw = rows(seasonWb, '_dettaglio_giornate')
  const players = rows(statsWb, 'Riepilogo')
  const playerGw = rows(statsWb, '_per_gw')
  const { formations, classicCalendars } = readFormationData(playerGw)
  const details = buildDetails(detailRaw)

  const competitions = COMPETITIONS.map(def=>{
    const standings = rows(seasonWb, def.sheet)
    const gws = [...new Set(allData.filter(r=>String(r.modalita)===def.id).map(r=>n(r.gw)).filter(Boolean))].sort((a,b)=>a-b)
    const gameweeks = {}
    for (const gw of gws) {
      const scoreMap = makeScoreMap(allData, def.id, gw)
      if (def.kind === 'roundrobin') {
        gameweeks[String(gw)] = roundRobinGameweek(scoreMap)
      } else if (def.kind === 'formula1') {
        gameweeks[String(gw)] = formulaOneGameweek(scoreMap)
      } else {
        const users=[...scoreMap.keys()]
        let pairs
        if (def.league==='classic') pairs=classicCalendars[String(gw)]?.length ? classicCalendars[String(gw)] : roundRobinPairs(users,gw)
        else pairs=roundRobinPairs(users,gw)
        gameweeks[String(gw)] = directGameweek(scoreMap,pairs)
      }
    }
    return { ...def, standings, gws, gameweeks }
  })

  const payload = {
    generated:new Date().toISOString(),
    leagues:{
      classic:{name:'SWOS League',type:'Classic · 10 utenti'},
      mantra:{name:'PremierMantra',type:'Mantra · 6 utenti'},
    },
    competitions,
    formations,
    details,
    players,
    playerGw,
  }

  const js = `// Generato automaticamente da genera-dashboard-data.js\nwindow.FANTASTATS_DATA = ${JSON.stringify(payload)};\n`
  fs.writeFileSync(OUTPUT_FILE, js, 'utf8')
  console.log(`Dashboard dati aggiornata: ${path.basename(OUTPUT_FILE)}`)
  return payload
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
if (isMain) {
  try { generateDashboardData() }
  catch (e) { console.error(`Errore dashboard: ${e.message}`); process.exit(1) }
}
