// Rappels d'habitudes : quoi programmer sur l'iPhone pour les prochains jours.
// Fonction pure (testée) : l'app la recalcule à chaque ouverture et après chaque coche.
import { addDays, isVisibleOn, isPaused, todayItem, periodOf, periodCount, periodTarget, logValue, CUTOFF_HOURS, dayOfWeek, STRETCH_DAYS } from './logic.js'

export const RELANCE_MIN = 60
const RELANCE_LAST = 23 * 60 + 30

const fmt = (v) => (Number(v) || 0).toLocaleString('fr-BE', { maximumFractionDigits: 1 })

/**
 * @param habits  habitudes (avec reminder_time « HH:MM »)
 * @param ctx     contexte de logic.js (journal, pauses, coches auto, today)
 * @param now     maintenant
 * @returns [{ id, habitId, date, at, title, body }] triés par heure, au plus `max`
 */
export function planReminders(habits, ctx, now = new Date(), { days = 7, max = 60 } = {}) {
  const out = []
  for (const h of habits) {
    if (!h.reminder_time || h.archived || h.kind === 'avoid') continue
    const [hh, mm] = h.reminder_time.split(':').map(Number)
    if (Number.isNaN(hh)) continue
    for (let i = 0; i < days; i++) {
      const date = addDays(ctx.today, i)
      if (!isVisibleOn(h, date, ctx) || isPaused(h, date, ctx)) continue
      // « Étirements » : rappel seulement les soirs où ils sont prévus (dimanche → jeudi)
      if (h.auto === 'stretch' && !STRETCH_DAYS.includes(dayOfWeek(date))) continue
      // déjà fait ? (aujourd'hui : la coche du jour ; plus tard : objectif de la période déjà atteint)
      const periodic = !['daily', 'challenge'].includes(h.frequency)
      if (date === ctx.today) {
        const item = todayItem(h, date, ctx)
        if (item.doneToday || (periodic && item.status === 'done')) continue
      } else if (periodic && periodCount(h, periodOf(h, date), ctx) >= periodTarget(h)) continue
      // une heure avant 3 h du matin appartient encore à la journée « date »
      const calDate = hh < CUTOFF_HOURS ? addDays(date, 1) : date
      const at = `${calDate}T${String(hh).padStart(2, '0')}:${String(mm || 0).padStart(2, '0')}`
      const [y, mo, d] = calDate.split('-').map(Number)
      if (new Date(y, mo - 1, d, hh, mm || 0) <= now) continue
      const title = `${h.emoji ? `${h.emoji} ` : ''}${h.name}`
      out.push({ id: `${h.id}|${date}`, habitId: h.id, date, at, title, body: bodyFor(h, date, ctx) })
      // v0.32 : relance 1 h après, seulement si pas cochée entre-temps (les rappels sont recalculés après
      // chaque coche, donc la relance disparaît dès que c'est fait) ; jamais après 23:30 ni après minuit
      const rel = hh * 60 + (mm || 0) + RELANCE_MIN
      if (hh >= CUTOFF_HOURS && rel <= RELANCE_LAST) {
        const rh = Math.floor(rel / 60)
        const rm = rel % 60
        const left = leftCount(habits, date, ctx)
        out.push({
          id: `${h.id}|${date}|r`, habitId: h.id, date, at: `${calDate}T${String(rh).padStart(2, '0')}:${String(rm).padStart(2, '0')}`,
          title: `${title} · toujours pas cochée`,
          body: left > 1 ? `Il te reste ${left} habitudes pour finir ta journée.` : 'C’est la dernière pour finir ta journée.'
        })
      }
    }
  }
  out.sort((a, b) => (a.at < b.at ? -1 : a.at > b.at ? 1 : 0))
  return out.slice(0, max)
}

// habitudes encore à faire ce jour-là (pour le texte de la relance)
function leftCount(habits, date, ctx) {
  let n = 0
  for (const h of habits) {
    if (h.archived || h.kind === 'avoid' || !isVisibleOn(h, date, ctx) || isPaused(h, date, ctx)) continue
    const it = todayItem(h, date, ctx)
    if (!(it.status === 'done' || (it.progress && it.doneToday))) n++
  }
  return n
}

function bodyFor(h, date, ctx) {
  const today = date === ctx.today
  if (h.kind === 'quantity') {
    const v = today ? logValue(h, date, ctx) || 0 : 0
    return v ? `${fmt(v)} / ${fmt(h.target)} ${h.unit || ''} pour l’instant.` : `Objectif : ${fmt(h.target)} ${h.unit || ''}.`
  }
  if (h.frequency === 'weekly' || h.frequency === 'monthly') {
    const n = periodCount(h, periodOf(h, date), ctx)
    return `${n} / ${periodTarget(h)} ${h.frequency === 'weekly' ? 'cette semaine' : 'ce mois-ci'}. « Fait » pour la cocher.`
  }
  if (h.frequency === 'monthly_task') return 'À faire ce mois-ci. « Fait » pour la cocher.'
  return 'Pas encore cochée aujourd’hui. « Fait » pour la cocher.'
}

// Valeur à enregistrer quand on touche « Fait » dans la notification.
export function doneValue(habit, currentValue = 0) {
  if (habit.kind === 'quantity') return Math.max(Number(currentValue) || 0, Number(habit.target) || 1)
  if (habit.kind === 'avoid') return null
  return 1
}
