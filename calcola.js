// Uso: node calcola.js formazioni/formazioni_GW12.xlsx [--dry-run] [--season=2026]
// Il nome del file identifica la giornata ufficiale. Nessuna finestra relativa a oggi.
import XLSX from 'xlsx'
import { generateDashboardData } from './genera-dashboard-data.js'
import { loadEnv } from './lib/env.js'
loadEnv()
import { retrieveMatchday } from './lib/matchday.js'
import { makePlayerResolver } from './lib/playerIdentity.js'

function parseArgs() {
  const args = process.argv.slice(2)
  const positional = args.filter((a) => !a.startsWith('--'))
  const flags = Object.fromEntries(
    args.filter((a) => a.startsWith('--')).map((a) => {
      const [k, v] = a.slice(2).split('=')
      return [k, v ?? true]
    })
  )
  const formazioniPath = positional[0]
  const match = /(?:^|[\\/])formazioni_GW([1-9][0-9]*)\.xlsx$/.exec(formazioniPath ?? '')
  const gw = match ? Number(match[1]) : NaN
  if (!Number.isInteger(gw) || gw > 38 || (positional[1] && Number(positional[1]) !== gw) || positional.length > 2) {
    throw new Error('Nome file o numero giornata non valido')
  }
  if (flags.from || flags.to) throw new Error('Le finestre manuali non sono più supportate')
  return { formazioniPath, gw, flags }
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
  return { byName, byId, all: rows, resolve: makePlayerResolver(rows, wb.Sheets.Alias_storici ? XLSX.utils.sheet_to_json(wb.Sheets.Alias_storici) : []) }
}

async function main() {
  const { formazioniPath, gw, flags } = parseArgs()


  console.log(`\n=== FANTASTATS SPINOFF — Giornata ${gw} ===\n`)

  const season = Number(flags.season ?? 2026)
  const { games, statsBySlug } = await retrieveMatchday({season,matchday:gw,apiKey:process.env.FOOTBALL_DATA_API_KEY})
  console.log('Partite validate: '+games.length+'; giocatori: '+statsBySlug.size)
  if (flags['expect-malen'] !== undefined) {
    if (flags['dry-run'] !== true) throw new Error('--expect-malen richiede --dry-run')
    const goals = statsBySlug.get('donyell-malen')?.goals
    if (goals !== Number(flags['expect-malen'])) throw new Error('Malen: atteso '+flags['expect-malen']+', ottenuto '+goals)
    console.log('Malen: '+goals+' gol, test superato')
  }
  if (flags['dry-run'] === true) {
    console.log('DRY RUN: nessun Excel o dashboard modificato')
    return
  }
  const listone = loadListone(flags.listone || 'listone_slug.xlsx')
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
  if (!flags.out && !flags.statsOut) generateDashboardData()
} catch (e) {
  console.warn(`Dashboard non aggiornata: ${e.message}`)
}
}

main().catch((e) => { console.error(e); process.exit(1) })
