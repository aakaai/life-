// Moteur de progression (double progression).
// 1. Tu restes à la même charge et tu ajoutes des répétitions.
// 2. Quand toutes les séries atteignent le haut de la fourchette en gardant
//    au moins 1 répétition en réserve (RIR ≥ 1), la charge monte d'un cran.
// 3. Deux séances sans progrès : alerte de stagnation.

import { EXERCISES, DEFAULT_SETTINGS } from './data.js'

// Charge maximale possible par haltère avec ton matériel.
export function maxLoad(exKey, settings = DEFAULT_SETTINGS) {
  const ex = EXERCISES[exKey]
  const handle = Number(settings.handle_kg ?? 2)
  const plates = Number(settings.plates_total_kg ?? 22)
  if (ex.load === 'one') return handle + plates
  return handle + Math.floor(plates / 2)
}

export const loadStep = (settings = DEFAULT_SETTINGS) => Number(settings.plate_step_kg ?? 1)

// Charge que tu peux réellement monter (poignée + disques de 1 kg).
function snap(kg, exKey, settings) {
  const step = loadStep(settings)
  const handle = Number(settings.handle_kg ?? 2)
  const v = handle + Math.round((kg - handle) / step) * step
  return Math.min(Math.max(v, handle), maxLoad(exKey, settings))
}

// Score d'une séance pour un exercice : meilleure série, estimation du max (formule d'Epley).
function score(sets, ex) {
  if (ex.load === 'time') return Math.max(0, ...sets.map((s) => s.seconds || 0))
  if (ex.load === 'bw') return sets.reduce((t, s) => t + (s.reps || 0), 0)
  return Math.max(0, ...sets.map((s) => (s.weight_kg || 0) * (1 + (s.reps || 0) / 30)))
}

/**
 * Propose la prochaine séance pour un exercice.
 * @param item     { ex, sets, reps: [min, max], rest }
 * @param history  séances passées pour cet exercice, la plus récente d'abord :
 *                 [{ date, sets: [{ weight_kg, reps, seconds, rir }] }]
 * @param options  { progress: false } pendant une semaine allégée
 * @returns { weight, targets: [reps ou secondes par série], unit, message, stagnation, last }
 */
export function suggest(item, history = [], settings = DEFAULT_SETTINGS, { progress = true } = {}) {
  const ex = EXERCISES[item.ex]
  const [lo, hi] = item.reps
  const last = history[0]
  const nSets = item.sets
  const fill = (v) => Array.from({ length: nSets }, (_, i) => (Array.isArray(v) ? v[i] ?? v[v.length - 1] : v))

  const out = { weight: null, targets: fill(lo), unit: ex.load === 'time' ? 's' : 'reps', message: null, stagnation: null, last }

  // --- Gainage : secondes ---
  if (ex.load === 'time') {
    if (!last) {
      out.targets = fill(lo)
      out.message = `Commence à ${lo} s.`
      return out
    }
    const best = Math.max(...last.sets.map((s) => s.seconds || 0))
    const t = progress ? Math.min(best + 5, hi) : best
    out.targets = fill(Math.max(t, lo))
    out.message = best >= hi ? `Tu tiens ${hi} s : garde ce temps, serre plus fort les fessiers.` : `+5 s par rapport à la dernière fois.`
    out.stagnation = stagnation(history, ex)
    return out
  }

  // --- Poids du corps : répétitions ---
  if (ex.load === 'bw') {
    if (!last) {
      out.targets = fill(lo)
      out.message = item.ex.startsWith('pushups')
        ? 'Fais le maximum moins 2 : arrête-toi quand il te reste 2 répétitions.'
        : `Vise ${lo}–${hi} répétitions.`
      return out
    }
    const reps = last.sets.map((s) => s.reps || 0)
    out.targets = fill(reps.map((r) => (progress ? Math.min(r + 1, hi) : r)))
    out.message = progress ? '+1 répétition par série par rapport à la dernière fois.' : 'Semaine allégée : mêmes répétitions.'
    out.stagnation = stagnation(history, ex)
    return out
  }

  // --- Haltères : double progression ---
  const top = maxLoad(item.ex, settings)
  if (!last) {
    out.weight = snap(ex.start ?? 2, item.ex, settings)
    out.targets = fill(lo)
    out.message = `Première fois : ${out.weight} kg pour tester. Note honnêtement les répétitions en réserve (RIR).`
    return out
  }

  const weight = Math.max(...last.sets.map((s) => s.weight_kg || 0))
  const atWeight = last.sets.filter((s) => (s.weight_kg || 0) === weight)
  const allTop = atWeight.length >= Math.min(nSets, last.sets.length) && atWeight.every((s) => (s.reps || 0) >= hi && (s.rir ?? 2) >= 1)
  const failed = last.sets.every((s) => (s.rir ?? 2) === 0)

  if (progress && allTop && weight < top) {
    out.weight = snap(weight + loadStep(settings), item.ex, settings)
    out.targets = fill(lo)
    out.message = `Bravo : toutes les séries à ${hi} reps. On monte à ${out.weight} kg, repars à ${lo} reps.`
  } else if (allTop && weight >= top) {
    out.weight = top
    out.targets = fill(hi)
    out.message = `Charge maximale atteinte (${top} kg). Descente lente en 3–4 s pour continuer à progresser.`
  } else {
    out.weight = weight
    const reps = last.sets.map((s) => s.reps || 0)
    out.targets = fill(reps.map((r) => (progress && !failed ? Math.min(Math.max(r + 1, lo), hi) : Math.max(r, lo))))
    out.message = !progress
      ? 'Semaine allégée : mêmes charges, moitié des séries.'
      : failed
        ? 'La dernière fois tu étais à l’échec : mêmes répétitions, garde 1–2 reps en réserve.'
        : '+1 répétition sur chaque série, même charge.'
  }
  out.stagnation = stagnation(history, ex)
  return out
}

// Stagnation : les deux dernières séances ne battent pas celle d'avant.
export function stagnation(history, ex) {
  if (history.length < 3) return null
  const [a, b, c] = history.map((h) => score(h.sets, ex))
  if (a <= c && b <= c) {
    return 'Pas de progrès depuis 2 séances. Vérifie ton sommeil et ce que tu manges ; si ça continue, fais une série de moins la semaine prochaine.'
  }
  return null
}

// Rassemble les séries enregistrées par exercice, séance la plus récente d'abord.
export function historyByExercise(workouts, sets) {
  const byWorkout = new Map(workouts.map((w) => [w.id, w]))
  const map = {}
  for (const s of sets) {
    const w = byWorkout.get(s.workout_id)
    if (!w || !w.finished_at) continue
    const ex = (map[s.exercise_key] ||= {})
    const entry = (ex[w.id] ||= { date: w.started_at, sets: [] })
    entry.sets.push(s)
  }
  const out = {}
  for (const [k, v] of Object.entries(map)) {
    out[k] = Object.values(v)
      .map((e) => ({ ...e, sets: e.sets.sort((x, y) => x.set_index - y.set_index) }))
      .sort((x, y) => (x.date < y.date ? 1 : -1))
  }
  return out
}
