// Accès aux données du module Alimentation (via la couche commune `store`).
import { store, currentUserId } from '../../lib/store'
import { DEFAULT_SETTINGS, guessPortions, forGrams } from './data'
import { loadCiqual, findCiqual } from './ciqual'
import { dayTarget, currentWeight, checkAdjustment, totalAdjust, fuelingTips } from './targets'
import { ensureWeek, loadSettings as loadSportSettings } from '../sport/api'
import { mondayOf, parseDay, keyOf } from '../sport/planner'

export const FOOD_TABLES = ['nutrition_settings', 'foods', 'recipes', 'food_logs', 'weights', 'nutrition_adjustments']

const shift = (key, n) => {
  const d = parseDay(key)
  d.setDate(d.getDate() + n)
  return keyOf(d)
}

/* ---------- Réglages ---------- */

export async function loadSettings() {
  const id = await currentUserId()
  const row = (await store.get('nutrition_settings', id)) || {}
  return { ...DEFAULT_SETTINGS, ...Object.fromEntries(Object.entries(row).filter(([, v]) => v != null)), id }
}

export async function saveSettings(patch) {
  const id = await currentUserId()
  const current = (await store.get('nutrition_settings', id)) || { id }
  return store.upsert('nutrition_settings', { ...current, ...patch, id })
}

/* ---------- Aliments ---------- */

// Un aliment de ta base, présenté comme un aliment Ciqual.
export function foodItem(f) {
  const portions = f.portion_g ? [{ label: f.portion_label || '1 portion', g: Number(f.portion_g) }] : guessPortions(f.name)
  return {
    ref: f.source === 'ciqual' ? `ciqual:${f.code}` : `food:${f.id}`,
    id: f.id,
    source: f.source,
    code: f.code,
    name: f.name,
    brand: f.brand,
    kcal: Number(f.kcal),
    protein: Number(f.protein),
    carbs: Number(f.carbs),
    fat: Number(f.fat),
    fiber: f.fiber == null ? null : Number(f.fiber),
    favorite: f.favorite,
    portions
  }
}

export function recipeItem(r) {
  return {
    ref: `recipe:${r.id}`,
    id: r.id,
    source: 'recipe',
    name: r.name,
    kcal: Number(r.kcal),
    protein: Number(r.protein),
    carbs: Number(r.carbs),
    fat: Number(r.fat),
    portions: r.cooked_g ? [{ label: 'Tout le plat', g: Number(r.cooked_g) }] : []
  }
}

export const listFoods = () => store.list('foods', { orderBy: 'name' })
export const listRecipes = () => store.list('recipes', { orderBy: 'name' })

export async function findByBarcode(code) {
  const rows = await store.list('foods', { where: { code } })
  return rows.find((r) => r.source !== 'ciqual') || null
}

export async function saveFood(food) {
  const row = {
    source: food.source || 'custom',
    code: food.code || null,
    name: food.name.trim(),
    brand: food.brand || null,
    kcal: Number(food.kcal) || 0,
    protein: Number(food.protein) || 0,
    carbs: Number(food.carbs) || 0,
    fat: Number(food.fat) || 0,
    fiber: food.fiber === '' || food.fiber == null ? null : Number(food.fiber),
    portion_label: food.portion_label || null,
    portion_g: food.portion_g ? Number(food.portion_g) : null,
    favorite: !!food.favorite
  }
  return food.id ? store.update('foods', food.id, row) : store.insert('foods', row)
}

export const removeFood = (id) => store.remove('foods', id)

// Favori : pour un aliment Ciqual, on en garde une copie dans ta base.
export async function setFavorite(item, favorite) {
  if (item.source === 'recipe') return null
  if (item.source === 'ciqual') {
    const existing = (await store.list('foods', { where: { source: 'ciqual', code: item.code } }))[0]
    if (existing) return store.update('foods', existing.id, { favorite })
    if (!favorite) return null
    return store.insert('foods', {
      source: 'ciqual', code: item.code, name: item.name, kcal: item.kcal, protein: item.protein,
      carbs: item.carbs, fat: item.fat, fiber: item.fiber, favorite: true
    })
  }
  return store.update('foods', item.id, { favorite })
}

export async function favorites() {
  return (await listFoods()).filter((f) => f.favorite).map(foodItem)
}

// Retrouve un aliment à partir de sa référence (pour « comme hier », récents…).
export async function resolveRef(ref) {
  const [kind, id] = (ref || '').split(':')
  if (kind === 'ciqual') return findCiqual(await loadCiqual(), id)
  if (kind === 'food') {
    const f = await store.get('foods', id)
    return f ? foodItem(f) : null
  }
  if (kind === 'recipe') {
    const r = await store.get('recipes', id)
    return r ? recipeItem(r) : null
  }
  return null
}

// Derniers aliments notés (sans doublon), avec la dernière quantité utilisée.
export async function recentItems(limit = 15) {
  const logs = await store.list('food_logs', { orderBy: 'created_at', ascending: false, limit: 300 })
  const seen = new Map()
  for (const l of logs) {
    if (!l.ref || seen.has(l.ref)) continue
    seen.set(l.ref, l)
    if (seen.size >= limit) break
  }
  const out = []
  for (const l of seen.values()) {
    const item = await resolveRef(l.ref)
    if (item) out.push({ ...item, lastGrams: Number(l.grams) })
  }
  return out
}

export async function lastGramsFor(ref) {
  const logs = await store.list('food_logs', { where: { ref }, orderBy: 'created_at', ascending: false, limit: 1 })
  return logs[0] ? Number(logs[0].grams) : null
}

/* ---------- Journal ---------- */

export const logsFor = (date) => store.list('food_logs', { where: { date }, orderBy: 'created_at' })

export function addLog({ item, grams, meal, date }) {
  return store.insert('food_logs', {
    date, meal, ref: item.ref, name: item.brand ? `${item.name} (${item.brand})` : item.name,
    grams: Number(grams), ...forGrams(item, grams)
  })
}

export async function updateLog(log, { grams, meal, item }) {
  const per100 = item || {
    kcal: (log.kcal / log.grams) * 100, protein: (log.protein / log.grams) * 100,
    carbs: (log.carbs / log.grams) * 100, fat: (log.fat / log.grams) * 100
  }
  return store.update('food_logs', log.id, { grams: Number(grams), meal, ...forGrams(per100, grams) })
}

export const removeLog = (id) => store.remove('food_logs', id)

// Recopie un repas d'un autre jour.
export async function copyMeal(fromDate, toDate, meal) {
  const src = (await logsFor(fromDate)).filter((l) => l.meal === meal)
  const rows = src.map(({ ref, name, grams, kcal, protein, carbs, fat }) => ({ date: toDate, meal, ref, name, grams, kcal, protein, carbs, fat }))
  return store.insertMany('food_logs', rows)
}

/* ---------- Recettes ---------- */

export function recipeTotals(items, cookedG) {
  const sum = items.reduce(
    (t, i) => ({ grams: t.grams + (Number(String(i.grams || 0).replace(',', '.')) || 0), kcal: t.kcal + Number(i.kcal || 0), protein: t.protein + Number(i.protein || 0), carbs: t.carbs + Number(i.carbs || 0), fat: t.fat + Number(i.fat || 0) }),
    { grams: 0, kcal: 0, protein: 0, carbs: 0, fat: 0 }
  )
  const weight = Number(cookedG) || sum.grams
  const per = (v) => (weight ? Math.round((v / weight) * 1000) / 10 : 0)
  return { ...sum, weight, per100: { kcal: Math.round(per(sum.kcal)), protein: per(sum.protein), carbs: per(sum.carbs), fat: per(sum.fat) } }
}

export async function saveRecipe(recipe) {
  const t = recipeTotals(recipe.items, recipe.cooked_g)
  const row = {
    name: recipe.name.trim(),
    items: recipe.items,
    cooked_g: recipe.cooked_g ? Number(recipe.cooked_g) : null,
    ...t.per100
  }
  return recipe.id ? store.update('recipes', recipe.id, row) : store.insert('recipes', row)
}

export const getRecipe = (id) => store.get('recipes', id)
export const removeRecipe = (id) => store.remove('recipes', id)

/* ---------- Poids ---------- */

export const listWeights = () => store.list('weights', { orderBy: 'date' })
export const listAdjustments = () => store.list('nutrition_adjustments', { orderBy: 'date' })

export async function saveWeight(date, kg) {
  const existing = (await store.list('weights', { where: { date } }))[0]
  if (existing) return store.update('weights', existing.id, { kg: Number(kg) })
  return store.insert('weights', { date, kg: Number(kg) })
}

export const removeWeight = (id) => store.remove('weights', id)

// Fait l'ajustement des 2 semaines s'il est dû (au plus une fois).
let adjusting = null
export function maybeAdjust(today) {
  adjusting ||= (async () => {
    const [weights, adjustments] = await Promise.all([listWeights(), listAdjustments()])
    const due = checkAdjustment(weights, adjustments, today)
    if (due) await store.insert('nutrition_adjustments', due)
    return due
  })().finally(() => setTimeout(() => (adjusting = null), 0))
  return adjusting
}

/* ---------- La journée : cible, séances, conseils ---------- */

async function sportDay(date) {
  try {
    const { sessions } = await ensureWeek(mondayOf(parseDay(date)))
    return sessions.filter((s) => s.date === date)
  } catch {
    return []
  }
}

export async function loadDay(date, { today = keyOf(new Date()) } = {}) {
  if (date === today) await maybeAdjust(today).catch(() => null)
  const [settings, logs, weights, adjustments, sessions, tomorrow, sport] = await Promise.all([
    loadSettings(),
    logsFor(date),
    listWeights(),
    listAdjustments(),
    sportDay(date),
    sportDay(shift(date, 1)),
    loadSportSettings().catch(() => ({ ftp: 210 }))
  ])
  const rideLogs = {}
  for (const s of sessions.filter((x) => x.kind === 'velo' && x.status === 'done')) {
    const log = (await store.list('ride_logs', { where: { session_id: s.id } }))[0]
    if (log) rideLogs[s.id] = log
  }
  const adjust = totalAdjust(adjustments.filter((a) => a.date <= date))
  const weight = currentWeight(weights, date, Number(settings.start_weight_kg))
  const target = dayTarget({ settings, weight, sessions, rideLogs, ftp: Number(sport.ftp) || 210, adjust })
  const tips = fuelingTips({ today: sessions, tomorrow })
  const weighedToday = weights.find((w) => w.date === date) || null
  const lastAdjustment = adjustments[adjustments.length - 1] || null
  return { settings, logs, target, tips, sessions, weighedToday, weights, lastAdjustment }
}
