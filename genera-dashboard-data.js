import XLSX from 'xlsx'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { fsRateFromPoints } from './lib/fsRate.js'
import { goalThresholds } from './lib/fasceGol.js'

const ROOT = process.cwd()
const SEASON_FILE = path.join(ROOT, 'fantastats_stagione.xlsx')
const STATS_FILE = path.join(ROOT, 'statistiche_giocatori.xlsx')
const ROSE_FILE = path.join(ROOT, 'rose.xlsx')
const FORMATIONS_DIR = path.join(ROOT, 'formazioni')
const OUTPUT_FILE = path.join(ROOT, 'dashboard-data.js')

const COMPETITIONS = [
  { id:'C_scontri', league:'classic', title:'Classic 11 — Serie A', subtitle:'Scontri diretti · 3/1/0', sheet:'CL_C_scontri', kind:'direct', scoreMode:'classic', roleSystem:'classic', numPlayers:11, isFlop:false },
  { id:'C_tutti',   league:'classic', title:'Classic 11 — Tutti contro tutti', subtitle:'9 scontri a testa per GW · 3/1/0', sheet:'CL_C_tutti', kind:'roundrobin', scoreMode:'classic', roleSystem:'classic', numPlayers:11, isFlop:false },
  { id:'C_fanta7',  league:'classic', title:'Fantastats 7 — Serie A', subtitle:'Scontri diretti · migliori 7', sheet:'CL_C_fanta7', kind:'direct', scoreMode:'fanta7', roleSystem:'fantastats', numPlayers:7, isFlop:false },
  { id:'C_f1',      league:'classic', title:'Classic 11 — Formula 1', subtitle:'25-18-15… per piazzamento di giornata', sheet:'CL_C_f1', kind:'formula1', scoreMode:'classic', roleSystem:'classic', numPlayers:11, isFlop:false },
  { id:'C_flop',    league:'classic', title:'Flop XI — Serie A', subtitle:'Scontri diretti · vince chi floppa meglio', sheet:'CL_C_flop', kind:'direct', scoreMode:'flop', roleSystem:'classic', numPlayers:11, isFlop:true },

  { id:'M_scontri', league:'mantra', title:'Mantra 11 — Serie A', subtitle:'Scontri diretti · 3/1/0', sheet:'CL_M_scontri', kind:'direct', scoreMode:'mantra', roleSystem:'mantra', numPlayers:11, isFlop:false },
  { id:'M_tutti',   league:'mantra', title:'Mantra 11 — Tutti contro tutti', subtitle:'5 scontri a testa per GW · 3/1/0', sheet:'CL_M_tutti', kind:'roundrobin', scoreMode:'mantra', roleSystem:'mantra', numPlayers:11, isFlop:false },
  { id:'M_fanta7',  league:'mantra', title:'Fantastats 7 — Tutti contro tutti', subtitle:'5 scontri a testa per GW · migliori 7', sheet:'CL_M_fanta7', kind:'roundrobin', scoreMode:'fanta7', roleSystem:'fantastats', numPlayers:7, isFlop:false },
  { id:'M_f1',      league:'mantra', title:'Mantra 11 — Formula 1', subtitle:'25-18-15… per piazzamento di giornata', sheet:'CL_M_f1', kind:'formula1', scoreMode:'mantra', roleSystem:'mantra', numPlayers:11, isFlop:false },
  { id:'M_flop',    league:'mantra', title:'Flop XI — Serie A', subtitle:'Scontri diretti · vince chi floppa meglio', sheet:'CL_M_flop', kind:'direct', scoreMode:'flop', roleSystem:'mantra', numPlayers:11, isFlop:true },
]

const COMP_BY_ID = Object.fromEntries(COMPETITIONS.map(c => [c.id, c]))
const F1_POINTS = [25,18,15,12,10,8,6,4,2,1]

function rows(wb, sheetName) {
  if (!wb.SheetNames.includes(sheetName)) return []
  return XLSX.utils.sheet_to_json(wb.Sheets[sheetName], { defval: null })
}

function n(v) {
  const x = Number(v)
  return Number.isFinite(x) ? x : 0
}

function round2(v) {
  return Math.round((Number(v) + Number.EPSILON) * 100) / 100
}

function splitRoles(v) {
  return String(v ?? '')
    .split(';')
    .map(x => x.trim())
    .filter(Boolean)
}

function roleField(system) {
  if (system === 'classic') return 'ruolo_classic'
  if (system === 'mantra') return 'ruolo_mantra'
  return 'ruolo_fantastats'
}

function scoreField(system, isFlop = false) {
  return `${isFlop ? 'punteggio_flop_' : 'punteggio_'}${system}`
}

function rowScore(r, system, isFlop = false) {
  const exact = r?.[scoreField(system, isFlop)]

  if (exact != null && Number.isFinite(Number(exact))) {
    return Number(exact)
  }

  // Fallback per dati storici prima del Blocco 2.
  const legacy = isFlop ? r?.punteggio_flop : r?.punteggio
  return Number.isFinite(Number(legacy)) ? Number(legacy) : null
}

function rowRoleMatches(r, system, role) {
  if (!role) return false
  return splitRoles(r?.[roleField(system)]).includes(String(role))
}

function percentileRank(value, pool) {
  const x = Number(value)
  const vals = pool.map(Number).filter(Number.isFinite)

  if (!Number.isFinite(x) || vals.length === 0) return null

  let lower = 0
  let equal = 0

  for (const v of vals) {
    if (v < x) lower++
    else if (v === x) equal++
  }

  // Mid-rank percentile: gestisce i pari in modo simmetrico.
  return round2(((lower + equal * 0.5) / vals.length) * 100)
}

function goalProgress(score, thresholds) {
  const s = Number(score)
  if (!Number.isFinite(s) || !thresholds?.length) {
    return { goals:0, nextThreshold:null, missing:null }
  }

  let goals = 0
  for (const t of thresholds) {
    if (s >= t) goals++
    else break
  }

  const nextThreshold = goals < thresholds.length ? thresholds[goals] : null

  return {
    goals,
    nextThreshold,
    missing:
      nextThreshold == null
        ? null
        : round2(Math.max(0, nextThreshold - s)),
  }
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

function readRosters() {
  if (!fs.existsSync(ROSE_FILE)) {
    throw new Error(`File non trovato: ${ROSE_FILE}`)
  }

  const wb = XLSX.readFile(ROSE_FILE)
  const rosterRows = rows(wb, 'Rose')

  const rosters = {
    classic: {},
    mantra: {},
  }

  for (const r of rosterRows) {
    const rawLeague = String(r.lega ?? '').trim().toLowerCase()
    const league =
      rawLeague === 'classic' ? 'classic' :
      rawLeague === 'mantra' ? 'mantra' :
      null

    const user = String(r.utente ?? '').trim()
    const player = String(r.giocatore ?? '').trim()

    if (!league || !user || !player) continue

    if (!rosters[league][user]) rosters[league][user] = []

    rosters[league][user].push({
      id: r.id ?? null,
      giocatore: player,
      squadra: String(r.squadra ?? '').trim(),
      costo: r.costo ?? null,
      ruolo_classic: String(r.ruolo_classic ?? '').trim(),
      ruolo_mantra: String(r.ruolo_mantra ?? '').trim(),
      ruolo_fantastats: String(r.ruolo_fantastats ?? '').trim(),
    })
  }

  for (const league of Object.keys(rosters)) {
    for (const user of Object.keys(rosters[league])) {
      rosters[league][user].sort((a, b) =>
        String(a.giocatore).localeCompare(String(b.giocatore), 'it')
      )
    }
  }

  return rosters
}

function rosterPlayerIdsForRole(rosters, league, system, role) {
  const ids = new Set()

  for (const team of Object.values(rosters[league] ?? {})) {
    for (const p of team) {
      if (p.id == null) continue
      if (splitRoles(p[roleField(system)]).includes(String(role))) {
        ids.add(String(p.id))
      }
    }
  }

  return ids
}

function buildPlayerGwIndex(playerGw) {
  const byPlayerGw = new Map()
  const byGw = new Map()
  const gws = new Set()

  for (const r of playerGw) {
    const gw = n(r.gw)
    const id = String(r.id ?? '')
    if (!gw || !id) continue

    gws.add(gw)
    byPlayerGw.set(`${id}|${gw}`, r)

    if (!byGw.has(gw)) byGw.set(gw, [])
    byGw.get(gw).push(r)
  }

  return {
    byPlayerGw,
    byGw,
    gws:[...gws].sort((a,b)=>a-b),
  }
}

function performanceProfile(playerId, playerGwIndex, system, isFlop) {
  const playedRows = []
  let totalMinutes = 0

  for (const gw of playerGwIndex.gws) {
    const r = playerGwIndex.byPlayerGw.get(`${playerId}|${gw}`)
    if (!r) continue

    const mins = n(r.minuti)
    totalMinutes += mins

    if (mins > 0) {
      const fp = rowScore(r, system, isFlop)
      if (fp == null) continue
      const rate = fsRateFromPoints(fp, isFlop)
      playedRows.push({ gw, fp, fsRate:rate.rate, fsRateRaw:rate.raw, label:rate.label })
    }
  }

  const recentGws = playerGwIndex.gws.slice(-5)
  const last5 = recentGws.map(gw => {
    const r = playerGwIndex.byPlayerGw.get(`${playerId}|${gw}`)

    if (!r || n(r.minuti) <= 0) {
      return { gw, status:'NG', fp:null, fsRate:null, fsRateRaw:null, label:'N.G.' }
    }

    const fp = rowScore(r, system, isFlop)
    if (fp == null) {
      return { gw, status:'NG', fp:null, fsRate:null, fsRateRaw:null, label:'N.G.' }
    }

    const rate = fsRateFromPoints(fp, isFlop)
    return {
      gw,
      status:'played',
      fp:round2(fp),
      fsRate:rate.rate,
      fsRateRaw:rate.raw,
      label:rate.label,
    }
  })

  const appearances = playedRows.length

  return {
    appearances,
    minutes:totalMinutes,
    avgFp:
      appearances
        ? round2(playedRows.reduce((a,r)=>a+r.fp,0) / appearances)
        : null,
    avgFsRate:
      appearances
        ? round2(playedRows.reduce((a,r)=>a+r.fsRate,0) / appearances)
        : null,
    bestFp:
      appearances
        ? round2(Math.max(...playedRows.map(r=>r.fp)))
        : null,
    bestFsRate:
      appearances
        ? Math.max(...playedRows.map(r=>r.fsRate))
        : null,
    last5,
  }
}

function buildPlayerPerformance(players, playerGwIndex) {
  const out = {}

  for (const p of players) {
    const id = String(p.id ?? '')
    if (!id) continue

    out[id] = {
      id:p.id,
      nome:p.nome,
      squadra:p.squadra,
      roles:{
        classic:p.ruolo_classic ?? p.ruolo ?? '',
        mantra:p.ruolo_mantra ?? '',
        fantastats:p.ruolo_fantastats ?? '',
      },
      systems:{},
    }

    for (const system of ['classic','mantra','fantastats']) {
      out[id].systems[system] = {
        normal:performanceProfile(id, playerGwIndex, system, false),
        flop:performanceProfile(id, playerGwIndex, system, true),
      }
    }
  }

  return out
}

function parseJsonField(v, fallback) {
  if (typeof v !== 'string') return v ?? fallback
  try { return JSON.parse(v) } catch { return fallback }
}

function currentPercentiles({
  playerId,
  gw,
  score,
  mins,
  role,
  system,
  isFlop,
  league,
  playerGwIndex,
  rosters,
}) {
  if (!playerId || !gw || !role || n(mins) <= 0) {
    return {
      serieA:null,
      league:null,
      serieASample:0,
      leagueSample:0,
    }
  }

  const gwRows = playerGwIndex.byGw.get(Number(gw)) ?? []

  const seriePool = gwRows
    .filter(r => n(r.minuti) > 0 && rowRoleMatches(r, system, role))
    .map(r => rowScore(r, system, isFlop))
    .filter(v => v != null)

  const rosterIds = rosterPlayerIdsForRole(rosters, league, system, role)

  const leaguePool = gwRows
    .filter(r =>
      n(r.minuti) > 0 &&
      rosterIds.has(String(r.id)) &&
      rowRoleMatches(r, system, role)
    )
    .map(r => rowScore(r, system, isFlop))
    .filter(v => v != null)

  return {
    serieA:percentileRank(score, seriePool),
    league:percentileRank(score, leaguePool),
    serieASample:seriePool.length,
    leagueSample:leaguePool.length,
  }
}

function buildDetails(detailRows, playerPerformance, playerGwIndex, rosters) {
  const details = {}

  for (const raw of detailRows) {
    const gw = String(n(raw.gw))
    const comp = String(raw.modalita ?? '')
    const user = String(raw.utente ?? '')
    if (!gw || !comp || !user) continue

    const compDef = COMP_BY_ID[comp]
    if (!compDef) continue

    if (!details[gw]) details[gw] = {}
    if (!details[gw][comp]) details[gw][comp] = {}
    if (!details[gw][comp][user]) details[gw][comp][user] = []

    const breakdown = parseJsonField(raw.breakdown, {})
    const actionDetails = parseJsonField(raw.action_details, [])

    const playerId = raw.player_id != null ? String(raw.player_id) : null
    const role = String(raw.ruolo ?? '').trim()
    const score = n(raw.punteggio)

    const percentiles = currentPercentiles({
      playerId,
      gw:Number(gw),
      score,
      mins:raw.minuti,
      role,
      system:compDef.roleSystem,
      isFlop:compDef.isFlop,
      league:compDef.league,
      playerGwIndex,
      rosters,
    })

    const profile =
      playerId &&
      playerPerformance[playerId]?.systems?.[compDef.roleSystem]?.[
        compDef.isFlop ? 'flop' : 'normal'
      ]
        ? playerPerformance[playerId].systems[compDef.roleSystem][
            compDef.isFlop ? 'flop' : 'normal'
          ]
        : null

    details[gw][comp][user].push({
      ...raw,
      breakdown,
      action_details:actionDetails,
      percentiles,
      season:profile,
    })
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

function directGameweek(scoreMap, pairs, thresholds) {
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
          homeProgress:goalProgress(h.score, thresholds),
          awayProgress:goalProgress(a.score, thresholds),
        }
      })
  }
}

function roundRobinGameweek(scoreMap, thresholds) {
  const users=[...scoreMap.keys()]
  const stats=new Map(users.map(u=>[u,{points:0,wins:0,draws:0,losses:0}]))
  const matches=[]

  for (const p of allPairs(users)) {
    const h=scoreMap.get(p.home), a=scoreMap.get(p.away)
    let winner='Pareggio'

    if (h.goals>a.goals) {
      stats.get(p.home).points+=3
      stats.get(p.home).wins++
      stats.get(p.away).losses++
      winner=p.home
    } else if (h.goals<a.goals) {
      stats.get(p.away).points+=3
      stats.get(p.away).wins++
      stats.get(p.home).losses++
      winner=p.away
    } else {
      stats.get(p.home).points++
      stats.get(p.away).points++
      stats.get(p.home).draws++
      stats.get(p.away).draws++
    }

    matches.push({
      home:p.home,
      away:p.away,
      homeGoals:h.goals,
      awayGoals:a.goals,
      homeScore:h.score.toFixed(2),
      awayScore:a.score.toFixed(2),
      homeProgress:goalProgress(h.score, thresholds),
      awayProgress:goalProgress(a.score, thresholds),
      winner
    })
  }

  const board=users.map(team=>({
    team,
    score:scoreMap.get(team).score.toFixed(2),
    goals:scoreMap.get(team).goals,
    progress:goalProgress(scoreMap.get(team).score, thresholds),
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
    board:ranked.map(([team,v],i)=>({
      team,
      score:v.score.toFixed(2),
      position:i+1,
      points:F1_POINTS[i]??0
    }))
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

  const rosters = readRosters()
  const { formations, classicCalendars } = readFormationData(playerGw)

  const playerGwIndex = buildPlayerGwIndex(playerGw)
  const playerPerformance = buildPlayerPerformance(players, playerGwIndex)
  const details = buildDetails(
    detailRaw,
    playerPerformance,
    playerGwIndex,
    rosters
  )

  const competitions = COMPETITIONS.map(def=>{
    const standings = rows(seasonWb, def.sheet)

    const gws = [...new Set(
      allData
        .filter(r=>String(r.modalita)===def.id)
        .map(r=>n(r.gw))
        .filter(Boolean)
    )].sort((a,b)=>a-b)

    const thresholds = goalThresholds(
      def.numPlayers,
      def.isFlop,
      6,
      null
    )

    const gameweeks = {}

    for (const gw of gws) {
      const scoreMap = makeScoreMap(allData, def.id, gw)

      if (def.kind === 'roundrobin') {
        gameweeks[String(gw)] = roundRobinGameweek(scoreMap, thresholds)
      } else if (def.kind === 'formula1') {
        gameweeks[String(gw)] = formulaOneGameweek(scoreMap)
      } else {
        const users=[...scoreMap.keys()]
        let pairs

        if (def.league==='classic') {
          pairs=classicCalendars[String(gw)]?.length
            ? classicCalendars[String(gw)]
            : roundRobinPairs(users,gw)
        } else {
          pairs=roundRobinPairs(users,gw)
        }

        gameweeks[String(gw)] = directGameweek(scoreMap,pairs,thresholds)
      }
    }

    return {
      ...def,
      goalBands:{
        thresholds,
        maxDisplayedGoals:6,
      },
      standings,
      gws,
      gameweeks
    }
  })

  const payload = {
    generated:new Date().toISOString(),

    leagues:{
      classic:{name:'SWOS League',type:'Classic · 10 utenti'},
      mantra:{name:'PremierMantra',type:'Mantra · 6 utenti'},
    },

    ratingScale:{
      normal:{anchors:[{fp:0,rate:0},{fp:5.2,rate:50},{fp:17,rate:100}]},
      flop:{anchors:[{fp:0,rate:0},{fp:1,rate:50},{fp:3.9,rate:100}]},
      labels:[
        {min:null,max:0,label:'Vabbè almeno non piove'},
        {min:0,max:20,label:'Madre de Dios...'},
        {min:20,max:40,label:'Butta male'},
        {min:40,max:50,label:'Meh'},
        {min:50,max:65,label:'Ha fatto il suo'},
        {min:65,max:80,label:'Top'},
        {min:80,max:90,label:'El generalissimo'},
        {min:90,max:100,label:'GOAT'},
        {min:100,max:null,label:'Compà chiudi tutto'},
      ],
    },

    competitions,
    rosters,
    formations,
    details,

    players,
    playerGw,

    // Struttura già pronta per il modal del Blocco 3.
    playerPerformance,
    availableGws:playerGwIndex.gws,
  }

  const js =
    `// Generato automaticamente da genera-dashboard-data.js\n` +
    `window.FANTASTATS_DATA = ${JSON.stringify(payload)};\n`

  fs.writeFileSync(OUTPUT_FILE, js, 'utf8')

  console.log(`Dashboard dati aggiornata: ${path.basename(OUTPUT_FILE)}`)
  return payload
}

const isMain =
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)

if (isMain) {
  try {
    generateDashboardData()
  } catch (e) {
    console.error(`Errore dashboard: ${e.message}`)
    process.exit(1)
  }
}
