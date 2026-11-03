import assert from 'node:assert/strict'
import {
  expandEvents, occursOn, planEdit, planDelete, movedFields, layoutDay, layoutLanes, defaultBusy,
  plannerEvents, agendaReminders, addDays, keyOf, whenLabel
} from '../src/modules/agenda/logic.js'
import { dayContexts } from '../src/modules/sport/planner.js'
import { DEFAULT_SETTINGS } from '../src/modules/sport/data.js'

const iso = (y, m, d, h, mi = 0) => new Date(y, m - 1, d, h, mi).toISOString()

// ---------- Évènement simple ----------
const resto = { id: 'r', title: 'Resto', all_day: false, start_at: iso(2026, 11, 5, 19), end_at: iso(2026, 11, 5, 21), busy: true }
let occ = expandEvents([resto], '2026-11-02', '2026-11-09')
assert.equal(occ.length, 1)
assert.equal(occ[0].date, '2026-11-05')
assert.equal(expandEvents([resto], '2026-11-06', '2026-11-09').length, 0)

// ---------- Répétitions ----------
// job chaque samedi depuis le 7 nov., jusqu'au 28 nov., sauf le 21
const job = {
  id: 'j', title: 'Job', all_day: false, start_at: iso(2026, 11, 7, 9), end_at: iso(2026, 11, 7, 17),
  repeat: 'weekly', repeat_until: '2026-11-28', exdates: ['2026-11-21'], busy: true
}
occ = expandEvents([job], '2026-11-01', '2026-12-31')
assert.deepEqual(occ.map((o) => o.date), ['2026-11-07', '2026-11-14', '2026-11-28'])
assert.equal(occ[1].start.getHours(), 9)
assert.equal(occ[1].end.getHours(), 17)

// lundi et mercredi, toutes les 2 semaines
const bi = { id: 'b', title: 'Bi', all_day: false, start_at: iso(2026, 11, 2, 18), end_at: iso(2026, 11, 2, 19), repeat: 'biweekly', repeat_days: [0, 2] }
assert.deepEqual(expandEvents([bi], '2026-11-01', '2026-12-01').map((o) => o.date), ['2026-11-02', '2026-11-04', '2026-11-16', '2026-11-18', '2026-11-30'])

// chaque mois le 31 : pas de 30 novembre
const m31 = { id: 'm', title: 'Loyer', all_day: true, day_start: '2026-10-31', day_end: '2026-11-01', repeat: 'monthly' }
assert.deepEqual(expandEvents([m31], '2026-10-01', '2027-01-01').map((o) => o.date), ['2026-10-31', '2026-12-31'])
// chaque année
const anniv = { id: 'a', title: 'Anniv', all_day: true, day_start: '2026-03-14', day_end: '2026-03-15', repeat: 'yearly' }
assert.ok(occursOn(anniv, '2027-03-14'))
assert.ok(!occursOn(anniv, '2027-03-15'))

// heure d'été : 9 h reste 9 h après le changement d'heure (29 mars 2027)
const daily = { id: 'd', title: 'Sport', all_day: false, start_at: iso(2027, 3, 27, 9), end_at: iso(2027, 3, 27, 10), repeat: 'daily' }
const dst = expandEvents([daily], '2027-03-27', '2027-03-31')
assert.deepEqual(dst.map((o) => o.start.getHours()), [9, 9, 9, 9])

// évènement de plusieurs jours entiers qui commence avant la période
const trip = { id: 't', title: 'Voyage Thaïlande', all_day: true, day_start: '2027-01-23', day_end: '2027-02-08', busy: false }
occ = expandEvents([trip], '2027-02-01', '2027-02-08')
assert.equal(occ.length, 1)
assert.equal(occ[0].dayEnd, '2027-02-08')

// évènement de nuit (à cheval sur deux jours) : visible les deux jours
const night = { id: 'n', title: 'Soirée', all_day: false, start_at: iso(2026, 11, 6, 22), end_at: iso(2026, 11, 7, 2) }
assert.equal(expandEvents([night], '2026-11-07', '2026-11-08').length, 1)
assert.equal(expandEvents([night], '2026-11-07', '2026-11-08')[0].dayEnd, '2026-11-07')

// ---------- Modifier une occurrence ----------
const job14 = expandEvents([job], '2026-11-14', '2026-11-15')[0]
let ops = planEdit(job, job14.date, { title: 'Job (long)' }, 'one')
assert.equal(ops.length, 2)
assert.deepEqual(ops[0].patch.exdates, ['2026-11-21', '2026-11-14'])
assert.equal(ops[1].row.repeat, null)
assert.equal(ops[1].row.title, 'Job (long)')

ops = planEdit(job, '2026-11-14', { ...movedFields(job, job14, { date: '2026-11-14', startMin: 10 * 60, endMin: 18 * 60 }) }, 'following')
assert.equal(ops[0].patch.repeat_until, '2026-11-13')
assert.equal(new Date(ops[1].row.start_at).getHours(), 10)
assert.equal(ops[1].row.repeat, 'weekly')
assert.deepEqual(ops[1].row.exdates, ['2026-11-21'])
// la première occurrence : on modifie la série elle-même
ops = planEdit(job, '2026-11-07', { title: 'Job' }, 'following')
assert.equal(ops.length, 1)
assert.equal(ops[0].op, 'update')

// déplacer une série « chaque semaine le lundi » au mardi : les jours suivent
const lundi = { id: 'l', title: 'Cours de guitare', all_day: false, start_at: iso(2026, 11, 2, 18), end_at: iso(2026, 11, 2, 19), repeat: 'weekly', repeat_days: [0] }
const o9 = expandEvents([lundi], '2026-11-09', '2026-11-10')[0]
assert.deepEqual(movedFields(lundi, o9, { date: '2026-11-10', startMin: 18 * 60, endMin: 19 * 60 }).repeat_days, [1])

// supprimer
assert.deepEqual(planDelete(resto, '2026-11-05'), [{ op: 'delete', id: 'r' }])
assert.equal(planDelete(job, '2026-11-14', 'following')[0].patch.repeat_until, '2026-11-13')
assert.equal(planDelete(job, '2026-11-07', 'following')[0].op, 'delete')
assert.deepEqual(planDelete(job, '2026-11-14', 'one')[0].patch.exdates, ['2026-11-21', '2026-11-14'])

// glisser une journée entière de 2 jours
const two = { id: 'w', title: 'Week-end', all_day: true, day_start: '2026-11-07', day_end: '2026-11-09' }
const ow = expandEvents([two], '2026-11-01', '2026-11-30')[0]
assert.deepEqual(movedFields(two, ow, { shiftDays: 7 }), { day_start: '2026-11-14', day_end: '2026-11-16', repeat_days: null })

// ---------- Grille ----------
const laid = layoutDay([{ id: 1, from: 540, to: 600 }, { id: 2, from: 570, to: 660 }, { id: 3, from: 600, to: 630 }, { id: 4, from: 700, to: 720 }])
const by = Object.fromEntries(laid.map((x) => [x.id, x]))
assert.equal(by[1].cols, 2)
assert.equal(by[2].col, 1)
assert.equal(by[3].col, 0) // reprend la colonne libérée par 1
assert.equal(by[4].cols, 1)
const lanes = layoutLanes([{ id: 'a', a: 0, b: 2 }, { id: 'b', a: 1, b: 1 }, { id: 'c', a: 3, b: 4 }])
assert.deepEqual(lanes.map((x) => [x.id, x.lane]), [['a', 0], ['b', 1], ['c', 0]])

// ---------- « Bloque le sport » ----------
const perso = { blocks_sport: true }
const deadline = { blocks_sport: false }
assert.equal(defaultBusy({ category: perso, title: 'Cinéma', allDay: false }), true)
assert.equal(defaultBusy({ category: deadline, title: 'Rendu TFE', allDay: false }), false)
assert.equal(defaultBusy({ category: deadline, title: 'Examen IA', allDay: false }), true)
assert.equal(defaultBusy({ category: perso, title: 'Anniversaire', allDay: true }), false)

// Le planificateur sport voit les évènements : créneau occupé, journée bloquée, voyage
const own = [
  { ...resto, busy: true },
  { id: 'x', title: 'Rendu', all_day: false, start_at: iso(2026, 11, 3, 10), end_at: iso(2026, 11, 3, 12), busy: false },
  { id: 'y', title: 'Déménagement', all_day: true, day_start: '2026-11-07', day_end: '2026-11-08', busy: true },
  { id: 'z', title: 'Voyage à Gand', all_day: true, day_start: '2026-11-08', day_end: '2026-11-09', busy: false }
]
const pe = plannerEvents(expandEvents(own, '2026-11-02', '2026-11-09'))
assert.equal(pe.length, 3) // « Rendu » ne bloque pas
const ctx = dayContexts('2026-11-02', pe, DEFAULT_SETTINGS.keywords)
assert.deepEqual(ctx[3].busy.map((b) => [b.from, b.to]), [[19 * 60, 21 * 60]]) // jeudi
assert.deepEqual(ctx[5].busy.map((b) => [b.from, b.to]), [[0, 1440]]) // samedi bloqué
assert.equal(ctx[6].travel, true) // dimanche : voyage (mot-clé)
assert.equal(ctx[1].busy.length, 0)

// ---------- Rappels ----------
const now = new Date(2026, 10, 3, 14, 0) // mardi 14 h
const rem = agendaReminders([
  { ...resto, reminder_min: 30, location: 'Gand' },
  { ...job, reminder_min: 1440 },
  { id: 'p', title: 'Passé', all_day: false, start_at: iso(2026, 11, 3, 14, 10), end_at: iso(2026, 11, 3, 15), reminder_min: 15 },
  { id: 'f', title: 'Fête', all_day: true, day_start: '2026-11-04', day_end: '2026-11-05', reminder_min: 240 },
  { id: 'q', title: 'Sans rappel', all_day: false, start_at: iso(2026, 11, 4, 9), end_at: iso(2026, 11, 4, 10) }
], now)
assert.deepEqual(rem.map((r) => [r.id, r.at]), [
  ['agenda.f.2026-11-04', '2026-11-03T20:00'],
  ['agenda.r.2026-11-05', '2026-11-05T18:30'],
  ['agenda.j.2026-11-07', '2026-11-06T09:00']
])
assert.equal(rem[0].body, 'Demain, journée entière')
assert.equal(rem[1].body, 'Dans 30 min · 19:00–21:00 · Gand')
assert.equal(rem[2].body, 'Demain à 09:00')
assert.ok(rem.every((r) => r.category === 'agenda' && r.habitId === 'agenda'))

assert.equal(whenLabel(expandEvents([resto], '2026-11-05', '2026-11-06')[0]), 'Jeudi 5 novembre · 19:00–21:00')
assert.equal(whenLabel(ow), 'Du samedi 7 novembre au dimanche 8 novembre')
assert.equal(addDays('2026-12-31', 1), '2027-01-01')
assert.equal(keyOf(new Date(2026, 0, 5)), '2026-01-05')

console.log('agenda : OK')
