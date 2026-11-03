// Logique du module Habitudes : ce qui est attendu quel jour, ce qui est fait,
// séries, jokers, pauses, taux de réussite et coches automatiques.
// Fonctions pures (aucun accès aux données), testées dans tests/habitudes.test.mjs.

/* ---------- Dates ---------- */
export const CUTOFF_HOURS = 3 // la journée se termine à 3 h du matin

export const parseDay = (key) => {
  const [y, m, d] = key.split('-').map(Number)
  return new Date(y, m - 1, d)
}
export const keyOf = (d) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
export const addDays = (key, n) => {
  const d = parseDay(key)
  d.setDate(d.getDate() + n)
  return keyOf(d)
}
export const mondayOf = (key) => {
  const d = parseDay(key)
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7))
  return keyOf(d)
}
export const monthOf = (key) => key.slice(0, 7)
export const firstOfMonth = (key) => `${key.slice(0, 7)}-01`
export const lastOfMonth = (key) => {
  const d = parseDay(firstOfMonth(key))
  d.setMonth(d.getMonth() + 1)
  d.setDate(0)
  return keyOf(d)
}
export const dayOfWeek = (key) => (parseDay(key).getDay() + 6) % 7 // 0 = lundi
export function todayKey(now = new Date()) {
  return keyOf(new Date(now.getTime() - CUTOFF_HOURS * 3600000))
}
export function daysBetween(from, to) {
  const out = []
  for (let d = from; d <= to; d = addDays(d, 1)) out.push(d)
  return out
}

/* ---------- Vocabulaire ---------- */
export const KINDS = {
  check: { label: 'Oui / non', hint: 'Une case à cocher (ex. méditer).' },
  quantity: { label: 'Quantité', hint: 'Un nombre avec un objectif (ex. 2 L d’eau, 30 min de lecture).' },
  avoid: { label: 'À éviter', hint: 'Réussie tant que tu ne notes pas d’écart (ex. pas de snack).' }
}
export const FREQUENCIES = {
  daily: { label: 'Tous les jours', unit: 'jours' },
  weekly: { label: 'X fois par semaine', unit: 'semaines' },
  monthly: { label: 'X fois par mois', unit: 'mois' },
  monthly_task: { label: 'Tâche du mois', unit: 'mois' },
  challenge: { label: 'Défi de 30 jours', unit: 'jours' }
}
export const MOMENTS = [
  ['morning', 'Matin'],
  ['day', 'Journée'],
  ['evening', 'Soir']
]
export const AUTO_SOURCES = {
  sport_session: { label: 'Séance de sport du jour faite', hint: 'Cochée quand toutes les séances du jour sont faites, ou un jour de repos.' },
  protein: { label: 'Protéines atteintes', hint: 'Cochée quand tes protéines du jour atteignent la cible (Alimentation).' },
  kcal: { label: 'Calories dans la cible', hint: 'Cochée quand tes calories du jour sont à ±10 % de la cible.' },
  weigh_in: { label: 'Pesée faite', hint: 'Cochée le jour où tu notes une pesée (Alimentation › Poids).' }
}
// Couleurs proposées pour les catégories (palette de l'app)
export const COLORS = ['blue', 'green', 'orange', 'purple', 'pink', 'red', 'yellow', 'brown', 'gray']

const isDayBased = (h) => h.frequency === 'daily' || h.frequency === 'challenge'

/* ---------- Contexte ---------- */
/**
 * Prépare le contexte des calculs.
 * @param logs   lignes habit_logs
 * @param pauses lignes habit_pauses
 * @param auto   { sport_session: { 'AAAA-MM-JJ': true|false }, protein: {…}, kcal: {…}, weigh_in: {…} }
 */
export function makeContext({ logs = [], pauses = [], auto = {}, today }) {
  const map = new Map()
  for (const l of logs) map.set(`${l.habit_id}|${l.date}`, Number(l.value))
  return { logs: map, pauses, auto, today, cache: new Map() }
}

export const logValue = (habit, date, ctx) => ctx.logs.get(`${habit.id}|${date}`)

export function isActive(habit, date) {
  if (date < habit.start_date) return false
  if (habit.end_date && date > habit.end_date) return false
  return true
}

export function isPaused(habit, date, ctx) {
  return ctx.pauses.some((p) => (!p.habit_id || p.habit_id === habit.id) && date >= p.start_date && date <= p.end_date)
}

// Valeur automatique (autres modules) pour ce jour : true, false ou undefined
export const autoValue = (habit, date, ctx) => (habit.auto ? ctx.auto?.[habit.auto]?.[date] : undefined)

// L'habitude est-elle réussie ce jour-là ?
export function isDoneOn(habit, date, ctx) {
  const v = logValue(habit, date, ctx)
  if (habit.kind === 'avoid') return !(v > 0)
  if (habit.kind === 'quantity') return (v || 0) >= (Number(habit.target) || 1)
  if (v > 0) return true
  return autoValue(habit, date, ctx) === true
}

/* ---------- Habitudes au jour le jour (quotidiennes et défis) ---------- */
// Premier jour raté d'une semaine (lundi → dimanche) : c'est le joker.
function jokerOfWeek(habit, monday, ctx) {
  const key = `j|${habit.id}|${monday}`
  if (ctx.cache.has(key)) return ctx.cache.get(key)
  let joker = null
  for (let i = 0; i < 7; i++) {
    const d = addDays(monday, i)
    if (d >= ctx.today) break
    if (!isActive(habit, d) || isPaused(habit, d, ctx)) continue
    if (!isDoneOn(habit, d, ctx)) {
      joker = d
      break
    }
  }
  ctx.cache.set(key, joker)
  return joker
}

/**
 * Statut d'un jour : none (pas attendue), future, paused, done, pending (aujourd'hui, pas encore),
 * joker (raté mais couvert) ou missed.
 */
export function dayStatus(habit, date, ctx) {
  if (!isActive(habit, date)) return 'none'
  if (date > ctx.today) return 'future'
  if (isPaused(habit, date, ctx)) return 'paused'
  if (isDoneOn(habit, date, ctx)) return 'done'
  if (date === ctx.today) return 'pending'
  return jokerOfWeek(habit, mondayOf(date), ctx) === date ? 'joker' : 'missed'
}

/* ---------- Habitudes par période (semaine, mois) ---------- */
export function periodOf(habit, date) {
  if (habit.frequency === 'weekly') {
    const start = mondayOf(date)
    return { start, end: addDays(start, 6), key: start }
  }
  return { start: firstOfMonth(date), end: lastOfMonth(date), key: monthOf(date) }
}

// Jour du mois où la tâche apparaît (31 → dernier jour des mois courts)
export function taskDay(habit, date) {
  const last = Number(lastOfMonth(date).slice(8))
  return `${monthOf(date)}-${String(Math.min(Number(habit.day_of_month) || 1, last)).padStart(2, '0')}`
}

export function periodCount(habit, period, ctx) {
  let n = 0
  const end = period.end < ctx.today ? period.end : ctx.today
  for (let d = period.start; d <= end; d = addDays(d, 1)) {
    if (!isActive(habit, d)) continue
    if (habit.kind === 'avoid' ? false : isDoneOn(habit, d, ctx)) n++
  }
  return n
}

export const periodTarget = (habit) => (habit.frequency === 'monthly_task' ? 1 : Math.max(1, Number(habit.times) || 1))

// Statut d'une période : done, pending (en cours), paused (entièrement en pause), missed, none
export function periodStatus(habit, period, ctx) {
  if (period.end < habit.start_date || (habit.end_date && period.start > habit.end_date)) return 'none'
  if (period.start > ctx.today) return 'future'
  const count = periodCount(habit, period, ctx)
  if (count >= periodTarget(habit)) return 'done'
  if (period.end >= ctx.today) return 'pending'
  const days = daysBetween(period.start > habit.start_date ? period.start : habit.start_date, period.end)
  if (days.every((d) => isPaused(habit, d, ctx))) return 'paused'
  return 'missed'
}

/* ---------- Liste du jour ---------- */
/**
 * L'habitude apparaît-elle dans la liste de ce jour ?
 * Quotidiennes et défis : chaque jour actif. Hebdo / mensuelles : chaque jour de la période.
 * Tâche du mois : à partir de son jour, jusqu'à la fin du mois (ou dès qu'elle est faite).
 */
export function isVisibleOn(habit, date, ctx) {
  if (habit.archived || !isActive(habit, date)) return false
  if (habit.frequency === 'monthly_task') {
    if (date >= taskDay(habit, date)) return true
    return periodCount(habit, periodOf(habit, date), ctx) > 0
  }
  return true
}

/** Ligne de la liste du jour : statut et progression. */
export function todayItem(habit, date, ctx) {
  const paused = isPaused(habit, date, ctx)
  const value = logValue(habit, date, ctx) || 0
  const auto = autoValue(habit, date, ctx)
  if (isDayBased(habit)) {
    const st = dayStatus(habit, date, ctx)
    return { habit, status: st, paused, value, auto, doneToday: st === 'done', progress: null }
  }
  const period = periodOf(habit, date)
  const count = periodCount(habit, period, ctx)
  const target = periodTarget(habit)
  return {
    habit,
    status: paused ? 'paused' : count >= target ? 'done' : 'pending',
    paused,
    value,
    auto,
    doneToday: isDoneOn(habit, date, ctx),
    progress: { count, target, period }
  }
}

/* ---------- Séries ---------- */
/**
 * Série en cours et record.
 * Au jour le jour : un jour fait +1, un joker ou une pause ne cassent rien, un jour raté remet à 0,
 * aujourd'hui pas encore fait ne compte pas encore. Hebdo / mensuelles : en semaines ou en mois réussis.
 */
export function streak(habit, ctx) {
  let current = 0
  let best = 0
  if (isDayBased(habit)) {
    const end = habit.end_date && habit.end_date < ctx.today ? habit.end_date : ctx.today
    for (let d = habit.start_date; d <= end; d = addDays(d, 1)) {
      const st = dayStatus(habit, d, ctx)
      if (st === 'done') current++
      else if (st === 'missed') current = 0
      best = Math.max(best, current)
    }
    return { current, best, unit: 'jours' }
  }
  let d = habit.start_date
  while (d <= ctx.today) {
    const p = periodOf(habit, d)
    const st = periodStatus(habit, p, ctx)
    if (st === 'done') current++
    else if (st === 'missed') current = 0
    best = Math.max(best, current)
    d = addDays(p.end, 1)
  }
  return { current, best, unit: FREQUENCIES[habit.frequency].unit }
}

/* ---------- Taux de réussite ---------- */
/** { done, total } entre deux dates (incluses). Les pauses et le jour en cours non fait ne comptent pas. */
export function rate(habit, from, to, ctx) {
  let done = 0
  let total = 0
  const end = to < ctx.today ? to : ctx.today
  if (isDayBased(habit)) {
    for (let d = from; d <= end; d = addDays(d, 1)) {
      const st = dayStatus(habit, d, ctx)
      if (st === 'done') {
        done++
        total++
      } else if (st === 'missed' || st === 'joker') total++
    }
    return { done, total }
  }
  let d = from > habit.start_date ? from : habit.start_date
  while (d <= end) {
    const p = periodOf(habit, d)
    const st = periodStatus(habit, p, ctx)
    if (st === 'done' || st === 'missed') {
      total++
      done += Math.min(1, periodCount(habit, p, ctx) / periodTarget(habit))
    }
    d = addDays(p.end, 1)
  }
  return { done, total }
}

export function globalRate(habits, from, to, ctx) {
  let done = 0
  let total = 0
  for (const h of habits) {
    const r = rate(h, from, to, ctx)
    done += r.done
    total += r.total
  }
  return { done, total, pct: total ? done / total : null }
}

/* ---------- Calendrier ---------- */
/** Score d'un jour, toutes habitudes au jour le jour confondues : 0 à 1, ou null si rien d'attendu. */
export function dayScore(habits, date, ctx) {
  let done = 0
  let total = 0
  for (const h of habits) {
    if (!isDayBased(h) || h.archived) continue
    const st = dayStatus(h, date, ctx)
    if (st === 'done') {
      done++
      total++
    } else if (st === 'missed' || st === 'joker' || st === 'pending') total++
  }
  return total ? { done, total, score: done / total } : null
}

/** Intensité d'une case pour une habitude (0 à 1), avec son statut. */
export function habitCell(habit, date, ctx) {
  if (isDayBased(habit)) {
    const st = dayStatus(habit, date, ctx)
    let level = st === 'done' ? 1 : st === 'joker' ? 0.35 : 0
    if (habit.kind === 'quantity' && st !== 'done') level = Math.min(0.75, (logValue(habit, date, ctx) || 0) / (Number(habit.target) || 1))
    return { status: st, level }
  }
  if (!isActive(habit, date) || date > ctx.today) return { status: 'none', level: 0 }
  const did = isDoneOn(habit, date, ctx)
  return { status: did ? 'done' : isPaused(habit, date, ctx) ? 'paused' : 'empty', level: did ? 1 : 0 }
}

/* ---------- Coches automatiques ---------- */
/**
 * Valeurs automatiques par jour, à partir des autres modules.
 * @param sessions  séances sport (planned_sessions)
 * @param foodLogs  journal alimentation (food_logs)
 * @param targets   { 'AAAA-MM-JJ': { kcal, protein } } cibles du jour
 * @param weights   pesées
 */
export function autoFromData({ sessions = [], foodLogs = [], targets = {}, weights = [], from, to }) {
  const out = { sport_session: {}, protein: {}, kcal: {}, weigh_in: {} }
  const food = {}
  for (const l of foodLogs) {
    const f = (food[l.date] ||= { kcal: 0, protein: 0, n: 0 })
    f.kcal += Number(l.kcal) || 0
    f.protein += Number(l.protein) || 0
    f.n++
  }
  const weighed = new Set(weights.map((w) => w.date))
  for (const d of daysBetween(from, to)) {
    const list = sessions.filter((s) => s.date === d && !['skipped', 'unplaced'].includes(s.status))
    out.sport_session[d] = list.every((s) => s.status === 'done')
    const t = targets[d]
    const f = food[d]
    out.protein[d] = !!(t && f && f.protein >= t.protein)
    out.kcal[d] = !!(t && f && Math.abs(f.kcal - t.kcal) <= t.kcal * 0.1)
    out.weigh_in[d] = weighed.has(d)
  }
  return out
}

/* ---------- Tri ---------- */
export function sortHabits(habits, categories = []) {
  const catIdx = Object.fromEntries(categories.map((c, i) => [c.id, c.sort ?? i]))
  return [...habits].sort(
    (a, b) =>
      (a.sort ?? 0) - (b.sort ?? 0) ||
      (catIdx[a.category_id] ?? 99) - (catIdx[b.category_id] ?? 99) ||
      a.name.localeCompare(b.name)
  )
}

// « 3 / 5 cette semaine », « 1 / 2 ce mois-ci », « à faire ce mois-ci »
export function progressLabel(item) {
  if (!item.progress) return ''
  const { count, target } = item.progress
  const f = item.habit.frequency
  if (f === 'monthly_task') return count ? 'Fait ce mois-ci' : 'À faire ce mois-ci'
  return `${count} / ${target} ${f === 'weekly' ? 'cette semaine' : 'ce mois-ci'}`
}

// Jour du défi : « Jour 12 / 30 »
export function challengeDay(habit, date) {
  const n = daysBetween(habit.start_date, date).length
  const total = daysBetween(habit.start_date, habit.end_date || addDays(habit.start_date, 29)).length
  return { n: Math.min(n, total), total }
}
