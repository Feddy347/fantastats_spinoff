// Matching esplicito dei club tra provider. Nessun fuzzy matching.
import { fetchSerieAPastGames, fetchGameStats, statsFromSorare, bareGameId, sleep, SORARE_REQUEST_DELAY_MS } from './sorare.js'
import { fetchSerieAMatchday } from './footballData.js'

const aliases = {
  atalanta: ['Atalanta BC','Atalanta Bergamasca Calcio','Atalanta'],
  bologna: ['Bologna FC 1909','Bologna FC','Bologna'],
  cagliari: ['Cagliari Calcio','Cagliari'],
  como: ['Calcio Como','Como 1907','Como'],
  fiorentina: ['ACF Fiorentina','Fiorentina'],
  frosinone: ['Frosinone Calcio','Frosinone'],
  genoa: ['Genoa CFC','Genoa'],
  inter: ['FC Internazionale Milano','Internazionale','Inter','Inter Milan','FC Internazionale'],
  juventus: ['Juventus FC','Juventus'],
  lazio: ['SS Lazio','Lazio'],
  lecce: ['US Lecce','Lecce'],
  milan: ['AC Milan','Milan'],
  monza: ['AC Monza','Monza'],
  napoli: ['SSC Napoli','Napoli'],
  parma: ['Parma Calcio 1913','Parma Calcio','Parma'],
  roma: ['AS Roma','Roma'],
  sassuolo: ['US Sassuolo Calcio','Sassuolo','US Sassuolo'],
  torino: ['Torino FC','Torino'],
  udinese: ['Udinese Calcio','Udinese'],
  venezia: ['Venezia FC','Venezia']
}
const normalize = s => String(s ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]/g,'')
const names = new Map(Object.entries(aliases).flatMap(([key, values]) => values.map(v => [normalize(v),key])))
function team(t) {
  return [t?.name,t?.shortName,t?.tla].map(v => names.get(normalize(v))).find(Boolean)
}
function pair(g) {
  const home = team(g.homeTeam), away = team(g.awayTeam)
  return home && away ? home + ':' + away : null
}
function sameFixture(m,g) {
  return pair(m) !== null && pair(m) === pair(g) &&
    Date.parse(m.utcDate) === Date.parse(g.date) &&
    m.score.fullTime.home === g.homeScore && m.score.fullTime.away === g.awayScore
}
export function matchFixtures(matches, games) {
  const selected = matches.map(m => {
    if (!pair(m)) throw new Error('Club non riconosciuto: '+m.homeTeam?.name+' / '+m.awayTeam?.name)
    const candidates = games.filter(g => sameFixture(m,g))
    if (candidates.length !== 1) throw new Error('Matching non univoco: '+pair(m)+' ('+candidates.length+')')
    if (candidates[0].statusTyped !== 'played') throw new Error('Partita non conclusa: '+pair(m))
    return candidates[0]
  })
  if (new Set(selected.map(g => bareGameId(g.id))).size !== 10) throw new Error('Game ID duplicati')
  return selected
}

export async function retrieveMatchday({season, matchday, apiKey, getCalendar=fetchSerieAMatchday, getPage=fetchSerieAPastGames, getStats=fetchGameStats, pause=()=>sleep(SORARE_REQUEST_DELAY_MS)}) {
  const matches = await getCalendar(apiKey,season,matchday)
  const found = new Map(), cursors = new Set()
  let after = null, selected
  // Stop only after all expected fixtures have been found; never assume blocks of ten.
  for (let i=0;i<250;i++) {
    const page = await getPage(after)
    for (const g of page.nodes) {
      if (!g?.id) throw new Error('Sorare: Game ID mancante')
      if (matches.some(m => sameFixture(m,g))) found.set(bareGameId(g.id),g)
    }
    if (matches.every(m => [...found.values()].some(g => sameFixture(m,g)))) {
      selected = matchFixtures(matches,[...found.values()])
      break
    }
    if (!page.pageInfo.hasNextPage) break
    after = page.pageInfo.endCursor
    if (!after || cursors.has(after)) throw new Error('Sorare: cursore non valido')
    cursors.add(after)
    await pause()
  }
  if (!selected) selected = matchFixtures(matches,[...found.values()])
  const statsBySlug = new Map()
  for (const g of selected) {
    await pause()
    const detail = await getStats(g.id)
    if (!detail || bareGameId(detail.id ?? '') !== bareGameId(g.id) ||
        detail.statusTyped !== 'played' || detail.scored !== true ||
        pair(detail) !== pair(g) || Date.parse(detail.date) !== Date.parse(g.date) ||
        detail.homeScore !== g.homeScore || detail.awayScore !== g.awayScore ||
        !Array.isArray(detail.playerGameScores) || !detail.playerGameScores.length) {
      throw new Error('Statistiche non pronte o partita incoerente: '+g.id)
    }
    let participants = 0
    const seen = new Set()
    for (const ps of detail.playerGameScores) {
      const slug = ps.anyPlayer?.slug
      const s = ps.anyPlayerGameStats
      if (!slug || seen.has(slug)) throw new Error('Giocatore assente o duplicato: '+g.id)
      seen.add(slug)
      // Sorare può restituire righe senza statistiche per non partecipanti.
      // Non trasformarle in prestazioni a zero; verifica la copertura dei partecipanti.
      if (!s || !Object.hasOwn(s,'minsPlayed')) continue
      if (s.live === true) throw new Error('Statistiche live: '+slug)
      if (!(s.minsPlayed > 0) && s.gameStarted !== true) continue
      if (!Number.isFinite(s.minsPlayed) || s.minsPlayed <= 0) throw new Error('Minuti non validi: '+slug)
      if (statsBySlug.has(slug)) throw new Error('Giocatore in più partite della giornata: '+slug)
      participants++
      statsBySlug.set(slug,statsFromSorare(s))
    }
    if (participants < 22) throw new Error('Copertura insufficiente (meno di 22 partecipanti): '+g.id)
    console.log(g.date+' '+g.homeTeam.name+' vs '+g.awayTeam.name+' '+g.homeScore+'-'+g.awayScore+' | '+g.id+' | '+participants+' giocatori')
  }
  return {games:selected,statsBySlug}
}
