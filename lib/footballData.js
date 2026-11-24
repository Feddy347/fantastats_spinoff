export async function fetchNextSerieAGame(apiKey) {
  if (!apiKey) {
    throw new Error(
      'FOOTBALL_DATA_API_KEY non presente nel file .env'
    )
  }

  const response = await fetch(
    'https://api.football-data.org/v4/competitions/SA/matches',
    {
      headers: {
        'X-Auth-Token': apiKey
      }
    }
  )

  if (!response.ok) {
    throw new Error(
      `Football Data API: ${response.status} ${response.statusText}`
    )
  }

  const data = await response.json()

  const now = Date.now()

  const futureMatches = (data.matches ?? [])
    .filter(m => {
      const time = new Date(m.utcDate).getTime()

      return (
        time > now &&
        ['SCHEDULED','TIMED'].includes(m.status)
      )
    })
    .sort(
      (a,b) =>
        new Date(a.utcDate) -
        new Date(b.utcDate)
    )

  if (!futureMatches.length) {
    return null
  }

  const next = futureMatches[0]

  return {
    matchday: next.matchday,
    kickoff: next.utcDate,
    home: next.homeTeam?.name ?? '',
    away: next.awayTeam?.name ?? ''
  }
}

// Il numero ufficiale della giornata proviene dal calendario, non da Sorare.
export async function fetchSerieAMatchday(apiKey, season, matchday) {
  if (!apiKey) throw new Error('FOOTBALL_DATA_API_KEY mancante')
  if (!Number.isInteger(season) || !Number.isInteger(matchday) || matchday < 1 || matchday > 38) {
    throw new Error('Stagione o giornata Serie A non valida')
  }
  const url = `https://api.football-data.org/v4/competitions/SA/matches?season=${season}&matchday=${matchday}`
  const response = await fetch(url, { headers: { 'X-Auth-Token': apiKey } })
  if (!response.ok) throw new Error(`Football Data API: ${response.status}`)
  const data = await response.json()
  const matches = data.matches
  if (!Array.isArray(matches) || matches.length !== 10 ||
      new Set(matches.map(m => m.id)).size !== 10 ||
      new Set(matches.flatMap(m => [m.homeTeam?.id, m.awayTeam?.id])).size !== 20 ||
      matches.some(m => !m.id || m.matchday !== matchday || m.status !== 'FINISHED' ||
        !m.homeTeam?.id || !m.awayTeam?.id || !Number.isFinite(Date.parse(m.utcDate)) ||
        !Number.isInteger(m.score?.fullTime?.home) || !Number.isInteger(m.score?.fullTime?.away))) {
    throw new Error(`Serie A ${season} giornata ${matchday}: calendario incompleto o non concluso`)
  }
  return matches
}
