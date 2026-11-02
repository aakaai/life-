// Accès aux données du module Alimentation (via la couche commune `store`).
import { store, currentUserId } from '../../lib/store'
import { DEFAULT_SETTINGS, guessPortions, forGrams } from './data'
import { loadCiqual, findCiqual } from './ciqual'
import { dayTarget, currentWeight, checkAdjustment, totalAdjust, fuelingTips } from './targets'
import { ensureWeek, loadSettings as loadSportSettings } from '../sport/api'
import { mondayOf, parseDay, keyOf } from '../sport/planner'
import { SEED_INGREDIENTS } from './seed'
import { planDay, recipeLines, totals } from './plan'

export const FOOD_TABLES = [
  'nutrition_settings', 'foods', 'ingredients', 'recipes', 'meal_plans', 'shopping_lists',
  'food_logs', 'weights', 'nutrition_adjustments'
]

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
    portions: r.cooked_g
      ? (Number(r.servings) || 1) > 1
        ? [{ label: '1 portion', g: Math.round(Number(r.cooked_g) / Number(r.servings)) }, { label: 'Tout le plat', g: Number(r.cooked_g) }]
        : [{ label: '1 portion', g: Number(r.cooked_g) }]
      : []
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

export async function removeLog(id) {
  await store.remove('food_logs', id)
  const plans = await store.list('meal_plans', { where: { log_id: id } })
  for (const p of plans) await store.update('meal_plans', p.id, { eaten: false, log_id: null })
}

export const logsBetween = (start, end) => store.list('food_logs', { gte: { date: start }, lte: { date: end } })

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

/* ---------- Ingrédients ---------- */

const numOrNull = (v) => (v === '' || v == null ? null : Number(v))

export function normIngredient(i) {
  return {
    ...i,
    kcal: Number(i.kcal) || 0, protein: Number(i.protein) || 0, carbs: Number(i.carbs) || 0, fat: Number(i.fat) || 0,
    pack_g: numOrNull(i.pack_g), pack_price: numOrNull(i.pack_price), unit_g: numOrNull(i.unit_g)
  }
}

export async function listIngredients() {
  return (await store.list('ingredients', { orderBy: 'name' })).map(normIngredient)
}

export const indexById = (list) => Object.fromEntries(list.map((x) => [x.id, x]))

export function saveIngredient(ing) {
  const row = {
    name: ing.name.trim(), rayon: ing.rayon, ciqual_code: ing.ciqual_code || null,
    kcal: Number(ing.kcal) || 0, protein: Number(ing.protein) || 0, carbs: Number(ing.carbs) || 0, fat: Number(ing.fat) || 0,
    pack_g: numOrNull(ing.pack_g), pack_label: ing.pack_label || null, pack_price: numOrNull(ing.pack_price),
    price_date: ing.price_changed ? keyOf(new Date()) : ing.price_date || null,
    unit_g: numOrNull(ing.unit_g), unit_name: ing.unit_name || null,
    scalable: !!ing.scalable, pantry: !!ing.pantry
  }
  if (ing.key !== undefined) row.key = ing.key
  return ing.id ? store.update('ingredients', ing.id, row) : store.insert('ingredients', row)
}

export const removeIngredient = (id) => store.remove('ingredients', id)

/* ---------- Base de recettes de départ ---------- */

function seedIngredientRow(s, ciqual) {
  let n = s.nutrition
  let code = null
  if (typeof n === 'string') {
    code = n
    const c = findCiqual(ciqual, n)
    n = c ? [c.kcal, c.protein, c.carbs, c.fat] : [0, 0, 0, 0]
  }
  return {
    key: s.key, name: s.name, rayon: s.rayon, ciqual_code: code,
    kcal: n[0], protein: n[1], carbs: n[2], fat: n[3],
    pack_g: s.pack[0], pack_label: s.pack[1], pack_price: s.pack[2], price_date: null,
    unit_g: s.unit ? s.unit[0] : null, unit_name: s.unit ? s.unit[1] : null,
    scalable: !!s.scalable, pantry: !!s.pantry
  }
}

// Valeurs pour 100 g et poids total d'une recette (pour la noter comme un aliment).
export function recipePer100(recipe, ingById) {
  const t = totals(recipeLines(recipe, ingById, recipe.servings))
  const weight = Number(recipe.cooked_g) || t.grams
  const per = (v) => (weight ? Math.round((v / weight) * 1000) / 10 : 0)
  return { cooked_g: Math.round(weight), kcal: Math.round(per(t.kcal)), protein: per(t.protein), carbs: per(t.carbs), fat: per(t.fat) }
}

let seeding = null
// Installe les ingrédients de base (avec leurs prix) au premier lancement.
// Les recettes de base ont été retirées le 2 nov. 2026 : Esteban crée les siennes.
// Toute recette qui vient de l'ancienne base (champ `key`) est supprimée une fois.
export function ensureSeed({ force = false } = {}) {
  seeding ||= (async () => {
    const old = (await store.list('recipes')).filter((r) => r.key)
    for (const r of old) {
      await store.removeWhere('meal_plans', { where: { recipe_id: r.id } })
      await store.remove('recipes', r.id)
    }
    const ings = await store.list('ingredients')
    if (ings.length && !force) return false
    const ciqual = await loadCiqual()
    const have = new Set(ings.map((i) => i.key).filter(Boolean))
    await store.insertMany(
      'ingredients',
      SEED_INGREDIENTS.filter((x) => !have.has(x.key)).map((x) => seedIngredientRow(x, ciqual))
    )
    return true
  })().finally(() => setTimeout(() => (seeding = null), 0))
  return seeding
}

export async function saveRecipeV2(recipe, ingById) {
  const cooked = numOrNull(String(recipe.cooked_g ?? '').replace(',', '.'))
  const row = {
    name: recipe.name.trim(), category: recipe.category, servings: Number(recipe.servings) || 1,
    prep_min: numOrNull(recipe.prep_min), batch: !!recipe.batch, steps: recipe.steps || '',
    lines: recipe.lines.map((l) => ({ ingredient_id: l.ingredient_id, grams: Number(String(l.grams).replace(',', '.')) || 0 })),
    items: recipe.lines.length ? [] : recipe.items || [],
    cooked_g: cooked || null,
    cooked_measured: !!cooked
  }
  Object.assign(row, recipePer100(row, ingById))
  return recipe.id ? store.update('recipes', recipe.id, row) : store.insert('recipes', row)
}

/* ---------- Planning des repas ---------- */

export const plansBetween = (start, end) => store.list('meal_plans', { gte: { date: start }, lte: { date: end }, orderBy: 'sort' })

export function addPlan({ date, meal, recipe_id, servings = 1 }) {
  return store.insert('meal_plans', { date, meal, recipe_id, servings, eaten: false, sort: Date.now() % 1e9 })
}
export const updatePlan = (id, patch) => store.update('meal_plans', id, patch)
export const removePlan = (id) => store.remove('meal_plans', id)

export async function eatPlan(entry) {
  const t = entry.totals
  const log = await store.insert('food_logs', {
    date: entry.date, meal: entry.meal, ref: `recipe:${entry.recipe.id}`,
    name: Number(entry.servings) !== 1 ? `${entry.recipe.name} (×${String(entry.servings).replace('.', ',')})` : entry.recipe.name,
    grams: Math.round(t.grams), kcal: t.kcal, protein: t.protein, carbs: t.carbs, fat: t.fat
  })
  await updatePlan(entry.id, { eaten: true, log_id: log.id })
}

export async function uneatPlan(entry) {
  if (entry.log_id) await store.remove('food_logs', entry.log_id)
  await updatePlan(entry.id, { eaten: false, log_id: null })
}

// Cibles de plusieurs jours (une seule lecture des réglages, pesées, séances).
export async function loadTargets(dates) {
  const [settings, weights, adjustments, sport] = await Promise.all([
    loadSettings(), listWeights(), listAdjustments(), loadSportSettings().catch(() => ({ ftp: 210 }))
  ])
  const mondays = [...new Set(dates.map((d) => mondayOf(parseDay(d))))]
  const sessions = []
  for (const m of mondays) {
    try {
      sessions.push(...(await ensureWeek(m)).sessions)
    } catch {
      /* pas de sport : cible de repos */
    }
  }
  const rideLogs = {}
  for (const s of sessions.filter((x) => x.kind === 'velo' && x.status === 'done' && dates.includes(x.date))) {
    const log = (await store.list('ride_logs', { where: { session_id: s.id } }))[0]
    if (log) rideLogs[s.id] = log
  }
  const out = {}
  for (const d of dates) {
    out[d] = dayTarget({
      settings,
      weight: currentWeight(weights, d, Number(settings.start_weight_kg)),
      sessions: sessions.filter((s) => s.date === d),
      rideLogs,
      ftp: Number(sport.ftp) || 210,
      adjust: totalAdjust(adjustments.filter((a) => a.date <= d))
    })
  }
  return { targets: out, settings }
}

// Planning de plusieurs jours : repas prévus avec portions ajustées à la cible.
export async function loadPlanRange(dates) {
  await ensureSeed()
  const start = dates[0]
  const end = dates[dates.length - 1]
  const [ings, recipes, plans, logs, { targets, settings }] = await Promise.all([
    listIngredients(), listRecipes(), plansBetween(start, end), logsBetween(start, end), loadTargets(dates)
  ])
  const ingById = indexById(ings)
  const recipeById = indexById(recipes)
  const days = {}
  for (const d of dates) {
    const entries = plans
      .filter((p) => p.date === d)
      .map((p) => ({ ...p, servings: Number(p.servings), recipe: recipeById[p.recipe_id] }))
      .filter((e) => e.recipe)
    const eatenKcal = logs.filter((l) => l.date === d).reduce((t, l) => t + Number(l.kcal || 0), 0)
    days[d] = { ...planDay({ entries, ingById, target: targets[d].kcal, eatenKcal, auto: settings.auto_portions !== false }), target: targets[d], eatenKcal }
  }
  return { days, ingById, recipes, recipeById, settings, ings }
}

/* ---------- Courses ---------- */

export async function shoppingState(start) {
  return (await store.list('shopping_lists', { where: { start } }))[0] || { start, checked: [], skipped: [] }
}

export function saveShoppingState(state) {
  const row = { checked: state.checked, skipped: state.skipped }
  return state.id ? store.update('shopping_lists', state.id, row) : store.insert('shopping_lists', { start: state.start, ...row })
}
