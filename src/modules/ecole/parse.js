// Lecture des événements Hyperplanning (ICHEC).
// Titre : « MASTER 1 Jour - WALEWYNS - 21ST020-A / Électronique et nouvelles technologies pour managers »
// Lieu  : « B104 - Salle de cours »
// Description : « Niveau : … Professeur : … Activité d'apprentissage : … Salle : … »

export const COLORS = ['blue', 'green', 'purple', 'orange', 'pink', 'yellow', 'red', 'brown', 'gray']

const field = (desc, label) => {
  const m = new RegExp(`${label}\\s*:\\s*(.+?)(?=\\s+(?:Niveau|Professeur|Activité d'apprentissage|Salle|Groupe|Matière)\\s*:|\\n|$)`, 'i').exec(desc || '')
  return m ? m[1].trim() : null
}

export function parseCourse(ev) {
  const title = (ev.title || '').trim()
  const out = {
    id: ev.id,
    title,
    start: ev.start_at ? new Date(ev.start_at) : null,
    end: ev.end_at ? new Date(ev.end_at) : null,
    code: null,
    name: title,
    prof: null,
    level: null,
    room: null,
    roomType: null,
    exam: /examen|exam\b|évaluation/i.test(title),
    holiday: /^vacances|cong[ée]/i.test(title)
  }
  // « niveau - prof - CODE / Intitulé »
  const slash = title.indexOf(' / ')
  if (slash > -1) {
    const head = title.slice(0, slash)
    out.name = title.slice(slash + 3).trim()
    const parts = head.split(' - ').map((x) => x.trim())
    out.code = parts[parts.length - 1] || null
    if (parts.length >= 3) {
      out.level = parts[0]
      out.prof = parts.slice(1, -1).join(' - ')
    } else if (parts.length === 2) out.prof = parts[0]
  }
  out.prof = field(ev.description, 'Professeur') || out.prof
  out.level = field(ev.description, 'Niveau') || out.level
  const room = ev.location || field(ev.description, 'Salle')
  if (room) {
    const [r, ...rest] = room.split(' - ')
    out.room = r.trim()
    out.roomType = rest.join(' - ').trim() || null
  }
  out.courseKey = out.code ? out.code.replace(/-[A-Z]$/, '') + (out.code.match(/-[A-Z]$/)?.[0] || '') : out.name
  return out
}

const cap = (s) => (s ? s.charAt(0) + s.slice(1).toLowerCase() : s)
export const profName = (p) => (p ? p.split(' ').map((w) => (w === w.toUpperCase() ? cap(w) : w)).join(' ') : null)

// Une couleur stable par cours (ordre alphabétique des codes).
export function colorMap(courses) {
  const keys = [...new Set(courses.filter((c) => !c.holiday).map((c) => c.courseKey))].sort()
  return Object.fromEntries(keys.map((k, i) => [k, `var(--${COLORS[i % COLORS.length]})`]))
}
