// Souplesse (v0.26) : routines, chrono, planning des étirements et de la mobilité, habitude automatique.
import assert from 'node:assert/strict'
import {
  ROUTINES, MOVES, routineSteps, routineSeconds, routineMinutes, moveDose, fmtMinSec, advance, nextMoveIndex, SOUPLESSE
} from '../src/modules/sport/souplesse.js'
import { planWeek, parseDay } from '../src/modules/sport/planner.js'
import { autoFromData, makeContext } from '../src/modules/habitudes/logic.js'
import { planReminders } from '../src/modules/habitudes/reminders.js'

/* ---------- Routines ---------- */
for (const [k, r] of Object.entries(ROUTINES)) {
  for (const mk of r.moves) assert.ok(MOVES[mk], `${k} : mouvement ${mk} inconnu`)
}
// mollets, tendon d'Achille et bas du dos dans les étirements du soir
const zones = ROUTINES.etirements.moves.map((m) => MOVES[m].zone)
assert.ok(zones.includes('Mollet') && zones.includes('Tendon d’Achille') && zones.filter((z) => z === 'Bas du dos').length === 2)
assert.ok(ROUTINES.mob_a.moves.includes('descente_marche'))
// environ 10 min le soir, environ 20 min de mobilité
assert.equal(routineMinutes('etirements'), 10)
assert.equal(routineMinutes('mob_a'), 20)
assert.equal(routineMinutes('mob_b'), 20)
assert.ok(routineSeconds('etirements') >= 540 && routineSeconds('etirements') <= 660)
assert.equal(fmtMinSec(605), '10 min 05')
assert.equal(fmtMinSec(1140), '19 min')
assert.equal(moveDose('mollet_plie'), '45 s par côté')
assert.equal(moveDose('genou_mur'), '45 s par côté × 2')
assert.equal(moveDose('ytw'), '45 s × 3')

// déroulé : mise en place, côté droit, changement, côté gauche…
const steps = routineSteps('etirements')
assert.deepEqual(steps.slice(0, 4).map((s) => [s.type, s.move, s.side]), [
  ['prep', 'mollet_tendu', 'droit'], ['work', 'mollet_tendu', 'droit'], ['switch', 'mollet_tendu', 'gauche'], ['work', 'mollet_tendu', 'gauche']
])
assert.equal(steps.filter((s) => s.type === 'work').length, 12)
const genou = routineSteps('mob_a').filter((s) => s.move === 'genou_mur')
assert.deepEqual(genou.map((s) => s.type), ['prep', 'work', 'switch', 'work', 'switch', 'work', 'switch', 'work'])

// chrono : rattrape le temps passé app fermée, s'arrête en pause, finit à la fin
const t0 = 1_000_000
let st = { idx: 0, endAt: t0 + 10_000, paused: false }
assert.equal(advance(st, steps, t0 + 5_000).idx, 0)
const a = advance(st, steps, t0 + 10_000 + 45_000 + 1)
assert.equal(a.idx, 2)
assert.equal(a.advanced, 2)
assert.equal(a.endAt, t0 + 10_000 + 45_000 + 5_000)
assert.equal(advance({ ...st, paused: true }, steps, t0 + 999_999).idx, 0)
assert.equal(advance(st, steps, t0 + 10_000_000).finished, true)
// « Passer ce mouvement » : au premier passage du mouvement suivant
assert.equal(steps[nextMoveIndex(steps, 1)].move, 'mollet_plie')
assert.equal(nextMoveIndex(steps, steps.length - 1), steps.length)

/* ---------- Planning ---------- */
const soft = (r) => r.sessions.filter((s) => s.kind === 'etirements' || s.kind === 'mobilite')
const dayIdx = (key) => (parseDay(key).getDay() + 6) % 7

// semaine complète vue du dimanche d'avant : 2 mobilités + étirements les autres soirs (dim → jeu)
let r = planWeek({ weekStart: '2026-11-09', now: new Date(2026, 10, 8, 12, 0) })
let mob = soft(r).filter((s) => s.kind === 'mobilite')
let str = soft(r).filter((s) => s.kind === 'etirements')
assert.equal(mob.length, 2)
assert.ok(mob.every((s) => s.status === 'planned' && SOUPLESSE.stretchDays.includes(dayIdx(s.date))))
assert.ok(Math.abs(dayIdx(mob[0].date) - dayIdx(mob[1].date)) >= 2, 'au moins 2 jours entre les mobilités')
assert.equal(str.length, 3, '5 soirs moins les 2 soirs de mobilité')
assert.ok(str.every((s) => s.start_time === '22:45' && s.duration_min === 10))
const softDays = new Set(soft(r).map((s) => s.date))
assert.equal(softDays.size, 5)
assert.ok(soft(r).every((s) => ![4, 5].includes(dayIdx(s.date))), 'jamais le vendredi ni le samedi')
// la mobilité tient dans tes disponibilités et ne chevauche pas une autre séance
for (const m of mob) {
  const others = r.sessions.filter((s) => s.date === m.date && s !== m && s.start_time)
  const [h, mi] = m.start_time.split(':').map(Number)
  const s0 = h * 60 + mi
  for (const o of others) {
    const [oh, om] = o.start_time.split(':').map(Number)
    const o0 = oh * 60 + om
    assert.ok(s0 >= o0 + o.duration_min || s0 + m.duration_min <= o0, `${m.label} chevauche ${o.label}`)
  }
}

// mercredi : les soirs passés ratés sont oubliés (pas reportés), le reste ne bouge pas sans raison
const prev = r.sessions.map((s, i) => ({ ...s, id: `p${i}`, week_start: '2026-11-09' }))
r = planWeek({ weekStart: '2026-11-09', previous: prev, now: new Date(2026, 10, 11, 9, 0) })
const missed = soft(r).filter((s) => s.date < '2026-11-11')
assert.ok(missed.length > 0 && missed.every((s) => s.status === 'missed' && /oubli/.test(s.note)))
assert.ok(soft(r).filter((s) => s.date >= '2026-11-11').every((s) => s.status === 'planned'))
assert.equal(soft(r).filter((s) => s.kind === 'mobilite').length, 2)

// première semaine (fonction ajoutée en cours de semaine) : pas d'étirements « ratés » inventés
r = planWeek({ weekStart: '2026-11-02', now: new Date(2026, 10, 5, 14, 22) })
assert.ok(soft(r).every((s) => s.date >= '2026-11-05' && s.status === 'planned'))
assert.equal(soft(r).filter((s) => s.kind === 'mobilite').length, 2)

// étirements faits : on ne les renvoie plus (gardés tels quels) ; mobilité sautée : les étirements reviennent
const base = planWeek({ weekStart: '2026-11-09', now: new Date(2026, 10, 8, 12, 0) }).sessions.map((s, i) => ({ ...s, id: `q${i}`, week_start: '2026-11-09' }))
const mobRow = base.find((s) => s.kind === 'mobilite')
const strRow = base.find((s) => s.kind === 'etirements')
const prev2 = base.map((s) => (s === mobRow ? { ...s, status: 'skipped' } : s === strRow ? { ...s, status: 'done' } : s))
r = planWeek({ weekStart: '2026-11-09', previous: prev2, now: new Date(2026, 10, 8, 12, 0) })
assert.ok(!r.sessions.some((s) => s.slot === `etirements@${dayIdx(strRow.date)}`))
assert.ok(r.sessions.some((s) => s.kind === 'etirements' && s.date === mobRow.date), 'mobilité sautée → étirements ce soir-là')
assert.ok(!r.sessions.some((s) => s.template_key === mobRow.template_key), 'la mobilité sautée n’est pas replacée')

// séance de mobilité d'aujourd'hui : elle reste aujourd'hui même si son heure est passée
const today = base.find((s) => s.kind === 'mobilite')
r = planWeek({ weekStart: '2026-11-09', previous: base, now: new Date(parseDay(today.date).getTime() + 23 * 3600000) })
assert.equal(r.sessions.find((s) => s.template_key === today.template_key).date, today.date)

/* ---------- Habitude automatique ---------- */
const sessions = [
  { date: '2026-11-09', kind: 'muscu', status: 'done' },
  { date: '2026-11-09', kind: 'etirements', status: 'planned' },
  { date: '2026-11-10', kind: 'mobilite', status: 'done' },
  { date: '2026-11-10', kind: 'velo', status: 'planned' }
]
const auto = autoFromData({ sessions, from: '2026-11-09', to: '2026-11-10' })
assert.equal(auto.sport_session['2026-11-09'], true, 'les étirements ne bloquent pas « séance du jour faite »')
assert.equal(auto.stretch['2026-11-09'], false)
assert.equal(auto.stretch['2026-11-10'], true, 'la mobilité coche « Étirements »')

// rappels : 22:45 du dimanche au jeudi seulement
const habit = { id: 'h', name: 'Étirements', kind: 'check', frequency: 'weekly', times: 5, start_date: '2026-11-01', reminder_time: '22:45', auto: 'stretch' }
const ctx = makeContext({ logs: [], pauses: [], auto: {}, today: '2026-11-09' })
const rem = planReminders([habit], ctx, new Date(2026, 10, 9, 12, 0))
assert.deepEqual(rem.map((x) => dayIdx(x.date)), [0, 1, 2, 3, 6])
assert.ok(rem.every((x) => x.at.endsWith('T22:45')))

console.log('souplesse : ok')
