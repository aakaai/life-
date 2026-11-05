// Calculs de l'écran « Progrès » : tout part du journal (séances muscu, séries,
// sorties vélo, séances prévues, pesées, tests FTP). Fonctions pures, testées.
import { EXERCISES, RIDES, rideBlocks, rideKj, blocksDuration } from './data.js'
import { historyByExercise, score } from './progression.js'
import { mondayOf, keyOf, parseDay } from './planner.js'

export const RANGES = [
  { key: '4w', label: '4 sem.', weeks: 4 },
  { key: '12w', label: '12 sem.', weeks: 12 },
  { key: '26w', label: '6 mois', weeks: 26 },
  { key: 'all', label: 'Tout', weeks: null }
]

const dayOf = (v) => (v ? (v.length > 10 ? keyOf(new Date(v)) : v) : null)
const addWeeks = (key, n) => {
  const d = parseDay(key)
  d.setDate(d.getDate() + 7 * n)
  return keyOf(d)
}

// Lundis de la période affichée, du plus ancien au plus récent.
export function weeksFor(rangeKey, now = new Date(), firstDate = null) {
  const last = mondayOf(now)
  const r = RANGES.find((x) => x.key === rangeKey) || RANGES[1]
  let first = r.weeks ? addWeeks(last, -(r.weeks - 1)) : mondayOf(parseDay(firstDate || keyOf(now)))
  if (!r.weeks && addWeeks(first, 3) > last) first = addWeeks(last, -3) // au moins 4 semaines
  const out = []
  for (let w = first; w <= last; w = addWeeks(w, 1)) out.push(w)
  return out
}

/* ---------- FTP ---------- */
// Historique des tests (le plus ancien d'abord). Sans historique : la FTP des réglages.
export function ftpTimeline(history = [], currentFtp = 210) {
  const rows = [...history].filter((h) => h.ftp).sort((a, b) => (a.date < b.date ? -1 : 1))
  const at = (date) => {
    let v = rows.length ? Number(rows[0].ftp) : Number(currentFtp)
    for (const r of rows) if (r.date <= date) v = Number(r.ftp)
    return v
  }
  return { rows, at, current: rows.length ? Number(rows[rows.length - 1].ftp) : Number(currentFtp) }
}

/* ---------- Vélo ---------- */
// Une ligne par sortie : durée, puissance, énergie (kJ), intensité.
// Sans capteur de puissance, l'énergie est estimée à partir de la séance prévue.
export function rideEntries(rides = [], ftpAt = () => 210) {
  return rides
    .filter((r) => r.date && r.duration_min)
    .map((r) => {
      const min = Number(r.duration_min)
      const power = r.avg_power ? Number(r.avg_power) : null
      const ftp = ftpAt(r.date)
      let kj = power ? Math.round((power * min * 60) / 1000) : null
      let estimated = false
      if (!kj && r.template_key && RIDES[r.template_key]) {
        try {
          const blocks = rideBlocks(r.template_key, 0, min)
          kj = Math.round((rideKj(blocks, ftp) * min) / Math.max(1, blocksDuration(blocks)))
          estimated = true
        } catch {
          kj = null
        }
      }
      return {
        date: r.date,
        min,
        power,
        kj,
        estimated,
        rpe: r.rpe ? Number(r.rpe) : null,
        intensity: power && ftp ? power / ftp : null,
        name: RIDES[r.template_key]?.name || 'Sortie'
      }
    })
    .sort((a, b) => (a.date < b.date ? -1 : 1))
}

// Somme par semaine d'une valeur tirée de chaque ligne.
export function weekly(weeks, rows, dateOf, valueOf) {
  const sums = Object.fromEntries(weeks.map((w) => [w, 0]))
  for (const r of rows) {
    const w = mondayOf(parseDay(dateOf(r)))
    if (w in sums) sums[w] += valueOf(r) || 0
  }
  return weeks.map((w) => ({ week: w, value: sums[w] }))
}

/* ---------- Muscu ---------- */
// Pour chaque exercice : une valeur par séance (le plus ancien d'abord).
// Haltères : 1RM estimé (Epley) ; poids du corps : répétitions totales ; gainage : meilleur temps.
export function strengthSeries(workouts = [], sets = []) {
  const hist = historyByExercise(workouts, sets)
  const out = {}
  for (const [key, entries] of Object.entries(hist)) {
    const ex = EXERCISES[key]
    if (!ex) continue
    out[key] = {
      key,
      name: ex.name,
      load: ex.load,
      unit: ex.load === 'time' ? 's' : ex.load === 'bw' ? 'rép.' : 'kg',
      metric: ex.load === 'time' ? 'Meilleur temps' : ex.load === 'bw' ? 'Répétitions totales' : '1RM estimé',
      points: [...entries]
        .reverse()
        .map((e) => ({ date: dayOf(e.date), value: Math.round(score(e.sets, ex) * 10) / 10, detail: bestSet(e.sets, ex) }))
        .filter((p) => p.value > 0)
    }
  }
  return out
}

function bestSet(sets, ex) {
  if (ex.load === 'time') return `${sets.length} × ${Math.max(...sets.map((s) => s.seconds || 0))} s max`
  if (ex.load === 'bw') return `${sets.length} séries : ${sets.map((s) => s.reps || 0).join(' · ')}`
  const best = [...sets].sort((a, b) => b.weight_kg * (1 + b.reps / 30) - a.weight_kg * (1 + a.reps / 30))[0]
  return best ? `Meilleure série : ${best.reps} × ${String(best.weight_kg).replace('.', ',')} kg` : ''
}

// Charge totale déplacée (kg × répétitions, les deux haltères, les deux côtés).
export function setTonnage(s) {
  const ex = EXERCISES[s.exercise_key]
  if (!ex || !s.weight_kg || !s.reps || ex.load === 'bw' || ex.load === 'time') return 0
  return Number(s.weight_kg) * Number(s.reps) * (ex.load === 'two' ? 2 : 1) * (ex.unilateral ? 2 : 1)
}

// Séries et charge totale par séance terminée.
export function workoutTotals(workouts = [], sets = []) {
  const map = new Map(workouts.filter((w) => w.finished_at).map((w) => [w.id, { date: dayOf(w.started_at), sets: 0, tonnage: 0 }]))
  for (const s of sets) {
    const t = map.get(s.workout_id)
    if (!t) continue
    t.sets += 1
    t.tonnage += setTonnage(s)
  }
  return [...map.values()]
}

const ORDER = Object.keys(EXERCISES)

// Records : meilleure valeur de chaque exercice et progression depuis la première séance.
export function records(series) {
  return Object.values(series)
    .filter((s) => s.points.length)
    .map((s) => {
      const best = s.points.reduce((a, b) => (b.value >= a.value ? b : a))
      const first = s.points[0]
      return { key: s.key, name: s.name, unit: s.unit, best, gain: best.value - first.value, sessions: s.points.length }
    })
    .sort((a, b) => b.sessions - a.sessions || ORDER.indexOf(a.key) - ORDER.indexOf(b.key))
}

/* ---------- Régularité ---------- */
// Séances prévues et faites par semaine (les séances sautées ou pas casées ne comptent pas).
export function regularity(weeks, sessions = [], today = keyOf(new Date())) {
  return weeks.map((w) => {
    const list = sessions.filter((s) => s.week_start === w && !['skipped', 'unplaced'].includes(s.status) && !['etirements', 'mobilite'].includes(s.kind))
    const due = list.filter((s) => s.date <= today || s.status === 'done')
    return { week: w, planned: due.length, done: due.filter((s) => s.status === 'done').length }
  })
}

// Valeur sur la période et sur la période précédente de même longueur.
export function compare(rows, weeks, dateOf, valueOf) {
  const n = weeks.length
  const first = weeks[0]
  const prevFirst = addWeeks(first, -n)
  let now = 0
  let before = 0
  for (const r of rows) {
    const w = mondayOf(parseDay(dateOf(r)))
    if (w >= first) now += valueOf(r) || 0
    else if (w >= prevFirst) before += valueOf(r) || 0
  }
  return { now, before }
}
