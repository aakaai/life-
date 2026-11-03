// Données de l'agenda de l'accueil : tes évènements + agendas reliés + cours + séances sport.
import { store } from '../../lib/store'
import { ensureWeek, listSources } from '../sport/api'
import { parseCourse } from '../ecole/parse'
import { DEFAULT_CATEGORIES, expandEvents, addDays, parseKey, keyOf, mondayOf, atMinutes, fromHHMM } from './logic'

export const AGENDA_TABLES = ['agenda_categories', 'agenda_events']

export const missingTable = (e) => /relation|does not exist|schema cache|agenda_/i.test(e?.message || '')

/* ---------- Catégories ---------- */

let seeding = null

export async function loadCategories() {
  const cats = await store.list('agenda_categories', { orderBy: 'sort' })
  if (cats.length) return cats
  // premier lancement : les catégories proposées (une seule fois, même si deux écrans demandent en même temps)
  seeding = seeding || store.insertMany('agenda_categories', DEFAULT_CATEGORIES.map((c, i) => ({ ...c, sort: i })))
  try {
    await seeding
  } finally {
    seeding = null
  }
  return store.list('agenda_categories', { orderBy: 'sort' })
}

export const saveCategory = (c) =>
  c.id ? store.update('agenda_categories', c.id, { name: c.name, color: c.color, blocks_sport: c.blocks_sport, sort: c.sort }) : store.insert('agenda_categories', c)
export const removeCategory = (id) => store.remove('agenda_categories', id)

/* ---------- Évènements ---------- */

export const listEvents = () => store.list('agenda_events')

export async function runOps(ops) {
  for (const o of ops) {
    if (o.op === 'insert') await store.insert('agenda_events', o.row)
    else if (o.op === 'update') await store.update('agenda_events', o.id, o.patch)
    else if (o.op === 'delete') await store.remove('agenda_events', o.id)
  }
}

/* ---------- Tout ce qu'affiche le calendrier, sur [from, to[ ---------- */

const SPORT_AHEAD_WEEKS = 12

async function sportSessions(from, to) {
  const thisMonday = mondayOf(keyOf(new Date()))
  const out = []
  const weeks = []
  for (let w = mondayOf(from); w < to; w = addDays(w, 7)) weeks.push(w)
  await Promise.all(
    weeks.map(async (w) => {
      try {
        let list
        if (w < thisMonday) list = await store.list('planned_sessions', { where: { week_start: w } })
        else if (w <= addDays(thisMonday, 7 * SPORT_AHEAD_WEEKS)) list = (await ensureWeek(w)).sessions
        else list = []
        out.push(...list)
      } catch {
        /* module sport pas encore configuré */
      }
    })
  )
  return out.filter((s) => s.status !== 'unplaced' && s.start_time && s.date >= from && s.date < to)
}

async function linkedEvents(from, to) {
  try {
    const sources = await listSources()
    if (!sources.length) return { sources, timed: [], allDay: [] }
    const fromIso = parseKey(addDays(from, -1)).toISOString()
    const toIso = parseKey(addDays(to, 1)).toISOString()
    const [timed, allDay] = await Promise.all([
      store.list('calendar_events', { gte: { end_at: fromIso }, lte: { start_at: toIso } }),
      store.list('calendar_events', { where: { all_day: true } })
    ])
    return {
      sources,
      timed: timed.filter((e) => !e.all_day && e.start_at),
      allDay: allDay.filter((e) => e.day_start && e.day_start < to && (e.day_end || addDays(e.day_start, 1)) > from)
    }
  } catch {
    return { sources: [], timed: [], allDay: [] }
  }
}

/**
 * Éléments du calendrier, tous au même format :
 * { id, kind: 'agenda' | 'google' | 'cours' | 'sport' | 'off', title, color, allDay, start, end, dayStart, dayEnd,
 *   editable, filter, occ?, raw? }
 * dayEnd est exclu pour les journées entières, inclus pour les évènements à heure.
 */
export async function loadRange(from, to) {
  const result = { items: [], categories: [], sources: [], courses: [], needsSql: false }

  // tes évènements
  try {
    const [categories, events] = await Promise.all([loadCategories(), listEvents()])
    result.categories = categories
    const byId = new Map(categories.map((c) => [c.id, c]))
    for (const o of expandEvents(events, from, to)) {
      const cat = byId.get(o.event.category_id)
      result.items.push({
        id: o.key, kind: 'agenda', title: o.event.title || 'Sans titre', color: `var(--${cat?.color || 'gray'})`,
        allDay: o.allDay, start: o.start, end: o.end, dayStart: o.dayStart, dayEnd: o.dayEnd,
        editable: true, resizable: true, filter: `cat:${cat?.id || 'none'}`, occ: o, category: cat || null,
        meta: o.event.location || ''
      })
    }
  } catch (e) {
    if (missingTable(e)) result.needsSql = true
    else throw e
  }

  // agendas reliés (Google perso) et horaire de cours
  const linked = await linkedEvents(from, to)
  result.sources = linked.sources
  const school = new Set(linked.sources.filter((s) => s.kind === 'ecole').map((s) => s.id))
  const sourceName = new Map(linked.sources.map((s) => [s.id, s.name]))
  const allCourses = []
  for (const e of linked.timed) {
    const start = new Date(e.start_at)
    const end = new Date(e.end_at || e.start_at)
    if (school.has(e.source_id)) {
      const c = parseCourse(e)
      if (c.holiday) continue
      allCourses.push(c)
      result.items.push({
        id: `c:${e.id}`, kind: 'cours', title: c.name, color: 'var(--purple)', allDay: false, start, end,
        dayStart: keyOf(start), dayEnd: keyOf(new Date(end.getTime() - 1)), editable: false, filter: 'cours',
        meta: c.room || '', course: c
      })
    } else {
      result.items.push({
        id: `g:${e.id}`, kind: 'google', title: e.title || 'Occupé', color: 'var(--green)', allDay: false, start, end,
        dayStart: keyOf(start), dayEnd: keyOf(new Date(Math.max(end.getTime() - 1, start.getTime()))), editable: false, filter: 'google',
        meta: e.location || '', raw: e, source: sourceName.get(e.source_id)
      })
    }
  }
  result.courses = allCourses
  for (const e of linked.allDay) {
    const dayEnd = e.day_end || addDays(e.day_start, 1)
    const off = school.has(e.source_id) || /^(vacances|f[ée]ri[ée]|cong[ée])/i.test(e.title || '')
    if (school.has(e.source_id) && !off) continue
    result.items.push({
      id: `a:${e.id}`, kind: off && school.has(e.source_id) ? 'off' : 'google', title: e.title || 'Journée',
      color: off && school.has(e.source_id) ? 'var(--yellow)' : 'var(--green)', allDay: true, start: null, end: null,
      dayStart: e.day_start, dayEnd, editable: false, filter: off && school.has(e.source_id) ? 'cours' : 'google',
      meta: e.location || '', raw: e, source: sourceName.get(e.source_id)
    })
  }

  // séances sport
  for (const s of await sportSessions(from, to)) {
    const start = atMinutes(s.date, fromHHMM(s.start_time))
    const end = new Date(start.getTime() + (s.duration_min || 60) * 60000)
    result.items.push({
      id: `s:${s.id}`, kind: 'sport', title: s.label || (s.kind === 'muscu' ? 'Muscu' : 'Vélo'),
      color: s.kind === 'muscu' ? 'var(--c-muscu)' : 'var(--c-velo)', allDay: false, start, end,
      dayStart: s.date, dayEnd: keyOf(new Date(end.getTime() - 1)), filter: 'sport',
      // une séance prévue se déplace en glissant (sa durée vient du programme)
      editable: s.status === 'planned' || s.status === 'missed', resizable: false,
      meta: s.status === 'done' ? 'Faite' : s.status === 'skipped' ? 'Passée' : s.pinned ? 'placée par toi' : '', session: s
    })
  }

  return result
}
