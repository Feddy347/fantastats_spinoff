// File giocatori separato (statistiche_giocatori.xlsx), aggiornato in parallelo
// al calcolo giornata. Accumula per giocatore le prestazioni di tutte le
// giornate, in modo idempotente (foglio dati _per_gw + foglio riepilogo).
//
// Il punteggio di un giocatore qui è quello NORMALE (non Flop XI): è la
// prestazione oggettiva. Calcolato una volta per giocatore, a prescindere
// dalle formazioni/modalità.
//
// Il punteggio viene conservato SOLO nel foglio _per_gw.
// Il foglio Riepilogo contiene invece statistiche cumulative.

import XLSX from 'xlsx'
import fs from 'fs'
import { calculateScore } from './scoreEngine.js'

const PERGW_SHEET = '_per_gw'
const STATS_FILE = 'statistiche_giocatori.xlsx'

// Calcola il punteggio "oggettivo" di un giocatore data la sua riga stats.
// Usa il ruolo naturale del giocatore come slot (nessun fuori-fase), modalità
// normale. Serve solo come metrica di rendimento, non per le leghe.
function objectiveScore(statsRow, roleFantastats) {
  const primaryRole = (roleFantastats ?? '').split(';')[0]?.trim() || 'C'
  const { totalScore } = calculateScore(
    statsRow,
    roleFantastats,
    primaryRole,
    false
  )
  return totalScore
}

export function updatePlayerStats({ gw, listone, statsById, flags }) {
  const path = flags.statsOut || STATS_FILE

  // ============================================================
  // 1. DATI DELLA SINGOLA GIORNATA
  // ============================================================

  const newRows = []

  for (const [playerId, stats] of statsById) {
    const rec = listone.byId.get(playerId)

    if (!rec) continue

    const score = objectiveScore(stats, rec.role_fantastats)

    const primaryRole = (rec.role_fantastats ?? '').split(';')[0]?.trim() || 'C'

const flopScore = calculateScore(
  stats,
  rec.role_fantastats,
  primaryRole,
  true
).totalScore

    newRows.push({
      gw,
      id: playerId,
      nome: rec.nome,
      squadra: rec.squadra,
      ruolo: rec.role_classic,

      // Dati base
      minuti: stats.mins_played ?? 0,
      punteggio: Number(score.toFixed(2)),
      punteggio_flop: Number(flopScore.toFixed(2)),

      // Statistiche già presenti
      gol: stats.goals ?? 0,
      assist: stats.goal_assist ?? 0,
      ammonizioni: stats.yellow_card ?? 0,
      espulsioni: stats.red_card ?? 0,

      // ========================================================
      // STATISTICHE AGGIUNTIVE
      // ========================================================

      tiri_in_porta: stats.ontarget_scoring_att ?? 0,

      big_chance_create: stats.big_chance_created ?? 0,

      precisione_passaggi: stats.pass_accuracy ?? 0,

      contrasti_vinti: stats.won_tackle ?? 0,

      intercetti: stats.interception_won ?? 0,

      duelli_vinti: stats.duel_won ?? 0,

      salvataggi_linea: stats.clearance_off_line ?? 0,

      parate: stats.saves ?? 0,

      rigori_parati: stats.penalty_save ?? 0,

      gol_subiti: stats.goals_conceded ?? 0,

      clean_sheet: stats.clean_sheet ? 1 : 0,

      falli: stats.fouls ?? 0,

      autogol: stats.own_goals ?? 0,

      errori_gol: stats.error_lead_to_goal ?? 0,

      dribbling_vinti: stats.won_contest ?? 0,
    })
  }

  // ============================================================
  // 2. LEGGI EVENTUALI GIORNATE GIÀ PRESENTI
  // ============================================================

  let existing = []

  if (fs.existsSync(path)) {
    const wb = XLSX.readFile(path)

    if (wb.SheetNames.includes(PERGW_SHEET)) {
      existing = XLSX.utils.sheet_to_json(
        wb.Sheets[PERGW_SHEET]
      )
    }
  }

  // Rimuove eventualmente la stessa GW già presente:
  // così rilanciare GW1 non crea duplicati.
  const kept = existing.filter(
    (r) => Number(r.gw) !== Number(gw)
  )

  const allRows = [...kept, ...newRows]

  // ============================================================
  // 3. RIEPILOGO CUMULATIVO PER GIOCATORE
  // ============================================================

  const byPlayer = new Map()

  for (const r of allRows) {

    const agg = byPlayer.get(r.id) ?? {
      nome: r.nome,
      squadra: r.squadra,
      ruolo: r.ruolo,

      presenze: 0,
      minuti: 0,

      gol: 0,
      assist: 0,
      ammonizioni: 0,
      espulsioni: 0,

      tiri_in_porta: 0,
      big_chance_create: 0,

      // Questa non viene sommata.
      precisione_passaggi_tot: 0,
      precisione_passaggi_gw: 0,

      contrasti_vinti: 0,
      intercetti: 0,
      duelli_vinti: 0,
      salvataggi_linea: 0,

      parate: 0,
      rigori_parati: 0,
      gol_subiti: 0,
      clean_sheet: 0,

      falli: 0,
      autogol: 0,
      errori_gol: 0,
      dribbling_vinti: 0
    }

    const minuti = Number(r.minuti ?? 0)

    if (minuti > 0) {
      agg.presenze += 1
    }

    agg.minuti += minuti

    agg.gol += Number(r.gol ?? 0)
    agg.assist += Number(r.assist ?? 0)
    agg.ammonizioni += Number(r.ammonizioni ?? 0)
    agg.espulsioni += Number(r.espulsioni ?? 0)

    agg.tiri_in_porta += Number(r.tiri_in_porta ?? 0)
    agg.big_chance_create += Number(r.big_chance_create ?? 0)

    // Precisione passaggi:
    // media delle giornate in cui il giocatore ha giocato.
    if (minuti > 0) {
      agg.precisione_passaggi_tot += Number(
        r.precisione_passaggi ?? 0
      )
      agg.precisione_passaggi_gw += 1
    }

    agg.contrasti_vinti += Number(r.contrasti_vinti ?? 0)
    agg.intercetti += Number(r.intercetti ?? 0)
    agg.duelli_vinti += Number(r.duelli_vinti ?? 0)
    agg.salvataggi_linea += Number(r.salvataggi_linea ?? 0)

    agg.parate += Number(r.parate ?? 0)
    agg.rigori_parati += Number(r.rigori_parati ?? 0)
    agg.gol_subiti += Number(r.gol_subiti ?? 0)
    agg.clean_sheet += Number(r.clean_sheet ?? 0)

    agg.falli += Number(r.falli ?? 0)
    agg.autogol += Number(r.autogol ?? 0)
    agg.errori_gol += Number(r.errori_gol ?? 0)
    agg.dribbling_vinti += Number(r.dribbling_vinti ?? 0)

    byPlayer.set(r.id, agg)
  }

  // ============================================================
  // 4. CREA IL FOGLIO RIEPILOGO
  // ============================================================

  const summary = [...byPlayer.entries()]
    .map(([id, a]) => ({

      id,
      nome: a.nome,
      squadra: a.squadra,
      ruolo: a.ruolo,

      presenze: a.presenze,
      minuti: a.minuti,

      gol: a.gol,
      assist: a.assist,

      tiri_in_porta: a.tiri_in_porta,
      big_chance_create: a.big_chance_create,

      precisione_passaggi:
        a.precisione_passaggi_gw > 0
          ? Number(
              (
                a.precisione_passaggi_tot /
                a.precisione_passaggi_gw
              ).toFixed(2)
            )
          : 0,

      contrasti_vinti: a.contrasti_vinti,
      intercetti: a.intercetti,
      duelli_vinti: a.duelli_vinti,
      salvataggi_linea: a.salvataggi_linea,

      parate: a.parate,
      rigori_parati: a.rigori_parati,
      gol_subiti: a.gol_subiti,
      clean_sheet: a.clean_sheet,

      falli: a.falli,
      autogol: a.autogol,
      errori_gol: a.errori_gol,
      dribbling_vinti: a.dribbling_vinti,

      ammonizioni: a.ammonizioni,
      espulsioni: a.espulsioni
    }))

    // Ordinamento neutro:
    // prima chi ha giocato di più, poi alfabetico.
    .sort((a, b) => {
      if (b.presenze !== a.presenze) {
        return b.presenze - a.presenze
      }

      return String(a.nome).localeCompare(
        String(b.nome),
        'it'
      )
    })

  // ============================================================
  // 5. SCRIVI IL FILE
  // ============================================================

  const wb = XLSX.utils.book_new()

  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.json_to_sheet(summary),
    'Riepilogo'
  )

  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.json_to_sheet(allRows),
    PERGW_SHEET
  )

  XLSX.writeFile(wb, path)

  console.log(
    `File giocatori aggiornato: ${path} (${summary.length} giocatori)`
  )
}