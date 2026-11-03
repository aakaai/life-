// Accès aux données du module Habitudes (via la couche commune `store`).
import { store } from '../../lib/store'
import { addDays, todayKey, autoFromData, makeContext } from './logic'
import { loadSettings as loadFoodSettings, listWeights, listAdjustments } from '../alimentation/api'
import { dayTarget, currentWeight, totalAdjust } from '../alimentation/targets'
import { loadSettings as loadSportSettings } from '../sport/api'

export const HABIT_TABLES = ['habit_categories', 'habits', 'habit_logs', 'habit_pauses', 'habit_reviews']

/* ---------- Lecture ---------- */

// Valeurs automatiques (sport, alimentation) sur une période.
export async function loadAuto(habits, from, to) {
  const sources = new Set(habits.filter((h) => h.auto && !h.archived).map((h) => h.auto))
  if (!sources.size) return {}
  const needFood = sources.has('protein') || sources.has('kcal')
  const [sessions, foodLogs, weights, foodSettings, adjustments, sport] = await Promise.all([
    store.list('planned_sessions', { gte: { date: from }, lte: { date: to } }).catch(() => []),
    needFood ? store.list('food_logs', { gte: { date: from }, lte: { date: to } }).catch(() => []) : [],
    listWeights().catch(() => []),
    needFood ? loadFoodSettings().catch(() => null) : null,
    needFood ? listAdjustments().catch(() => []) : [],
    needFood ? loadSportSettings().catch(() => ({ ftp: 210 })) : null
  ])
  const targets = {}
  if (needFood && foodSettings) {
    for (let d = from; d <= to; d = addDays(d, 1)) {
      targets[d] = dayTarget({
        settings: foodSettings,
        weight: currentWeight(weights, d, Number(foodSettings.start_weight_kg)),
        sessions: sessions.filter((s) => s.date === d),
        ftp: Number(sport?.ftp) || 210,
        adjust: totalAdjust(adjustments.filter((a) => a.date <= d))
      })
    }
  }
  return autoFromData({ sessions, foodLogs, targets, weights, from, to })
}

/**
 * Tout ce qu'il faut pour les écrans, sur une période (par défaut : 13 derniers mois).
 * @returns { habits, categories, logs, pauses, reviews, ctx, today, from }
 */
export async function loadHabits({ from, now = new Date(), autoDays = 400 } = {}) {
  const today = todayKey(now)
  const [habits, categories, pauses, reviews] = await Promise.all([
    store.list('habits', { orderBy: 'sort' }),
    store.list('habit_categories', { orderBy: 'sort' }),
    store.list('habit_pauses', { orderBy: 'start_date' }),
    store.list('habit_reviews', { orderBy: 'week_start', ascending: false })
  ])
  const earliest = habits.reduce((m, h) => (h.start_date < m ? h.start_date : m), today)
  const start = from || (earliest > addDays(today, -400) ? earliest : addDays(today, -400))
  const [logs, auto] = await Promise.all([
    store.list('habit_logs', { gte: { date: start } }),
    // coches automatiques : lourdes (journal alimentation), donc limitées à autoDays jours
    loadAuto(habits, start > addDays(today, -autoDays) ? start : addDays(today, -autoDays), today).catch(() => ({}))
  ])
  return { habits, categories, logs, pauses, reviews, auto, today, from: start, ctx: makeContext({ logs, pauses, auto, today }) }
}

/* ---------- Journal ---------- */

// Fixe la valeur d'un jour (0 ou vide = efface la ligne).
export async function setLog(habit, date, value) {
  const existing = (await store.list('habit_logs', { where: { habit_id: habit.id, date } }))[0]
  if (!value) {
    if (existing) await store.remove('habit_logs', existing.id)
    return null
  }
  if (existing) return store.update('habit_logs', existing.id, { value })
  return store.insert('habit_logs', { habit_id: habit.id, date, value })
}

/* ---------- Habitudes et catégories ---------- */

export function saveHabit(h) {
  const row = {
    name: h.name.trim(),
    emoji: h.emoji?.trim() || null,
    kind: h.kind,
    target: h.kind === 'quantity' ? Number(h.target) || 1 : null,
    unit: h.kind === 'quantity' ? h.unit?.trim() || null : null,
    step: h.kind === 'quantity' ? Number(h.step) || 1 : null,
    frequency: h.frequency,
    times: ['weekly', 'monthly'].includes(h.frequency) ? Math.max(1, Number(h.times) || 1) : 1,
    day_of_month: h.frequency === 'monthly_task' ? Math.min(31, Math.max(1, Number(h.day_of_month) || 1)) : null,
    start_date: h.start_date,
    end_date: h.frequency === 'challenge' ? addDays(h.start_date, 29) : null,
    moment: h.moment,
    category_id: h.category_id || null,
    reminder_time: h.reminder_time || null,
    auto: h.kind === 'check' ? h.auto || null : null,
    archived: !!h.archived,
    sort: Number(h.sort) || 0
  }
  return h.id ? store.update('habits', h.id, row) : store.insert('habits', row)
}

export const archiveHabit = (id, archived = true) => store.update('habits', id, { archived })
export async function removeHabit(id) {
  await store.removeWhere('habit_logs', { where: { habit_id: id } })
  await store.removeWhere('habit_pauses', { where: { habit_id: id } })
  await store.remove('habits', id)
}

export const saveCategory = (c) =>
  c.id ? store.update('habit_categories', c.id, { name: c.name.trim(), color: c.color, sort: c.sort ?? 0 }) : store.insert('habit_categories', { name: c.name.trim(), color: c.color, sort: c.sort ?? 0 })
export const removeCategory = (id) => store.remove('habit_categories', id)

/* ---------- Pauses et bilans ---------- */

export const addPause = ({ habit_id = null, start_date, end_date, reason = null }) =>
  store.insert('habit_pauses', { habit_id, start_date, end_date, reason })
export const removePause = (id) => store.remove('habit_pauses', id)

export async function saveReview(review) {
  const existing = (await store.list('habit_reviews', { where: { week_start: review.week_start } }))[0]
  const row = { week_start: review.week_start, went_well: review.went_well || null, blocked: review.blocked || null, goal: review.goal || null, rating: review.rating || null }
  return existing ? store.update('habit_reviews', existing.id, row) : store.insert('habit_reviews', row)
}
