import assert from 'node:assert/strict'
import { planWeek, weekInfo } from '../src/modules/sport/planner.js'
import { suggest } from '../src/modules/sport/progression.js'
import { WORKOUTS } from '../src/modules/sport/data.js'

const show = (r) => r.sessions.map(s => `${s.date} ${s.start_time} ${s.duration_min}' ${s.status.padEnd(8)} ${s.variant.padEnd(8)} ${s.label}${s.note ? '  → ' + s.note : ''}`).join('\n')
const W = '2026-11-02'
const monday8 = new Date(2026, 10, 2, 8, 0)

// 1. semaine type sans événement
let r = planWeek({ weekStart: W, now: monday8 })
console.log('--- Semaine type\n' + show(r))
assert.equal(r.sessions.filter(s => s.status === 'planned').length, 9)
assert.ok(r.sessions.every(s => !s.note))
// 4e séance muscu (3 nov.) : Haut C le jeudi après la sortie longue ; pas en semaine allégée, examens ni voyage
assert.equal(r.sessions.find(s => s.template_key === 'haut_c').date, '2026-11-05')
for (const [w, d] of [['2026-11-23', new Date(2026, 10, 23, 8)], ['2026-12-28', new Date(2026, 11, 28, 8)], ['2027-01-25', new Date(2027, 0, 25, 8)]]) {
  assert.ok(!planWeek({ weekStart: w, now: d }).sessions.some(s => s.template_key === 'haut_c'), `pas de Haut C la semaine du ${w}`)
}

// 2. escalade dimanche 14-17 + soirée mardi 18-23 + examen jeudi
const ev = (title, d, a, b) => ({ title, all_day: false, start_at: new Date(2026, 10, d, ...a).toISOString(), end_at: new Date(2026, 10, d, ...b).toISOString() })
const events = [
  ev('Anniversaire Lucas', 3, [17, 0], [23, 0]),
  ev('Escalade avec Tom', 7, [14, 0], [17, 0]),
  ev('Examen fiscalité', 5, [9, 0], [12, 0]),
]
r = planWeek({ weekStart: W, now: monday8, events })
console.log('--- Avec événements\n' + show(r))
const ss = r.sessions.find(s => s.template_key === 'sweet_spot')
assert.notEqual(ss.date, '2026-11-03')

// 3. escalade vendredi soir → Haut B mercredi allégée
r = planWeek({ weekStart: W, now: monday8, events: [ev('Bloc', 6, [19, 0], [21, 0])] })
console.log('--- Escalade vendredi\n' + show(r))
assert.equal(r.sessions.find(s => s.template_key === 'haut_b').variant, 'allegee')

// 4. mercredi midi, rien de fait lundi/mardi
const prev = planWeek({ weekStart: W, now: monday8 }).sessions
r = planWeek({ weekStart: W, now: new Date(2026, 10, 4, 12, 0), previous: prev.map(s => ({ ...s, status: s.template_key === 'haut_a' ? 'done' : s.status })) })
console.log('--- Mercredi, Haut A faite, sweet spot ratée\n' + show(r))

// 5. semaine de récupération & phases
console.log(weekInfo('2026-11-23'), weekInfo('2027-03-22'))
r = planWeek({ weekStart: '2026-11-23', now: new Date(2026, 10, 23, 8) })
console.log('--- Semaine allégée\n' + show(r))
r = planWeek({ weekStart: '2027-01-25', now: new Date(2027, 0, 25, 8) })
console.log('--- Voyage\n' + show(r))
r = planWeek({ weekStart: '2027-03-22', now: new Date(2027, 2, 22, 8) })
console.log('--- Construction\n' + show(r))

// progression
const item = WORKOUTS.haut_a.items[0]
console.log(suggest(item, []))
console.log(suggest(item, [{ date: 'x', sets: [1,2,3].map(i => ({ weight_kg: 10, reps: 12, rir: 1 })) }]))
console.log(suggest(item, [{ date: 'x', sets: [{ weight_kg: 10, reps: 10, rir: 2 }, { weight_kg: 10, reps: 9, rir: 1 }, { weight_kg: 10, reps: 8, rir: 1 }] }]))
console.log(suggest(item, [{ date: 'x', sets: [1,2,3].map(() => ({ weight_kg: 13, reps: 12, rir: 2 })) }]))
console.log('OK')
