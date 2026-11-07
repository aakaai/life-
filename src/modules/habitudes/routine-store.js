// Routines (v0.32) : réglages gardés sur cet appareil (l'iPhone) + « déjà ouverte aujourd'hui » + choix « Passer ».
import { DEFAULT_EVENING, routineWindow, routineSteps, stepsLeft } from './routine'
import { todayKey } from './logic'

const KEY = 'life:routines'
const SHOWN = 'life:routine-shown'
const read = (k, d) => { try { return JSON.parse(localStorage.getItem(k)) ?? d } catch { return d } }
const write = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)) } catch { /* stockage indisponible */ } }

export function routineSettings() {
  const s = read(KEY, {})
  return { evening: s.evening || DEFAULT_EVENING, auto: { matin: s.auto?.matin !== false, soir: s.auto?.soir !== false } }
}
export const saveRoutineSettings = (s) => write(KEY, s)

export const wasShown = (day, which) => read(SHOWN, {})[which] === day
export function markShown(day, which) {
  write(SHOWN, { ...read(SHOWN, {}), [which]: day })
}

// « Passer » : gardé pour la journée (si on quitte la routine pour les étirements, on ne revient pas dessus)
const skipKey = (day, which) => `life:routine-skip:${which}:${day}`
export const skippedKeys = (day, which) => new Set(read(skipKey(day, which), []))
export function addSkipped(day, which, key) {
  write(skipKey(day, which), [...skippedKeys(day, which), key])
}

/**
 * App iPhone : faut-il ouvrir une routine maintenant ? (Raccourcis ouvre Life ; on montre la routine une seule fois.)
 * @returns le chemin à ouvrir ou null
 */
export async function routineToOpen({ loadHabits, todaySessions, now = new Date(), path = '' }) {
  const st = routineSettings()
  const which = routineWindow(now, st.evening)
  if (!which || !st.auto[which]) return null
  const day = todayKey(now)
  if (wasShown(day, which)) return null
  if (/\/sport\/(seance|souplesse|velo)|\/habitudes\/routine/.test(path)) return null
  const [h, sessions] = await Promise.all([loadHabits({ autoDays: 2 }), todaySessions().catch(() => [])])
  const steps = routineSteps(which, h.habits, h.ctx, h.today, sessions, h.categories)
  if (!stepsLeft(steps)) return null
  markShown(day, which)
  return `/habitudes/routine/${which}`
}
