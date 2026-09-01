// Risoluzione formazione + sostituzioni automatiche, adattato dall'originale
// src/lib/lineupResolver.js. STESSE REGOLE dell'app, ma lavora su dati in
// memoria (venuti dall'Excel) invece che da Supabase.
//
// Regola sostituzione (identica all'app):
//   1. Scorri la panchina in ordine di priorità: primo giocatore che copre
//      ESATTAMENTE lo stesso ruolo dello slot vuoto E che ha giocato -> entra.
//   2. Se nessuno di quel ruolo ha giocato, riscorri tutta la panchina dall'alto
//      (qualsiasi ruolo): primo che ha giocato, ma solo se mettendo il suo ruolo
//      in quello slot la formazione resta un modulo valido.
//   3. Se nessuno va bene, lo slot resta vuoto e vale 0 (si gioca in inferiorità).

import { calculateScore } from './scoreEngine.js'

function lineKey(slots) {
  return slots.slice().sort().join(',')
}

function isValidModuleSlots(modules, trialRoles) {
  return modules.some((m) => lineKey(m.slotObjs.map((s) => s.roles[0])) === lineKey(trialRoles))
}

function splitRoles(roleValue) {
  return (roleValue ?? '').split(';').map((r) => r.trim()).filter(Boolean)
}

/**
 * @param {object} params
 * @param {Array<{slotIndex, slotRole, playerId}>} params.starters - uno per slot del modulo, in ordine
 * @param {Array<{playerId}>} params.bench - in ordine di priorità di sostituzione
 * @param {Map<number, object>} params.statsById - player_id -> riga statistiche Sorare (o assente se non ha dati)
 * @param {Map<number, string>} params.roleById - player_id -> stringa ruolo nel sistema scelto
 * @param {Array} params.modules - i moduli del sistema di ruolo (da roleSystems.modulesFor)
 * @param {boolean} params.isReverse - modalità Flop XI
 * @returns {{totalScore, contributions}}
 */
export function resolveLineupScore({
  starters,
  bench,
  statsById,
  roleById,
  modules,
  isReverse = false,
  roleSystem = 'fantastats'
}) {
  function minsPlayed(playerId) {
    return statsById.get(playerId)?.mins_played ?? 0
  }
  function played(playerId) {
    return minsPlayed(playerId) > 0
  }

  const usedBenchIds = new Set()
  const currentSlots = starters
    .slice()
    .sort((a, b) => a.slotIndex - b.slotIndex)
    .map((s) => s.slotRole)

  let totalScore = 0
  const contributions = []

  for (const starter of starters) {
    let effectivePlayerId = starter.playerId
    let effectiveRole = starter.slotRole
    let subApplied = false
    let slotEmpty = false

    if (!played(starter.playerId)) {
      // Passo 1: subentrante stesso ruolo che ha giocato
      const sameRoleSub = bench.find(
        (b) =>
          !usedBenchIds.has(b.playerId) &&
          played(b.playerId) &&
          splitRoles(roleById.get(b.playerId)).includes(starter.slotRole)
      )

      if (sameRoleSub) {
        effectivePlayerId = sameRoleSub.playerId
        usedBenchIds.add(sameRoleSub.playerId)
        subApplied = true
      } else {
        // Passo 2: qualsiasi ruolo, se la formazione resta valida
        let found = false
        for (const candidate of bench) {
          if (usedBenchIds.has(candidate.playerId) || !played(candidate.playerId)) continue
          const validRole = splitRoles(roleById.get(candidate.playerId)).find((r) => {
            const trial = [...currentSlots]
            trial[starter.slotIndex] = r
            return isValidModuleSlots(modules, trial)
          })
          if (validRole) {
            effectivePlayerId = candidate.playerId
            effectiveRole = validRole
            usedBenchIds.add(candidate.playerId)
            currentSlots[starter.slotIndex] = validRole
            subApplied = true
            found = true
            break
          }
        }
        if (!found) slotEmpty = true
      }
    }

    if (slotEmpty) {
      contributions.push({
        slotIndex: starter.slotIndex, playerId: null, role: starter.slotRole,
        score: 0, breakdown: null, minsPlayed: 0, subApplied: false,
      })
      continue
    }

    // Calcolo punteggio dello slot (sempre dal motore, sulle stat grezze)
    let slotScore = 0
    let breakdown = null
    const statsRow = statsById.get(effectivePlayerId)
    if (statsRow) {
      const result = calculateScore(
  statsRow,
  roleById.get(effectivePlayerId),
  effectiveRole,
  isReverse,
  roleSystem
)
      slotScore = result.totalScore
      breakdown = result.breakdown
    }

    totalScore += slotScore
    contributions.push({
      slotIndex: starter.slotIndex, playerId: effectivePlayerId, role: effectiveRole,
      score: slotScore, breakdown, minsPlayed: minsPlayed(effectivePlayerId), subApplied,
    })
  }

  return { totalScore: Math.round((totalScore + Number.EPSILON) * 100) / 100, contributions }
}
