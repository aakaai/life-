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

// ---------- v0.30 : page unique, projets, rappels ----------
{
  const { pageSections, projectProgress, sortProjects, reminderAt, reminderValid, taskReminders, reminderChoices } = await import('../src/modules/taches/logic.js')
  const s = pageSections([...tasks, T({ title: 'Plus tard', planned_date: '2026-11-20' }), T({ title: 'Demain', planned_date: '2026-11-04' })], today)
  assert.deepEqual(s.today.map((t) => t.title), ['Résumé ch. 2', 'Exercices problème 4', 'Dispos job', 'Appeler la banque', 'Lessive'])
  assert.equal(s.late, 1); assert.equal(s.dueToday, 3)
  assert.deepEqual(s.soon.map((g) => g.date), ['2026-11-04'])
  assert.deepEqual(s.later.map((t) => t.title), ['Plus tard', 'Courses Noël'])
  assert.deepEqual(s.nodate.map((t) => t.title), ['Idée TFE', 'Réserver vols'])
  assert.deepEqual(s.done.map((t) => t.title), ['Lessive'])

  const p = { id: 'p1', name: 'Voyage' }
  const pt = [T({ title: 'a', project_id: 'p1', done: true }), T({ title: 'b', project_id: 'p1' }), T({ title: 'c' })]
  assert.deepEqual(projectProgress(p, pt), { done: 1, total: 2, open: 1, ratio: 0.5 })
  assert.deepEqual(sortProjects([{ id: 1, done: true }, { id: 2 }, { id: 3, due_date: '2027-01-20' }]).map((x) => x.id), [3, 2, 1])

  const at = (t) => { const d = reminderAt(t); return d && `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()} ${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}` }
  assert.equal(at({ planned_date: '2026-11-06', time: '14:00', reminder: '15' }), '2026-11-6 13:45')
  assert.equal(at({ planned_date: '2026-11-06', time: '14:00', reminder: '60' }), '2026-11-6 13:00')
  assert.equal(at({ planned_date: '2026-11-06', time: '14:00', reminder: 'at' }), '2026-11-6 14:00')
  assert.equal(at({ planned_date: '2026-11-06', reminder: 'eve' }), '2026-11-5 20:00')
  assert.equal(at({ planned_date: '2026-12-01', reminder: 'eve' }), '2026-11-30 20:00')
  assert.equal(at({ due_date: '2026-11-08', reminder: 'morning' }), '2026-11-8 9:00')
  assert.equal(reminderValid({ planned_date: '2026-11-06', reminder: '15' }), false) // pas d'heure
  assert.equal(reminderValid({ reminder: 'eve' }), false) // pas de date
  assert.deepEqual(reminderChoices({ time: '14:00' }), ['at', '15', '60', 'eve'])
  assert.deepEqual(reminderChoices({}), ['morning', 'eve'])
  const now = new Date(2026, 10, 6, 12, 0)
  const items = taskReminders([
    { id: 'x', title: 'Appeler le proprio', planned_date: '2026-11-06', time: '14:00', reminder: '15' },
    { id: 'y', title: 'Vols', planned_date: '2026-11-07', reminder: 'eve' },
    { id: 'z', title: 'Passé', planned_date: '2026-11-06', time: '10:00', reminder: 'at' },
    { id: 'w', title: 'Faite', planned_date: '2026-11-07', reminder: 'eve', done: true },
    { id: 'v', title: 'Loin', planned_date: '2026-12-20', reminder: 'eve' }
  ], now)
  assert.deepEqual(items.map((i) => [i.id, i.habitId, i.at, i.body]), [
    ['task.x', 'task:x', '2026-11-06T13:45', 'Dans 15 min · 14:00'],
    ['task.y', 'task:y', '2026-11-06T20:00', 'Demain']
  ])
}
console.log('tâches v0.30 : ok')
