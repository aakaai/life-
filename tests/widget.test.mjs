import assert from 'node:assert/strict'
import { feedEvents, feedMeals, feedTasks, feedHabits, colorToken } from '../src/modules/widget/logic.js'
import { makeContext } from '../src/modules/habitudes/logic.js'

const today = '2026-11-04'
const D = (h, m = 0, d = 4) => new Date(2026, 10, d, h, m)

assert.equal(colorToken('var(--purple)'), 'purple')
assert.equal(colorToken('var(--c-velo)'), 'c-velo')
assert.equal(colorToken(undefined), 'gray')

// évènements : aujourd'hui + demain, les tâches restent dans leur carré
const items = [
  { id: 'c:1', kind: 'cours', title: 'IA 1', color: 'var(--purple)', allDay: false, start: D(13, 45), end: D(15, 45), meta: 'A201' },
  { id: 'g:2', kind: 'google', title: 'Soirée', color: 'var(--green)', allDay: false, start: D(20, 30), end: D(23), meta: '' },
  { id: 'a:3', kind: 'off', title: 'Congé', color: 'var(--yellow)', allDay: true, dayStart: '2026-11-05', dayEnd: '2026-11-06' },
  { id: 't:4', kind: 'task', title: 'Tâche', color: 'var(--gray)', allDay: false, start: D(11), end: D(11, 30) },
  { id: 'g:5', kind: 'google', title: 'Hier', color: 'var(--green)', allDay: false, start: D(10, 0, 3), end: D(11, 0, 3) },
  { id: 'g:6', kind: 'google', title: 'Après-demain', color: 'var(--green)', allDay: false, start: D(9, 0, 6), end: D(10, 0, 6) }
]
const ev = feedEvents(items, today, '2026-11-06')
assert.deepEqual(ev.map((e) => e.id), ['c:1', 'g:2', 'a:3'])
assert.equal(ev[0].start, D(13, 45).getTime())
assert.equal(ev[0].color, 'purple')
assert.equal(ev[0].sub, 'A201')
assert.deepEqual([ev[2].all_day, ev[2].date, ev[2].day_end, ev[2].start], [true, '2026-11-05', '2026-11-06', null])

// repas prévus pas encore mangés
const meals = feedMeals({ entries: [
  { meal: 1, eaten: false, recipe: { name: 'Bowl shawarma' }, totals: { kcal: 640 } },
  { meal: 0, eaten: true, recipe: { name: 'Porridge' }, totals: { kcal: 520 } },
  { meal: 5, eaten: false, recipe: { name: 'Banane' }, totals: { kcal: 106 } },
  { meal: 5, eaten: false, recipe: { name: 'Skyr' }, totals: { kcal: 126 } }
] }, today)
assert.deepEqual(meals.map((m) => m.title), ['Collation du matin · Banane + Skyr', 'Midi · Bowl shawarma'])
assert.equal(meals[0].start, D(10).getTime())
assert.equal(meals[1].sub, '640 kcal')
assert.deepEqual(feedMeals(null, today), [])

// tâches : en retard, du jour, faites aujourd'hui
const tasks = feedTasks([
  { id: 'a', title: 'Rendre rapport', planned_date: '2026-11-03', priority: 3, done: false, category_id: 'k1' },
  { id: 'b', title: 'Mail prof', planned_date: today, time: '11:00', priority: 2, done: false },
  { id: 'c', title: 'Courses', planned_date: today, priority: 1, done: true, done_at: D(9).toISOString() },
  { id: 'd', title: 'Plus tard', planned_date: '2026-11-10', priority: 2, done: false }
], [{ id: 'k1', color: 'purple' }], today)
assert.deepEqual(tasks.map((t) => t.id).sort(), ['a', 'b', 'c'])
const late = tasks.find((t) => t.id === 'a')
assert.deepEqual([late.late, late.priority, late.color], [true, 3, 'purple'])
assert.equal(tasks.find((t) => t.id === 'b').time, '11:00')
assert.equal(tasks.find((t) => t.id === 'c').done, true)

// habitudes du jour : à éviter exclues, quantité avec note, auto non cochable
const habits = [
  { id: 'h1', name: 'Lire', kind: 'check', frequency: 'daily', start_date: '2026-11-01', category_id: 'c1', moment: 'evening' },
  { id: 'h2', name: 'Eau', kind: 'quantity', target: 2, unit: 'L', frequency: 'daily', start_date: '2026-11-01' },
  { id: 'h3', name: 'Pas de soda', kind: 'avoid', frequency: 'daily', start_date: '2026-11-01' },
  { id: 'h4', name: 'Protéines', kind: 'check', frequency: 'daily', start_date: '2026-11-01', auto: 'protein' },
  { id: 'h5', name: 'Escalade', kind: 'check', frequency: 'weekly', times: 2, start_date: '2026-11-01' }
]
const ctx = makeContext({ logs: [{ habit_id: 'h2', date: today, value: 2 }, { habit_id: 'h5', date: '2026-11-03', value: 1 }], auto: { protein: { [today]: true } }, today })
const fh = feedHabits({ habits, categories: [{ id: 'c1', color: 'blue' }], ctx, today })
assert.equal(fh.date, today)
const byId = Object.fromEntries(fh.items.map((h) => [h.id, h]))
assert.equal(byId.h3, undefined)
assert.deepEqual([byId.h1.done, byId.h1.tickable, byId.h1.color], [false, true, 'blue'])
assert.deepEqual([byId.h2.done, byId.h2.note], [true, '2/2 L'])
assert.equal(byId.h5.note, '1 / 2 sem.')
assert.deepEqual([byId.h4.done, byId.h4.tickable, byId.h4.note], [true, false, 'auto'])
console.log('widget : OK')
