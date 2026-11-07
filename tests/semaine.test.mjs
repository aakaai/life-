import assert from 'node:assert/strict'
import { makeContext } from '../src/modules/habitudes/logic.js'
import { weekGrid, weekCardFor, weekReminder } from '../src/modules/habitudes/week.js'
import { routineWindow, routineSteps, routineHabits, stepsLeft, moveInOrder } from '../src/modules/habitudes/routine.js'

// semaine du lundi 9 au dimanche 15 novembre 2026, on est dimanche soir
const today = '2026-11-15'
const H = (o) => ({ kind: 'check', frequency: 'daily', start_date: '2026-11-01', moment: 'day', ...o })
const habits = [
  H({ id: 'crea', name: 'Créatine', moment: 'morning', sort: 20 }),
  H({ id: 'eau', name: 'Eau', kind: 'quantity', target: 2, step: 0.5, unit: 'L', moment: 'morning', sort: 10 }),
  H({ id: 'lire', name: 'Lire', frequency: 'weekly', times: 3, moment: 'evening' }),
  H({ id: 'neuf', name: 'Nouvelle', start_date: '2026-11-13', moment: 'evening' }),
  H({ id: 'sucre', name: 'Pas de sucre', kind: 'avoid', moment: 'evening' }),
  H({ id: 'stretch', name: 'Étirements', auto: 'stretch', frequency: 'weekly', times: 5, moment: 'evening' }),
  H({ id: 'mois', name: 'Rangement', frequency: 'monthly', times: 2 })
]
const logs = [
  ...['2026-11-09', '2026-11-10', '2026-11-11', '2026-11-12', '2026-11-13', '2026-11-15'].map((d) => ({ habit_id: 'crea', date: d, value: 1 })),
  { habit_id: 'eau', date: '2026-11-09', value: 2 }, { habit_id: 'eau', date: '2026-11-10', value: 1 },
  { habit_id: 'lire', date: '2026-11-10', value: 1 }, { habit_id: 'lire', date: '2026-11-12', value: 1 },
  { habit_id: 'lire', date: '2026-11-13', value: 1 }, { habit_id: 'lire', date: '2026-11-14', value: 1 },
  { habit_id: 'sucre', date: '2026-11-11', value: 1 } // un écart
]
const ctx = makeContext({ logs, pauses: [{ habit_id: 'crea', start_date: '2026-11-14', end_date: '2026-11-14' }], today })
const g = weekGrid(habits, ctx, today)
assert.equal(g.start, '2026-11-09'); assert.equal(g.end, '2026-11-15')
const row = (id) => g.rows.find((r) => r.habit.id === id)
assert.deepEqual(row('crea').cells, ['done', 'done', 'done', 'done', 'done', 'off', 'done'], 'pause = pas prévu')
assert.equal(row('crea').done, 6); assert.equal(row('crea').planned, 6)
assert.equal(row('eau').cells[1], 'part', 'quantité commencée'); assert.equal(row('eau').cells[0], 'done')
assert.equal(row('lire').done, 3, 'hebdo plafonné à l’objectif'); assert.equal(row('lire').planned, 3)
assert.equal(row('lire').cells[0], 'free')
assert.deepEqual(row('neuf').cells.slice(0, 4), ['off', 'off', 'off', 'off'], 'pas encore commencée')
assert.equal(row('neuf').planned, 3)
assert.equal(row('sucre').cells[2], 'miss', 'écart = raté')
assert.equal(row('mois').counted, false, 'mensuelle : affichée sans compter')
assert.ok(g.pct > 0 && g.pct < 1)
assert.equal(g.done, g.rows.filter((r) => r.counted).reduce((n, r) => n + r.done, 0))
// semaine d'avant : habitudes commencées le 1er
const prev = weekGrid(habits, ctx, '2026-11-02')
assert.equal(prev.start, '2026-11-02'); assert.equal(prev.rows.find((r) => r.habit.id === 'crea').done, 0); assert.equal(prev.rows.find((r) => r.habit.id === 'sucre').done, 7, 'à éviter sans écart = tenu')

// carte de l'accueil : dimanche dès 19 h, lundi toute la journée
assert.equal(weekCardFor(new Date(2026, 10, 15, 18, 59)), null)
assert.equal(weekCardFor(new Date(2026, 10, 15, 19, 0)), '2026-11-15')
assert.equal(weekCardFor(new Date(2026, 10, 16, 22, 0)), '2026-11-15', 'lundi : la semaine d’avant')
assert.equal(weekCardFor(new Date(2026, 10, 17, 9)), null)
// notification du dimanche 19:00
assert.equal(weekReminder(new Date(2026, 10, 11, 12)).at, '2026-11-15T19:00')
assert.equal(weekReminder(new Date(2026, 10, 15, 18)).at, '2026-11-15T19:00')
assert.equal(weekReminder(new Date(2026, 10, 15, 19, 30)).at, '2026-11-22T19:00')
assert.equal(weekReminder(new Date()).category, 'agenda')

// routines
assert.equal(routineWindow(new Date(2026, 10, 10, 7, 40)), 'matin')
assert.equal(routineWindow(new Date(2026, 10, 10, 12, 0)), null)
assert.equal(routineWindow(new Date(2026, 10, 10, 22, 44)), null)
assert.equal(routineWindow(new Date(2026, 10, 10, 22, 45)), 'soir')
assert.equal(routineWindow(new Date(2026, 10, 11, 1, 10)), 'soir', 'après minuit : encore le soir')
assert.equal(routineWindow(new Date(2026, 10, 10, 22, 0), '21:30'), 'soir', 'heure du soir réglable')
assert.deepEqual(routineHabits('matin', habits).map((h) => h.id), ['eau', 'crea'], 'ordre = champ sort')
assert.deepEqual(routineHabits('soir', habits).map((h) => h.id), ['lire', 'neuf'], 'sans « à éviter » ni automatiques')
const sessions = [
  { id: 's1', date: today, kind: 'etirements', status: 'planned' },
  { id: 's2', date: today, kind: 'velo', status: 'planned' },
  { id: 's3', date: '2026-11-14', kind: 'mobilite', status: 'planned' }
]
const soir = routineSteps('soir', habits, ctx, today, sessions)
assert.deepEqual(soir.map((s) => s.key), ['ss1', 'hlire', 'hneuf'], 'étirements du jour en premier, pas le vélo')
assert.equal(soir[1].done, true, 'hebdo déjà atteinte : faite')
assert.equal(stepsLeft(soir), 2)
const matin = routineSteps('matin', habits, ctx, today, sessions)
assert.deepEqual(matin.map((s) => [s.key, s.done]), [['heau', false], ['hcrea', true]])
assert.deepEqual(moveInOrder(routineHabits('matin', habits), 1, -1), [{ id: 'crea', sort: 10 }, { id: 'eau', sort: 20 }])
assert.equal(moveInOrder(routineHabits('matin', habits), 0, -1), null)
console.log('semaine et routines : ok')
