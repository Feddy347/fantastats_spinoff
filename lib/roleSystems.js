// Aggregatore dei tre sistemi di ruolo. NON ridefinisce i moduli: importa
// quelli originali (mantraModules/classicModules/modules) copiati identici
// dal progetto, così le sostituzioni danno gli stessi risultati dell'app.

import { MODULES as MODULES_7 } from './modules.js'
import { CLASSIC_MODULES } from './classicModules.js'
import { MANTRA_MODULES } from './mantraModules.js'

// I moduli Fantastats-7 hanno slots come array di stringhe (['POR','DC',...]);
// Classic e Mantra hanno slots come array di {roles:[...]}. Normalizzo tutto
// alla forma {roles:[...]} che il resolver si aspetta.
function normalizeModules(modules) {
  return modules.map((m) => ({
    id: m.id,
    slotObjs: m.slots.map((slot) =>
      typeof slot === 'string' ? { roles: [slot] } : slot
    ),
  }))
}

const NORM_7 = normalizeModules(MODULES_7)
const NORM_CLASSIC = normalizeModules(CLASSIC_MODULES)
const NORM_MANTRA = normalizeModules(MANTRA_MODULES)

export function modulesFor(system) {
  if (system === 'classic') return NORM_CLASSIC
  if (system === 'mantra') return NORM_MANTRA
  return NORM_7
}

export function roleFieldFor(system) {
  if (system === 'classic') return 'role_classic'
  if (system === 'mantra') return 'role_mantra'
  return 'role_fantastats'
}
