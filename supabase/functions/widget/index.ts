// Edge Function « widget » (v0.23) : le widget iPhone « Ma journée » lit ta journée et coche
// tâches et habitudes, avec ta clé privée (en-tête x-life-key). Seule l'empreinte de la clé est
// enregistrée (table widget_feed, 015_widget.sql). Aucune autre dépendance.
//
// Déploiement : Supabase > Edge Functions > Deploy a new function > Via Editor,
// nom « widget », colle ce fichier, « Deploy function », puis dans les réglages de la fonction
// désactive « Verify JWT » (le widget n'a pas de session, il a sa clé).

const URL_ = Deno.env.get('SUPABASE_URL')!
const SERVICE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const H = { apikey: SERVICE, Authorization: `Bearer ${SERVICE}`, 'Content-Type': 'application/json' }
const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'x-life-key, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS'
}
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } })

const rest = (path: string, init: RequestInit = {}) =>
  fetch(`${URL_}/rest/v1/${path}`, { ...init, headers: { ...H, ...(init.headers || {}) } })

async function sha256(s: string) {
  const b = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s))
  return [...new Uint8Array(b)].map((x) => x.toString(16).padStart(2, '0')).join('')
}
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const DAY = /^\d{4}-\d{2}-\d{2}$/

// deno-lint-ignore no-explicit-any
type Feed = { tasks?: any[]; habits?: any[]; [k: string]: unknown }

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: CORS })
  const key = req.headers.get('x-life-key')?.trim() || ''
  if (key.length < 24) return json({ error: 'Clé manquante' }, 401)
  const r = await rest(`widget_feed?key_hash=eq.${await sha256(key)}&select=user_id,data,updated_at`)
  if (!r.ok) return json({ error: 'Table widget_feed absente : lance 015_widget.sql' }, 500)
  const row = (await r.json())[0]
  if (!row) return json({ error: 'Clé inconnue : crée-la dans Réglages › Widget iPhone' }, 401)
  const uid: string = row.user_id
  const data: Feed = row.data || {}

  if (req.method === 'GET') return json({ ...data, updated_at: row.updated_at })
  if (req.method !== 'POST') return json({ error: 'Méthode' }, 405)

  let body: { kind?: string; id?: string; date?: string; done?: boolean }
  try {
    body = await req.json()
  } catch {
    return json({ error: 'JSON' }, 400)
  }
  const { kind, id, date } = body
  const done = !!body.done
  if (!id || !UUID.test(id)) return json({ error: 'id' }, 400)

  if (kind === 'task') {
    const u = await rest(`tasks?id=eq.${id}&user_id=eq.${uid}`, {
      method: 'PATCH',
      headers: { Prefer: 'return=representation' },
      body: JSON.stringify({ done, done_at: done ? new Date().toISOString() : null })
    })
    if (!u.ok || !(await u.json()).length) return json({ error: 'Tâche introuvable' }, 404)
    for (const t of data.tasks || []) if (t.id === id) t.done = done
  } else if (kind === 'habit') {
    if (!date || !DAY.test(date)) return json({ error: 'date' }, 400)
    const hr = await rest(`habits?id=eq.${id}&user_id=eq.${uid}&select=kind,target`)
    const habit = hr.ok ? (await hr.json())[0] : null
    if (!habit || habit.kind === 'avoid') return json({ error: 'Habitude introuvable' }, 404)
    if (done) {
      const value = habit.kind === 'quantity' ? Number(habit.target) || 1 : 1
      const w = await rest('habit_logs?on_conflict=habit_id,date', {
        method: 'POST',
        headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
        body: JSON.stringify({ user_id: uid, habit_id: id, date, value })
      })
      if (!w.ok) return json({ error: await w.text() }, 500)
    } else {
      await rest(`habit_logs?habit_id=eq.${id}&date=eq.${date}&user_id=eq.${uid}`, { method: 'DELETE' })
    }
    for (const h of data.habits || []) if (h.id === id) h.done = done
  } else {
    return json({ error: 'kind' }, 400)
  }

  const updated_at = new Date().toISOString()
  await rest(`widget_feed?user_id=eq.${uid}`, { method: 'PATCH', body: JSON.stringify({ data, updated_at }) })
  return json({ ...data, updated_at })
})
