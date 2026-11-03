// Données du module École : les cours viennent de l'agenda « Horaire de cours » (Hyperplanning),
// relu par la fonction calendar-sync comme les autres agendas.
import { store } from '../../lib/store'
import { listSources, syncCalendars, dedupeEvents } from '../sport/api'
import { parseCourse, colorMap } from './parse'

export { syncCalendars }

export async function loadSchool() {
  const sources = (await listSources()).filter((s) => s.kind === 'ecole')
  if (!sources.length) return { hasSource: false, courses: [], holidays: [], colors: {}, sources }
  const ids = new Set(sources.map((s) => s.id))
  const events = dedupeEvents(await store.list('calendar_events')).filter((e) => ids.has(e.source_id))
  const courses = events.filter((e) => !e.all_day && e.start_at).map(parseCourse).filter((c) => !c.holiday)
  courses.sort((a, b) => a.start - b.start)
  const holidays = events
    .filter((e) => e.all_day || /^vacances/i.test(e.title || ''))
    .map((e) => ({ title: e.title, from: e.day_start || e.start_at?.slice(0, 10), to: e.day_end || e.end_at?.slice(0, 10) }))
  return { hasSource: true, courses, holidays, colors: colorMap(courses), sources }
}

export const sameDayKey = (d) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
