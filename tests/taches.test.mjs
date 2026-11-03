import assert from 'node:assert/strict'
import { taskState, sortTasks, tabsOf, tasksForToday, taskMeta, taskBusyEvents, isDueLate } from '../src/modules/taches/logic.js'

const today = '2026-11-03'
const T = (o) => ({ id: o.title, priority: 2, done: false, created_at: '2026-11-01', ...o })
const tasks = [
  T({ title: 'Résumé ch. 2', planned_date: '2026-11-02', due_date: '2026-11-02', priority: 3 }), // en retard
  T({ title: 'Exercices problème 4', planned_date: today, time: '16:30', duration_min: 60, due_date: '2026-11-05', priority: 3 }),
  T({ title: 'Appeler la banque', planned_date: today, priority: 1 }),
  T({ title: 'Dispos job', planned_date: today, priority: 2, due_date: '2026-11-04' }),
  T({ title: 'Courses Noël', planned_date: '2026-12-10' }),
  T({ title: 'Idée TFE', priority: 3 }),
  T({ title: 'Réserver vols', due_date: '2026-11-15' }),
  T({ title: 'Lessive', planned_date: today, done: true, done_at: '2026-11-03T09:00:00' })
]

assert.equal(taskState(tasks[0], today), 'overdue')
assert.equal(taskState(tasks[4], today), 'upcoming')
assert.equal(taskState(tasks[5], today), 'nodate')
assert.ok(isDueLate(tasks[0], today))
assert.ok(!isDueLate(tasks[1], today))

const tabs = tabsOf(tasks, today)
assert.deepEqual(tabs.today.map((t) => t.title), ['Résumé ch. 2', 'Exercices problème 4', 'Dispos job', 'Appeler la banque'])
assert.deepEqual(tabs.upcoming.map((t) => t.title), ['Courses Noël'])
assert.deepEqual(tabs.nodate.map((t) => t.title), ['Idée TFE', 'Réserver vols'])
assert.deepEqual(tabs.done.map((t) => t.title), ['Lessive'])

assert.deepEqual(tasksForToday(tasks, today).map((t) => t.title), ['Résumé ch. 2', 'Exercices problème 4', 'Dispos job', 'Lessive', 'Appeler la banque'])
assert.equal(taskMeta(tasks[1], today), '16:30 · 1 h · limite jeu 5 nov')
assert.equal(taskMeta(tasks[3], today), 'limite demain')
assert.equal(taskMeta(tasks[0], today, { withDay: true }), 'prévue hier · limite hier')

const busy = taskBusyEvents([{ ...tasks[1], busy: true }, tasks[2]], '2026-11-02', '2026-11-09')
assert.equal(busy.length, 1)
assert.equal(new Date(busy[0].start_at).getHours(), 16)
assert.equal((new Date(busy[0].end_at) - new Date(busy[0].start_at)) / 60000, 60)
assert.equal(sortTasks([], today).length, 0)
console.log('tâches : OK')
