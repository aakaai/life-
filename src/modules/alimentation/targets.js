// Cible du jour et ajustement selon le poids. Fonctions pures, testées dans tests/alimentation.test.mjs.
import { RIDES, rideBlocks, rideKj } from '../sport/data.js'
import { weekInfo, parseDay, keyOf } from '../sport/planner.js'
import { DEFAULT_SETTINGS } from './data.js'

export const bmr = ({ weight, height_cm, age, sex }) =>
  10 * weight + 6.25 * height_cm - 5 * age + (sex === 'f' ? -161 : 5)

const COUNTED = ['planned', 'done']

// Énergie dépensée par une séance (kcal). Vélo : 1 kJ ≈ 1 kcal.
export function sessionKcal(session, { ftp = 210, rideLog = null } = {}) {
  if (session.kind === 'muscu') return session.variant === 'normal' || session.variant === 'allegee' ? 200 : 100
  if (rideLog?.avg_power && rideLog?.duration_min) {
    return { kcal: Math.round((rideLog.avg_power * rideLog.duration_min * 60) / 1000), real: true }
  }
  if (!RIDES[session.template_key]) return 0
  const blocks = rideBlocks(session.template_key, weekInfo(session.week_start).inPhase, session.duration_min)
  return rideKj(blocks, ftp)
}

/**
 * Cible du jour.
 * @param sessions séances sport de la journée (planifiées ou faites)
 * @param rideLogs { [session_id]: ride_log }
 */
export function dayTarget({ settings = DEFAULT_SETTINGS, weight, sessions = [], rideLogs = {}, ftp = 210, adjust = 0 }) {
  const s = { ...DEFAULT_SETTINGS, ...settings }
  const w = weight || Number(s.start_weight_kg)
  const base = Math.round(bmr({ weight: w, height_cm: Number(s.height_cm), age: Number(s.age), sex: s.sex }) * Number(s.activity))
  const training = sessions
    .filter((x) => COUNTED.includes(x.status))
    .map((x) => {
      const v = sessionKcal(x, { ftp, rideLog: rideLogs[x.id] })
      const kcal = typeof v === 'object' ? v.kcal : v
      return { label: x.label, kind: x.kind, kcal, real: typeof v === 'object' }
    })
  const trainingKcal = training.reduce((t, x) => t + x.kcal, 0)
  const kcal = base + Number(s.surplus_kcal) + trainingKcal + adjust
  const protein = Number(s.protein_g)
  const fat = Math.round((kcal * Number(s.fat_pct)) / 100 / 9)
  const carbs = Math.max(0, Math.round((kcal - protein * 4 - fat * 9) / 4))
  return { kcal, protein, carbs, fat, base, surplus: Number(s.surplus_kcal), training, adjust, weight: w }
}

/* ---------- Poids ---------- */

const shift = (key, n) => {
  const d = parseDay(key)
  d.setDate(d.getDate() + n)
  return keyOf(d)
}

// Moyenne des pesées des 7 jours qui finissent à `key`.
export function avg7(weights, key) {
  const from = shift(key, -6)
  const list = weights.filter((w) => w.date >= from && w.date <= key).map((w) => Number(w.kg))
  if (!list.length) return { avg: null, count: 0 }
  return { avg: Math.round((list.reduce((a, b) => a + b, 0) / list.length) * 100) / 100, count: list.length }
}

export function currentWeight(weights, today, fallback) {
  const a = avg7(weights, today)
  if (a.avg) return a.avg
  const last = [...weights].filter((w) => w.date <= today).sort((x, y) => (x.date < y.date ? 1 : -1))[0]
  return last ? Number(last.kg) : fallback
}

/**
 * Toutes les 2 semaines : compare la moyenne 7 jours à celle d'il y a 2 semaines.
 * Les 2 premières semaines de pesée ne comptent pas (eau stockée avec les glucides).
 * @returns null (rien à faire) ou { date, delta, note }
 */
export function checkAdjustment(weights, adjustments, today) {
  if (!weights.length) return null
  const first = [...weights].sort((a, b) => (a.date < b.date ? -1 : 1))[0].date
  const last = [...adjustments].sort((a, b) => (a.date < b.date ? 1 : -1))[0]
  if (last && today < shift(last.date, 14)) return null
  if (!last && today < shift(first, 28)) return null
  const now = avg7(weights, today)
  const before = avg7(weights, shift(today, -14))
  if (now.count < 3 || before.count < 3) return null
  const perWeek = Math.round(((now.avg - before.avg) / 2) * 100) / 100
  const sign = perWeek > 0 ? '+' : ''
  const fmt = (v) => v.toLocaleString('fr-BE', { maximumFractionDigits: 2 })
  const facts = `Moyenne ${fmt(before.avg)} → ${fmt(now.avg)} kg en 2 semaines (${sign}${fmt(perWeek)} kg/sem).`
  if (perWeek < 0.1) return { date: today, delta: 150, note: `${facts} Moins de 0,1 kg par semaine : +150 kcal par jour.` }
  if (perWeek > 0.3) return { date: today, delta: -150, note: `${facts} Plus de 0,3 kg par semaine : −150 kcal par jour.` }
  return { date: today, delta: 0, note: `${facts} Dans la cible (0,1 à 0,3 kg/sem) : on ne change rien.` }
}

export const totalAdjust = (adjustments) => adjustments.reduce((t, a) => t + (Number(a.delta) || 0), 0)

/* ---------- Conseils autour de l'entraînement ---------- */

export function fuelingTips({ today = [], tomorrow = [] }) {
  const tips = []
  const ok = (s) => s.kind === 'velo' && COUNTED.includes(s.status) && s.status !== 'done'
  const long = tomorrow.find((s) => ok(s) && (s.duration_min || 0) >= 120)
  if (long) {
    const g = Math.round(((long.duration_min / 60) * 55) / 10) * 10
    tips.push({
      title: `Demain : ${long.label}`,
      text: `Prépare environ ${g} g de glucides à emporter (par exemple 2 bidons avec 30 g de sucre chacun, 2 bananes et 2 barres de céréales). Commence à 30 g par heure.`
    })
  }
  const ride = today.find((s) => ok(s) && (s.duration_min || 0) >= 75)
  if (ride) {
    tips.push({
      title: `Aujourd’hui : ${ride.label}`,
      text: `Repas riche en glucides 2 à 3 h avant, puis 30 à 60 g de glucides par heure pendant la sortie. Après : un vrai repas avec glucides et protéines.`
    })
  }
  return tips
}
