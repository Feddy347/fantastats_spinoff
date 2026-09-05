// Fantastats scoring matrix. Pure function, no I/O.
//
// Flop XI: ogni termine cambia segno tranne la partecipazione.
//
// Oltre al breakdown numerico legacy, calculateScore restituisce actionDetails:
// dati strutturati per il modal (quantità, valore unitario, modificatore ruolo,
// bonus/malus soglia e totale). Questo NON modifica la matematica del punteggio.

const DEFENSE_SLOTS = ['DC', 'T', 'C']
const OFFENSE_SLOTS = ['ES', 'Tq', 'ATT']
const GK_SLOT = 'POR'

const GK_BY_SYSTEM = {
  fantastats: 'POR',
  classic: 'P',
  mantra: 'Por',
}

function isGoalkeeperSlot(slotRole, roleSystem = 'fantastats') {
  return GK_BY_SYSTEM[roleSystem] === slotRole
}

function round2(n) {
  return Math.round((n + Number.EPSILON) * 100) / 100
}

function isMultiRole(playerRole) {
  return (playerRole ?? '').includes(';')
}

function slotPhase(slotRole) {
  if (slotRole === GK_SLOT) return 'gk'
  if (DEFENSE_SLOTS.includes(slotRole)) return 'defense'
  if (OFFENSE_SLOTS.includes(slotRole)) return 'offense'
  return null
}

export function calculateScore(
  stats,
  playerRole,
  slotRole,
  isReverse = false,
  roleSystem = 'fantastats'
) {
  const s = stats ?? {}
  const phase = slotPhase(slotRole)
  const multiplierEligible = phase !== 'gk' && phase !== null && !isMultiRole(playerRole)
  const multiplier = multiplierEligible ? 1.3 : 1.0
  const isGoalkeeper = isGoalkeeperSlot(slotRole, roleSystem)

  function actionMultiplier(isOffenseAction) {
    if (!multiplierEligible) return 1.0
    if (phase === 'defense' && isOffenseAction) return multiplier
    if (phase === 'offense' && !isOffenseAction) return multiplier
    return 1.0
  }

  function weighted(value, isOffenseAction) {
    return value * actionMultiplier(isOffenseAction)
  }

  const participationPlayed = (s.mins_played ?? 0) > 0 ? 2 : 0
  const participation60 = (s.mins_played ?? 0) >= 60 ? 1 : 0
  const participation = participationPlayed + participation60

  const goalsOpenPlayQty = Math.max(0, (s.goals ?? 0) - (s.att_pen_goal ?? 0))
  const goals = weighted(goalsOpenPlayQty * 6, true)
  const penaltyGoals = weighted((s.att_pen_goal ?? 0) * 4, true)
  const assists = weighted((s.goal_assist ?? 0) * 3, true)
  const shotsOnTarget = weighted((s.ontarget_scoring_att ?? 0) * 0.5, true)
  const bigChances = weighted((s.big_chance_created ?? 0) * 1.5, true)
  const penaltyWon = weighted((s.assist_penalty_won ?? 0) * 1.5, true)
  const penaltyMissed = (s.att_pen_miss ?? 0) * -3

  const passing = (s.accurate_pass ?? 0) * 0.03

  const tackles = weighted((s.won_tackle ?? 0) * 0.4, false)
  const interceptions = weighted((s.interception_won ?? 0) * 0.4, false)
  const clearances = weighted((s.effective_clearance ?? 0) * 0.3, false)
  const duels = weighted((s.duel_won ?? 0) * 0.15, false)
  const lineClearance = weighted((s.clearance_off_line ?? 0) * 3, false)
  const lastManTackle = weighted((s.last_man_tackle ?? 0) * 3, false)

  const keeperSaves = (s.saves ?? 0) * 0.5
  const penaltySave = (s.penalty_save ?? 0) * 5
  const goalsConceded = isGoalkeeper ? (s.goals_conceded ?? 0) * -1 : 0

  const foulsBase = (s.fouls ?? 0) * -0.2
  const yellowCardMalus = (s.yellow_card ?? 0) * -1

  let redCardMalus = 0
  let redCardUnit = -4
  if ((s.red_card ?? 0) >= 1) {
    redCardUnit = (s.yellow_card ?? 0) >= 2 ? -3 : -4
    redCardMalus = redCardUnit
  }

  const ownGoalMalus = (s.own_goals ?? 0) * -4
  const errorLeadToGoalMalus = (s.error_lead_to_goal ?? 0) * -3
  const errorLeadToShotMalus = (s.error_lead_to_shot ?? 0) * -1
  const penaltyConcededMalus = (s.penalty_conceded ?? 0) * -2

  const discipline =
    foulsBase +
    yellowCardMalus +
    redCardMalus +
    ownGoalMalus +
    errorLeadToGoalMalus +
    errorLeadToShotMalus +
    penaltyConcededMalus

  const baseScore =
    participation +
    goals +
    penaltyGoals +
    assists +
    shotsOnTarget +
    bigChances +
    penaltyWon +
    penaltyMissed +
    passing +
    tackles +
    interceptions +
    clearances +
    duels +
    lineClearance +
    lastManTackle +
    keeperSaves +
    penaltySave +
    goalsConceded +
    discipline

  const cleanSheetBonus =
    s.clean_sheet &&
    (s.mins_played ?? 0) >= 60 &&
    isGoalkeeper
      ? 4
      : 0

  const passAccuracyBonus =
    (s.pass_accuracy ?? 0) >= 85 && (s.total_pass ?? 0) >= 30 ? 1.5 : 0

  const dribbleBonusBase = (s.won_contest ?? 0) >= 4 ? 2 : 0
  const bigChanceBonusBase = (s.big_chance_created ?? 0) >= 3 ? 2 : 0

  const dribbleBonus = weighted(dribbleBonusBase, true)
  const bigChanceBonus = weighted(bigChanceBonusBase, true)

  const bonusScore =
    cleanSheetBonus +
    passAccuracyBonus +
    dribbleBonus +
    bigChanceBonus

  const goalkeeperMalus =
    s.three_goals_conceded && isGoalkeeper ? -3 : 0

  const foulsMalus = (s.fouls ?? 0) >= 5 ? -1.5 : 0

  const noTacklesMalus =
    (s.won_tackle ?? 0) === 0 && (s.total_tackle ?? 0) >= 3 ? -1 : 0

  const malusScore = goalkeeperMalus + foulsMalus + noTacklesMalus
  const totalScore = baseScore + bonusScore + malusScore

  const rawBreakdown = {
    participation: round2(participation),
    goals: round2(goals),
    penaltyGoals: round2(penaltyGoals),
    assists: round2(assists),
    shotsOnTarget: round2(shotsOnTarget),
    bigChances: round2(bigChances),
    penaltyWon: round2(penaltyWon),
    penaltyMissed: round2(penaltyMissed),
    passing: round2(passing),
    tackles: round2(tackles),
    interceptions: round2(interceptions),
    clearances: round2(clearances),
    duels: round2(duels),
    lineClearance: round2(lineClearance),
    lastManTackle: round2(lastManTackle),
    keeperSaves: round2(keeperSaves),
    penaltySave: round2(penaltySave),
    goalsConceded: round2(goalsConceded),
    fouls: round2(foulsBase),
    yellowCard: round2(yellowCardMalus),
    redCard: round2(redCardMalus),
    ownGoals: round2(ownGoalMalus),
    errorLeadToGoal: round2(errorLeadToGoalMalus),
    errorLeadToShot: round2(errorLeadToShotMalus),
    penaltyConceded: round2(penaltyConcededMalus),
    cleanSheetBonus: round2(cleanSheetBonus),
    passAccuracyBonus: round2(passAccuracyBonus),
    dribbleBonus: round2(dribbleBonus),
    bigChanceBonus: round2(bigChanceBonus),
    goalkeeperMalus: round2(goalkeeperMalus),
    foulsMalus: round2(foulsMalus),
    noTacklesMalus: round2(noTacklesMalus),
  }

  function flip(value, keep = false) {
    return round2(isReverse && !keep ? -value : value)
  }

  function unit(value, keep = false) {
    return isReverse && !keep ? -value : value
  }

  function detail({
    key,
    label,
    quantity,
    unitValue,
    total,
    isOffenseAction = null,
    thresholdAdjustment = null,
    goalkeeperOnly = false,
    keepInFlop = false,
    note = null,
  }) {
    const roleMod =
      isOffenseAction === null
        ? 'No'
        : actionMultiplier(isOffenseAction) === 1.3
          ? 'x1.3'
          : 'No'

    return {
      key,
      label,
      quantity: Number(quantity ?? 0),
      unitValue: round2(unit(unitValue, keepInFlop)),
      roleModifier: roleMod,
      thresholdAdjustment:
        thresholdAdjustment == null
          ? null
          : flip(thresholdAdjustment, keepInFlop),
      total: flip(total, keepInFlop),
      goalkeeperOnly,
      note,
    }
  }

  const actionDetails = [
    detail({ key:'participationPlayed', label:'Partecipazione', quantity:(s.mins_played ?? 0)>0?1:0, unitValue:2, total:participationPlayed, keepInFlop:true, note:'Ingresso in campo' }),
    detail({ key:'participation60', label:'60+ minuti', quantity:(s.mins_played ?? 0)>=60?1:0, unitValue:1, total:participation60, keepInFlop:true }),
    detail({ key:'goals', label:'Gol su azione', quantity:goalsOpenPlayQty, unitValue:6, total:goals, isOffenseAction:true }),
    detail({ key:'penaltyGoals', label:'Gol su rigore', quantity:s.att_pen_goal ?? 0, unitValue:4, total:penaltyGoals, isOffenseAction:true }),
    detail({ key:'assists', label:'Assist', quantity:s.goal_assist ?? 0, unitValue:3, total:assists, isOffenseAction:true }),
    detail({ key:'shotsOnTarget', label:'Tiri in porta', quantity:s.ontarget_scoring_att ?? 0, unitValue:0.5, total:shotsOnTarget, isOffenseAction:true }),
    detail({ key:'bigChances', label:'Big chance create', quantity:s.big_chance_created ?? 0, unitValue:1.5, total:bigChances + bigChanceBonus, isOffenseAction:true, thresholdAdjustment:bigChanceBonus, note:'Bonus soglia a 3+ big chance create' }),
    detail({ key:'penaltyWon', label:'Rigori procurati', quantity:s.assist_penalty_won ?? 0, unitValue:1.5, total:penaltyWon, isOffenseAction:true }),
    detail({ key:'penaltyMissed', label:'Rigori sbagliati', quantity:s.att_pen_miss ?? 0, unitValue:-3, total:penaltyMissed }),
    detail({ key:'passing', label:'Passaggi riusciti', quantity:s.accurate_pass ?? 0, unitValue:0.03, total:passing + passAccuracyBonus, thresholdAdjustment:passAccuracyBonus, note:'Bonus soglia: precisione >=85% con almeno 30 passaggi' }),
    detail({ key:'dribbles', label:'Dribbling riusciti', quantity:s.won_contest ?? 0, unitValue:0, total:dribbleBonus, isOffenseAction:true, thresholdAdjustment:dribbleBonus, note:'Bonus soglia a 4+ dribbling riusciti' }),
    detail({ key:'tackles', label:'Contrasti vinti', quantity:s.won_tackle ?? 0, unitValue:0.4, total:tackles + noTacklesMalus, isOffenseAction:false, thresholdAdjustment:noTacklesMalus, note:'Malus soglia se 0 vinti su almeno 3 tentati' }),
    detail({ key:'interceptions', label:'Intercetti', quantity:s.interception_won ?? 0, unitValue:0.4, total:interceptions, isOffenseAction:false }),
    detail({ key:'clearances', label:'Respinte efficaci', quantity:s.effective_clearance ?? 0, unitValue:0.3, total:clearances, isOffenseAction:false }),
    detail({ key:'duels', label:'Duelli vinti', quantity:s.duel_won ?? 0, unitValue:0.15, total:duels, isOffenseAction:false }),
    detail({ key:'lineClearance', label:'Salvataggi sulla linea', quantity:s.clearance_off_line ?? 0, unitValue:3, total:lineClearance, isOffenseAction:false }),
    detail({ key:'lastManTackle', label:'Contrasto ultimo uomo', quantity:s.last_man_tackle ?? 0, unitValue:3, total:lastManTackle, isOffenseAction:false }),
    detail({ key:'keeperSaves', label:'Parate', quantity:s.saves ?? 0, unitValue:0.5, total:keeperSaves, goalkeeperOnly:true }),
    detail({ key:'penaltySave', label:'Rigori parati', quantity:s.penalty_save ?? 0, unitValue:5, total:penaltySave, goalkeeperOnly:true }),
    detail({ key:'goalsConceded', label:'Gol subiti', quantity:isGoalkeeper?(s.goals_conceded ?? 0):0, unitValue:-1, total:goalsConceded + goalkeeperMalus, goalkeeperOnly:true, thresholdAdjustment:goalkeeperMalus, note:'Malus soglia aggiuntivo a 3+ gol subiti' }),
    detail({ key:'cleanSheet', label:'Clean sheet', quantity:isGoalkeeper && s.clean_sheet?1:0, unitValue:0, total:cleanSheetBonus, goalkeeperOnly:true, thresholdAdjustment:cleanSheetBonus, note:'Bonus soglia con almeno 60 minuti' }),
    detail({ key:'fouls', label:'Falli', quantity:s.fouls ?? 0, unitValue:-0.2, total:foulsBase + foulsMalus, thresholdAdjustment:foulsMalus, note:'Malus soglia a 5+ falli' }),
    detail({ key:'yellowCard', label:'Ammonizioni', quantity:s.yellow_card ?? 0, unitValue:-1, total:yellowCardMalus }),
    detail({ key:'redCard', label:'Espulsioni', quantity:s.red_card ?? 0, unitValue:redCardUnit, total:redCardMalus, note:'Doppia ammonizione: malus espulsione -3 oltre alle ammonizioni' }),
    detail({ key:'ownGoals', label:'Autogol', quantity:s.own_goals ?? 0, unitValue:-4, total:ownGoalMalus }),
    detail({ key:'errorLeadToGoal', label:'Errori che portano a gol', quantity:s.error_lead_to_goal ?? 0, unitValue:-3, total:errorLeadToGoalMalus }),
    detail({ key:'errorLeadToShot', label:'Errori che portano a tiro', quantity:s.error_lead_to_shot ?? 0, unitValue:-1, total:errorLeadToShotMalus }),
    detail({ key:'penaltyConceded', label:'Rigori concessi', quantity:s.penalty_conceded ?? 0, unitValue:-2, total:penaltyConcededMalus }),
  ]

  if (!isReverse) {
    return {
      baseScore: round2(baseScore),
      multiplier,
      bonusScore: round2(bonusScore),
      malusScore: round2(malusScore),
      totalScore: round2(totalScore),
      breakdown: rawBreakdown,
      actionDetails,
    }
  }

  const reversedBaseScore = 2 * participation - baseScore
  const reversedBonusScore = -bonusScore
  const reversedMalusScore = -malusScore
  const reversedTotalScore =
    reversedBaseScore + reversedBonusScore + reversedMalusScore

  const reversedBreakdown = Object.fromEntries(
    Object.entries(rawBreakdown).map(([key, value]) => [
      key,
      key === 'participation' ? value : round2(-value),
    ])
  )

  return {
    baseScore: round2(reversedBaseScore),
    multiplier,
    bonusScore: round2(reversedBonusScore),
    malusScore: round2(reversedMalusScore),
    totalScore: round2(reversedTotalScore),
    breakdown: reversedBreakdown,
    actionDetails,
  }
}
