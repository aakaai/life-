// « Ta semaine » (v0.32) — grille 7 jours × habitudes et pourcentage tenu. Pur, testé (tests/semaine.test.mjs).
import { addDays, mondayOf, dayStatus, isActive, isPaused, isDoneOn, logValue, periodTarget, sortHabits } from './logic.js'

const isDayBased = (h) => h.frequency === 'daily' || h.frequency === 'challenge'

/**
 * Cellules : done (fait), part (quantité commencée), miss (raté ou pas encore fait), free (jour libre d'une
 * habitude « X fois par semaine / mois », pas encore faite), off (pas prévu : pas commencée, finie, en pause).
 * Total de la ligne : done / planned. Les habitudes mensuelles s'affichent sans compter dans le pourcentage.
 * @returns { start, end, days: [7 clés], rows: [{ habit, cells, done, planned, counted }], done, planned, pct }
 */
export function weekGrid(habits, ctx, anyDay, categories = []) {
  const start = mondayOf(anyDay)
  const days = Array.from({ length: 7 }, (_, i) => addDays(start, i))
  const end = days[6]
  const rows = []
  for (const h of sortHabits(habits, categories)) {
    if (!days.some((d) => isActive(h, d))) continue
    if (h.archived && !days.some((d) => logValue(h, d, ctx))) continue
    const cells = days.map((d) => {
      if (!isActive(h, d) || d > ctx.today || isPaused(h, d, ctx)) return 'off'
      if (isDayBased(h)) {
        const st = dayStatus(h, d, ctx)
        if (st === 'done') return 'done'
        if (st === 'none' || st === 'future' || st === 'paused') return 'off'
        return h.kind === 'quantity' && (logValue(h, d, ctx) || 0) > 0 ? 'part' : 'miss'
      }
      return isDoneOn(h, d, ctx) ? 'done' : 'free'
    })
    const doneCells = cells.filter((c) => c === 'done').length
    let planned
    let counted = true
    if (isDayBased(h)) planned = cells.filter((c) => c !== 'off').length
    else if (h.frequency === 'weekly') planned = cells.some((c) => c !== 'off') ? periodTarget(h) : 0
    else { planned = 0; counted = false }
    if (counted && !planned) continue
    rows.push({ habit: h, cells, done: counted ? Math.min(doneCells, planned) : doneCells, planned, counted })
  }
  const done = rows.reduce((n, r) => n + (r.counted ? r.done : 0), 0)
  const planned = rows.reduce((n, r) => n + (r.counted ? r.planned : 0), 0)
  return { start, end, days, rows, done, planned, pct: planned ? done / planned : null }
}

/** Semaine à montrer sur l'accueil : le dimanche dès 19 h (cette semaine) et le lundi (la semaine d'avant). */
export function weekCardFor(now = new Date()) {
  const day = now.getDay()
  const pad = (n) => String(n).padStart(2, '0')
  const key = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
  if (day === 0 && now.getHours() >= 19) return key(now)
  if (day === 1) return key(new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1))
  return null
}

/** Notification « Ta semaine d'habitudes » le prochain dimanche à 19:00 (catégorie agenda : toucher → accueil). */
export function weekReminder(now = new Date()) {
  const d = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 19, 0, 0)
  d.setDate(d.getDate() + ((7 - d.getDay()) % 7))
  if (d <= now) d.setDate(d.getDate() + 7)
  const pad = (n) => String(n).padStart(2, '0')
  const date = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
  return {
    id: `agenda.week.${date}`, habitId: 'agenda', agendaId: 'week', category: 'agenda', date, at: `${date}T19:00`,
    title: 'Ta semaine d’habitudes', body: 'Ta grille de la semaine est prête : viens voir ce que tu as tenu.'
  }
}
