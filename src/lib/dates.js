// Petits utilitaires de dates (semaine du lundi au dimanche, format belge).

const fmtLong = new Intl.DateTimeFormat('fr-BE', { weekday: 'long', day: 'numeric', month: 'long' })
const fmtDayShort = new Intl.DateTimeFormat('fr-BE', { weekday: 'short' })
const fmtMonth = new Intl.DateTimeFormat('fr-BE', { month: 'long', year: 'numeric' })

const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1)

export const longDate = (d) => cap(fmtLong.format(d))
export const shortDay = (d) => cap(fmtDayShort.format(d).replace('.', ''))
export const monthLabel = (d) => cap(fmtMonth.format(d))

// Clé ISO locale AAAA-MM-JJ (sans décalage UTC), utilisée pour stocker les dates.
export function dayKey(d) {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export function startOfWeek(d) {
  const x = new Date(d.getFullYear(), d.getMonth(), d.getDate())
  const diff = (x.getDay() + 6) % 7 // lundi = 0
  x.setDate(x.getDate() - diff)
  return x
}

export function addDays(d, n) {
  const x = new Date(d)
  x.setDate(x.getDate() + n)
  return x
}

export function weekDays(d) {
  const start = startOfWeek(d)
  return Array.from({ length: 7 }, (_, i) => addDays(start, i))
}

export const sameDay = (a, b) => dayKey(a) === dayKey(b)

export function greeting(now = new Date()) {
  const h = now.getHours()
  if (h < 5 || h >= 18) return 'Bonsoir'
  return 'Bonjour'
}
