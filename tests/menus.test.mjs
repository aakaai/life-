import assert from 'node:assert/strict'
import { proposeWeek, schoolLunches } from '../src/modules/alimentation/menus.js'

const R = (id, category, servings = 1) => ({ id, name: id, category, servings })
const recipes = [
  R('porridge', 'matin'), R('omelette', 'matin'),
  R('chili', 'plat', 4), R('curry', 'plat', 4), R('bolo', 'plat', 4),
  R('wraps', 'rapide'), R('croque', 'rapide'),
  R('skyr', 'collation'), R('tartines', 'collation'),
  R('maquee', 'soir'), R('ravito', 'velo')
]
const dates = ['2026-11-09', '2026-11-10', '2026-11-11', '2026-11-12', '2026-11-13', '2026-11-14', '2026-11-15']
const school = new Set(['2026-11-10', '2026-11-11'])
const res = proposeWeek({ dates, recipes, school, longRide: new Set(['2026-11-12']), cookBefore: '2026-11-08' })
const M = ['matin', 'midi', 'coll.', 'soir', 'coucher']
for (const d of ['2026-11-08', ...dates]) {
  const day = res.plans.filter((p) => p.date === d).sort((a, b) => a.meal - b.meal)
  console.log(d, day.map((p) => `${M[p.meal]}:${p.recipe_id}${p.cook ? '🍳' : ''}${p.box ? '📦' : ''}`).join('  '))
}
console.log(res.warnings, res.missing, res.leftovers)
// chaque boîte de l'école vient d'un plat cuisiné avant
for (const d of school) {
  const box = res.plans.find((p) => p.date === d && p.meal === 1)
  assert.ok(box.box && box.batchKey, `boîte ${d}`)
  const cookP = res.plans.find((p) => p.batchKey === box.batchKey && p.cook)
  assert.ok(cookP.date < d, 'cuisiné avant')
}
// un seul plat par séance de cuisine, jamais plus de portions que la recette
const byBatch = {}
for (const p of res.plans.filter((x) => x.batchKey)) (byBatch[p.batchKey] ||= []).push(p)
for (const list of Object.values(byBatch)) {
  assert.equal(new Set(list.map((p) => p.recipe_id)).size, 1)
  assert.ok(list.length <= 4)
  assert.equal(list.filter((p) => p.cook).length, 1)
}
// sans horaire : jours par défaut
assert.deepEqual([...schoolLunches(dates, { defaultDays: [1, 2] })], ['2026-11-10', '2026-11-11'])
// avec horaire : cours 8 h 30–12 h 30 et 13 h 30–17 h
const ev = (d, a, b) => ({ all_day: false, start_at: new Date(`${d}T${a}:00`).toISOString(), end_at: new Date(`${d}T${b}:00`).toISOString() })
const s2 = schoolLunches(dates, { schoolEvents: [ev('2026-11-09', '08:30', '12:30'), ev('2026-11-09', '13:30', '17:00'), ev('2026-11-10', '08:30', '11:30'), ev('2026-11-11', '13:00', '17:00'), ev('2026-11-11', '10:00', '12:00')] })
assert.deepEqual([...s2], ['2026-11-09', '2026-11-11'])
// recettes manquantes
assert.ok(proposeWeek({ dates, recipes: [R('wraps', 'rapide')], school }).missing.length >= 3)
// restes de la semaine d'avant
const carry = proposeWeek({ dates, recipes, school, stock: [{ recipe: recipes[2], left: 2, until: '2026-11-10', batchKey: 'old' }] })
assert.equal(carry.plans.filter((p) => p.batchKey === 'old').length, 2)
console.log('OK')
