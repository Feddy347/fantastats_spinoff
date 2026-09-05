// File giocatori separato (statistiche_giocatori.xlsx).
// Accumula per giocatore le prestazioni di tutte le giornate.
//
// Dal Blocco 2 salva anche i punteggi oggettivi separati per sistema di ruolo:
// Classic, Mantra e Fantastats. Questo serve per percentili e confronti
// coerenti con la modalità visualizzata.
//
// FS Rate viene SEMPRE derivato dai Fantapunti.

import XLSX from 'xlsx'
import fs from 'fs'
import { calculateScore } from './scoreEngine.js'
import { fsRateFromPoints } from './fsRate.js'

const PERGW_SHEET = '_per_gw'
const STATS_FILE = 'statistiche_giocatori.xlsx'

function primaryRole(roleValue, fallback = 'C') {
  return (roleValue ?? '').split(';')[0]?.trim() || fallback
}

function scoreForSystem(statsRow, rec, system, isFlop = false) {
  const field =
    system === 'classic'
      ? 'role_classic'
      : system === 'mantra'
        ? 'role_mantra'
        : 'role_fantastats'

  const roleValue = rec?.[field] ?? ''
  const fallback = system === 'classic' ? 'C' : system === 'mantra' ? 'C' : 'C'
  const slotRole = primaryRole(roleValue, fallback)

  return calculateScore(
    statsRow,
    roleValue,
    slotRole,
    isFlop,
    system
  ).totalScore
}

function addRatings(row) {
  const normalRate = fsRateFromPoints(Number(row.punteggio ?? 0), false)
  const flopRate = fsRateFromPoints(Number(row.punteggio_flop ?? 0), true)

  return {
    ...row,
    fs_rate: normalRate.rate,
    fs_rate_raw: normalRate.raw,
    fs_label: normalRate.label,
    fs_rate_flop: flopRate.rate,
    fs_rate_flop_raw: flopRate.raw,
    fs_label_flop: flopRate.label,
  }
}

export function updatePlayerStats({ gw, listone, statsById, flags }) {
  const path = flags.statsOut || STATS_FILE
  const newRows = []

  for (const [playerId, stats] of statsById) {
    const rec = listone.byId.get(playerId)
    if (!rec) continue

    const scoreClassic = scoreForSystem(stats, rec, 'classic', false)
    const scoreMantra = scoreForSystem(stats, rec, 'mantra', false)
    const scoreFantastats = scoreForSystem(stats, rec, 'fantastats', false)

    const flopClassic = scoreForSystem(stats, rec, 'classic', true)
    const flopMantra = scoreForSystem(stats, rec, 'mantra', true)
    const flopFantastats = scoreForSystem(stats, rec, 'fantastats', true)

    newRows.push({
      gw,
      id: playerId,
      nome: rec.nome,
      squadra: rec.squadra,

      ruolo: rec.role_classic,
      ruolo_classic: rec.role_classic,
      ruolo_mantra: rec.role_mantra,
      ruolo_fantastats: rec.role_fantastats,

      minuti: stats.mins_played ?? 0,

      // Compatibilità con il file esistente:
      // "punteggio" resta l'oggettivo Fantastats.
      punteggio: Number(scoreFantastats.toFixed(2)),
      punteggio_flop: Number(flopFantastats.toFixed(2)),

      // Punteggi per sistema di ruolo.
      punteggio_classic: Number(scoreClassic.toFixed(2)),
      punteggio_mantra: Number(scoreMantra.toFixed(2)),
      punteggio_fantastats: Number(scoreFantastats.toFixed(2)),

      punteggio_flop_classic: Number(flopClassic.toFixed(2)),
      punteggio_flop_mantra: Number(flopMantra.toFixed(2)),
      punteggio_flop_fantastats: Number(flopFantastats.toFixed(2)),

      gol: stats.goals ?? 0,
      assist: stats.goal_assist ?? 0,
      ammonizioni: stats.yellow_card ?? 0,
      espulsioni: stats.red_card ?? 0,
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

  let existing = []

  if (fs.existsSync(path)) {
    const wb = XLSX.readFile(path)

    if (wb.SheetNames.includes(PERGW_SHEET)) {
      existing = XLSX.utils.sheet_to_json(wb.Sheets[PERGW_SHEET])
    }
  }

  const kept = existing.filter((r) => Number(r.gw) !== Number(gw))

  const allRows = [...kept, ...newRows].map((r) => {
    const rec = listone.byId.get(r.id)

    // Fallback per le GW storiche non ancora rilanciate:
    // se le nuove colonne non esistono, usiamo il vecchio punteggio oggettivo.
    const baseNormal = Number(r.punteggio ?? 0)
    const baseFlop = Number(r.punteggio_flop ?? 0)

    return addRatings({
      ...r,
      ruolo: r.ruolo ?? rec?.role_classic ?? '',
      ruolo_classic: rec?.role_classic ?? r.ruolo_classic ?? r.ruolo ?? '',
      ruolo_mantra: rec?.role_mantra ?? r.ruolo_mantra ?? '',
      ruolo_fantastats: rec?.role_fantastats ?? r.ruolo_fantastats ?? '',

      punteggio_classic:
        r.punteggio_classic != null ? Number(r.punteggio_classic) : baseNormal,
      punteggio_mantra:
        r.punteggio_mantra != null ? Number(r.punteggio_mantra) : baseNormal,
      punteggio_fantastats:
        r.punteggio_fantastats != null ? Number(r.punteggio_fantastats) : baseNormal,

      punteggio_flop_classic:
        r.punteggio_flop_classic != null ? Number(r.punteggio_flop_classic) : baseFlop,
      punteggio_flop_mantra:
        r.punteggio_flop_mantra != null ? Number(r.punteggio_flop_mantra) : baseFlop,
      punteggio_flop_fantastats:
        r.punteggio_flop_fantastats != null ? Number(r.punteggio_flop_fantastats) : baseFlop,
    })
  })

  const byPlayer = new Map()

  for (const r of allRows) {
    const agg = byPlayer.get(r.id) ?? {
      nome: r.nome,
      squadra: r.squadra,
      ruolo: r.ruolo,
      ruolo_classic: r.ruolo_classic,
      ruolo_mantra: r.ruolo_mantra,
      ruolo_fantastats: r.ruolo_fantastats,

      presenze: 0,
      minuti: 0,

      gol: 0,
      assist: 0,
      ammonizioni: 0,
      espulsioni: 0,
      tiri_in_porta: 0,
      big_chance_create: 0,

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
      dribbling_vinti: 0,
    }

    const minuti = Number(r.minuti ?? 0)

    if (minuti > 0) agg.presenze += 1

    agg.minuti += minuti
    agg.gol += Number(r.gol ?? 0)
    agg.assist += Number(r.assist ?? 0)
    agg.ammonizioni += Number(r.ammonizioni ?? 0)
    agg.espulsioni += Number(r.espulsioni ?? 0)
    agg.tiri_in_porta += Number(r.tiri_in_porta ?? 0)
    agg.big_chance_create += Number(r.big_chance_create ?? 0)

    if (minuti > 0) {
      agg.precisione_passaggi_tot += Number(r.precisione_passaggi ?? 0)
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

  const summary = [...byPlayer.entries()]
    .map(([id, a]) => ({
      id,
      nome: a.nome,
      squadra: a.squadra,
      ruolo: a.ruolo,
      ruolo_classic: a.ruolo_classic,
      ruolo_mantra: a.ruolo_mantra,
      ruolo_fantastats: a.ruolo_fantastats,

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
      espulsioni: a.espulsioni,
    }))
    .sort((a, b) => {
      if (b.presenze !== a.presenze) return b.presenze - a.presenze
      return String(a.nome).localeCompare(String(b.nome), 'it')
    })

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

  console.log(`File giocatori aggiornato: ${path} (${summary.length} giocatori)`)
}
