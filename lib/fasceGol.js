// Conversione punteggio squadra -> gol segnati (fasce gol).
// Codice NUOVO (non esisteva nell'app). Valori tarati sui dati reali GW1.
//
// Formula unica che scala col numero di giocatori schierati:
//   - primo gol quando punteggio >= numero_giocatori × sufficienza
//   - ogni gol successivo ogni "passo" punti in più
//
// Default (confermati da Federico):
//   Normale:  sufficienza = 5,  passo = 8
//   Flop XI:  sufficienza = 1,  passo = 1.5
// Tutti configurabili per lega.

export const DEFAULT_GOAL_PARAMS = {
  normal: { sufficiency: 5, step: 8 },
  flop: { sufficiency: 1, step: 1.5 },
}

/**
 * @param {number} teamScore - punteggio totale della squadra
 * @param {number} numPlayers - giocatori schierati (7 o 11)
 * @param {boolean} isReverse - true per Flop XI
 * @param {object} [params] - { sufficiency, step } opzionale per override lega
 * @returns {number} gol segnati (>= 0)
 */
export function scoreToGoals(teamScore, numPlayers, isReverse = false, params = null) {
  const p = params ?? (isReverse ? DEFAULT_GOAL_PARAMS.flop : DEFAULT_GOAL_PARAMS.normal)
  const firstGoalThreshold = numPlayers * p.sufficiency

  if (teamScore < firstGoalThreshold) return 0

  // primo gol raggiunto; ogni "step" punti oltre la soglia = +1 gol
  const extraGoals = Math.floor((teamScore - firstGoalThreshold) / p.step)
  return 1 + extraGoals
}
