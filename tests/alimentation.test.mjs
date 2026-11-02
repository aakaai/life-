import assert from 'node:assert/strict'
import { planWeek } from '../src/modules/sport/planner.js'
import { dayTarget, checkAdjustment, avg7, fuelingTips } from '../src/modules/alimentation/targets.js'
import { loadCiqual, searchCiqual } from '../src/modules/alimentation/ciqual.js'
import { forGrams } from '../src/modules/alimentation/data.js'

const week = planWeek({ weekStart: '2026-11-02', now: new Date(2026, 10, 2, 8) }).sessions.map((s, i) => ({ ...s, id: 's' + i, status: 'planned', week_start: '2026-11-02' }))
const day = (d) => week.filter((s) => s.date === d)
for (const d of ['2026-11-02', '2026-11-03', '2026-11-04', '2026-11-05', '2026-11-06', '2026-11-07', '2026-11-08']) {
  const t = dayTarget({ sessions: day(d) })
  console.log(d, t.kcal, 'kcal', `P${t.protein} G${t.carbs} L${t.fat}`, t.training.map((x) => `${x.label} ${x.kcal}`).join(' + '))
}
const rest = dayTarget({ sessions: [] })
assert.ok(Math.abs(rest.kcal - 2410) < 15, 'repos ≈ 2 410')
const thu = dayTarget({ sessions: day('2026-11-05') })
assert.ok(thu.kcal > 3600 && thu.kcal < 3950, 'jeudi ≈ 3 850')
// sortie réelle notée : 150 W pendant 160 min
const real = dayTarget({ sessions: day('2026-11-05'), rideLogs: { [day('2026-11-05')[0].id]: { avg_power: 150, duration_min: 160 } } })
assert.equal(real.training[0].kcal, 1440)

// ajustement du poids : une pesée par samedi
const W = (date, kg) => ({ date, kg })
const sat = (i) => { const d = new Date(2026, 10, 7 + 7 * i); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}` }
const flat = Array.from({ length: 8 }, (_, i) => W(sat(i), 55 + (i % 2) * 0.2))
assert.equal(checkAdjustment(flat, [], sat(3)), null, 'pas avant 4 semaines')
const adj = checkAdjustment(flat, [], sat(4))
console.log(adj)
assert.equal(adj.delta, 150)
assert.equal(checkAdjustment(flat, [adj], sat(5)), null, 'pas avant 2 semaines')
const gaining = flat.map((w, i) => ({ ...w, kg: 55 + i * 0.4 }))
assert.equal(checkAdjustment(gaining, [], sat(4)).delta, -150)
const good = flat.map((w, i) => ({ ...w, kg: 55 + i * 0.2 }))
assert.equal(checkAdjustment(good, [], sat(4)).delta, 0)
console.log(fuelingTips({ tomorrow: day('2026-11-05'), today: [] }))

// recherche Ciqual
const list = await loadCiqual()
for (const q of ['oeufs', 'riz cru', 'poulet filet', 'skyr', 'flocons avoine', 'saumon']) {
  console.log(q, '→', searchCiqual(list, q, { limit: 3, excludeFish: true }).map((x) => `${x.name} (${x.kcal})${x.fish ? ' [poisson]' : ''}`).join(' | '))
}
console.log(forGrams({ kcal: 350, protein: 7, carbs: 77.5, fat: 0.8 }, 80))
console.log('OK')
