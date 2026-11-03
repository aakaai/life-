// Tâches : logique pure (testée dans tests/taches.test.mjs).
// Une tâche prévue un jour passé et pas faite reste « en retard » (pas de report automatique).

export const PRIORITIES = { 1: 'Basse', 2: 'Moyenne', 3: 'Haute' }
export const PRIORITY_MARK = { 1: '!', 2: '!!', 3: '!!!' }

export const DEFAULT_CATEGORIES = [
  { name: 'École', color: 'purple' },
  { name: 'Perso', color: 'gray' },
  { name: 'Job', color: 'yellow' }
]

const pad = (n) => String(n).padStart(2, '0')
export const keyOf = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
export const parseKey = (k) => {
  const [y, m, d] = k.split('-').map(Number)
  return new Date(y, m - 1, d)
}
export const addDays = (k, n) => {
  const d = parseKey(k)
  d.setDate(d.getDate() + n)
  return keyOf(d)
}
export const toMin = (hhmm) => {
  if (!hhmm) return null
  const [h, m] = String(hhmm).split(':').map(Number)
  return (h || 0) * 60 + (m || 0)
}

/** done / overdue (prévue avant aujourd'hui) / today / upcoming / nodate */
export function taskState(t, today) {
  if (t.done) return 'done'
  if (!t.planned_date) return 'nodate'
  if (t.planned_date < today) return 'overdue'
  if (t.planned_date === today) return 'today'
  return 'upcoming'
}

export const isDueLate = (t, today) => !t.done && !!t.due_date && t.due_date < today

// En retard d'abord, puis l'heure (les tâches avec heure avant celles sans), puis la priorité.
export function sortTasks(list, today) {
  const rank = (t) => (taskState(t, today) === 'overdue' ? 0 : 1)
  return [...list].sort((a, b) =>
    rank(a) - rank(b) ||
    (a.planned_date || '9999').localeCompare(b.planned_date || '9999') ||
    (toMin(a.time) ?? 9999) - (toMin(b.time) ?? 9999) ||
    (b.priority || 2) - (a.priority || 2) ||
    (a.due_date || '9999').localeCompare(b.due_date || '9999') ||
    String(a.created_at || '').localeCompare(String(b.created_at || ''))
  )
}

/** Onglets de l'espace Tâches. */
export function tabsOf(tasks, today) {
  const by = { today: [], upcoming: [], nodate: [], done: [] }
  for (const t of tasks) {
    const st = taskState(t, today)
    if (st === 'overdue' || st === 'today') by.today.push(t)
    else by[st].push(t)
  }
  by.today = sortTasks(by.today, today)
  by.upcoming = sortTasks(by.upcoming, today)
  by.nodate = [...by.nodate].sort((a, b) => (b.priority || 2) - (a.priority || 2) || (a.due_date || '9999').localeCompare(b.due_date || '9999'))
  by.done = [...by.done].sort((a, b) => String(b.done_at || '').localeCompare(String(a.done_at || '')))
  return by
}

// Tâches de la journée pour l'accueil : en retard + prévues aujourd'hui (+ faites aujourd'hui, pour les voir cochées).
export function tasksForToday(tasks, today) {
  return sortTasks(
    tasks.filter((t) => {
      const st = taskState(t, today)
      if (st === 'overdue' || st === 'today') return true
      return t.done && (t.planned_date === today || (t.done_at && keyOf(new Date(t.done_at)) === today))
    }),
    today
  )
}

const fmtDay = new Intl.DateTimeFormat('fr-BE', { weekday: 'short', day: 'numeric', month: 'short' })
export const shortDay = (k) => fmtDay.format(parseKey(k)).replace(/\./g, '')

export function relDay(k, today) {
  if (k === today) return 'aujourd’hui'
  if (k === addDays(today, 1)) return 'demain'
  if (k === addDays(today, -1)) return 'hier'
  return shortDay(k)
}

// Ligne d'infos sous le titre : « 16:30 · 1 h · limite jeu 5 nov »
export function taskMeta(t, today, { withDay = false } = {}) {
  const out = []
  if (withDay && t.planned_date) out.push(`prévue ${relDay(t.planned_date, today)}`)
  if (t.time) out.push(t.time)
  if (t.duration_min) out.push(t.duration_min >= 60 ? `${Math.floor(t.duration_min / 60)} h${t.duration_min % 60 ? String(t.duration_min % 60).padStart(2, '0') : ''}` : `${t.duration_min} min`)
  if (t.due_date) out.push(`limite ${relDay(t.due_date, today)}`)
  return out.join(' · ')
}

// Créneaux occupés pour le planning sport : tâches avec heure et « bloque le sport ».
export function taskBusyEvents(tasks, from, to) {
  return tasks
    .filter((t) => t.busy && !t.done && t.time && t.planned_date && t.planned_date >= from && t.planned_date < to)
    .map((t) => {
      const start = parseKey(t.planned_date)
      start.setMinutes(toMin(t.time))
      const end = new Date(start.getTime() + (t.duration_min || 30) * 60000)
      return { title: t.title, all_day: false, start_at: start.toISOString(), end_at: end.toISOString() }
    })
}
