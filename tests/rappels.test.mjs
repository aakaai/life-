import assert from 'node:assert/strict'
import { planReminders, doneValue } from '../src/modules/habitudes/reminders.js'
import { makeContext } from '../src/modules/habitudes/logic.js'

const today = '2026-11-03' // mardi
const now = new Date(2026, 10, 3, 14, 0)
const H = (o) => ({ kind: 'check', frequency: 'daily', start_date: '2026-11-01', moment: 'day', ...o })
const habits = [
  H({ id: 'med', name: 'Méditer', emoji: '🧘', reminder_time: '07:30' }),   // 7 h 30 déjà passé aujourd'hui
  H({ id: 'lire', name: 'Lire', kind: 'quantity', target: 20, unit: 'min', reminder_time: '21:00' }),
  H({ id: 'eau', name: 'Eau', reminder_time: '18:00' }),                      // déjà cochée aujourd'hui
  H({ id: 'snack', name: 'Pas de snack', kind: 'avoid', reminder_time: '20:00' }), // pas de rappel « à éviter »
  H({ id: 'rev', name: 'Réviser', frequency: 'weekly', times: 2, reminder_time: '19:00' }),
  H({ id: 'nuit', name: 'Coucher', reminder_time: '00:30' }),                 // après minuit = encore la journée
  H({ id: 'sans', name: 'Sans heure' })
]
const ctx = makeContext({
  logs: [
    { habit_id: 'eau', date: today, value: 1 },
    { habit_id: 'lire', date: today, value: 10 },
    { habit_id: 'rev', date: '2026-11-02', value: 1 },
    { habit_id: 'rev', date: today, value: 1 } // objectif de la semaine atteint
  ],
  pauses: [{ habit_id: 'med', start_date: '2026-11-06', end_date: '2026-11-07' }],
  today
})
const r = planReminders(habits, ctx, now)
const ids = r.map((x) => x.id)
assert.ok(!ids.includes('med|2026-11-03'), '7 h 30 déjà passé')
assert.ok(ids.includes('med|2026-11-04'))
assert.ok(!ids.includes('med|2026-11-06') && !ids.includes('med|2026-11-07'), 'pause')
assert.ok(!ids.includes('eau|2026-11-03'), 'déjà cochée')
assert.ok(ids.includes('eau|2026-11-04'))
assert.ok(!ids.some((i) => i.startsWith('snack|')), 'à éviter : pas de rappel')
assert.ok(!ids.some((i) => i.startsWith('rev|2026-11-0') && i <= 'rev|2026-11-08'), 'hebdo atteint : plus de rappel cette semaine')
assert.ok(ids.includes('rev|2026-11-09'), 'semaine suivante : rappel')
const lire = r.find((x) => x.id === 'lire|2026-11-03')
assert.equal(lire.at, '2026-11-03T21:00')
assert.match(lire.body, /10 \/ 20 min/)
const nuit = r.find((x) => x.id === 'nuit|2026-11-03')
assert.equal(nuit.at, '2026-11-04T00:30', '0 h 30 le lendemain, pour la journée du 3')
assert.equal(r.find((x) => x.id === 'med|2026-11-04').title, '🧘 Méditer')
assert.ok(r.every((x, i) => i === 0 || r[i - 1].at <= x.at), 'trié par heure')
assert.equal(planReminders(habits, ctx, now, { max: 5 }).length, 5)
assert.equal(doneValue({ kind: 'quantity', target: 20 }, 10), 20)
assert.equal(doneValue({ kind: 'quantity', target: 20 }, 30), 30)
assert.equal(doneValue({ kind: 'check' }), 1)
assert.equal(doneValue({ kind: 'avoid' }), null)
console.log('rappels : OK')
