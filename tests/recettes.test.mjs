import assert from 'node:assert/strict'
import { SEED_INGREDIENTS } from '../src/modules/alimentation/seed.js'
const R = (key, name, category, servings, prep_min, batch, lines) => ({ key, name, category, servings, prep_min, batch, lines })
const SEED_RECIPES = [
  R('porridge', 'Porridge', 'matin', 1, 5, false, [['flocons', 80], ['lait', 300], ['banane', 120], ['cacahuete', 20]]),
  R('chili', 'Chili', 'plat', 4, 40, true, [['hache', 500], ['haricots', 500], ['tomates', 800], ['oignon', 150], ['poivron', 150], ['riz', 400], ['huile', 15], ['epices', 10]]),
  R('bolo', 'Bolo', 'plat', 4, 40, true, [['hache', 500], ['pates', 400], ['passata', 700], ['carotte', 200], ['oignon', 150], ['huile', 15], ['emmental', 60]]),
  R('ravito', 'Ravito', 'velo', 1, 5, false, [['sucre', 60], ['banane', 240], ['barre', 50]]),
  R('maquee_miel', 'Maquée', 'soir', 1, 1, false, [['maquee', 250], ['miel', 10]])
]
import { loadCiqual, findCiqual } from '../src/modules/alimentation/ciqual.js'
import { recipeLines, totals, planDay, shoppingList, periodFor, daysOf, qtyLabel } from '../src/modules/alimentation/plan.js'

const ciq = await loadCiqual()
const ingById = {}
for (const s of SEED_INGREDIENTS) {
  let n = s.nutrition
  if (typeof n === 'string') { const c = findCiqual(ciq, n); assert.ok(c, `Ciqual ${n} (${s.name})`); n = [c.kcal, c.protein, c.carbs, c.fat] }
  ingById[s.key] = { id: s.key, name: s.name, kcal: n[0], protein: n[1], carbs: n[2], fat: n[3], pack_g: s.pack[0], pack_label: s.pack[1], pack_price: s.pack[2], unit_g: s.unit?.[0], unit_name: s.unit?.[1], scalable: !!s.scalable, pantry: !!s.pantry, rayon: s.rayon }
}
const recipes = Object.fromEntries(SEED_RECIPES.map((r) => [r.key, { ...r, id: r.key, lines: r.lines.map(([k, g]) => { assert.ok(ingById[k], `ingrédient ${k}`); return { ingredient_id: k, grams: g } }) }]))
console.log('Recette'.padEnd(42), 'kcal  prot  gluc  lip   €/portion')
for (const r of Object.values(recipes)) {
  const t = totals(recipeLines(r, ingById, 1))
  console.log(r.name.padEnd(42), String(t.kcal).padStart(4), String(t.protein).padStart(5), String(t.carbs).padStart(5), String(t.fat).padStart(5), t.cost.toFixed(2).padStart(6))
}

// une journée de jeudi (sortie longue, 3 773 kcal)
const entries = [
  { id: 'a', recipe: recipes.porridge, servings: 1 },
  { id: 'b', recipe: recipes.chili, servings: 1 },
  { id: 'c', recipe: recipes.ravito, servings: 1 },
  { id: 'd', recipe: recipes.bolo, servings: 1 },
  { id: 'e', recipe: recipes.maquee_miel, servings: 1 }
]
const day = planDay({ entries, ingById, target: 3773 })
console.log('jeudi facteur', day.factor, 'prévu', day.plannedKcal, 'écart', day.gap)
for (const e of day.entries) console.log(' ', e.recipe.name, e.totals.kcal, e.lines.filter((l) => l.scaled).map((l) => `${l.ing.name} ${l.grams} g`).join(', '))
assert.ok(Math.abs(day.gap) < 60)
const rest = planDay({ entries, ingById, target: 2411 })
console.log('repos facteur', rest.factor, 'prévu', rest.plannedKcal, 'écart', rest.gap)
const eaten = planDay({ entries: entries.map((e, i) => ({ ...e, eaten: i < 2 })), ingById, target: 3773, eatenKcal: 1500 })
console.log('après 2 repas mangés : facteur', eaten.factor, 'reste prévu', eaten.plannedKcal)

// périodes de courses (lundi et jeudi)
console.log(periodFor('2026-11-02'), periodFor('2026-11-04'), periodFor('2026-11-05'), periodFor('2026-11-08'))
assert.deepEqual(periodFor('2026-11-04'), { start: '2026-11-02', end: '2026-11-04' })
assert.deepEqual(periodFor('2026-11-08'), { start: '2026-11-05', end: '2026-11-08' })
assert.equal(daysOf(periodFor('2026-11-06')).length, 4)

const list = shoppingList([day, rest])
for (const it of list) console.log(' ', it.ing.name.padEnd(34), qtyLabel(it.ing, it.grams).padEnd(10), `${it.packs} × ${it.ing.pack_label}`.padEnd(18), it.cost.toFixed(2), it.ing.pantry ? '(placard)' : '')
console.log('total', list.filter((i) => !i.ing.pantry).reduce((t, i) => t + i.cost, 0).toFixed(2), '€')
assert.equal(qtyLabel(ingById.oeuf, 300), '6 œufs')
console.log('OK')

// ---------- v0.12 : aliment seul dans le planning + collation du matin ----------
{
  const { ingredientRecipe, planDay: pd, shoppingList: sl } = await import('../src/modules/alimentation/plan.js')
  const { MEALS: M, mealRank, mealInfo, mealForTime: mft } = await import('../src/modules/alimentation/data.js')
  const banane = { id: 'ban', name: 'Bananes', kcal: 90, protein: 1.1, carbs: 20, fat: 0.3, unit_g: 120, unit_name: 'banane', pack_g: 1000, pack_price: 1.69 }
  const r = ingredientRecipe(banane, 240)
  const day = pd({ entries: [{ id: 'e1', recipe: r, servings: 1, eaten: false }], ingById: { ban: banane }, target: 0, auto: false })
  if (day.entries[0].totals.kcal !== 216) throw new Error('banane : 216 kcal attendues')
  const list = sl([day])
  if (list[0].ing.id !== 'ban' || list[0].grams !== 240 || list[0].packs !== 1) throw new Error('banane dans la liste de courses')
  if (M.map((m) => m.key).join() !== '0,5,1,2,3,4') throw new Error('ordre des repas')
  if (!(mealRank(5) > mealRank(0) && mealRank(5) < mealRank(1))) throw new Error('collation du matin entre petit-déj et midi')
  if (mealInfo(5).name !== 'Collation du matin') throw new Error('nom collation du matin')
  if (mft(new Date(2026, 10, 3, 10, 30)) !== 5) throw new Error('10 h 30 → collation du matin')
  if (mft(new Date(2026, 10, 3, 8, 0)) !== 0) throw new Error('8 h → petit-déjeuner')
  console.log('aliment seul + collation du matin : OK')
}
