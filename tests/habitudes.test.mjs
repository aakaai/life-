import assert from 'node:assert/strict'
import {
  todayKey, makeContext, dayStatus, streak, rate, globalRate, todayItem, isVisibleOn, periodOf,
  periodStatus, autoFromData, dayScore, taskDay, progressLabel, challengeDay, addDays
} from '../src/modules/habitudes/logic.js'

// Journée qui se termine à 3 h du matin
assert.equal(todayKey(new Date(2026, 10, 4, 1, 30)), '2026-11-03')
assert.equal(todayKey(new Date(2026, 10, 4, 3, 1)), '2026-11-04')

const today = '2026-11-18' // mercredi
const log = (habit_id, date, value = 1) => ({ habit_id, date, value })

/* ---------- Quotidienne : séries, joker, pause ---------- */
const med = { id: 'med', name: 'Méditer', kind: 'check', frequency: 'daily', start_date: '2026-11-02' }
// semaine 1 (2–8 nov.) : tout fait sauf le 4 (joker) ; semaine 2 (9–15) : ratés le 10 (joker) et le 12 (raté)
const days1 = ['2026-11-02', '2026-11-03', '2026-11-05', '2026-11-06', '2026-11-07', '2026-11-08']
const days2 = ['2026-11-09', '2026-11-11', '2026-11-13', '2026-11-14', '2026-11-15']
const days3 = ['2026-11-16', '2026-11-17']
let ctx = makeContext({ logs: [...days1, ...days2, ...days3].map((d) => log('med', d)), today })
assert.equal(dayStatus(med, '2026-11-04', ctx), 'joker')
assert.equal(dayStatus(med, '2026-11-10', ctx), 'joker')
assert.equal(dayStatus(med, '2026-11-12', ctx), 'missed')
assert.equal(dayStatus(med, today, ctx), 'pending')
assert.equal(dayStatus(med, '2026-11-19', ctx), 'future')
assert.equal(dayStatus(med, '2026-11-01', ctx), 'none')
let s = streak(med, ctx)
assert.deepEqual([s.current, s.best], [5, 8], 'série : 13→17 = 5 jours ; record 2→11 = 8 jours (jokers ne cassent pas)')
// une pause sur le 12 sauve la série
ctx = makeContext({ logs: [...days1, ...days2, ...days3].map((d) => log('med', d)), pauses: [{ habit_id: null, start_date: '2026-11-12', end_date: '2026-11-12' }], today })
assert.equal(dayStatus(med, '2026-11-12', ctx), 'paused')
assert.equal(streak(med, ctx).current, 13, 'jours faits du 2 au 17, jokers et pause sans casser')
// cochée aujourd'hui : la série augmente
ctx = makeContext({ logs: [...days1, ...days2, ...days3, today].map((d) => log('med', d)), today })
assert.equal(streak(med, ctx).current, 6)
// taux : 2–17 nov. = 16 jours comptés (pending exclu), 13 faits
let r = rate(med, '2026-11-02', today, makeContext({ logs: [...days1, ...days2, ...days3].map((d) => log('med', d)), today }))
assert.deepEqual(r, { done: 13, total: 16 })

/* ---------- Quantité et « à éviter » ---------- */
const eau = { id: 'eau', name: 'Eau', kind: 'quantity', target: 2, unit: 'L', frequency: 'daily', start_date: '2026-11-16' }
const snack = { id: 'snack', name: 'Pas de snack', kind: 'avoid', frequency: 'daily', start_date: '2026-11-16' }
ctx = makeContext({ logs: [log('eau', '2026-11-16', 2.5), log('eau', '2026-11-17', 1.5), log('snack', '2026-11-17', 1)], today })
assert.equal(dayStatus(eau, '2026-11-16', ctx), 'done')
assert.equal(dayStatus(eau, '2026-11-17', ctx), 'joker')
assert.equal(dayStatus(snack, '2026-11-16', ctx), 'done')
assert.equal(dayStatus(snack, '2026-11-17', ctx), 'joker', 'écart = raté (premier de la semaine : joker)')
assert.equal(dayStatus(snack, today, ctx), 'done', 'sans écart aujourd’hui : tenu')

/* ---------- X fois par semaine ---------- */
const lire = { id: 'lire', name: 'Lire', kind: 'check', frequency: 'weekly', times: 3, start_date: '2026-11-02' }
ctx = makeContext({
  logs: ['2026-11-02', '2026-11-04', '2026-11-06', '2026-11-10', '2026-11-16'].map((d) => log('lire', d)),
  today
})
assert.equal(periodStatus(lire, periodOf(lire, '2026-11-02'), ctx), 'done')
assert.equal(periodStatus(lire, periodOf(lire, '2026-11-10'), ctx), 'missed')
assert.equal(periodStatus(lire, periodOf(lire, today), ctx), 'pending')
s = streak(lire, ctx)
assert.deepEqual([s.current, s.best, s.unit], [0, 1, 'semaines'])
let item = todayItem(lire, today, ctx)
assert.equal(progressLabel(item), '1 / 3 cette semaine')
assert.deepEqual(rate(lire, '2026-11-02', today, ctx), { done: 1 + 1 / 3, total: 2 })

/* ---------- Tâche du mois ---------- */
const bilan = { id: 'bilan', name: 'Bilan budget', kind: 'check', frequency: 'monthly_task', day_of_month: 31, start_date: '2026-10-01' }
assert.equal(taskDay(bilan, '2026-11-05'), '2026-11-30', '31 → dernier jour de novembre')
const draps = { id: 'draps', name: 'Changer les draps', kind: 'check', frequency: 'monthly_task', day_of_month: 15, start_date: '2026-10-01' }
ctx = makeContext({ logs: [log('draps', '2026-10-20')], today })
assert.equal(isVisibleOn(draps, '2026-11-10', ctx), false)
assert.equal(isVisibleOn(draps, today, ctx), true)
assert.equal(periodStatus(draps, periodOf(draps, '2026-10-01'), ctx), 'done')
assert.equal(streak(draps, ctx).current, 1, 'octobre fait, novembre en cours')

/* ---------- Défi de 30 jours ---------- */
const defi = { id: 'defi', name: 'Sans sucre', kind: 'avoid', frequency: 'challenge', start_date: '2026-11-10', end_date: addDays('2026-11-10', 29) }
assert.deepEqual(challengeDay(defi, today), { n: 9, total: 30 })
assert.equal(isVisibleOn(defi, '2026-12-10', makeContext({ today: '2026-12-10' })), false, 'terminé après 30 jours')

/* ---------- Coches automatiques ---------- */
const auto = autoFromData({
  from: '2026-11-16',
  to: '2026-11-18',
  sessions: [
    { date: '2026-11-16', status: 'done' },
    { date: '2026-11-16', status: 'skipped' },
    { date: '2026-11-17', status: 'missed' },
    { date: '2026-11-18', status: 'planned' }
  ],
  foodLogs: [
    { date: '2026-11-16', kcal: 2600, protein: 115 },
    { date: '2026-11-17', kcal: 1500, protein: 60 }
  ],
  targets: { '2026-11-16': { kcal: 2765, protein: 110 }, '2026-11-17': { kcal: 2400, protein: 110 } },
  weights: [{ date: '2026-11-17', kg: 55 }]
})
assert.deepEqual(auto.sport_session, { '2026-11-16': true, '2026-11-17': false, '2026-11-18': false })
assert.deepEqual(auto.protein, { '2026-11-16': true, '2026-11-17': false, '2026-11-18': false })
assert.deepEqual(auto.kcal, { '2026-11-16': true, '2026-11-17': false, '2026-11-18': false })
assert.equal(auto.weigh_in['2026-11-17'], true)
const seance = { id: 'seance', name: 'Ma séance', kind: 'check', frequency: 'daily', auto: 'sport_session', start_date: '2026-11-16' }
ctx = makeContext({ auto, today })
assert.equal(dayStatus(seance, '2026-11-16', ctx), 'done')
assert.equal(dayStatus(seance, '2026-11-17', ctx), 'joker')
// coche manuelle possible même si l'auto dit non
ctx = makeContext({ auto, logs: [log('seance', '2026-11-17')], today })
assert.equal(dayStatus(seance, '2026-11-17', ctx), 'done')

/* ---------- Taux global et calendrier ---------- */
ctx = makeContext({ logs: [log('med', '2026-11-17'), log('eau', '2026-11-17', 2)], today })
const g = globalRate([{ ...med, start_date: '2026-11-17' }, { ...eau, start_date: '2026-11-17' }], '2026-11-17', today, ctx)
assert.deepEqual(g, { done: 2, total: 2, pct: 1 })
assert.deepEqual(dayScore([{ ...med, start_date: '2026-11-17' }, { ...eau, start_date: '2026-11-17' }], today, ctx), { done: 0, total: 2, score: 0 })

console.log('habitudes : OK')
