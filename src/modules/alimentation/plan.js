// Calculs du planning des repas et de la liste de courses. Fonctions pures (testées).
import { parseDay, keyOf } from '../sport/planner.js'

const r1 = (v) => Math.round(v * 10) / 10
export const round5 = (g) => Math.max(5, Math.round(g / 5) * 5)

// Coût d'un gramme d'ingrédient (€).
export const costPerGram = (ing) => (ing && ing.pack_g && ing.pack_price != null ? Number(ing.pack_price) / Number(ing.pack_g) : 0)

// Valeurs d'une ligne (ingrédient × grammes).
export function lineValues(ing, grams) {
  const k = grams / 100
  return {
    kcal: Math.round((Number(ing.kcal) || 0) * k),
    protein: r1((Number(ing.protein) || 0) * k),
    carbs: r1((Number(ing.carbs) || 0) * k),
    fat: r1((Number(ing.fat) || 0) * k),
    cost: Math.round(costPerGram(ing) * grams * 100) / 100
  }
}

export function totals(lines) {
  return lines.reduce(
    (t, l) => ({
      grams: t.grams + l.grams,
      kcal: t.kcal + l.kcal,
      protein: r1(t.protein + l.protein),
      carbs: r1(t.carbs + l.carbs),
      fat: r1(t.fat + l.fat),
      cost: Math.round((t.cost + l.cost) * 100) / 100
    }),
    { grams: 0, kcal: 0, protein: 0, carbs: 0, fat: 0, cost: 0 }
  )
}

// Un aliment seul dans le planning (« 1 banane ») se comporte comme une recette d'une ligne :
// mêmes calculs pour les calories, les portions du jour et la liste de courses.
export function ingredientRecipe(ing, grams) {
  return {
    id: `ing:${ing.id}`,
    ingredientId: ing.id,
    single: true,
    name: ing.name,
    servings: 1,
    category: 'collation',
    lines: [{ ingredient_id: ing.id, grams: Number(grams) || Number(ing.unit_g) || 100 }]
  }
}

// Lignes d'une recette pour `servings` portions. ingById : { id: ingrédient }
export function recipeLines(recipe, ingById, servings = 1) {
  const per = (Number(servings) || 1) / (Number(recipe.servings) || 1)
  const lines = (recipe.lines || [])
    .map((l) => {
      const ing = ingById[l.ingredient_id]
      if (!ing) return null
      const grams = Number(l.grams) * per
      return { ing, grams, ...lineValues(ing, grams) }
    })
    .filter(Boolean)
  // anciennes recettes (avant la v0.5) : ingrédients sans prix
  if (!lines.length && recipe.items?.length) {
    for (const it of recipe.items) {
      const g = Number(String(it.grams).replace(',', '.')) || 0
      const pseudo = { name: it.name, kcal: (it.kcal / g) * 100, protein: (it.protein / g) * 100, carbs: (it.carbs / g) * 100, fat: (it.fat / g) * 100 }
      const grams = g * per
      lines.push({ ing: pseudo, grams, ...lineValues(pseudo, grams) })
    }
  }
  return lines
}

/**
 * Ajuste les portions d'une journée à la cible : seuls les féculents (riz, pâtes, pain,
 * flocons, pommes de terre…) changent, les protéines restent fixes.
 * @param entries  repas prévus [{ id, recipe, servings, eaten }]
 * @param target   cible kcal du jour
 * @param eatenKcal déjà noté dans le journal (y compris les repas prévus déjà mangés)
 */
export function planDay({ entries, ingById, target, eatenKcal = 0, auto = true, minF = 0.5, maxF = 2.2 }) {
  const open = entries.filter((e) => !e.eaten)
  const base = open.map((e) => ({ e, lines: recipeLines(e.recipe, ingById, e.servings) }))
  const all = base.flatMap((b) => b.lines)
  const K = all.reduce((t, l) => t + l.kcal, 0)
  const S = all.filter((l) => l.ing.scalable).reduce((t, l) => t + l.kcal, 0)
  let factor = 1
  if (auto && open.length && S > 0 && target) {
    factor = Math.min(maxF, Math.max(minF, 1 + (target - eatenKcal - K) / S))
    factor = Math.round(factor * 100) / 100
  }
  const out = entries.map((e) => {
    if (e.eaten) return { ...e, lines: [], totals: null }
    const lines = recipeLines(e.recipe, ingById, e.servings).map((l) => {
      if (!l.ing.scalable || factor === 1) return { ...l, grams: Math.round(l.grams) }
      const grams = round5(l.grams * factor)
      return { ...l, grams, scaled: true, ...lineValues(l.ing, grams) }
    })
    return { ...e, lines, totals: totals(lines) }
  })
  const planned = out.reduce((t, e) => t + (e.totals?.kcal || 0), 0)
  return { entries: out, factor, plannedKcal: planned, gap: target ? Math.round(target - eatenKcal - planned) : 0 }
}

/* ---------- Courses ---------- */

const shift = (key, n) => {
  const d = parseDay(key)
  d.setDate(d.getDate() + n)
  return keyOf(d)
}
const weekday = (key) => (parseDay(key).getDay() + 6) % 7 // lundi = 0

// Période de courses qui contient `key` : du jour de courses jusqu'à la veille du suivant.
export function periodFor(key, shopDays = [0, 3]) {
  const days = [...shopDays].map(Number).sort((a, b) => a - b)
  if (!days.length) return { start: key, end: shift(key, 6) }
  let start = key
  for (let i = 0; i < 7; i++) {
    const k = shift(key, -i)
    if (days.includes(weekday(k))) {
      start = k
      break
    }
  }
  let end = shift(start, 6)
  for (let i = 1; i <= 7; i++) {
    const k = shift(start, i)
    if (days.includes(weekday(k))) {
      end = shift(k, -1)
      break
    }
  }
  return { start, end }
}

export function daysOf({ start, end }) {
  const out = []
  for (let k = start; k <= end; k = shift(k, 1)) out.push(k)
  return out
}

// Quantité lisible : « 3 œufs », « 650 g », « 1,2 kg ».
export function qtyLabel(ing, grams) {
  if (ing.unit_g && ing.unit_name) {
    const n = Math.round((grams / ing.unit_g) * 10) / 10
    if (n >= 0.5 && Math.abs(n - Math.round(n)) < 0.15) {
      const c = Math.round(n)
      return `${c} ${c > 1 ? plural(ing.unit_name) : ing.unit_name}`
    }
  }
  if (grams >= 1000) return `${(Math.round(grams / 100) / 10).toLocaleString('fr-BE')} kg`
  return `${Math.round(grams)} g`
}

const plural = (w) => (/[sx]$/.test(w) ? w : w.endsWith('eau') ? `${w}x` : `${w}s`)

/**
 * Liste de courses : somme des ingrédients des repas prévus, convertie en paquets.
 * dayPlans : résultats de planDay pour chaque jour de la période
 */
export function shoppingList(dayPlans) {
  const need = new Map()
  for (const p of dayPlans) {
    for (const e of p.entries) {
      for (const l of e.lines || []) {
        if (!l.ing.id) continue
        const cur = need.get(l.ing.id) || { ing: l.ing, grams: 0, recipes: new Set() }
        cur.grams += l.grams
        cur.recipes.add(e.recipe.name)
        need.set(l.ing.id, cur)
      }
    }
  }
  const items = [...need.values()].map(({ ing, grams, recipes }) => {
    const packs = ing.pack_g ? Math.max(1, Math.ceil((grams - 0.5) / Number(ing.pack_g))) : 1
    return {
      ing,
      grams: Math.round(grams),
      packs,
      cost: Math.round(packs * (Number(ing.pack_price) || 0) * 100) / 100,
      used: Math.round(costPerGram(ing) * grams * 100) / 100,
      recipes: [...recipes]
    }
  })
  items.sort((a, b) => a.ing.name.localeCompare(b.ing.name, 'fr'))
  return items
}
