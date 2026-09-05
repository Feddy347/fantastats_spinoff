// Legge le formazioni, calcola i punteggi di una giornata, li accumula nel
// file-stagione in modo IDEMPOTENTE, e ricostruisce dashboard + classifiche
// cumulative + fogli-giornata da tutti i dati presenti.

import XLSX from 'xlsx'
import fs from 'fs'
import { resolveLineupScore } from './resolver.js'
import { modulesFor, roleFieldFor } from './roleSystems.js'
import { computeSerieAScontri, computeTuttiControTutti, computeFormula1, roundRobinPairs } from './modalita.js'
import { scoreToGoals } from './fasceGol.js'
import { readSeasonData, upsertGameweekData, gameweeksInData, DATA_SHEET } from './persistenza.js'
import { updatePlayerStats } from './statistiche.js'
import { fsRateFromPoints } from './fsRate.js'

// key univoca per modalità; label leggibile; fanta di appartenenza
const MODES = [
  { fanta: 'Classic', key: 'C_scontri', label: 'Classic11 Scontri SerieA', system: 'classic', numPlayers: 11, mode: 'serie_a_scontri', isReverse: false },
  { fanta: 'Classic', key: 'C_tutti', label: 'Classic11 TuttiControTutti', system: 'classic', numPlayers: 11, mode: 'tutti_contro_tutti', isReverse: false },
  { fanta: 'Classic', key: 'C_fanta7', label: 'Fantastats7 Scontri', system: 'fantastats', numPlayers: 7, mode: 'serie_a_scontri', isReverse: false },
  { fanta: 'Classic', key: 'C_f1', label: 'Classic11 Formula1', system: 'classic', numPlayers: 11, mode: 'formula_1', isReverse: false },
  { fanta: 'Classic', key: 'C_flop', label: 'Classic FlopXI Scontri', system: 'classic', numPlayers: 11, mode: 'serie_a_scontri', isReverse: true },
  { fanta: 'Mantra', key: 'M_scontri', label: 'Mantra11 Scontri SerieA', system: 'mantra', numPlayers: 11, mode: 'serie_a_scontri', isReverse: false },
  { fanta: 'Mantra', key: 'M_tutti', label: 'Mantra11 TuttiControTutti', system: 'mantra', numPlayers: 11, mode: 'tutti_contro_tutti', isReverse: false },
  { fanta: 'Mantra', key: 'M_fanta7', label: 'Fantastats7 TuttiControTutti', system: 'fantastats', numPlayers: 7, mode: 'tutti_contro_tutti', isReverse: false },
  { fanta: 'Mantra', key: 'M_f1', label: 'Mantra11 Formula1', system: 'mantra', numPlayers: 11, mode: 'formula_1', isReverse: false },
  { fanta: 'Mantra', key: 'M_flop', label: 'Mantra FlopXI Scontri', system: 'mantra', numPlayers: 11, mode: 'serie_a_scontri', isReverse: true },
]

const SEASON_FILE = 'fantastats_stagione.xlsx'

function readFormazioni(sheet) {
  const rows = XLSX.utils.sheet_to_json(sheet)
  const byUser = new Map()
  for (const r of rows) {
    const utente = String(r.utente).trim()
    if (!byUser.has(utente)) byUser.set(utente, { starters: [], bench: [] })
    const entry = {
      slotIndex: r.slot_index != null && r.slot_index !== '' ? Number(r.slot_index) : null,
      ruolo: String(r.ruolo ?? '').trim(),
      giocatore: String(r.giocatore).trim(),
      squadra: String(r.squadra ?? '').trim(),
      ordine: r.ordine_panchina != null && r.ordine_panchina !== '' ? Number(r.ordine_panchina) : 999,
    }
    if (String(r.tipo).trim().toLowerCase().startsWith('tit')) byUser.get(utente).starters.push(entry)
    else byUser.get(utente).bench.push(entry)
  }
  for (const u of byUser.values()) u.bench.sort((a, b) => a.ordine - b.ordine)
  return byUser
}

function resolvePlayerId(listone, giocatore, squadra) {
  const rec = listone.byName.get(`${giocatore.toLowerCase()}|${squadra.toLowerCase()}`)
  return rec ? rec.id : null
}

function deriveFantastats7(starters11, bench11, listone) {
  const DEF = new Set(['DC', 'T', 'C']), OFF = new Set(['ES', 'Tq', 'ATT'])
  const modules = modulesFor('fantastats')
  const fsRoles = (id) => (listone.byId.get(id)?.role_fantastats ?? '').split(';').map((r) => r.trim()).filter(Boolean)
  const withId = starters11.map((s) => ({ ...s, pid: resolvePlayerId(listone, s.giocatore, s.squadra) })).filter((s) => s.pid != null)
  const por = withId.find((s) => fsRoles(s.pid).includes('POR'))
  const movimento = withId.filter((s) => s !== por)
  const defenders = movimento.filter((s) => fsRoles(s.pid).some((r) => DEF.has(r)))
  const offenders = movimento.filter((s) => fsRoles(s.pid).some((r) => OFF.has(r)))
  for (const mod of modules) {
    const need = mod.slotObjs.map((s) => s.roles[0])
    const assigned = []; const usedIds = new Set(); let ok = true
    for (const slotRole of need) {
      if (slotRole === 'POR') { if (!por) { ok = false; break } assigned.push({ slotRole, pid: por.pid }); usedIds.add(por.pid); continue }
      const pool = DEF.has(slotRole) ? defenders : offenders
      const cand = pool.find((s) => !usedIds.has(s.pid) && fsRoles(s.pid).includes(slotRole))
      if (!cand) { ok = false; break }
      assigned.push({ slotRole, pid: cand.pid }); usedIds.add(cand.pid)
    }
    if (ok && assigned.length === 7) {
      const starters = assigned.map((a, i) => ({ slotIndex: i, slotRole: a.slotRole, playerId: a.pid }))
      const benchIds = []
      for (const s of withId) if (!usedIds.has(s.pid)) benchIds.push(s.pid)
      for (const b of bench11) { const pid = resolvePlayerId(listone, b.giocatore, b.squadra); if (pid != null && !usedIds.has(pid)) benchIds.push(pid) }
      return { starters, bench: benchIds.map((pid) => ({ playerId: pid })) }
    }
  }
  return null
}

function build11(userForm, listone) {
  const starters = userForm.starters.filter((s) => s.slotIndex != null).sort((a, b) => a.slotIndex - b.slotIndex)
    .map((s) => ({ slotIndex: s.slotIndex, slotRole: s.ruolo, playerId: resolvePlayerId(listone, s.giocatore, s.squadra) }))
    .filter((s) => s.playerId != null)
  const bench = userForm.bench.map((b) => ({ playerId: resolvePlayerId(listone, b.giocatore, b.squadra) })).filter((b) => b.playerId != null)
  return { starters, bench }
}

function buildRoleById(listone, ids, system) {
  const field = roleFieldFor(system)
  const map = new Map()
  for (const id of ids) { const rec = listone.byId.get(id); if (rec) map.set(id, rec[field]) }
  return map
}

// Calcola il totale squadra di ogni utente per una modalità, in una giornata.
function computeTotals(users, forms, modeDef, listone, statsById) {
  const totalsByUser = new Map()
  const detailsByUser = new Map()

  for (const user of users) {
    const form = forms.get(user)

    if (!form) {
      totalsByUser.set(user, 0)
      detailsByUser.set(user, [])
      continue
    }

    let lineup

    if (modeDef.system === 'fantastats') {
      lineup = deriveFantastats7(
        form.starters,
        form.bench,
        listone
      )

      if (!lineup) {
        totalsByUser.set(user, 0)
        detailsByUser.set(user, [])
        continue
      }
    } else {
      lineup = build11(form, listone)
    }

    const ids = [
      ...lineup.starters.map((s) => s.playerId),
      ...lineup.bench.map((b) => b.playerId)
    ]

    const roleById = buildRoleById(
      listone,
      ids,
      modeDef.system
    )

    const modules = modulesFor(modeDef.system)

    const {
      totalScore,
      contributions
    } = resolveLineupScore({
  starters: lineup.starters,
  bench: lineup.bench,
  statsById,
  roleById,
  modules,
  isReverse: modeDef.isReverse,
  roleSystem: modeDef.system
})

    totalsByUser.set(user, totalScore)

    const details = contributions.map((c) => {
      const rec = c.playerId
        ? listone.byId.get(c.playerId)
        : null
    const rate = fsRateFromPoints(c.score ?? 0, modeDef.isReverse)
      
       return {
        slotIndex: c.slotIndex,
        playerId: c.playerId,
        giocatore: rec?.nome ?? '',
        squadra: rec?.squadra ?? '',
        ruolo: c.role,
        score: Number((c.score ?? 0).toFixed(2)),
        fsRate: rate.rate,
        fsRateRaw: rate.raw,
        fsLabel: rate.label,
        minuti: c.minsPlayed ?? 0,
        subApplied: Boolean(c.subApplied),
        breakdown: c.breakdown ?? null,
        actionDetails: c.actionDetails ?? null
      }
    })

    detailsByUser.set(user, details)
  }

  return {
    totalsByUser,
    detailsByUser
  }
}

export async function computeAllModes({ formazioniPath, gw, listone, statsById, flags }) {
  const inWb = XLSX.readFile(formazioniPath)

  let classicCalendar = null
  if (inWb.SheetNames.includes('calendario_classic')) {
    classicCalendar = XLSX.utils.sheet_to_json(inWb.Sheets['calendario_classic']).map((r) => ({ home: String(r.home).trim(), away: String(r.away).trim() }))
  }

  const usersByFanta = {}
  const formsByFanta = {}
  for (const fanta of ['Classic', 'Mantra']) {
    if (inWb.SheetNames.includes(fanta)) {
      formsByFanta[fanta] = readFormazioni(inWb.Sheets[fanta])
      usersByFanta[fanta] = [...formsByFanta[fanta].keys()]
    }
  }

  // 1) Calcola i totali di QUESTA giornata per ogni modalità e costruisci le righe-dati
  const newDataRows = []
  const newDetailRows = []
  for (const modeDef of MODES) {
    const users = usersByFanta[modeDef.fanta]
    if (!users) continue
    const {
  totalsByUser: totals,
  detailsByUser
} = computeTotals(
  users,
  formsByFanta[modeDef.fanta],
  modeDef,
  listone,
  statsById
)
    for (const [utente, punteggio] of totals) {
      const gol = scoreToGoals(punteggio, modeDef.numPlayers, modeDef.isReverse, null)
      newDataRows.push({ gw, fanta: modeDef.fanta, modalita: modeDef.key, utente, punteggio: Number(punteggio.toFixed(2)), gol })
    }
    for (const [utente, details] of detailsByUser) {
  for (const d of details) {
    newDetailRows.push({
      gw,
      fanta: modeDef.fanta,
      modalita: modeDef.key,
      utente,
      slot_index: d.slotIndex,
      player_id: d.playerId,
      giocatore: d.giocatore,
      squadra: d.squadra,
      ruolo: d.ruolo,
      punteggio: d.score,
      fs_rate: d.fsRate,
      fs_rate_raw: d.fsRateRaw,
      fs_label: d.fsLabel,
      minuti: d.minuti,
      sostituzione: d.subApplied ? 1 : 0,
      breakdown: JSON.stringify(d.breakdown ?? {}),
      action_details: JSON.stringify(d.actionDetails ?? [])
    })
  }
}
  }

  // 2) Accumula in modo idempotente
  const seasonPath = flags.out || SEASON_FILE
  const existing = readSeasonData(seasonPath)
  const allData = upsertGameweekData(existing, gw, newDataRows)

  // 3) Ricostruisci tutto da allData e scrivi il file-stagione
  writeSeasonFile(
  seasonPath,
  allData,
  classicCalendar,
  usersByFanta,
  newDetailRows,
  gw
)

  // 4) Aggiorna il file giocatori separato (in parallelo)
  updatePlayerStats({ gw, listone, statsById, flags })

  const gws = gameweeksInData(allData)
  console.log(`\n=== FATTO ===`)
  console.log(`Giornate nel file: ${gws.join(', ')}`)
  console.log(`File aggiornato: ${seasonPath}`)
}

// Ricostruisce dashboard + classifiche cumulative + fogli-giornata da allData
function writeSeasonFile(
  path,
  allData,
  classicCalendar,
  usersByFanta,
  newDetailRows = [],
  currentGw = null
) {
  const outWb = XLSX.utils.book_new()
  const gws = gameweeksInData(allData)

  // helper: righe dati per (modalita, gw)
  const rowsFor = (modKey, gw) => allData.filter((r) => r.modalita === modKey && Number(r.gw) === Number(gw))

  // --- Ricostruisci le classifiche cumulative per ogni modalità ---
  // Per ogni modalità, per ogni gw, ricalcola punti-giornata; poi somma.
  const cumulativeByMode = {}   // modKey -> Map(utente -> {punti, gol, ...})
  const perGwPointsByMode = {}  // modKey -> Map(gw -> Map(utente->puntiGw))

  for (const modeDef of MODES) {
    const cum = new Map()
    const perGw = new Map()
    for (const gw of gws) {
      const rows = rowsFor(modeDef.key, gw)
      if (rows.length === 0) continue
      const totalsByUser = new Map(rows.map((r) => [r.utente, r.punteggio]))
      const users = [...totalsByUser.keys()]

      let ptsThisGw = new Map()
      if (modeDef.mode === 'serie_a_scontri') {
        let cal = modeDef.fanta === 'Classic' && classicCalendar ? classicCalendar : roundRobinPairs(users, gw)
        const res = computeSerieAScontri(totalsByUser, cal, modeDef.numPlayers, modeDef.isReverse, null)
        res.standings.forEach((s) => ptsThisGw.set(s.user, s.points))
        // accumula anche V/N/P e gol
        res.standings.forEach((s) => {
          const c = cum.get(s.user) ?? { punti: 0, V: 0, N: 0, P: 0, gf: 0, gs: 0, punteggioTot: 0 }
          c.punti += s.points; c.V += s.won; c.N += s.drawn; c.P += s.lost
          c.gf += s.goalsFor ?? 0; c.gs += s.goalsAgainst ?? 0; c.punteggioTot += s.score
          cum.set(s.user, c)
        })
      } else if (modeDef.mode === 'tutti_contro_tutti') {
        const res = computeTuttiControTutti(totalsByUser, modeDef.numPlayers, modeDef.isReverse, null)
        res.standings.forEach((s) => {
          ptsThisGw.set(s.user, s.points)
          const c = cum.get(s.user) ?? { punti: 0, V: 0, N: 0, P: 0, gf: 0, gs: 0, punteggioTot: 0 }
          c.punti += s.points; c.V += s.won; c.N += s.drawn; c.P += s.lost; c.punteggioTot += s.score
          cum.set(s.user, c)
        })
      } else if (modeDef.mode === 'formula_1') {
        const res = computeFormula1(totalsByUser)
        res.standings.forEach((s) => {
          ptsThisGw.set(s.user, s.points)
          const c = cum.get(s.user) ?? { punti: 0, V: 0, N: 0, P: 0, gf: 0, gs: 0, punteggioTot: 0 }
          c.punti += s.points; c.punteggioTot += s.score
          cum.set(s.user, c)
        })
      }
      perGw.set(gw, ptsThisGw)
    }
    cumulativeByMode[modeDef.key] = cum
    perGwPointsByMode[modeDef.key] = perGw
  }

  // --- DASHBOARD (una per fanta): podio di ogni modalità ---
  for (const fanta of ['Classic', 'Mantra']) {
    const modes = MODES.filter((m) => m.fanta === fanta)
    if (!usersByFanta[fanta]) continue
    const dashRows = []
    for (const modeDef of modes) {
      const cum = cumulativeByMode[modeDef.key]
      const ranked = [...cum.entries()].sort((a, b) => b[1].punti - a[1].punti || b[1].punteggioTot - a[1].punteggioTot)
      dashRows.push({
        Modalita: modeDef.label,
        '1°': ranked[0]?.[0] ?? '-', 'pt': ranked[0]?.[1].punti ?? '-',
        '2°': ranked[1]?.[0] ?? '-', 'pt ': ranked[1]?.[1].punti ?? '-',
        '3°': ranked[2]?.[0] ?? '-', 'pt  ': ranked[2]?.[1].punti ?? '-',
      })
    }
    const sh = XLSX.utils.json_to_sheet(dashRows)
    XLSX.utils.book_append_sheet(outWb, sh, `DASH_${fanta}`.slice(0, 31))
  }

  // --- CLASSIFICHE cumulative: un foglio per modalità, colonna per gw + totale ---
  for (const modeDef of MODES) {
    if (!usersByFanta[modeDef.fanta]) continue
    const cum = cumulativeByMode[modeDef.key]
    const perGw = perGwPointsByMode[modeDef.key]
    const ranked = [...cum.entries()].sort((a, b) => b[1].punti - a[1].punti || b[1].punteggioTot - a[1].punteggioTot)
    const rows = ranked.map(([user, c], i) => {
      const row = { Pos: i + 1, Utente: user }
      for (const gw of gws) row[`GW${gw}`] = perGw.get(gw)?.get(user) ?? '-'
      row.TOT_PUNTI = c.punti
      if (modeDef.mode !== 'formula_1') { row.V = c.V; row.N = c.N; row.P = c.P }
      row.Punteggio_tot = Number(c.punteggioTot.toFixed(2))
      return row
    })
    const sh = XLSX.utils.json_to_sheet(rows)
    XLSX.utils.book_append_sheet(outWb, sh, `CL_${modeDef.key}`.slice(0, 31))
  }

  // --- FOGLI GIORNATA: dettaglio scontri/punteggi per ogni gw ---
  for (const gw of gws) {
    const rows = []
    for (const modeDef of MODES) {
      const dataRows = rowsFor(modeDef.key, gw)
      if (dataRows.length === 0) continue
      rows.push({ Modalita: modeDef.label })
      const totalsByUser = new Map(dataRows.map((r) => [r.utente, r.punteggio]))
      const users = [...totalsByUser.keys()]
      if (modeDef.mode === 'serie_a_scontri') {
        let cal = modeDef.fanta === 'Classic' && classicCalendar ? classicCalendar : roundRobinPairs(users, gw)
        const res = computeSerieAScontri(totalsByUser, cal, modeDef.numPlayers, modeDef.isReverse, null)
        for (const m of res.matchups) rows.push({ Casa: m.home, Risultato: `${m.homeGoals}-${m.awayGoals}`, Trasferta: m.away, Punt_Casa: m.homeScore.toFixed(2), Punt_Tras: m.awayScore.toFixed(2) })
      } else if (modeDef.mode === 'tutti_contro_tutti') {
        const res = computeTuttiControTutti(totalsByUser, modeDef.numPlayers, modeDef.isReverse, null)
        for (const s of res.standings) rows.push({ Utente: s.user, Punteggio: totalsByUser.get(s.user).toFixed(2), Gol: res.goalsByUser.get(s.user), Punti: s.points, V: s.won, N: s.drawn, P: s.lost })
      } else if (modeDef.mode === 'formula_1') {
        const res = computeFormula1(totalsByUser)
        for (const s of res.standings) rows.push({ Pos: s.rank, Utente: s.user, Punteggio: s.score.toFixed(2), Punti_F1: s.points })
      }
      rows.push({})
    }
    const sh = XLSX.utils.json_to_sheet(rows, { skipHeader: true })
    XLSX.utils.book_append_sheet(outWb, sh, `GW${gw}`.slice(0, 31))
  }

  // --- Foglio dati (per l'accumulo idempotente) ---
  const dataSheet = XLSX.utils.json_to_sheet(allData)
  XLSX.utils.book_append_sheet(outWb, dataSheet, DATA_SHEET)

  let existingDetails = []

if (fs.existsSync(path)) {
  const oldWb = XLSX.readFile(path)

  if (oldWb.SheetNames.includes('_dettaglio_giornate')) {
    existingDetails = XLSX.utils.sheet_to_json(
      oldWb.Sheets['_dettaglio_giornate']
    )
  }
}

const keptDetails = existingDetails.filter(
  (r) => Number(r.gw) !== Number(currentGw)
)

const allDetails = [
  ...keptDetails,
  ...newDetailRows
]

const detailSheet = XLSX.utils.json_to_sheet(allDetails)

XLSX.utils.book_append_sheet(
  outWb,
  detailSheet,
  '_dettaglio_giornate'
)

  XLSX.writeFile(outWb, path)
}
