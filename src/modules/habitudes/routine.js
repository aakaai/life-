// Routines matin / soir (v0.32) — logique pure, testée (tests/routines.test.mjs).
// Routine du matin = habitudes « Matin » ; routine du soir = séance d'étirements / mobilité du jour + habitudes « Soir ».
// Les habitudes « à éviter » et celles qui se cochent toutes seules n'y sont pas.
import { isVisibleOn, isPaused, todayItem, sortHabits } from './logic.js'

export const ROUTINES = {
  matin: { moment: 'morning', label: 'Routine du matin', end: 'Bonne journée' },
  soir: { moment: 'evening', label: 'Routine du soir', end: 'Bonne nuit' }
}
export const SOUPLESSE_KINDS = ['etirements', 'mobilite']
export const DEFAULT_EVENING = '22:45'
export const MORNING_FROM = 4 * 60
export const MORNING_TO = 12 * 60

const minutes = (t) => { const [h, m] = String(t || '').split(':').map(Number); return (h || 0) * 60 + (m || 0) }

/** Quelle routine peut s'ouvrir maintenant : matin de 4 h à midi, soir dès l'heure choisie jusqu'à 3 h. */
export function routineWindow(now = new Date(), evening = DEFAULT_EVENING) {
  const t = now.getHours() * 60 + now.getMinutes()
  if (t >= MORNING_FROM && t < MORNING_TO) return 'matin'
  if (t >= minutes(evening) || t < 3 * 60) return 'soir'
  return null
}

export const habitDone = (item) => item.status === 'done' || !!(item.progress && item.doneToday)

/** Habitudes qui peuvent entrer dans une routine (pour l'ordre dans Gérer › Routines). */
export function routineHabits(which, habits, categories = []) {
  const { moment } = ROUTINES[which]
  return sortHabits(habits.filter((h) => !h.archived && h.moment === moment && h.kind !== 'avoid' && !h.auto), categories)
}

/**
 * Étapes de la routine du jour, dans l'ordre.
 * @returns [{ key, type: 'session' | 'habit', session?, habit?, item?, done, skipped }]
 */
export function routineSteps(which, habits, ctx, date, sessions = [], categories = []) {
  const steps = []
  if (which === 'soir') {
    for (const s of sessions || []) {
      if (s.date !== date || !SOUPLESSE_KINDS.includes(s.kind) || s.status === 'unplaced') continue
      steps.push({ key: `s${s.id}`, type: 'session', session: s, done: s.status === 'done', skipped: s.status === 'skipped' })
    }
  }
  for (const h of routineHabits(which, habits, categories)) {
    if (!isVisibleOn(h, date, ctx) || isPaused(h, date, ctx)) continue
    const item = todayItem(h, date, ctx)
    steps.push({ key: `h${h.id}`, type: 'habit', habit: h, item, done: habitDone(item), skipped: false })
  }
  return steps
}

export const stepsLeft = (steps) => steps.filter((s) => !s.done && !s.skipped).length

/** Nouvel ordre (champ sort) après avoir monté / descendu une habitude. */
export function moveInOrder(list, index, delta) {
  const j = index + delta
  if (j < 0 || j >= list.length) return null
  const next = [...list]
  ;[next[index], next[j]] = [next[j], next[index]]
  return next.map((h, i) => ({ id: h.id, sort: (i + 1) * 10 }))
}
