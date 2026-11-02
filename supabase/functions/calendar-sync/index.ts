// Edge Function « calendar-sync »
// Lit tes agendas (adresse iCal secrète) et copie les événements des 30 derniers
// jours et des 6 mois à venir (titre, heures, lieu, description) dans la table calendar_events.
// Version 2 (module École) : nécessite la migration 005_ecole.sql.
// Elle tourne chez Supabase (gratuit) parce qu'un navigateur ne peut pas lire
// directement un agenda Google (blocage CORS).
//
// Déploiement : Supabase > Edge Functions > Deploy a new function > Via Editor,
// nom « calendar-sync », colle ce fichier, puis « Deploy function ».

import { createClient } from 'npm:@supabase/supabase-js@2'
import ICAL from 'npm:ical.js@2'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS'
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json' } })

type Row = { uid: string; title: string; start_at: string | null; end_at: string | null; all_day: boolean; day_start: string | null; day_end: string | null; location: string | null; description: string | null }

// Transforme un fichier .ics en liste d'événements (récurrences dépliées).
export function parseIcs(text: string, from: Date, to: Date): Row[] {
  const root = new ICAL.Component(ICAL.parse(text))
  for (const tz of root.getAllSubcomponents('vtimezone')) {
    try { ICAL.TimezoneService.register(tz) } catch { /* fuseau déjà connu */ }
  }
  const rangeStart = ICAL.Time.fromJSDate(from, true)
  const rangeEnd = ICAL.Time.fromJSDate(to, true)

  const vevents = root.getAllSubcomponents('vevent')
  const masters = new Map<string, any>()
  const exceptions: any[] = []
  for (const v of vevents) {
    const ev = new ICAL.Event(v)
    if (v.hasProperty('recurrence-id')) exceptions.push(ev)
    else masters.set(ev.uid, ev)
  }
  for (const ex of exceptions) {
    const m = masters.get(ex.uid)
    if (m) m.relateException(ex)
    else masters.set(ex.uid + ex.recurrenceId, ex)
  }

  const rows: Row[] = []
  const push = (item: any, start: any, end: any) => {
    if ((item.component.getFirstPropertyValue('status') || '').toUpperCase() === 'CANCELLED') return
    const title = item.summary || '(sans titre)'
    const location = item.location || null
    const description = item.description ? String(item.description).slice(0, 1000) : null
    if (start.isDate) {
      const endDay = end && end.compare(start) > 0 ? end : start.clone()
      if (endDay === start || endDay.compare(start) === 0) endDay.addDuration(new ICAL.Duration({ days: 1 }))
      rows.push({ uid: item.uid, title, start_at: null, end_at: null, all_day: true, day_start: start.toString(), day_end: endDay.toString(), location, description })
    } else {
      const s = start.toJSDate()
      const e = end ? end.toJSDate() : new Date(s.getTime() + 3600_000)
      rows.push({ uid: item.uid, title, start_at: s.toISOString(), end_at: e.toISOString(), all_day: false, day_start: null, day_end: null, location, description })
    }
  }

  for (const ev of masters.values()) {
    if (ev.isRecurring()) {
      const it = ev.iterator()
      let next
      let guard = 0
      while ((next = it.next()) && guard++ < 3000) {
        if (next.compare(rangeEnd) > 0) break
        const d = ev.getOccurrenceDetails(next)
        if (d.endDate.compare(rangeStart) < 0) continue
        push(d.item, d.startDate, d.endDate)
      }
    } else {
      const end = ev.endDate || ev.startDate
      if (ev.startDate.compare(rangeEnd) > 0 || end.compare(rangeStart) < 0) continue
      push(ev, ev.startDate, ev.endDate)
    }
  }
  return rows
}

if (typeof Deno !== 'undefined') Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })
  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY') ?? Deno.env.get('SUPABASE_PUBLISHABLE_KEY')!,
      { global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } } }
    )
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return json({ error: 'Non connecté' }, 401)

    const { data: sources, error } = await supabase.from('calendar_sources').select('*')
    if (error) throw error

    const from = new Date(Date.now() - 30 * 86400_000)
    const to = new Date(Date.now() + 183 * 86400_000)
    const report = []
    for (const src of sources ?? []) {
      try {
        const url = String(src.url).trim().replace(/^webcal:\/\//i, 'https://')
        if (!/^https:\/\//i.test(url)) throw new Error('L’adresse doit commencer par https://')
        const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0 (Life app calendar sync)', Accept: 'text/calendar' } })
        if (!res.ok) throw new Error(`L’agenda a répondu ${res.status}`)
        const rows = parseIcs(await res.text(), from, to)
        await supabase.from('calendar_events').delete().eq('source_id', src.id)
        for (let i = 0; i < rows.length; i += 500) {
          const chunk = rows.slice(i, i + 500).map((r) => ({ ...r, source_id: src.id, user_id: user.id }))
          const { error: e } = await supabase.from('calendar_events').insert(chunk)
          if (e) throw e
        }
        await supabase.from('calendar_sources').update({ last_error: null }).eq('id', src.id)
        report.push({ name: src.name, events: rows.length })
      } catch (e) {
        const message = e instanceof Error ? e.message : String(e)
        await supabase.from('calendar_sources').update({ last_error: message }).eq('id', src.id)
        report.push({ name: src.name, error: message })
      }
    }
    await supabase.from('sport_settings').upsert({ id: user.id, last_sync_at: new Date().toISOString() })
    return json({ ok: true, report })
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : String(e) }, 500)
  }
})
