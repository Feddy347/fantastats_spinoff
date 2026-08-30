// Mini-caricatore di .env senza dipendenze esterne. Legge il file .env nella
// cartella corrente (se esiste) e popola process.env con le variabili trovate.
// Non sovrascrive variabili già presenti nell'ambiente.

import fs from 'fs'
import path from 'path'

export function loadEnv(envPath = '.env') {
  const full = path.resolve(process.cwd(), envPath)
  if (!fs.existsSync(full)) return
  const content = fs.readFileSync(full, 'utf8')
  for (const rawLine of content.split('\n')) {
    const line = rawLine.trim()
    if (!line || line.startsWith('#')) continue
    const eq = line.indexOf('=')
    if (eq === -1) continue
    const key = line.slice(0, eq).trim()
    let value = line.slice(eq + 1).trim()
    // rimuovi virgolette attorno al valore, se presenti
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1)
    }
    if (!(key in process.env)) process.env[key] = value
  }
}
