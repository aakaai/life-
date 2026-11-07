import assert from 'node:assert/strict'
import { kotSunday, splitKot, kotReminders } from '../src/modules/accueil/kot-logic.js'

// semaine du lundi 9 au dimanche 15 novembre 2026
assert.equal(kotSunday(new Date(2026, 10, 11, 9)), '2026-11-15', 'mercredi → dimanche qui vient')
assert.equal(kotSunday(new Date(2026, 10, 14, 23, 50)), '2026-11-15', 'samedi soir → le lendemain')
assert.equal(kotSunday(new Date(2026, 10, 15, 18)), '2026-11-15', 'dimanche → aujourd’hui')
assert.equal(kotSunday(new Date(2026, 10, 16, 0, 10)), '2026-11-22', 'lundi → dimanche suivant')
assert.equal(kotSunday(new Date(2026, 11, 30)), '2027-01-03', 'passage d’année')

const items = [
  { id: 'a', title: 'Pull', sunday: '2026-11-15', created_at: '2026-11-11T10:00:00Z' },
  { id: 'b', title: 'Calculatrice', sunday: '2026-11-15', done: true, created_at: '2026-11-10T10:00:00Z' },
  { id: 'c', title: 'Vieux', sunday: '2026-11-08', created_at: '2026-11-05T10:00:00Z' }
]
const s = splitKot(items, new Date(2026, 10, 12))
assert.deepEqual(s.current.map((x) => x.id), ['b', 'a'], 'ordre d’ajout')
assert.deepEqual(s.stale.map((x) => x.id), ['c'], 'le dimanche passé est périmé')
const monday = splitKot(items, new Date(2026, 10, 16, 8))
assert.equal(monday.current.length, 0, 'lundi : liste vide')
assert.equal(monday.stale.length, 3, 'lundi : tout est effacé, même non coché')

// rappel : dimanche 12:00, s'il reste quelque chose
let r = kotReminders(items, new Date(2026, 10, 12, 20))
assert.equal(r.length, 1)
assert.equal(r[0].at, '2026-11-15T12:00:00')
assert.equal(r[0].category, 'agenda')
assert.match(r[0].body, /^1 chose à prendre/)
assert.equal(kotReminders(items, new Date(2026, 10, 15, 12, 30)).length, 0, 'midi passé : plus de rappel')
assert.equal(kotReminders([{ ...items[0], done: true }, items[1]], new Date(2026, 10, 12)).length, 0, 'tout coché : pas de rappel')
assert.equal(kotReminders([], new Date(2026, 10, 12)).length, 0, 'liste vide : pas de rappel')
r = kotReminders([...items, { id: 'd', title: 'Ordi', sunday: '2026-11-15' }], new Date(2026, 10, 15, 9))
assert.match(r[0].body, /^2 choses/)

console.log('kot : ok')
