// Logica delle modalità di lega. Replica la logica dell'app
// (consolidate-league-gameweek.js) + aggiunge le fasce gol.
//
// Modalità supportate:
//   'serie_a_scontri'    - scontri diretti (calendario), punti 3/1/0, con gol
//   'tutti_contro_tutti' - ognuno vs tutti gli altri nella GW, punti 3/1/0
//   'formula_1'          - nessuno scontro, punti per piazzamento (25-18-15...)
//
// Flop XI non è una modalità a sé: è un flag isReverse che cambia il calcolo
// dei punteggi (già gestito nel resolver) e i parametri fasce gol.

import { scoreToGoals } from './fasceGol.js'

const F1_POINTS = [25, 18, 15, 12, 10, 8, 6, 4, 2, 1]

function resultPoints(myScore, otherScore) {
  if (myScore > otherScore) return 3
  if (myScore === otherScore) return 1
  return 0
}

/**
 * Scontri diretti con calendario. Ogni voce di calendar è {home, away}.
 * @param {Map<string, number>} totalsByUser - utente -> punteggio squadra
 * @param {Array<{home, away}>} calendar - accoppiamenti della GW
 * @param {number} numPlayers, @param {boolean} isReverse, @param {object} goalParams
 * @returns {{matchups, standings}} matchups con gol, standings con punti 3/1/0
 */
export function computeSerieAScontri(totalsByUser, calendar, numPlayers, isReverse, goalParams) {
  const points = new Map()
  const won = new Map(), drawn = new Map(), lost = new Map()
  const goalsFor = new Map(), goalsAgainst = new Map()
  for (const u of totalsByUser.keys()) {
    points.set(u, 0); won.set(u, 0); drawn.set(u, 0); lost.set(u, 0)
    goalsFor.set(u, 0); goalsAgainst.set(u, 0)
  }

  const matchups = []
  for (const { home, away } of calendar) {
    const hScore = totalsByUser.get(home) ?? 0
    const aScore = totalsByUser.get(away) ?? 0
    const hGoals = scoreToGoals(hScore, numPlayers, isReverse, goalParams)
    const aGoals = scoreToGoals(aScore, numPlayers, isReverse, goalParams)
    // Il risultato dello scontro si decide sui GOL (non sui punti grezzi)
    const hRes = resultPoints(hGoals, aGoals)
    const aRes = resultPoints(aGoals, hGoals)

    points.set(home, points.get(home) + hRes)
    points.set(away, points.get(away) + aRes)
    won.set(home, won.get(home) + (hRes === 3 ? 1 : 0))
    drawn.set(home, drawn.get(home) + (hRes === 1 ? 1 : 0))
    lost.set(home, lost.get(home) + (hRes === 0 ? 1 : 0))
    won.set(away, won.get(away) + (aRes === 3 ? 1 : 0))
    drawn.set(away, drawn.get(away) + (aRes === 1 ? 1 : 0))
    lost.set(away, lost.get(away) + (aRes === 0 ? 1 : 0))
    goalsFor.set(home, goalsFor.get(home) + hGoals)
    goalsAgainst.set(home, goalsAgainst.get(home) + aGoals)
    goalsFor.set(away, goalsFor.get(away) + aGoals)
    goalsAgainst.set(away, goalsAgainst.get(away) + hGoals)

    matchups.push({ home, away, homeScore: hScore, awayScore: aScore, homeGoals: hGoals, awayGoals: aGoals })
  }

  const standings = buildStandings(totalsByUser, { points, won, drawn, lost, goalsFor, goalsAgainst })
  return { matchups, standings }
}

/**
 * Tutti contro tutti: ogni utente affronta tutti gli altri nella stessa GW.
 * Punti 3/1/0 sommati su tutti gli scontri. Il risultato di ogni mini-scontro
 * si decide sui GOL (come Serie A).
 */
export function computeTuttiControTutti(totalsByUser, numPlayers, isReverse, goalParams) {
  const users = [...totalsByUser.keys()]
  const goalsByUser = new Map(users.map((u) => [u, scoreToGoals(totalsByUser.get(u), numPlayers, isReverse, goalParams)]))

  const points = new Map(), won = new Map(), drawn = new Map(), lost = new Map()
  for (const u of users) { points.set(u, 0); won.set(u, 0); drawn.set(u, 0); lost.set(u, 0) }

  for (const u of users) {
    for (const other of users) {
      if (u === other) continue
      const res = resultPoints(goalsByUser.get(u), goalsByUser.get(other))
      points.set(u, points.get(u) + res)
      if (res === 3) won.set(u, won.get(u) + 1)
      else if (res === 1) drawn.set(u, drawn.get(u) + 1)
      else lost.set(u, lost.get(u) + 1)
    }
  }

  const standings = buildStandings(totalsByUser, { points, won, drawn, lost })
  return { goalsByUser, standings }
}

/**
 * Formula 1: nessuno scontro. Si ordina per punteggio squadra e si assegnano
 * punti per posizione (25-18-15-12-10-8-6-4-2-1).
 */
export function computeFormula1(totalsByUser) {
  const ranked = [...totalsByUser.entries()].sort((a, b) => b[1] - a[1])
  const points = new Map()
  ranked.forEach(([user], i) => points.set(user, F1_POINTS[i] ?? 0))
  const standings = ranked.map(([user, score], i) => ({
    user, score, rank: i + 1, points: points.get(user),
  }))
  return { standings }
}

// Classifica ordinata per punti, poi differenza reti/punteggio come spareggio
function buildStandings(totalsByUser, stats) {
  const users = [...totalsByUser.keys()]
  const rows = users.map((user) => ({
    user,
    score: totalsByUser.get(user),
    points: stats.points.get(user) ?? 0,
    won: stats.won?.get(user) ?? 0,
    drawn: stats.drawn?.get(user) ?? 0,
    lost: stats.lost?.get(user) ?? 0,
    goalsFor: stats.goalsFor?.get(user) ?? null,
    goalsAgainst: stats.goalsAgainst?.get(user) ?? null,
  }))
  rows.sort((a, b) => {
    if (b.points !== a.points) return b.points - a.points
    const aDiff = (a.goalsFor ?? 0) - (a.goalsAgainst ?? 0)
    const bDiff = (b.goalsFor ?? 0) - (b.goalsAgainst ?? 0)
    if (bDiff !== aDiff) return bDiff - aDiff
    return b.score - a.score
  })
  rows.forEach((r, i) => { r.rank = i + 1 })
  return rows
}

// Round-robin deterministico (metodo del girone). Genera gli accoppiamenti
// della giornata usando l'algoritmo del cerchio: gli utenti sono ordinati in
// modo stabile (alfabetico), uno resta fisso e gli altri ruotano. Ogni coppia
// si affronta una volta per ciclo (N-1 giornate se N pari, N giornate se
// dispari con un turno di riposo). Deterministico: stessa gw -> stessi scontri.
export function roundRobinPairs(users, gw) {
  const arr = [...users].sort()
  if (arr.length % 2 === 1) arr.push('__RIPOSA__') // bye per numero dispari
  const n = arr.length
  const rounds = n - 1
  const roundIndex = ((gw - 1) % rounds + rounds) % rounds

  // fissa arr[0], ruota gli altri di roundIndex posizioni
  const fixed = arr[0]
  const rest = arr.slice(1)
  const rotated = rest.slice(-roundIndex).concat(rest.slice(0, rest.length - roundIndex))
  const lineup = [fixed, ...rotated]

  const pairs = []
  for (let i = 0; i < n / 2; i++) {
    const home = lineup[i]
    const away = lineup[n - 1 - i]
    if (home === '__RIPOSA__' || away === '__RIPOSA__') continue
    // alterna casa/trasferta per equità nei cicli successivi
    if (Math.floor((gw - 1) / rounds) % 2 === 0) pairs.push({ home, away })
    else pairs.push({ home: away, away: home })
  }
  return pairs
}
