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

/* ---------- v0.30 : page unique, projets, rappels ---------- */

/**
 * Sections de la page : aujourd'hui (en retard + du jour + faites aujourd'hui), bientôt (7 jours, par jour),
 * plus tard, sans date, terminées.
 */
export function pageSections(tasks, today, { days = 7 } = {}) {
  const until = addDays(today, days)
  const soon = []
  const later = []
  const nodate = []
  const done = []
  for (const t of tasks) {
    if (t.done) {
      done.push(t)
      continue
    }
    if (!t.planned_date) nodate.push(t)
    else if (t.planned_date > today && t.planned_date <= until) soon.push(t)
    else if (t.planned_date > until) later.push(t)
  }
  const byDay = []
  for (const t of sortTasks(soon, today)) {
    const last = byDay[byDay.length - 1]
    if (last && last.date === t.planned_date) last.tasks.push(t)
    else byDay.push({ date: t.planned_date, tasks: [t] })
  }
  const todayList = tasksForToday(tasks, today)
  // les faites de la journée en bas, pour qu'une tâche cochée ne disparaisse pas d'un coup
  const open = todayList.filter((t) => !t.done)
  return {
    today: [...open, ...todayList.filter((t) => t.done)],
    late: open.filter((t) => taskState(t, today) === 'overdue').length,
    dueToday: open.filter((t) => taskState(t, today) === 'today').length,
    soon: byDay,
    later: sortTasks(later, today),
    nodate: [...nodate].sort((a, b) => (b.priority || 2) - (a.priority || 2) || (a.due_date || '9999').localeCompare(b.due_date || '9999')),
    done: done.sort((a, b) => String(b.done_at || '').localeCompare(String(a.done_at || '')))
  }
}

/** Avancement d'un projet : { done, total, open } (les tâches du projet). */
export function projectProgress(project, tasks) {
  const list = tasks.filter((t) => t.project_id === project.id)
  const done = list.filter((t) => t.done).length
  return { done, total: list.length, open: list.length - done, ratio: list.length ? done / list.length : 0 }
}

/** Projets en cours d'abord (date de fin la plus proche), puis sans date, dans l'ordre choisi. */
export function sortProjects(projects) {
  return [...projects].sort((a, b) =>
    (a.done ? 1 : 0) - (b.done ? 1 : 0) ||
    (a.due_date || '9999').localeCompare(b.due_date || '9999') ||
    (a.sort || 0) - (b.sort || 0) ||
    String(a.created_at || '').localeCompare(String(b.created_at || ''))
  )
}

export const daysUntil = (k, today) => Math.round((parseKey(k) - parseKey(today)) / 86400000)

/* Rappels : 'at' à l'heure, '15' / '60' minutes avant (tâche avec heure), 'morning' le jour même à 9 h, 'eve' la veille à 20 h */
export const REMINDERS = {
  at: { label: 'À l’heure', short: 'à l’heure', needsTime: true },
  15: { label: '15 min avant', short: '15 min avant', needsTime: true },
  60: { label: '1 h avant', short: '1 h avant', needsTime: true },
  morning: { label: 'Le jour même 9 h', short: 'le matin', needsTime: false },
  eve: { label: 'La veille 20 h', short: 'la veille', needsTime: false }
}
export const REMINDER_ORDER = ['at', '15', '60', 'morning', 'eve']
export const reminderChoices = (t) => REMINDER_ORDER.filter((k) => (t.time ? k !== 'morning' : !REMINDERS[k].needsTime))

// Le jour de référence d'un rappel : le jour prévu, sinon la date limite.
const refDay = (t) => t.planned_date || t.due_date || null

/** Rappel valable pour cette tâche ? (une heure est nécessaire pour « à l'heure », « 15 min », « 1 h ») */
export function reminderValid(t) {
  const r = REMINDERS[t.reminder]
  if (!r || !refDay(t)) return false
  return r.needsTime ? !!(t.planned_date && t.time) : true
}

/** Moment du rappel (Date locale) ou null. */
export function reminderAt(t) {
  if (!reminderValid(t)) return null
  const d = parseKey(refDay(t))
  if (t.reminder === 'eve') {
    d.setDate(d.getDate() - 1)
    d.setHours(20, 0, 0, 0)
    return d
  }
  if (t.reminder === 'morning') {
    d.setHours(9, 0, 0, 0)
    return d
  }
  d.setMinutes(toMin(t.time) - (t.reminder === 'at' ? 0 : Number(t.reminder)))
  return d
}

const pad2 = (n) => String(n).padStart(2, '0')
const localIso = (d) => `${keyOf(d)}T${pad2(d.getHours())}:${pad2(d.getMinutes())}`

/**
 * Notifications iPhone des tâches (7 jours). Envoyées comme des rappels d'habitude
 * (habitId « task:<id> ») : le bouton « Fait ✓ » marche sans réinstaller l'app.
 */
export function taskReminders(tasks, now = new Date(), { days = 7 } = {}) {
  const limit = now.getTime() + days * 86400000
  const out = []
  for (const t of tasks || []) {
    if (t.done) continue
    const at = reminderAt(t)
    if (!at || at <= now || at.getTime() > limit) continue
    const day = refDay(t)
    const when = t.time && t.planned_date ? `${day === keyOf(at) ? 'Aujourd’hui' : 'Demain'} à ${t.time}` : day === keyOf(at) ? 'Aujourd’hui' : 'Demain'
    const body = t.reminder === '15' || t.reminder === '60'
      ? `Dans ${t.reminder === '60' ? '1 h' : '15 min'} · ${t.time}`
      : !t.planned_date && t.due_date ? `À rendre ${when.toLowerCase()}` : when
    out.push({ id: `task.${t.id}`, habitId: `task:${t.id}`, date: day, at: localIso(at), title: t.title, body })
  }
  return out.sort((a, b) => a.at.localeCompare(b.at))
}
