import assert from 'node:assert/strict'
import { weeksFor, ftpTimeline, rideEntries, weekly, strengthSeries, workoutTotals, records, regularity, compare, setTonnage } from '../src/modules/sport/stats.js'
import { niceTicks } from '../src/components/niceTicks.js'

const now = new Date(2026, 11, 3, 10) // jeudi 3 décembre 2026

// Périodes
let w = weeksFor('4w', now)
assert.deepEqual(w, ['2026-11-09', '2026-11-16', '2026-11-23', '2026-11-30'])
assert.equal(weeksFor('12w', now).length, 12)
assert.equal(weeksFor('all', now, '2026-11-05')[0], '2026-11-02')
assert.equal(weeksFor('all', now, '2026-11-25').length, 4, 'au moins 4 semaines')

// FTP
const ftp = ftpTimeline([{ date: '2026-11-20', ftp: 220 }, { date: '2026-11-02', ftp: 210 }], 999)
assert.equal(ftp.current, 220)
assert.equal(ftp.at('2026-11-10'), 210)
assert.equal(ftp.at('2026-11-20'), 220)
assert.equal(ftp.at('2026-10-01'), 210)
assert.equal(ftpTimeline([], 205).at('2026-11-10'), 205)

// Vélo : énergie réelle avec puissance, estimée sinon
const rides = rideEntries([
  { date: '2026-11-24', duration_min: 60, avg_power: 180, rpe: 6, template_key: 'sweet_spot' },
  { date: '2026-11-26', duration_min: 50, template_key: 'z2' },
  { date: '2026-11-27', duration_min: null }
], ftp.at)
assert.equal(rides.length, 2)
assert.equal(rides[0].kj, 648)
assert.ok(Math.abs(rides[0].intensity - 180 / 220) < 1e-9)
assert.ok(rides[1].estimated && rides[1].kj > 300 && rides[1].kj < 500, `kJ estimés : ${rides[1].kj}`)
const wk = weekly(w, rides, (r) => r.date, (r) => r.min / 60)
assert.deepEqual(wk.map((x) => Math.round(x.value * 100) / 100), [0, 0, 1.83, 0])

// Muscu
const workouts = [
  { id: 'a', started_at: '2026-11-17T17:00:00Z', finished_at: '2026-11-17T18:00:00Z' },
  { id: 'b', started_at: '2026-11-24T17:00:00Z', finished_at: '2026-11-24T18:00:00Z' },
  { id: 'c', started_at: '2026-11-26T17:00:00Z', finished_at: null }
]
const sets = [
  { workout_id: 'a', exercise_key: 'floor_press', set_index: 1, weight_kg: 10, reps: 10 },
  { workout_id: 'a', exercise_key: 'floor_press', set_index: 2, weight_kg: 10, reps: 8 },
  { workout_id: 'b', exercise_key: 'floor_press', set_index: 1, weight_kg: 11, reps: 10 },
  { workout_id: 'b', exercise_key: 'row_1arm', set_index: 1, weight_kg: 14, reps: 10 },
  { workout_id: 'b', exercise_key: 'pushups', set_index: 1, reps: 15 },
  { workout_id: 'b', exercise_key: 'pushups', set_index: 2, reps: 12 },
  { workout_id: 'c', exercise_key: 'floor_press', set_index: 1, weight_kg: 30, reps: 10 }
]
const series = strengthSeries(workouts, sets)
assert.deepEqual(series.floor_press.points.map((p) => p.value), [13.3, 14.7], 'Epley, séance non terminée ignorée')
assert.equal(series.floor_press.points[0].date, '2026-11-17')
assert.match(series.floor_press.points[1].detail, /10 × 11 kg/)
assert.equal(series.pushups.points[0].value, 27)
assert.equal(series.pushups.unit, 'rép.')
const recs = records(series)
assert.equal(recs[0].key, 'floor_press')
assert.ok(Math.abs(recs[0].gain - 1.4) < 1e-9)
assert.equal(setTonnage(sets[0]), 200, 'deux haltères')
assert.equal(setTonnage(sets[3]), 280, 'un bras, deux côtés')
assert.equal(setTonnage(sets[4]), 0, 'poids du corps')
const totals = workoutTotals(workouts, sets)
assert.deepEqual(totals.map((t) => [t.date, t.sets, t.tonnage]), [['2026-11-17', 2, 360], ['2026-11-24', 4, 500]])

// Régularité : les séances futures non faites ne comptent pas encore
const reg = regularity(['2026-11-30'], [
  { week_start: '2026-11-30', date: '2026-11-30', status: 'done' },
  { week_start: '2026-11-30', date: '2026-12-01', status: 'missed' },
  { week_start: '2026-11-30', date: '2026-12-02', status: 'skipped' },
  { week_start: '2026-11-30', date: '2026-12-05', status: 'planned' },
  { week_start: '2026-11-30', date: '2026-12-06', status: 'unplaced' }
], '2026-12-03')
assert.deepEqual(reg, [{ week: '2026-11-30', planned: 2, done: 1 }])

// Comparaison avec la période d'avant
const c = compare(rides, ['2026-11-23', '2026-11-30'], (r) => r.date, (r) => r.min)
assert.deepEqual(c, { now: 110, before: 0 })

// Graduations
assert.deepEqual(niceTicks(0, 7, 3), [0, 2.5, 5, 7.5])
assert.deepEqual(niceTicks(0, 1830, 3), [0, 1000, 2000])
console.log('progrès : OK')
