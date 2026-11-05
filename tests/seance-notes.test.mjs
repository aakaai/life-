import assert from 'node:assert/strict'
import { lastNotes, pendingChecks, applyCheck, plateText, suggest } from '../src/modules/sport/progression.js'
import { DEFAULT_SETTINGS } from '../src/modules/sport/data.js'

const S = DEFAULT_SETTINGS
// disques à monter
assert.equal(plateText(9, 'floor_press', S), 'Par haltère : poignée 2 kg + 7 disques de 1 kg (4 + 3)')
assert.equal(plateText(13, 'row_1arm', S), '1 haltère : poignée 2 kg + 11 disques de 1 kg (6 + 5)')
assert.equal(plateText(2, 'curl', S), 'Par haltère : poignée seule (2 kg)')
assert.equal(plateText(null, 'curl', S), null)
assert.equal(plateText(10, 'pushups', S), null)

// dernière note par exercice (séances terminées seulement)
const workouts = [
  { id: 'w1', started_at: '2026-10-27T18:00:00Z', finished_at: '2026-10-27T19:00:00Z' },
  { id: 'w2', started_at: '2026-11-02T18:00:00Z', finished_at: '2026-11-02T19:00:00Z' },
  { id: 'w3', started_at: '2026-11-05T18:00:00Z', finished_at: null }
]
const notes = [
  { id: 'n1', workout_id: 'w1', exercise_key: 'shoulder_press', pain: false, note: 'ok' },
  { id: 'n2', workout_id: 'w2', exercise_key: 'shoulder_press', pain: true, area: 'Épaule', note: 'pincement' },
  { id: 'n3', workout_id: 'w3', exercise_key: 'curl', pain: true, note: 'en cours' }
]
const last = lastNotes(notes, workouts)
assert.equal(last.shoulder_press.id, 'n2')
assert.equal(last.curl, undefined, 'séance pas finie : ignorée')

// contrôle au début de la séance
const items = [{ ex: 'floor_press', sets: 3, reps: [8, 12], rest: 150 }, { ex: 'shoulder_press', sets: 3, reps: [8, 12], rest: 120 }]
assert.deepEqual(pendingChecks(items, last, []).map((p) => p.ex), ['shoulder_press'])
assert.deepEqual(pendingChecks(items, last, [{ exercise_key: 'shoulder_press', choice: 'ok' }]), [])

const it = items[1]
const s = suggest(it, [{ date: 'x', sets: [{ weight_kg: 7, reps: 9, rir: 2 }, { weight_kg: 7, reps: 9, rir: 2 }, { weight_kg: 6, reps: 10, rir: 2 }] }], S)
assert.equal(s.weight, 7)
assert.equal(applyCheck(s, 'ok', it, S), s)
const low = applyCheck(s, 'lower', it, S)
assert.deepEqual([low.weight, low.targets], [6, [8, 8, 8]])
assert.match(low.message, /6 kg/)
assert.equal(applyCheck(s, 'skip', it, S).skipped, true)
// jamais sous la poignée
assert.equal(applyCheck({ ...s, weight: 2 }, 'lower', it, S).weight, 2)
// poids du corps / gainage
assert.deepEqual(applyCheck({ targets: [12, 12] }, 'lower', { ex: 'pushups', reps: [5, 30] }, S).targets, [10, 10])
assert.deepEqual(applyCheck({ targets: [40, 40] }, 'lower', { ex: 'plank', reps: [30, 60] }, S).targets, [30, 30])
console.log('notes de séance : OK')
