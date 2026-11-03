// Agenda de l'accueil : logique pure (aucun accès réseau), testée dans tests/agenda.test.mjs.
//   - dates « AAAA-MM-JJ » locales ;
//   - répétitions (chaque jour / semaine / 2 semaines / mois / année, jours au choix, fin, exceptions) ;
//   - placement des évènements qui se chevauchent dans la grille ;
//   - modifications « celui-ci » / « tous les suivants » d'un évènement répété ;
//   - rappels de l'app iPhone et lien avec le planning sport.
import { DEFAULT_SETTINGS } from '../sport/data.js'

/* ---------- Dates ---------- */

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
export const daysBetween = (a, b) => Math.round((parseKey(b) - parseKey(a)) / 86400000)
export const weekdayIdx = (k) => (parseKey(k).getDay() + 6) % 7 // lundi = 0
export const mondayOf = (k) => addDays(k, -weekdayIdx(k))
export const hm = (d) => `${pad(d.getHours())}:${pad(d.getMinutes())}`
export const minutesOf = (d) => d.getHours() * 60 + d.getMinutes()
export const atMinutes = (key, min) => {
  const d = parseKey(key)
  d.setMinutes(min)
  return d
}
export const localIso = (d) => `${keyOf(d)}T${hm(d)}`
export const toHHMM = (min) => `${pad(Math.floor(min / 60) % 24)}:${pad(min % 60)}`
export const fromHHMM = (s) => {
  const [h, m] = String(s || '0:0').split(':').map(Number)
  return (h || 0) * 60 + (m || 0)
}

/* ---------- Réglages par défaut ---------- */

export const COLORS = ['gray', 'brown', 'orange', 'yellow', 'green', 'blue', 'purple', 'pink', 'red']
export const COLOR_NAMES = {
  gray: 'Gris', brown: 'Marron', orange: 'Orange', yellow: 'Jaune', green: 'Vert',
  blue: 'Bleu', purple: 'Violet', pink: 'Rose', red: 'Rouge'
}

export const DEFAULT_CATEGORIES = [
  { name: 'Perso', color: 'gray', blocks_sport: true },
  { name: 'Amis / sorties', color: 'pink', blocks_sport: true },
  { name: 'Job', color: 'yellow', blocks_sport: true },
  // marron plutôt que bleu : le bleu est déjà celui des séances vélo
  { name: 'Rendez-vous', color: 'brown', blocks_sport: true },
  { name: 'Deadline', color: 'red', blocks_sport: false }
]

export const REPEATS = {
  daily: 'Chaque jour',
  weekly: 'Chaque semaine',
  biweekly: 'Toutes les 2 semaines',
  monthly: 'Chaque mois',
  yearly: 'Chaque année'
}

// [minutes avant le début, libellé]
export const REMINDERS_TIMED = [
  [null, 'Aucun'], [0, 'À l’heure'], [5, '5 min avant'], [15, '15 min avant'],
  [30, '30 min avant'], [60, '1 h avant'], [1440, 'La veille']
]
// journée entière : le « début » est minuit
export const REMINDERS_ALLDAY = [[null, 'Aucun'], [240, 'La veille à 20 h'], [-480, 'Le jour même à 8 h']]

export const DAY_LETTERS = ['L', 'M', 'M', 'J', 'V', 'S', 'D']

/* ---------- Répétitions ---------- */

export const baseKey = (ev) => (ev.all_day ? ev.day_start : keyOf(new Date(ev.start_at)))

// Nombre de jours (en plus du premier) que couvre une occurrence.
function extraDays(ev) {
  if (ev.all_day) return Math.max(0, daysBetween(ev.day_start, ev.day_end) - 1)
  const s = new Date(ev.start_at)
  const e = new Date(new Date(ev.end_at).getTime() - 1)
  return Math.max(0, daysBetween(keyOf(s), keyOf(e)))
}

export function occursOn(ev, date) {
  const base = baseKey(ev)
  if (date < base) return false
  if (ev.repeat_until && date > ev.repeat_until) return false
  if ((ev.exdates || []).includes(date)) return false
  if (!ev.repeat) return date === base
  switch (ev.repeat) {
    case 'daily':
      return true
    case 'weekly':
    case 'biweekly': {
      const days = ev.repeat_days?.length ? ev.repeat_days : [weekdayIdx(base)]
      if (!days.includes(weekdayIdx(date))) return false
      if (ev.repeat === 'weekly') return true
      return (daysBetween(mondayOf(base), mondayOf(date)) / 7) % 2 === 0
    }
    case 'monthly':
      return parseKey(date).getDate() === parseKey(base).getDate()
    case 'yearly': {
      const a = parseKey(date)
      const b = parseKey(base)
      return a.getDate() === b.getDate() && a.getMonth() === b.getMonth()
    }
    default:
      return false
  }
}

function occurrence(ev, date) {
  if (ev.all_day) {
    const len = daysBetween(ev.day_start, ev.day_end)
    return { key: `${ev.id}@${date}`, event: ev, date, allDay: true, dayStart: date, dayEnd: addDays(date, len), start: null, end: null }
  }
  const s0 = new Date(ev.start_at)
  const dur = new Date(ev.end_at) - s0
  const start = atMinutes(date, minutesOf(s0))
  const end = new Date(start.getTime() + dur)
  return { key: `${ev.id}@${date}`, event: ev, date, allDay: false, start, end, dayStart: date, dayEnd: keyOf(new Date(end.getTime() - 1)) }
}

/**
 * Toutes les occurrences qui touchent [from, to[ (clés de jour).
 * dayEnd : dernier jour touché (inclus) pour un évènement à heure, jour suivant la fin pour une journée entière.
 */
export function expandEvents(events, from, to) {
  const out = []
  for (const ev of events || []) {
    if (!ev || (ev.all_day ? !ev.day_start : !ev.start_at)) continue
    const extra = extraDays(ev)
    const first = ev.repeat ? addDays(from, -extra) : baseKey(ev)
    const last = ev.repeat ? addDays(to, -1) : baseKey(ev)
    for (let d = first; d <= last; d = addDays(d, 1)) {
      if (!occursOn(ev, d)) continue
      const o = occurrence(ev, d)
      const lastDay = o.allDay ? addDays(o.dayEnd, -1) : o.dayEnd
      if (lastDay >= from && o.dayStart < to) out.push(o)
    }
  }
  return out.sort((a, b) => (a.start || parseKey(a.dayStart)) - (b.start || parseKey(b.dayStart)))
}

/* ---------- Modifications d'un évènement répété ---------- */

// Les champs qui décrivent un évènement (sans id ni dates de création).
export const FIELDS = [
  'title', 'category_id', 'all_day', 'start_at', 'end_at', 'day_start', 'day_end', 'location', 'note',
  'busy', 'reminder_min', 'repeat', 'repeat_days', 'repeat_until', 'exdates'
]
export const pickFields = (row) => Object.fromEntries(FIELDS.map((f) => [f, row[f] ?? (f === 'exdates' ? [] : null)]))

/**
 * Enregistre les nouvelles valeurs d'une occurrence.
 * scope : 'one' (celui-ci) ou 'following' (celui-ci et les suivants) — ignoré si l'évènement ne se répète pas.
 * @returns liste d'opérations { op: 'update' | 'insert' | 'delete', id?, patch?, row? }
 */
export function planEdit(ev, occDate, changes, scope = 'following') {
  if (!ev) return [{ op: 'insert', row: pickFields({ ...changes, exdates: [] }) }]
  if (!ev.repeat) return [{ op: 'update', id: ev.id, patch: pickFields({ ...ev, ...changes, exdates: [] }) }]
  if (scope === 'one') {
    return [
      { op: 'update', id: ev.id, patch: { exdates: [...new Set([...(ev.exdates || []), occDate])] } },
      { op: 'insert', row: pickFields({ ...ev, ...changes, repeat: null, repeat_days: null, repeat_until: null, exdates: [] }) }
    ]
  }
  const next = { ...ev, ...changes }
  const newBase = baseKey(next)
  if (occDate === baseKey(ev)) {
    return [{ op: 'update', id: ev.id, patch: pickFields({ ...next, exdates: (ev.exdates || []).filter((d) => d >= newBase) }) }]
  }
  return [
    { op: 'update', id: ev.id, patch: { repeat_until: addDays(occDate, -1) } },
    { op: 'insert', row: pickFields({ ...next, exdates: (ev.exdates || []).filter((d) => d >= newBase) }) }
  ]
}

export function planDelete(ev, occDate, scope = 'following') {
  if (!ev.repeat) return [{ op: 'delete', id: ev.id }]
  if (scope === 'one') return [{ op: 'update', id: ev.id, patch: { exdates: [...new Set([...(ev.exdates || []), occDate])] } }]
  if (occDate <= baseKey(ev)) return [{ op: 'delete', id: ev.id }]
  return [{ op: 'update', id: ev.id, patch: { repeat_until: addDays(occDate, -1) } }]
}

/**
 * Nouvelles dates d'une occurrence déplacée (glisser dans la grille).
 * Timed : newDate + newStartMin, durée = newEndMin - newStartMin. Journée entière : décalage en jours.
 * Pour une série « chaque semaine », les jours de répétition suivent le décalage.
 */
export function movedFields(ev, occ, { date, startMin, endMin, shiftDays }) {
  if (ev.all_day || occ.allDay) {
    const shift = shiftDays ?? daysBetween(occ.dayStart, date)
    const len = daysBetween(occ.dayStart, occ.dayEnd)
    const day_start = addDays(occ.dayStart, shift)
    return { day_start, day_end: addDays(day_start, len), repeat_days: shiftRepeatDays(ev, shift) }
  }
  let start
  let end
  if (shiftDays != null) {
    start = new Date(occ.start)
    start.setDate(start.getDate() + shiftDays)
    end = new Date(start.getTime() + (occ.end - occ.start))
  } else {
    start = atMinutes(date, startMin)
    end = atMinutes(date, endMin)
  }
  const shift = daysBetween(occ.date, keyOf(start))
  return { start_at: start.toISOString(), end_at: end.toISOString(), repeat_days: shiftRepeatDays(ev, shift) }
}

function shiftRepeatDays(ev, shift) {
  if (!ev.repeat_days?.length || !shift) return ev.repeat_days ?? null
  return [...new Set(ev.repeat_days.map((d) => (((d + shift) % 7) + 7) % 7))].sort()
}

/* ---------- Grille : évènements qui se chevauchent ---------- */

/**
 * items : [{ from, to }] en minutes dans la journée.
 * Ajoute col (colonne) et cols (nombre de colonnes du groupe), comme Calendrier / Notion Calendar.
 */
export function layoutDay(items) {
  const list = [...items].sort((a, b) => a.from - b.from || b.to - a.to)
  let cluster = []
  let columns = []
  let clusterEnd = -1
  const close = () => {
    for (const it of cluster) it.cols = columns.length
    cluster = []
    columns = []
    clusterEnd = -1
  }
  for (const it of list) {
    if (cluster.length && it.from >= clusterEnd) close()
    let col = columns.findIndex((end) => end <= it.from)
    if (col === -1) {
      col = columns.length
      columns.push(it.to)
    } else columns[col] = it.to
    it.col = col
    cluster.push(it)
    clusterEnd = Math.max(clusterEnd, it.to)
  }
  close()
  return list
}

// Lignes de la bande « journée entière » : [{ a, b }] indices de jours inclus → lane
export function layoutLanes(items) {
  const list = [...items].sort((x, y) => x.a - y.a || y.b - x.b)
  const lanes = []
  for (const it of list) {
    let lane = lanes.findIndex((end) => end < it.a)
    if (lane === -1) {
      lane = lanes.length
      lanes.push(it.b)
    } else lanes[lane] = it.b
    it.lane = lane
  }
  return list
}

/* ---------- Lien avec le planning sport ---------- */

const norm = (s) => (s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()

export function keywordKind(title, keywords = DEFAULT_SETTINGS.keywords) {
  const t = norm(title)
  for (const kind of ['escalade', 'examen', 'voyage']) {
    if ((keywords?.[kind] || []).some((w) => w && t.includes(norm(w)))) return kind
  }
  return null
}

// Valeur proposée pour « Bloque le sport ».
export function defaultBusy({ category, title, allDay, keywords }) {
  if (allDay) return false
  if (['escalade', 'examen'].includes(keywordKind(title, keywords))) return true
  return category ? category.blocks_sport !== false : true
}

/**
 * Évènements de l'agenda au format lu par le planificateur sport (comme calendar_events) :
 *   - « bloque le sport » avec heure → créneau occupé ;
 *   - « bloque le sport » journée entière → toute la journée occupée ;
 *   - journée entière sans blocage → seulement les mots-clés (voyage, examen, escalade) ;
 *   - avec heure sans blocage → ignoré.
 */
export function plannerEvents(occurrences) {
  const out = []
  for (const o of occurrences) {
    const ev = o.event
    if (o.allDay) {
      if (ev.busy) out.push({ title: ev.title, all_day: false, start_at: parseKey(o.dayStart).toISOString(), end_at: parseKey(o.dayEnd).toISOString() })
      else out.push({ title: ev.title, all_day: true, day_start: o.dayStart, day_end: o.dayEnd })
    } else if (ev.busy) {
      out.push({ title: ev.title, all_day: false, start_at: o.start.toISOString(), end_at: o.end.toISOString() })
    }
  }
  return out
}

/* ---------- Rappels (app iPhone) ---------- */

const fmtWeekday = new Intl.DateTimeFormat('fr-BE', { weekday: 'long' })

function dayWord(date, now) {
  const diff = daysBetween(keyOf(now), date)
  if (diff === 0) return 'Aujourd’hui'
  if (diff === 1) return 'Demain'
  const w = fmtWeekday.format(parseKey(date))
  return w.charAt(0).toUpperCase() + w.slice(1)
}

/**
 * Notifications à programmer pour les `days` prochains jours.
 * Même format que les rappels d'habitudes (HabitReminders.sync), avec category 'agenda'.
 */
export function agendaReminders(events, now = new Date(), { days = 7 } = {}) {
  const today = keyOf(now)
  const limit = now.getTime() + days * 86400000
  const items = []
  for (const o of expandEvents((events || []).filter((e) => e.reminder_min != null), today, addDays(today, days + 2))) {
    const ev = o.event
    const ref = o.allDay ? parseKey(o.dayStart) : o.start
    const at = new Date(ref.getTime() - ev.reminder_min * 60000)
    if (at <= now || at.getTime() > limit) continue
    let body
    if (o.allDay) body = `${dayWord(o.dayStart, at)}, journée entière`
    else if (ev.reminder_min > 0 && ev.reminder_min <= 60) body = `Dans ${ev.reminder_min === 60 ? '1 h' : `${ev.reminder_min} min`} · ${hm(o.start)}–${hm(o.end)}`
    else body = `${dayWord(o.date, at)} à ${hm(o.start)}`
    if (ev.location) body += ` · ${ev.location}`
    items.push({
      id: `agenda.${ev.id}.${o.date}`, habitId: 'agenda', agendaId: ev.id, category: 'agenda',
      date: o.date, at: localIso(at), title: ev.title, body
    })
  }
  return items.sort((a, b) => a.at.localeCompare(b.at))
}

/* ---------- Petits textes ---------- */

const fmtDayLong = new Intl.DateTimeFormat('fr-BE', { weekday: 'long', day: 'numeric', month: 'long' })
export const longDay = (k) => {
  const s = fmtDayLong.format(parseKey(k))
  return s.charAt(0).toUpperCase() + s.slice(1)
}

export function whenLabel(o) {
  if (o.allDay) {
    const last = addDays(o.dayEnd, -1)
    return last === o.dayStart ? `${longDay(o.dayStart)} · journée entière` : `Du ${fmtDayLong.format(parseKey(o.dayStart))} au ${fmtDayLong.format(parseKey(last))}`
  }
  const sameDay = keyOf(o.start) === keyOf(new Date(o.end.getTime() - 1))
  return sameDay
    ? `${longDay(keyOf(o.start))} · ${hm(o.start)}–${hm(o.end)}`
    : `${longDay(keyOf(o.start))} ${hm(o.start)} → ${longDay(keyOf(o.end))} ${hm(o.end)}`
}
