// Accès aux données du module Sport (via la couche commune `store`).
import { store, currentUserId } from '../../lib/store'
import { supabase, isCloud } from '../../lib/supabase'
import { DEFAULT_SETTINGS } from './data'
import { planWeek, slotOf, keyOf, parseDay } from './planner'
import { historyByExercise } from './progression'
import { expandEvents, plannerEvents } from '../agenda/logic'

export const SPORT_TABLES = [
  'sport_settings', 'calendar_sources', 'calendar_events',
  'planned_sessions', 'workout_logs', 'set_logs', 'ride_logs', 'ftp_tests'
]

/* ---------- Réglages ---------- */

export async function loadSettings() {
  const id = await currentUserId()
  const row = (await store.get('sport_settings', id)) || {}
  return {
    ...DEFAULT_SETTINGS,
    ...Object.fromEntries(Object.entries(row).filter(([, v]) => v != null)),
    id
  }
}

export async function saveSettings(patch) {
  const id = await currentUserId()
  const current = (await store.get('sport_settings', id)) || { id }
  const saved = await store.upsert('sport_settings', { ...current, ...patch, id })
  // Nouvelle FTP : on la garde dans l'historique (graphique « Progrès »).
  const before = Number(current.ftp ?? DEFAULT_SETTINGS.ftp)
  if (patch.ftp && Number(patch.ftp) !== before) {
    const today = keyOf(new Date())
    const since = current.updated_at ? keyOf(new Date(current.updated_at)) : null
    const { rows, missing } = await listFtpTests()
    if (!missing && !rows.length && since && since < today) {
      await store.insert('ftp_tests', { date: since, ftp: before, note: 'FTP de départ' }).catch(() => {})
    }
    await addFtpTest({ date: keyOf(new Date()), ftp: Number(patch.ftp), note: 'Modifiée dans les réglages' }, { syncSettings: false }).catch(() => {})
  }
  return saved
}

/* ---------- Progrès ---------- */

export async function listFtpTests() {
  try {
    return { rows: await store.list('ftp_tests', { orderBy: 'date' }), missing: false }
  } catch {
    return { rows: [], missing: true } // table pas encore créée (008_progres_ftp.sql)
  }
}

// Ajoute (ou remplace, même jour) un test FTP. Le plus récent devient la FTP des réglages.
export async function addFtpTest({ date, ftp, note = null }, { syncSettings = true } = {}) {
  const same = (await store.list('ftp_tests', { where: { date } }))[0]
  const row = same ? await store.update('ftp_tests', same.id, { ftp, note }) : await store.insert('ftp_tests', { date, ftp, note })
  if (syncSettings) {
    const all = await store.list('ftp_tests', { orderBy: 'date' })
    const latest = all[all.length - 1]
    if (latest?.id === row.id) {
      const id = await currentUserId()
      const current = (await store.get('sport_settings', id)) || { id }
      await store.upsert('sport_settings', { ...current, ftp, id })
    }
  }
  return row
}

export const removeFtpTest = (id) => store.remove('ftp_tests', id)

export async function loadProgress() {
  const [settings, workouts, sets, rides, sessions, weights, ftp] = await Promise.all([
    loadSettings(),
    store.list('workout_logs', { orderBy: 'started_at' }),
    store.list('set_logs'),
    store.list('ride_logs', { orderBy: 'date' }),
    store.list('planned_sessions', { orderBy: 'date' }),
    store.list('weights', { orderBy: 'date' }).catch(() => []),
    listFtpTests()
  ])
  return { settings, workouts, sets, rides, sessions, weights, ftp }
}

/* ---------- Agendas ---------- */

export const listSources = () => store.list('calendar_sources', { orderBy: 'created_at' })
export const addSource = (name, url, kind = 'perso') => store.insert('calendar_sources', { name, url: url.trim(), kind })
export const setSourceKind = (id, kind) => store.update('calendar_sources', id, { kind })
export async function removeSource(id) {
  await store.removeWhere('calendar_events', { where: { source_id: id } })
  await store.remove('calendar_sources', id)
}

// Demande à Supabase de relire les agendas (au plus une fois toutes les 10 minutes).
export async function syncCalendars({ force = false } = {}) {
  if (!isCloud) return { skipped: 'local' }
  const sources = await listSources()
  if (!sources.length) return { skipped: 'none' }
  const settings = await loadSettings()
  const last = settings.last_sync_at ? new Date(settings.last_sync_at) : null
  if (!force && last && Date.now() - last < 10 * 60 * 1000) return { skipped: 'recent' }
  const { data, error } = await supabase.functions.invoke('calendar-sync', { body: {} })
  if (error) throw new Error(await explainFunctionError(error))
  return data
}

// Traduit l'erreur renvoyée par Supabase en message compréhensible.
async function explainFunctionError(error) {
  const status = error.context?.status
  let detail = ''
  try {
    const body = await error.context.clone().json()
    detail = body.error || body.message || body.msg || ''
  } catch {
    try {
      detail = (await error.context.text()).slice(0, 200)
    } catch {
      /* pas de détail */
    }
  }
  if (error.name === 'FunctionsFetchError' || !status) {
    return 'Impossible de joindre la fonction calendar-sync (nom exact « calendar-sync » ? bien déployée ?).'
  }
  if (status === 404) return 'Fonction calendar-sync introuvable : vérifie qu’elle porte exactement ce nom.'
  if (status === 401) {
    return `Supabase refuse l’appel (401${detail ? ` : ${detail}` : ''}). Désactive « Verify JWT » dans les réglages de la fonction calendar-sync.`
  }
  return `calendar-sync a répondu ${status}${detail ? ` : ${detail}` : ''}`
}

export async function eventsForWeek(weekStart) {
  const start = parseDay(weekStart)
  const end = new Date(start)
  end.setDate(end.getDate() + 7)
  const endKey = keyOf(end)
  const all = await store.list('calendar_events')
  const linked = all.filter((e) =>
    e.all_day
      ? e.day_start < endKey && e.day_end > weekStart
      : new Date(e.start_at) < end && new Date(e.end_at) > start
  )
  // évènements ajoutés dans l'agenda de l'accueil (« Bloque le sport »)
  const own = await store.list('agenda_events').catch(() => [])
  return [...linked, ...plannerEvents(expandEvents(own, weekStart, endKey))]
}

/* ---------- Semaine ---------- */

const FIELDS = ['date', 'start_time', 'duration_min', 'label', 'variant', 'status', 'note', 'kind']
const locks = new Map()

// Crée ou met à jour la semaine : même entrée = même résultat, donc on ne
// touche la base que si quelque chose a vraiment changé.
export function ensureWeek(weekStart, now = new Date()) {
  if (!locks.has(weekStart)) {
    locks.set(weekStart, doEnsureWeek(weekStart, now).finally(() => locks.delete(weekStart)))
  }
  return locks.get(weekStart)
}

async function doEnsureWeek(weekStart, now) {
  const previous = await store.list('planned_sessions', { where: { week_start: weekStart } })
  const end = parseDay(weekStart)
  end.setDate(end.getDate() + 7)
  const settings = await loadSettings()
  const events = await eventsForWeek(weekStart)

  // les semaines passées ne bougent plus
  if (end <= now && previous.length) return { sessions: sortSessions(previous), settings }

  const { info, sessions } = planWeek({ weekStart, settings, events, previous, now })
  const fixed = new Set(previous.filter((p) => p.status === 'done' || p.status === 'skipped').map(slotOf))
  const bySlot = new Map(previous.filter((p) => !fixed.has(slotOf(p))).map((p) => [slotOf(p), p]))

  const inserts = []
  for (const [i, s] of sessions.entries()) {
    const row = { ...s, sort: i, week_start: weekStart }
    delete row.slot
    if (!row.pinned) delete row.pinned
    const existing = bySlot.get(s.slot)
    if (existing) {
      bySlot.delete(s.slot)
      // « pinned » n'existe qu'après 012_sport_deplacer.sql : on ne l'écrit que si la colonne est là
      const fields = 'pinned' in existing ? [...FIELDS, 'pinned'] : FIELDS
      const changed = fields.some((f) => (existing[f] ?? (f === 'pinned' ? false : null)) !== (row[f] ?? (f === 'pinned' ? false : null)))
      if (changed) await store.update('planned_sessions', existing.id, pick(row, fields))
    } else inserts.push(row)
  }
  if (inserts.length) await store.insertMany('planned_sessions', inserts)
  // anciennes séances qui ne font plus partie du plan (changement de phase, etc.)
  for (const left of bySlot.values()) {
    const keep = left.date === keyOf(now) && left.status === 'planned'
    if (!keep) await store.remove('planned_sessions', left.id)
  }

  const fresh = await store.list('planned_sessions', { where: { week_start: weekStart } })
  return { sessions: sortSessions(fresh), settings, info }
}

const pick = (row, fields = FIELDS) =>
  Object.fromEntries(fields.map((f) => [f, f === 'pinned' ? !!row.pinned : row[f] ?? null]))

function sortSessions(list) {
  return [...list].sort((a, b) =>
    (a.date + (a.start_time || '99')).localeCompare(b.date + (b.start_time || '99'))
  )
}

export const getSession = (id) => store.get('planned_sessions', id)

/**
 * Déplacer une séance à la main (calendrier de l'accueil) : elle reste là où tu la mets,
 * le reste de la semaine se réorganise autour. Seulement dans sa semaine.
 */
export async function moveSession(session, date, startTime) {
  const end = parseDay(session.week_start)
  end.setDate(end.getDate() + 7)
  if (date < session.week_start || date >= keyOf(end)) throw new Error('Une séance reste dans sa semaine (du lundi au dimanche).')
  await locks.get(session.week_start)?.catch(() => {}) // attendre une mise à jour de la semaine déjà en cours
  try {
    await store.update('planned_sessions', session.id, { date, start_time: startTime, status: 'planned', pinned: true })
  } catch (e) {
    if (/pinned/i.test(e.message)) throw new Error('Lance d’abord 012_sport_deplacer.sql dans Supabase pour pouvoir déplacer les séances.')
    throw e
  }
  return ensureWeek(session.week_start)
}

// Rendre la séance au planning automatique.
export async function unpinSession(session) {
  await store.update('planned_sessions', session.id, { pinned: false })
  return ensureWeek(session.week_start)
}
export const setSessionStatus = (id, status) => store.update('planned_sessions', id, { status })

/* ---------- Musculation ---------- */

// Séance en cours ou terminée liée à cette séance prévue (sans rien créer).
export async function findWorkout(sessionId) {
  const list = await store.list('workout_logs', { where: { session_id: sessionId }, orderBy: 'started_at', ascending: false })
  const open = list.find((w) => !w.finished_at) || null
  const finished = list.find((w) => w.finished_at) || null
  const target = open || finished
  const sets = target ? await store.list('set_logs', { where: { workout_id: target.id } }) : []
  return { open, finished, sets }
}

export async function openWorkout(session) {
  const existing = await store.list('workout_logs', { where: { session_id: session.id } })
  const open = existing.find((w) => !w.finished_at)
  const workout =
    open ||
    (await store.insert('workout_logs', {
      session_id: session.id,
      template_key: session.template_key,
      variant: session.variant,
      started_at: new Date().toISOString()
    }))
  const sets = await store.list('set_logs', { where: { workout_id: workout.id } })
  return { workout, sets }
}

export const saveSet = (row) => store.insert('set_logs', row)
export const updateSet = (id, patch) => store.update('set_logs', id, patch)
export const deleteSet = (id) => store.remove('set_logs', id)

export async function finishWorkout(workout, session) {
  const now = new Date()
  await store.update('workout_logs', workout.id, { finished_at: now.toISOString() })
  const start = new Date(workout.started_at)
  await store.update('planned_sessions', session.id, {
    status: 'done',
    date: keyOf(start),
    start_time: `${String(start.getHours()).padStart(2, '0')}:${String(start.getMinutes()).padStart(2, '0')}`,
    duration_min: Math.max(1, Math.round((now - start) / 60000))
  })
}

// Historique de toutes les séances terminées, par exercice.
export async function exerciseHistory({ excludeWorkout } = {}) {
  const workouts = (await store.list('workout_logs')).filter((w) => w.id !== excludeWorkout)
  const sets = await store.list('set_logs')
  return historyByExercise(workouts, sets)
}

/* ---------- Vélo ---------- */

export async function logRide(session, { duration_min, avg_power, rpe, note }) {
  await store.insert('ride_logs', {
    session_id: session.id,
    template_key: session.template_key,
    date: keyOf(new Date()),
    duration_min: duration_min ? Number(duration_min) : null,
    avg_power: avg_power ? Number(avg_power) : null,
    rpe: rpe ? Number(rpe) : null,
    note: note || null
  })
  await store.update('planned_sessions', session.id, { status: 'done', date: keyOf(new Date()) })
}

export const rideLogFor = async (sessionId) =>
  (await store.list('ride_logs', { where: { session_id: sessionId } }))[0] || null

/* ---------- Aujourd'hui (tuile de l'accueil) ---------- */

export async function todaySessions(now = new Date()) {
  const monday = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7))
  const { sessions } = await ensureWeek(keyOf(monday), now)
  return sessions.filter((s) => s.date === keyOf(now) && s.status !== 'unplaced')
}
