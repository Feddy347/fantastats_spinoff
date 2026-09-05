// Risoluzione formazione + sostituzioni automatiche.
// La logica delle sostituzioni resta invariata.

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
        slotIndex: starter.slotIndex,
        playerId: null,
        role: starter.slotRole,
        score: 0,
        breakdown: null,
        actionDetails: null,
        minsPlayed: 0,
        subApplied: false,
      })
      continue
    }

    let slotScore = 0
    let breakdown = null
    let actionDetails = null

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
      actionDetails = result.actionDetails
    }

    totalScore += slotScore

    contributions.push({
      slotIndex: starter.slotIndex,
      playerId: effectivePlayerId,
      role: effectiveRole,
      score: slotScore,
      breakdown,
      actionDetails,
      minsPlayed: minsPlayed(effectivePlayerId),
      subApplied,
    })
  }

  return {
    totalScore: Math.round((totalScore + Number.EPSILON) * 100) / 100,
    contributions,
  }
}
