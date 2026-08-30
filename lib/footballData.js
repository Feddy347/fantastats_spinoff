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