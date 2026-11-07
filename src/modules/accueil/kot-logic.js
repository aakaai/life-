// « Retour au kot » (v0.31) — logique pure, testée (tests/kot.test.mjs).
// Chaque chose notée appartient à un dimanche : le prochain (ou aujourd'hui si on est dimanche).
// Dès le lundi, celles du dimanche passé ne comptent plus (et sont effacées).

const pad = (n) => String(n).padStart(2, '0')
const keyOf = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
const localIso = (d) => `${keyOf(d)}T${pad(d.getHours())}:${pad(d.getMinutes())}:00`

export const REMINDER_HOUR = 12

/** Le dimanche visé : aujourd'hui si on est dimanche, sinon le prochain. */
export function kotSunday(now = new Date()) {
  const d = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  d.setDate(d.getDate() + ((7 - d.getDay()) % 7))
  return keyOf(d)
}

export const isSunday = (now = new Date()) => now.getDay() === 0

/** Les choses du dimanche visé (dans l'ordre d'ajout) et celles, périmées, à effacer. */
export function splitKot(items, now = new Date()) {
  const sunday = kotSunday(now)
  const current = (items || []).filter((x) => x.sunday === sunday)
    .sort((a, b) => String(a.created_at || '').localeCompare(String(b.created_at || '')))
  const stale = (items || []).filter((x) => x.sunday < sunday)
  return { sunday, current, stale }
}

/** Rappel du dimanche à midi, s'il reste des choses à prendre et que midi n'est pas passé. */
export function kotReminders(items, now = new Date()) {
  const { sunday, current } = splitKot(items, now)
  const left = current.filter((x) => !x.done).length
  if (!left) return []
  const [y, m, d] = sunday.split('-').map(Number)
  const at = new Date(y, m - 1, d, REMINDER_HOUR, 0, 0)
  if (at <= now) return []
  return [{
    id: `agenda.kot.${sunday}`, habitId: 'agenda', agendaId: 'kot', category: 'agenda', date: sunday, at: localIso(at),
    title: 'Retour au kot', body: `${left} chose${left > 1 ? 's' : ''} à prendre avant de partir.`
  }]
}
