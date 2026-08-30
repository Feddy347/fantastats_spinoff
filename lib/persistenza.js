// Gestione dell'accumulo idempotente tra giornate.
// Il file-stagione contiene un foglio dati "_dati_giornate" con una riga per
// (gw, fanta, modalita_key, utente, punteggio_squadra, gol). Le classifiche
// cumulative e i dettagli-giornata si RICOSTRUISCONO sempre da lì, così
// ricalcolare una giornata N volte dà sempre lo stesso risultato.

import XLSX from 'xlsx'
import fs from 'fs'

const DATA_SHEET = '_dati_giornate'

// Legge il foglio dati dal file-stagione (se esiste), come array di righe.
export function readSeasonData(path) {
  if (!fs.existsSync(path)) return []
  const wb = XLSX.readFile(path)
  if (!wb.SheetNames.includes(DATA_SHEET)) return []
  return XLSX.utils.sheet_to_json(wb.Sheets[DATA_SHEET])
}

// Rimuove tutte le righe di una certa giornata e aggiunge le nuove (idempotente).
export function upsertGameweekData(existingRows, gw, newRows) {
  const kept = existingRows.filter((r) => Number(r.gw) !== Number(gw))
  return [...kept, ...newRows]
}

// Elenco delle giornate presenti nei dati, ordinate.
export function gameweeksInData(rows) {
  return [...new Set(rows.map((r) => Number(r.gw)))].sort((a, b) => a - b)
}

export { DATA_SHEET }
