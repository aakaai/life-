// Planificateur de la semaine sport.
// Entrées : la semaine type, tes disponibilités, les événements de tes agendas,
// les séances déjà faites. Sortie : la liste des séances de la semaine, avec
// une note qui explique chaque déplacement.
// Fonction pure (aucun accès réseau) : facile à tester, mêmes entrées = même semaine.

import {
  PHASES, SEASON_START, RIDES, WORKOUTS, weekTemplate, rideBlocks, blocksDuration, DEFAULT_SETTINGS
} from './data.js'

const DAYS = ['lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi', 'dimanche']
const BUFFER = 15 // minutes de marge autour des événements et entre séances
const STEP = 15
const LEGS_RIDE_GAP = 240 // 4 h entre une sortie vélo et la séance jambes le même jour

/* ---------- Petits outils ---------- */

export const parseDay = (key) => {
  const [y, m, d] = key.split('-').map(Number)
  return new Date(y, m - 1, d)
}
export const keyOf = (d) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
const plusDays = (key, n) => {
  const d = parseDay(key)
  d.setDate(d.getDate() + n)
  return keyOf(d)
}
const daysBetween = (a, b) => Math.round((parseDay(b) - parseDay(a)) / 86400000)
export const toMin = (hhmm) => {
  const [h, m] = hhmm.split(':').map(Number)
  return h * 60 + m
}
export const toHHMM = (min) => `${String(Math.floor(min / 60)).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}`
const norm = (s) => (s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()

export function mondayOf(date) {
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate())
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7))
  return keyOf(d)
}

/* ---------- Saison ---------- */

export function phaseOf(dayKey) {
  if (dayKey < PHASES[0].from) return PHASES[0]
  return PHASES.find((p) => dayKey >= p.from && dayKey <= p.to) || PHASES[PHASES.length - 1]
}

export function weekInfo(weekStart) {
  const phase = phaseOf(weekStart)
  const index = Math.floor(daysBetween(SEASON_START, weekStart) / 7)
  const isRecovery = index >= 0 && index % 4 === 3 && ['base1', 'base2', 'build'].includes(phase.key)
  // nombre de semaines « normales » déjà faites dans la phase : sert à faire progresser les séances vélo
  let inPhase = 0
  for (let w = phase.from < weekStart ? mondayOf(parseDay(phase.from)) : weekStart; w < weekStart; w = plusDays(w, 7)) {
    const i = Math.floor(daysBetween(SEASON_START, w) / 7)
    if (!(i % 4 === 3)) inPhase++
  }
  return { phase, index, isRecovery, inPhase }
}

/* ---------- Lecture des agendas ---------- */

function kindOfEvent(title, keywords) {
  const t = norm(title)
  for (const kind of ['escalade', 'examen', 'voyage']) {
    if ((keywords[kind] || []).some((w) => w && t.includes(norm(w)))) return kind
  }
  return null
}

// Résume chaque jour de la semaine : créneaux occupés, escalade, examen, voyage.
export function dayContexts(weekStart, events, keywords) {
  const days = Array.from({ length: 7 }, (_, i) => {
    const key = plusDays(weekStart, i)
    return { key, busy: [], climb: null, exam: false, travel: phaseOf(key).key === 'voyage' }
  })
  for (const ev of events) {
    const kind = kindOfEvent(ev.title, keywords)
    if (ev.all_day) {
      // jour entier : ne bloque pas d'heure, mais peut signaler examen / voyage / escalade
      for (const d of days) {
        if (d.key >= ev.day_start && d.key < ev.day_end) {
          if (kind === 'voyage') d.travel = true
          if (kind === 'examen') d.exam = true
          if (kind === 'escalade') d.climb = { end: 0, title: ev.title, allDay: true }
        }
      }
      continue
    }
    const start = new Date(ev.start_at)
    const end = new Date(ev.end_at)
    for (const d of days) {
      const dayStart = parseDay(d.key)
      const dayEnd = new Date(dayStart)
      dayEnd.setDate(dayEnd.getDate() + 1)
      if (end <= dayStart || start >= dayEnd) continue
      const from = Math.max(0, Math.round((start - dayStart) / 60000))
      const to = Math.min(1440, Math.round((end - dayStart) / 60000))
      d.busy.push({ from, to, title: ev.title })
      if (kind === 'voyage') d.travel = true
      if (kind === 'examen') d.exam = true
      if (kind === 'escalade') d.climb = { end: Math.max(d.climb?.end || 0, to), title: ev.title }
    }
  }
  for (const d of days) d.busy.sort((a, b) => a.from - b.from)
  return days
}

/* ---------- Séances à placer ---------- */

function describe(item) {
  if (item.kind === 'muscu') return WORKOUTS[item.key].name
  return RIDES[item.key].name
}

// La semaine type, ajustée à la phase et aux semaines allégées.
export function templateFor(weekStart) {
  const info = weekInfo(weekStart)
  let items = weekTemplate(info.phase.key).map((t) => ({
    ...t,
    preferred_date: plusDays(weekStart, t.day),
    slot: `${t.key}@${t.day}`
  }))
  if (info.isRecovery) {
    items = items
      .filter((t) => !t.optional)
      .map((t) => {
        if (t.kind !== 'velo') return t
        if (RIDES[t.key].hard) return { ...t, key: 'z2', minutes: 60, recovery: true }
        if (RIDES[t.key].long) return { ...t, minutes: 120, recovery: true }
        return { ...t, minutes: Math.min(t.minutes || 60, 60), recovery: true }
      })
  }
  if (info.phase.key === 'examens') items = items.filter((t) => !t.optional)
  return { info, items }
}

function rideFor(item, info) {
  const blocks = rideBlocks(item.key, info.inPhase, item.minutes)
  return { blocks, duration: blocksDuration(blocks) }
}

function muscuVariant(item, day, ctx, info) {
  if (day.travel) return 'poids_du_corps'
  if (day.exam) return 'express'
  if (item.key === 'haut_b') {
    const near = ctx.some((d, i) => d.climb && Math.abs(i - day.index) <= 2)
    if (near) return 'allegee'
  }
  if (info.isRecovery) return 'recup'
  return 'normal'
}

const MUSCU_DURATION = { normal: null, express: 25, recup: 30, allegee: 35, poids_du_corps: 30 }

/* ---------- Règles ---------- */

const nameOf = (p) => (p.kind === 'muscu' ? WORKOUTS[p.key].name.split(' —')[0] : RIDES[p.key].name)

const isHard = (p) => p.kind === 'velo' && RIDES[p.key]?.hard
const isLong = (p) => p.kind === 'velo' && RIDES[p.key]?.long
const isLegs = (p) => p.kind === 'muscu' && WORKOUTS[p.key]?.legs && p.variant !== 'poids_du_corps'
const isUpper = (p) => p.kind === 'muscu' && WORKOUTS[p.key]?.upper && p.variant !== 'poids_du_corps'

// Renvoie null si la séance peut aller ce jour-là, sinon la raison (en français).
function ruleBlock(item, dayIdx, ctx, placed) {
  const day = ctx[dayIdx]
  const on = (i) => placed.filter((p) => p.dayIdx === i)
  const probe = { kind: item.kind, key: item.key, variant: item.variant }

  if (item.kind === 'velo') {
    if (day.travel) return 'voyage, pas de home trainer'
    const ride = on(dayIdx).find((p) => p.kind === 'velo')
    if (ride) return `${nameOf(ride)} est déjà prévue ce jour-là`
    if (isHard(probe) || isLong(probe)) {
      if (day.exam) return 'examen ce jour-là'
    }
    if (isHard(probe)) {
      if (on(dayIdx - 1).some(isHard) || on(dayIdx + 1).some(isHard)) return 'pas deux séances intenses d’affilée'
      if (on(dayIdx - 1).some(isLegs)) return 'séance jambes la veille'
      if (on(dayIdx).some(isLegs)) return 'séance jambes le même jour'
    }
    return null
  }

  // musculation
  const muscu = on(dayIdx).find((p) => p.kind === 'muscu')
  if (muscu) return `${nameOf(muscu)} est déjà prévue ce jour-là`
  const variant = item.variant
  const legs = WORKOUTS[item.key].legs && variant !== 'poids_du_corps'
  const upper = WORKOUTS[item.key].upper && variant !== 'poids_du_corps'
  if (legs) {
    if (on(dayIdx + 1).some(isHard)) return 'séance intense à vélo le lendemain'
    if (on(dayIdx).some(isHard)) return 'séance intense à vélo le même jour'
  }
  if (upper) {
    if (ctx[dayIdx + 1]?.climb) return 'escalade le lendemain'
    if (day.climb?.allDay) return 'escalade ce jour-là'
    const other = item.key === 'haut_a' ? 'haut_b' : 'haut_a'
    if (placed.some((p) => p.key === other && Math.abs(p.dayIdx - dayIdx) < 2)) return 'Haut A et Haut B trop rapprochés'
  }
  return null
}

/* ---------- Recherche d'un créneau ---------- */

function findSlot(item, dayIdx, ctx, placed, availability, minStart) {
  const day = ctx[dayIdx]
  const windows = availability[dayIdx] || []
  const dur = item.duration
  const pref = toMin(item.time)
  let start0 = minStart
  // muscu du haut le jour de l'escalade : seulement après l'escalade
  if (item.kind === 'muscu' && WORKOUTS[item.key].upper && item.variant !== 'poids_du_corps' && day.climb) {
    start0 = Math.max(start0, day.climb.end + BUFFER)
  }

  const candidates = []
  for (const w of windows) {
    const a = toMin(w.from)
    const b = toMin(w.to)
    for (let s = Math.ceil(a / STEP) * STEP; s + dur <= b; s += STEP) candidates.push(s)
    if (pref >= a && pref + dur <= b && !candidates.includes(pref)) candidates.push(pref)
  }
  if (!candidates.length) return { reason: 'tu n’es pas disponible ce jour-là' }
  candidates.sort((x, y) => Math.abs(x - pref) - Math.abs(y - pref) || x - y)

  const sameDay = placed.filter((p) => p.dayIdx === dayIdx)
  let blocker = null
  let after = null
  for (const s of candidates) {
    if (s < start0) continue
    const e = s + dur
    const ev = day.busy.find((b) => s < b.to + BUFFER && e > b.from - BUFFER)
    if (ev) {
      if (!blocker) blocker = ev
      continue
    }
    const clash = sameDay.find((p) => {
      let gap = BUFFER
      const legsAndRide =
        (item.kind === 'velo' && isLegs(p)) ||
        (p.kind === 'velo' && item.kind === 'muscu' && WORKOUTS[item.key].legs && item.variant !== 'poids_du_corps')
      if (legsAndRide) {
        // le vélo d'abord, la séance jambes au moins 4 h après
        const ride = item.kind === 'velo' ? { s, e } : { s: p.start, e: p.end }
        const legs = item.kind === 'velo' ? { s: p.start, e: p.end } : { s, e }
        return legs.s < ride.e + LEGS_RIDE_GAP
      }
      return s < p.end + gap && e > p.start - gap
    })
    if (clash) {
      if (!after) after = clash
      continue
    }
    return { start: s, blocker, after }
  }
  if (blocker) return { reason: `« ${blocker.title} » (${toHHMM(blocker.from)}–${toHHMM(blocker.to)}) prend ton créneau`, blocker }
  if (start0 > minStart && day.climb) return { reason: 'escalade ce jour-là' }
  return { reason: 'plus de créneau libre ce jour-là' }
}

/* ---------- Planification ---------- */

/**
 * @param weekStart  'AAAA-MM-JJ' (un lundi)
 * @param settings   réglages sport (disponibilités, mots-clés…)
 * @param events     événements d'agenda qui touchent la semaine
 * @param previous   séances déjà enregistrées pour cette semaine
 * @param now        date et heure actuelles
 * @returns liste de séances { slot, template_key, kind, label, preferred_date, date, start_time,
 *          duration_min, variant, status, note }
 */
export function planWeek({ weekStart, settings = DEFAULT_SETTINGS, events = [], previous = [], now = new Date() }) {
  const availability = settings.availability || DEFAULT_SETTINGS.availability
  const keywords = settings.keywords || DEFAULT_SETTINGS.keywords
  const { info, items } = templateFor(weekStart)
  const ctx = dayContexts(weekStart, events, keywords).map((d, index) => ({ ...d, index }))
  const todayKey = keyOf(now)
  const nowMin = now.getHours() * 60 + now.getMinutes()
  const firstDay = Math.max(0, Math.min(7, daysBetween(weekStart, todayKey)))

  const bySlot = new Map(previous.map((p) => [slotOf(p), p]))
  const placed = []
  const out = []

  // 1. Ce qui ne bouge plus : séances faites ou que tu as décidé de sauter,
  //    et les séances d'aujourd'hui dont l'heure est déjà passée.
  const fixedSlots = new Set()
  for (const p of previous) {
    const started = p.date === todayKey && p.start_time && toMin(p.start_time) <= nowMin && p.status === 'planned'
    if (p.status === 'done' || p.status === 'skipped' || started) {
      fixedSlots.add(slotOf(p))
      const dayIdx = daysBetween(weekStart, p.date)
      const start = p.start_time ? toMin(p.start_time) : 0
      placed.push({ dayIdx, kind: p.kind, key: p.template_key, variant: p.variant, start, end: start + (p.duration_min || 0) })
    }
  }

  // 2. Le reste, du plus important au moins important.
  const todo = items.filter((it) => !fixedSlots.has(it.slot)).sort((a, b) => a.priority - b.priority)

  for (const it of todo) {
    const prefIdx = it.day
    const prev = bySlot.get(it.slot)
    const wasMissed = prev && prev.date < todayKey && prev.status !== 'done'
    const order = []
    for (let i = firstDay; i < 7; i++) order.push(i)
    order.sort((a, b) => Math.abs(a - prefIdx) - Math.abs(b - prefIdx) || b - a)

    let prefReason = null
    let result = null
    for (const d of order) {
      const day = ctx[d]
      const item = { ...it }
      if (it.kind === 'muscu') {
        item.variant = muscuVariant(it, day, ctx, info)
        item.duration = MUSCU_DURATION[item.variant] || WORKOUTS[it.key].duration
      } else {
        item.variant = it.recovery ? 'recup' : 'normal'
        item.duration = rideFor(it, info).duration
      }
      const rule = ruleBlock(item, d, ctx, placed)
      if (rule) {
        if (d === prefIdx) prefReason = rule
        continue
      }
      const minStart = d === firstDay && ctx[d].key === todayKey ? nowMin + BUFFER : 0
      const slot = findSlot(item, d, ctx, placed, availability, minStart)
      if (slot.start == null) {
        if (d === prefIdx) prefReason = slot.reason
        continue
      }
      result = { item, d, start: slot.start, blocker: slot.blocker, after: slot.after }
      break
    }

    const base = {
      slot: it.slot,
      template_key: it.key,
      kind: it.kind,
      label: labelFor(it, info),
      preferred_date: it.preferred_date
    }

    if (!result) {
      const why = prefReason || (prefIdx < firstDay ? 'jour déjà passé' : 'pas de place')
      out.push({
        ...base,
        date: wasMissed ? prev.date : it.preferred_date,
        start_time: wasMissed ? prev.start_time : it.time,
        duration_min: prev?.duration_min || 0,
        variant: 'normal',
        status: wasMissed ? 'missed' : 'unplaced',
        note: wasMissed
          ? 'Pas faite, et plus de place cette semaine pour la rattraper.'
          : it.optional
            ? `Optionnelle, pas casée cette semaine : ${why}.`
            : `Pas de place cette semaine : ${why}.`
      })
      continue
    }

    const { item, d, start } = result
    placed.push({ dayIdx: d, kind: item.kind, key: item.key, variant: item.variant, start, end: start + item.duration })

    const notes = []
    if (wasMissed) notes.push(`Reportée : pas faite ${DAYS[daysBetween(weekStart, prev.date)]}.`)
    else if (d !== prefIdx) {
      notes.push(`Déplacée de ${DAYS[prefIdx]} : ${prefIdx < firstDay ? 'semaine commencée plus tard' : prefReason || 'pas de place'}.`)
    } else if (start !== toMin(it.time)) {
      const why = result.blocker
        ? ` : « ${result.blocker.title} » (${toHHMM(result.blocker.from)}–${toHHMM(result.blocker.to)})`
        : result.after
          ? result.after.kind === 'velo' && item.kind === 'muscu' && WORKOUTS[item.key].legs
            ? ' : au moins 4 h après le vélo'
            : ` : après ${nameOf(result.after)}`
          : ' : selon tes disponibilités'
      notes.push(`Décalée à ${toHHMM(start)}${why}.`)
    }
    if (item.variant === 'allegee') notes.push('Allégée à cause de l’escalade : sans rowing, pull-over ni curl.')
    if (item.variant === 'express') notes.push('Version express : examen ce jour-là.')
    if (item.variant === 'poids_du_corps') notes.push('Voyage : séance au poids du corps.')

    out.push({
      ...base,
      date: ctx[d].key,
      start_time: toHHMM(start),
      duration_min: item.duration,
      variant: item.variant,
      status: 'planned',
      note: notes.join(' ') || null
    })
  }

  out.sort((a, b) => (a.date + (a.start_time || '')).localeCompare(b.date + (b.start_time || '')))
  return { info, sessions: out, fixedSlots: [...fixedSlots] }
}

export function slotOf(s) {
  return `${s.template_key}@${daysBetween(mondayOf(parseDay(s.preferred_date)), s.preferred_date)}`
}

function labelFor(it, info) {
  if (it.kind === 'muscu') return WORKOUTS[it.key].name
  const { blocks, duration } = rideFor(it, info)
  const main = blocks.find((b) => b.repeat)
  if (main && RIDES[it.key].hard) {
    if (it.key === 'vo2_3015') return `${RIDES[it.key].name} — 3 × 13`
    return `${RIDES[it.key].name} ${main.repeat} × ${main.work.min} min`
  }
  const h = Math.floor(duration / 60)
  const m = duration % 60
  const len = h ? `${h} h${m ? String(m).padStart(2, '0') : ''}` : `${m} min`
  return `${RIDES[it.key].name} ${len}`
}

export { describe }
