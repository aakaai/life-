// Lien avec l'app iPhone : programme les rappels (habitudes, agenda de l'accueil, tâches, retour au kot)
// et applique les « Fait ». Ne fait rien sur le site web.
import { isNative, habitReminders } from '../../lib/native'
import { store } from '../../lib/store'
import { loadHabits, setLog } from './api'
import { planReminders, doneValue } from './reminders'
import { agendaReminders } from '../agenda/logic'
import { taskReminders } from '../taches/logic'
import { kotReminders } from '../accueil/kot-logic'
import { weekReminder } from './week'

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
  const now = new Date()
  const [habits, events, tasks, kot] = await Promise.all([
    loadHabits({ autoDays: 8 }).catch(() => null),
    store.list('agenda_events').catch(() => []),
    store.list('tasks').catch(() => []),
    store.list('kot_items').catch(() => [])
  ])
  const items = [...(habits ? planReminders(habits.habits, habits.ctx, now) : []), ...agendaReminders(events, now), ...taskReminders(tasks, now), ...kotReminders(kot, now), ...(habits?.habits.some((h) => !h.archived) ? [weekReminder(now)] : [])]
  // iOS garde au plus 64 notifications : les plus proches d'abord
  items.sort((a, b) => a.at.localeCompare(b.at))
  return habitReminders.sync(items.slice(0, 60))
}

/**
 * Actions venues des notifications : « Fait » coche l'habitude du jour concerné ;
 * toucher un rappel de l'agenda ouvre l'accueil sur ce jour.
 * @returns la page à ouvrir ({ path, state }) ou null
 */
export async function applyPendingActions() {
  if (!isNative) return null
  const actions = await habitReminders.takePending()
  if (!actions.length) return null
  let target = null
  for (const a of actions) {
    if (a.agendaId || a.habitId === 'agenda') {
      target = { path: '/', state: { agendaDate: a.date, at: Date.now() } }
      continue
    }
    // rappel d'une tâche (v0.30) : « Fait » la coche, toucher ouvre les tâches
    if (String(a.habitId).startsWith('task:')) {
      target = target || { path: '/taches' }
      if (a.action !== 'done') continue
      const id = String(a.habitId).slice(5)
      const task = await store.get('tasks', id).catch(() => null)
      if (task && !task.done) await store.update('tasks', id, { done: true, done_at: new Date().toISOString() })
      continue
    }
    target = target || { path: '/habitudes' }
    if (a.action !== 'done') continue
    const habit = await store.get('habits', a.habitId).catch(() => null)
    if (!habit) continue
    const existing = (await store.list('habit_logs', { where: { habit_id: habit.id, date: a.date } }))[0]
    const v = doneValue(habit, existing?.value)
    if (v != null) await setLog(habit, a.date, v)
  }
  scheduleReminderSync(0)
  return target
}
