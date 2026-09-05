// Conversione punteggio squadra -> gol segnati.
//
// Normale:
//   primo gol = numero giocatori × 5
//   ogni gol successivo = +8 FP
//
// Flop XI (ricalibrato su GW1-GW2 reali, formazione da 11):
//   1° gol -25 FP
//   poi +6 FP per ogni gol successivo
//   soglie: -25, -19, -13, -7, -1, 5
//
// Il punteggio competitivo resta sempre il totale Fantapunti della squadra.

export const DEFAULT_GOAL_PARAMS = {
  normal: { sufficiency: 5, step: 8 },
  flop: { firstGoalThreshold: -25, step: 6 },
}

export function goalThresholds(numPlayers, isReverse = false, limit = 6, params = null) {
  const p = params ?? (isReverse ? DEFAULT_GOAL_PARAMS.flop : DEFAULT_GOAL_PARAMS.normal)

  const firstGoalThreshold = isReverse
    ? p.firstGoalThreshold
    : numPlayers * p.sufficiency

  return Array.from(
    { length: Math.max(0, limit) },
    (_, i) => firstGoalThreshold + i * p.step
  )
}

export function scoreToGoals(teamScore, numPlayers, isReverse = false, params = null) {
  const p = params ?? (isReverse ? DEFAULT_GOAL_PARAMS.flop : DEFAULT_GOAL_PARAMS.normal)

  const firstGoalThreshold = isReverse
    ? p.firstGoalThreshold
    : numPlayers * p.sufficiency

  if (teamScore < firstGoalThreshold) return 0

  const extraGoals = Math.floor((teamScore - firstGoalThreshold) / p.step)
  return 1 + extraGoals
}
