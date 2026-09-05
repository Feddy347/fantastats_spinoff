// Fantastats Rating (FS Rate)
//
// Il Rating NON entra mai nei risultati di gioco: è una trasformazione
// interpretativa dei Fantapunti.
//
// Ancoraggi approvati:
//   Normale: 0 FP -> 0, 5.2 FP -> 50, 17 FP -> 100
//   Flop XI: 0 FP -> 0, 1 FP -> 50, 3.9 FP -> 100
//
// Curva: logaritmica con segno.
// I valori negativi possono scendere senza limite; il valore visualizzato
// ha solo un cap superiore a 100.

const NORMAL_K = 0.244082840236686
const FLOP_K = 1.9

const NORMAL_SCALE = 100 / Math.log(1 + NORMAL_K * 17)
const FLOP_SCALE = 100 / Math.log(1 + FLOP_K * 3.9)

function round1(n) {
  return Math.round((n + Number.EPSILON) * 10) / 10
}

export function fsRateRaw(points, isFlop = false) {
  const x = Number(points ?? 0)
  if (!Number.isFinite(x) || x === 0) return 0

  const k = isFlop ? FLOP_K : NORMAL_K
  const scale = isFlop ? FLOP_SCALE : NORMAL_SCALE
  const value = scale * Math.log(1 + k * Math.abs(x))

  return round1(Math.sign(x) * value)
}

export function fsRateLabel(rawRate) {
  const r = Number(rawRate ?? 0)

  if (r >= 100) return 'Compà chiudi tutto'
  if (r >= 90) return 'GOAT'
  if (r >= 80) return 'El generalissimo'
  if (r >= 65) return 'Top'
  if (r >= 50) return 'Ha fatto il suo'
  if (r >= 40) return 'Meh'
  if (r >= 20) return 'Butta male'
  if (r >= 0) return 'Madre de Dios...'
  return 'Vabbè almeno non piove'
}

export function fsRateFromPoints(points, isFlop = false) {
  const raw = fsRateRaw(points, isFlop)
  const rate = Math.min(100, raw)

  return {
    raw,
    rate,
    label: fsRateLabel(raw),
  }
}
