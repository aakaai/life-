// Proposition automatique des menus de la semaine. Fonctions pures (testées dans tests/menus.test.mjs).
//
// Règles :
// - midis à l'école : une boîte, toujours un plat cuisiné en lot ;
// - batch cooking : un seul plat par séance, cuisiné la veille au soir du premier midi à l'école
//   qu'il faut couvrir (le soir même, tu en manges une portion) ;
// - un plat cuisiné se garde `fridgeDays` jours : les portions restantes servent d'abord,
//   aux midis puis aux soirs, avant d'en cuisiner un autre ;
// - sans reste au frigo : le soir on cuisine un nouveau plat en lot, le midi une recette rapide ;
// - petit-déjeuner, collation et coucher tournent entre tes recettes ;
// - jour de sortie longue : le ravitaillement vélo s'ajoute à la collation ;
// - jours de voyage : rien de prévu ;
// - les quantités des recettes restent telles quelles ; planDay ajoute un conseil de féculents.
import { parseDay, keyOf } from '../sport/planner.js'

const shift = (key, n) => {
  const d = parseDay(key)
  d.setDate(d.getDate() + n)
  return keyOf(d)
}
const daysBetween = (a, b) => Math.round((parseDay(b) - parseDay(a)) / 86400000)

/**
 * Midis à l'école : un jour avec des cours le matin ET l'après-midi (d'après l'horaire),
 * sinon les jours par défaut des réglages (0 = lundi).
 */
export function schoolLunches(dates, { schoolEvents = null, defaultDays = [1, 2] } = {}) {
  const out = new Set()
  for (const d of dates) {
    if (schoolEvents) {
      const dayStart = parseDay(d)
      const evs = schoolEvents.filter((e) => !e.all_day && keyOf(new Date(e.start_at)) === d)
      if (!evs.length) continue
      const mins = (iso) => (new Date(iso) - dayStart) / 60000
      const first = Math.min(...evs.map((e) => mins(e.start_at)))
      const last = Math.max(...evs.map((e) => mins(e.end_at)))
      if (first < 12.5 * 60 && last > 13.5 * 60) out.add(d)
    } else if (defaultDays.includes((parseDay(d).getDay() + 6) % 7)) out.add(d)
  }
  return out
}

/**
 * @param dates        jours à proposer (dans l'ordre)
 * @param recipes      tes recettes { id, name, category, servings, batch }
 * @param school       Set des jours où le midi se mange à l'école
 * @param longRide     Set des jours de sortie longue (≥ 2 h)
 * @param away         Set des jours d'absence (voyage)
 * @param taken        Set de « date:repas » déjà remplis à la main (on n'y touche pas)
 * @param cookBefore   jour où l'on peut encore cuisiner avant le 1er jour (souvent la veille), ou null
 * @param history      { recipeId: nombre d'utilisations récentes } pour varier
 * @param stock        portions restantes de plats déjà cuisinés [{ recipe, left, until, batchKey }]
 * @returns { plans: [{ date, meal, recipe_id, cook, box, batchKey }], warnings: [] }
 */
export function proposeWeek({ dates, recipes, school = new Set(), longRide = new Set(), away = new Set(), taken = new Set(), cookBefore = null, fridgeDays = 3, history = {}, stock: initialStock = [] }) {
  const by = (cat) => recipes.filter((r) => r.category === cat)
  const batches = recipes.filter((r) => r.category === 'plat' && (Number(r.servings) || 1) >= 2)
  const quick = [...by('rapide'), ...recipes.filter((r) => r.category === 'plat' && (Number(r.servings) || 1) < 2)]
  const uses = { ...history }
  const plans = []
  const warnings = []
  let lastBatch = null
  let batchN = 0
  let stock = initialStock.map((x) => ({ ...x })) // { recipe, left, until, batchKey } : restes d'un plat déjà prévu

  const pickLeast = (list, avoid) => {
    const pool = list.filter((r) => r.id !== avoid?.id)
    const src = pool.length ? pool : list
    return [...src].sort((a, b) => (uses[a.id] || 0) - (uses[b.id] || 0) || a.name.localeCompare(b.name, 'fr'))[0] || null
  }
  const use = (r) => (uses[r.id] = (uses[r.id] || 0) + 1)
  const add = (p) => plans.push(p)
  const free = (date, meal) => !taken.has(`${date}:${meal}`)

  function cook(date, meal, box = false) {
    const recipe = pickLeast(batches, lastBatch)
    if (!recipe) return false
    lastBatch = recipe
    use(recipe)
    const batchKey = `b${++batchN}`
    stock.push({ recipe, left: (Number(recipe.servings) || 1) - 1, until: shift(date, fridgeDays), batchKey })
    add({ date, meal, recipe_id: recipe.id, cook: true, box, batchKey })
    return true
  }

  function eatStock(date, meal, box = false) {
    stock = stock.filter((s) => s.left > 0 && s.until >= date)
    const s = stock.sort((a, b) => (a.until < b.until ? -1 : 1))[0]
    if (!s) return false
    s.left--
    add({ date, meal, recipe_id: s.recipe.id, cook: false, box, batchKey: s.batchKey })
    return true
  }

  function eatQuick(date, meal, box = false) {
    const r = pickLeast(quick)
    if (!r) return false
    use(r)
    add({ date, meal, recipe_id: r.id, cook: false, box, batchKey: null })
    return true
  }

  const rotate = (cat, date, meal) => {
    if (!free(date, meal)) return
    const r = pickLeast(by(cat))
    if (r) {
      use(r)
      add({ date, meal, recipe_id: r.id, cook: false, box: false, batchKey: null })
    }
  }

  // Le soir avant le 1er jour : cuisiner pour une boîte du lendemain si besoin.
  if (cookBefore && school.has(dates[0]) && !away.has(dates[0]) && free(cookBefore, 3)) cook(cookBefore, 3)

  for (let i = 0; i < dates.length; i++) {
    const d = dates[i]
    const next = dates[i + 1]
    if (away.has(d)) continue

    rotate('matin', d, 0)

    // midi
    if (free(d, 1)) {
      if (school.has(d)) {
        if (!eatStock(d, 1, true) && !eatQuick(d, 1, true)) warnings.push(`Pas de recette pour la boîte du ${d}.`)
      } else if (!eatStock(d, 1) && !eatQuick(d, 1) && !cook(d, 1)) warnings.push(`Rien à proposer pour le midi du ${d}.`)
    }

    rotate('collation', d, 2)
    if (longRide.has(d)) {
      const v = pickLeast(by('velo'))
      if (v) add({ date: d, meal: 2, recipe_id: v.id, cook: false, box: false, batchKey: null })
    }

    // soir : si demain il faut une boîte et que le stock ne suffit pas, on cuisine ce soir
    if (free(d, 3)) {
      const needBox = next && school.has(next) && !away.has(next) && free(next, 1)
      const fresh = stock.filter((s) => s.left > 0 && s.until >= next).reduce((t, s) => t + s.left, 0)
      if (needBox && fresh < 2) {
        if (!cook(d, 3) && !eatStock(d, 3) && !eatQuick(d, 3)) warnings.push(`Rien à proposer pour le soir du ${d}.`)
      } else if (!eatStock(d, 3) && !cook(d, 3) && !eatQuick(d, 3)) warnings.push(`Rien à proposer pour le soir du ${d}.`)
    }

    rotate('soir', d, 4)
  }

  const missing = []
  if (!batches.length) missing.push('« Plats en lot » (au moins 2 portions)')
  if (!by('matin').length) missing.push('« Petit-déjeuner »')
  if (!by('collation').length) missing.push('« Collations »')
  if (!by('soir').length) missing.push('« Avant de dormir »')
  const leftovers = stock.filter((s) => s.left > 0).map((s) => ({ recipe: s.recipe.name, left: s.left }))
  return { plans, warnings, missing, leftovers }
}

export { daysBetween }
