// Client Sorare per lo standalone. Replica ESATTAMENTE le query del progetto
// originale (fetch-sorare-games.js, poll-sorare.js), che sono già validate.
// Nessuna dipendenza da Supabase.

const SORARE_API_URL = 'https://api.sorare.com/graphql'
export const SORARE_REQUEST_DELAY_MS = 1500

export function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

export async function sorareQuery(query, variables) {
  const headers = { 'Content-Type': 'application/json' }
  if (process.env.SORARE_API_KEY) headers.APIKEY = process.env.SORARE_API_KEY

  const res = await fetch(SORARE_API_URL, {
    method: 'POST',
    headers,
    body: JSON.stringify({ query, variables }),
  })
  if (!res.ok) throw new Error(`Sorare API HTTP ${res.status}: ${await res.text()}`)
  const json = await res.json()
  if (json.errors?.length) throw new Error(`Sorare API error: ${json.errors.map((e) => e.message).join('; ')}`)
  return json.data
}

export function bareGameId(id) {
  return id.replace(/^Game:/, '')
}

// --- Rose dei club (per la mappa nome->slug) ---
const CLUB_ROSTER_QUERY = `
query ClubRoster($slug: String!) {
  football {
    club(slug: $slug) {
      activePlayers {
        nodes { slug displayName firstName lastName age country { threeLetterCode } position }
      }
    }
  }
}
`

export async function fetchClubRoster(clubSlug) {
  const data = await sorareQuery(CLUB_ROSTER_QUERY, { slug: clubSlug })
  return data?.football?.club?.activePlayers?.nodes ?? []
}

// --- Partite di un club in una finestra di date (per trovare le partite della GW) ---
const CLUB_GAMES_QUERY = `
query ClubGames($slug: String!, $from: ISO8601DateTime!, $to: ISO8601DateTime!) {
  football {
    club(slug: $slug) {
      games(startDate: $from, endDate: $to, first: 20) {
        nodes {
  id
  statusTyped
  competition {
    slug
    name
  }
  homeTeam { name }
  awayTeam { name }
  homeScore
  awayScore
}
      }
    }
  }
}
`

export async function fetchClubGames(clubSlug, from, to) {
  const data = await sorareQuery(CLUB_GAMES_QUERY, { slug: clubSlug, from, to })
  return data?.football?.club?.games?.nodes ?? []
}

// --- Statistiche di tutti i giocatori di una partita (per game id) ---
const GAME_STATS_QUERY = `
query GameStats($gameId: ID!) {
  football {
    game(id: $gameId) {
      id
      statusTyped
      homeTeam { name }
      awayTeam { name }
      homeScore
      awayScore
      playerGameScores {
        anyPlayer { slug displayName }
        anyPlayerGameStats {
          ... on PlayerGameStats {
            minsPlayed goals attPenGoal goalAssist ontargetScoringAtt
            bigChanceCreated assistPenaltyWon attPenMiss accuratePass totalPass
            passAccuracy wonTackle totalTackle interceptionWon effectiveClearance
            duelWon clearanceOffLine lastManTackle saves penaltySave goalsConceded
            cleanSheet fouls yellowCard redCard ownGoals errorLeadToGoal
            errorLeadToShot penaltyConceded wonContest threeGoalsConceded
            gameStarted live
          }
        }
      }
    }
  }
}
`

export async function fetchGameStats(gameId) {
  const data = await sorareQuery(GAME_STATS_QUERY, { gameId: bareGameId(gameId) })
  return data?.football?.game ?? null
}

// Mappa una PlayerGameStats di Sorare sui nomi-colonna che il motore si aspetta
// (identico a statsRowFromSorare dell'originale; null -> 0/false).
export function statsFromSorare(stat) {
  const s = stat ?? {}
  return {
    mins_played: s.minsPlayed ?? 0,
    goals: s.goals ?? 0,
    att_pen_goal: s.attPenGoal ?? 0,
    goal_assist: s.goalAssist ?? 0,
    ontarget_scoring_att: s.ontargetScoringAtt ?? 0,
    big_chance_created: s.bigChanceCreated ?? 0,
    assist_penalty_won: s.assistPenaltyWon ?? 0,
    att_pen_miss: s.attPenMiss ?? 0,
    accurate_pass: s.accuratePass ?? 0,
    total_pass: s.totalPass ?? 0,
    pass_accuracy: s.passAccuracy ?? 0,
    won_tackle: s.wonTackle ?? 0,
    total_tackle: s.totalTackle ?? 0,
    interception_won: s.interceptionWon ?? 0,
    effective_clearance: s.effectiveClearance ?? 0,
    duel_won: s.duelWon ?? 0,
    clearance_off_line: s.clearanceOffLine ?? 0,
    last_man_tackle: s.lastManTackle ?? 0,
    saves: s.saves ?? 0,
    penalty_save: s.penaltySave ?? 0,
    goals_conceded: s.goalsConceded ?? 0,
    clean_sheet: Boolean(s.cleanSheet),
    fouls: s.fouls ?? 0,
    yellow_card: s.yellowCard ?? 0,
    red_card: s.redCard ?? 0,
    own_goals: s.ownGoals ?? 0,
    error_lead_to_goal: s.errorLeadToGoal ?? 0,
    error_lead_to_shot: s.errorLeadToShot ?? 0,
    penalty_conceded: s.penaltyConceded ?? 0,
    won_contest: s.wonContest ?? 0,
    three_goals_conceded: Boolean(s.threeGoalsConceded),
    game_started: Boolean(s.gameStarted),
    is_live: Boolean(s.live),
  }
}

// I 20 club Serie A 2026/27 (slug validati)
export const SERIE_A_CLUBS = [
  { slug: 'atalanta-ciserano', team: 'Atalanta' },
  { slug: 'bologna-bologna', team: 'Bologna' },
  { slug: 'cagliari-cagliari', team: 'Cagliari' },
  { slug: 'como-como', team: 'Como' },
  { slug: 'fiorentina-firenze', team: 'Fiorentina' },
  { slug: 'frosinone-frosinone', team: 'Frosinone' },
  { slug: 'genoa-genova', team: 'Genoa' },
  { slug: 'internazionale-milano', team: 'Inter' },
  { slug: 'juventus-torino', team: 'Juventus' },
  { slug: 'lazio-formello', team: 'Lazio' },
  { slug: 'lecce-lecce', team: 'Lecce' },
  { slug: 'milan-milano', team: 'Milan' },
  { slug: 'monza-monza', team: 'Monza' },
  { slug: 'napoli-castel-volturno', team: 'Napoli' },
  { slug: 'parma-parma', team: 'Parma' },
  { slug: 'roma-roma', team: 'Roma' },
  { slug: 'sassuolo-sassuolo', team: 'Sassuolo' },
  { slug: 'torino-torino', team: 'Torino' },
  { slug: 'udinese-udine', team: 'Udinese' },
  { slug: 'venezia-mestre', team: 'Venezia' },
]
