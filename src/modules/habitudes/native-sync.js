// Lien entre les habitudes et l'app iPhone : programme les rappels et applique les « Fait ».
// Ne fait rien sur le site web.
import { isNative, habitReminders } from '../../lib/native'
import { store } from '../../lib/store'
import { loadHabits, setLog } from './api'
import { planReminders, doneValue } from './reminders'

let timer = null
let running = null

// Recalcule et reprogramme les rappels (regroupé : une seule fois par seconde au plus).
export function scheduleReminderSync(delay = 800) {
  if (!isNative) return
  clearTimeout(timer)
  timer = setTimeout(() => {
    running = (running || Promise.resolve()).then(syncNow).catch(() => {})
  }, delay)
}

export async function syncNow() {
  if (!isNative) return null
  const data = await loadHabits({ autoDays: 8 })
  const items = planReminders(data.habits, data.ctx, new Date())
  return habitReminders.sync(items)
}

/**
 * Actions venues des notifications : « Fait » coche l'habitude du jour concerné.
 * @returns true si au moins une action a été traitée (pour ouvrir l'écran Habitudes)
 */
export async function applyPendingActions() {
  if (!isNative) return false
  const actions = await habitReminders.takePending()
  if (!actions.length) return false
  for (const a of actions) {
    if (a.action !== 'done') continue
    const habit = await store.get('habits', a.habitId).catch(() => null)
    if (!habit) continue
    const existing = (await store.list('habit_logs', { where: { habit_id: habit.id, date: a.date } }))[0]
    const v = doneValue(habit, existing?.value)
    if (v != null) await setLog(habit, a.date, v)
  }
  scheduleReminderSync(0)
  return true
}
