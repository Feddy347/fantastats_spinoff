// Script principale: legge formazioni.xlsx, pulla le statistiche da Sorare,
// calcola i punteggi con il motore Fantastats, applica sostituzioni e fasce
// gol, e scrive risultati_GWn.xlsx con tutte le modalità di test.
//
// Uso:  node calcola.js <formazioni.xlsx> <numero_giornata>
//   opzionale: --from=YYYY-MM-DD --to=YYYY-MM-DD  (finestra date partite;
//   se omessa, usa una finestra ampia attorno a oggi)
//
// Richiede listone_slug.xlsx nella stessa cartella (generato da
// genera-listone-slug.js).

import XLSX from 'xlsx'
import { generateDashboardData } from './genera-dashboard-data.js'
import { loadEnv } from './lib/env.js'
loadEnv()
import { resolveLineupScore } from './lib/resolver.js'
import { modulesFor, roleFieldFor } from './lib/roleSystems.js'
import { scoreToGoals } from './lib/fasceGol.js'
import {
  computeSerieAScontri, computeTuttiControTutti, computeFormula1, roundRobinPairs,
} from './lib/modalita.js'
import {
  fetchClubGames, fetchGameStats, statsFromSorare, sleep, bareGameId,
  SORARE_REQUEST_DELAY_MS, SERIE_A_CLUBS,
} from './lib/sorare.js'

function parseArgs() {
  const args = process.argv.slice(2)
  const positional = args.filter((a) => !a.startsWith('--'))
  const flags = Object.fromEntries(
    args.filter((a) => a.startsWith('--')).map((a) => {
      const [k, v] = a.slice(2).split('=')
      return [k, v ?? true]
    })
  )
  return { formazioniPath: positional[0], gw: parseInt(positional[1], 10), flags }
}

// --- Carica il listone-slug come dizionario ---
function loadListone(path) {
  const wb = XLSX.readFile(path)
  const rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]])
  const byName = new Map()   // "nome|squadra" -> record
  const byId = new Map()
  for (const r of rows) {
    const key = `${String(r.nome).trim().toLowerCase()}|${String(r.squadra).trim().toLowerCase()}`
    const rec = {
      id: r.id, nome: r.nome, squadra: r.squadra,
      role_classic: r.role_classic, role_mantra: r.role_mantra, role_fantastats: r.role_fantastats,
      sorare_slug: r.sorare_slug ?? '',
    }
    byName.set(key, rec)
    byId.set(r.id, rec)
  }
  return { byName, byId, all: rows }
}

// --- Finestra date attorno a una data centrale ---
function dateWindow(flags) {
  const DAY = 24 * 60 * 60 * 1000
  if (flags.from && flags.to) {
    return { from: new Date(flags.from).toISOString(), to: new Date(flags.to + 'T23:59:59Z').toISOString() }
  }
  const now = Date.now()
  return { from: new Date(now - 4 * DAY).toISOString(), to: new Date(now + 4 * DAY).toISOString() }
}

async function main() {
  const { formazioniPath, gw, flags } = parseArgs()
  if (!formazioniPath || !gw) {
    console.error('Uso: node calcola.js <formazioni.xlsx> <numero_giornata> [--from=YYYY-MM-DD --to=YYYY-MM-DD]')
    process.exit(1)
  }

  console.log(`\n=== FANTASTATS SPINOFF — Giornata ${gw} ===\n`)

  // 1) Carica listone-slug
  const listone = loadListone('listone_slug.xlsx')
  console.log(`Listone-slug: ${listone.all.length} giocatori`)

  // 2) Scarica le partite della giornata (finestra date) e le loro statistiche
  const { from, to } = dateWindow(flags)
  console.log(`Finestra date partite: ${from.slice(0,10)} -> ${to.slice(0,10)}`)
  console.log('Scarico le partite Serie A da Sorare...')

  const seenGameIds = new Set()
const games = []

for (const club of SERIE_A_CLUBS) {
  try {
    const clubGames = await fetchClubGames(club.slug, from, to)

    const serieAGames = clubGames.filter(
      (g) => g.competition?.slug === 'serie-a-it'
    )

    for (const g of serieAGames) {
      const bare = bareGameId(g.id)

      if (!seenGameIds.has(bare)) {
        seenGameIds.add(bare)
        games.push(g)
      }
    }
  } catch (e) {
    console.warn(`  ${club.team}: errore partite (${e.message})`)
  }

  await sleep(SORARE_REQUEST_DELAY_MS)
}

console.log(`Partite trovate: ${games.length}`)

// 3) Per ogni partita, scarica le statistiche di tutti i giocatori
console.log('Scarico le statistiche dei giocatori...')

const statsBySlug = new Map()  // sorare_slug -> statsRow

for (const g of games) {
  try {
    const gameData = await fetchGameStats(g.id)

    const scores = gameData?.playerGameScores ?? []

    for (const ps of scores) {
      const slug = ps.anyPlayer?.slug

      if (slug) {
        statsBySlug.set(
          slug,
          statsFromSorare(ps.anyPlayerGameStats)
        )
      }
    }

    console.log(
      `  ${gameData?.homeTeam?.name} vs ${gameData?.awayTeam?.name}: ${scores.length} giocatori`
    )

  } catch (e) {
    console.warn(
      `  partita ${g.id}: errore stat (${e.message})`
    )
  }

  await sleep(SORARE_REQUEST_DELAY_MS)
}

console.log(`Statistiche raccolte per ${statsBySlug.size} giocatori`)

  // 4) Costruisci statsById (player listone id -> statsRow) via slug
  const statsById = new Map()
  for (const rec of listone.all) {
    if (rec.sorare_slug && statsBySlug.has(rec.sorare_slug)) {
      statsById.set(rec.id, statsBySlug.get(rec.sorare_slug))
    }
  }
  console.log(`Giocatori del listone con statistiche: ${statsById.size}`)

  // 5) Leggi le formazioni e calcola (continua nel blocco successivo)
  const { computeAllModes } = await import('./lib/calcolaModalita.js')
  await computeAllModes({ formazioniPath, gw, listone, statsById, flags })
  try {
  generateDashboardData()
} catch (e) {
  console.warn(`Dashboard non aggiornata: ${e.message}`)
}
}

main().catch((e) => { console.error(e); process.exit(1) })
