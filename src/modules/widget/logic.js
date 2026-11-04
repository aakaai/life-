// Widget iPhone « Ma journée » (v0.23) : fonctions pures du résumé de la journée (testées dans tests/widget.test.mjs).
// Calendrier d'aujourd'hui et de demain (agenda Google + Life, cours, sport, repas prévus), tâches du jour
// et en retard, habitudes du jour. Construit par l'app (web ou iPhone) et écrit dans widget_feed ;
// le widget le lit avec la clé privée via la fonction Edge « widget ».
import { addDays } from '../agenda/logic.js'
import { tasksForToday, taskState } from '../taches/logic.js'
import { isVisibleOn, todayItem, sortHabits, progressLabel } from '../habitudes/logic.js'
import { mealInfo, mealRank } from '../alimentation/data.js'

const pad = (n) => String(n).padStart(2, '0')
const keyOf = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
const at = (key, hm) => {
  const [y, m, d] = key.split('-').map(Number)
  const [h, mi] = hm.split(':').map(Number)
  return new Date(y, m - 1, d, h, mi)
}
// « var(--purple) » → « purple » (le widget a sa propre palette claire / sombre)
export const colorToken = (c) => (String(c || '').match(/--([\w-]+)/)?.[1] || 'gray')
// heure affichée des repas prévus dans le calendrier du widget
export const MEAL_TIME = { 0: '07:30', 5: '10:00', 1: '12:00', 2: '16:00', 3: '19:00', 4: '22:00' }
const fmtNum = (v) => (Number(v) || 0).toLocaleString('fr-BE', { maximumFractionDigits: 1 })

export function feedEvents(items, from, to) {
  return items
    .filter((x) => x.kind !== 'task')
    .filter((x) => (x.allDay ? x.dayStart < to && (x.dayEnd || addDays(x.dayStart, 1)) > from : x.start && x.end && keyOf(x.start) < to && x.end > at(from, '00:00')))
    .map((x) => ({
      id: String(x.id),
      title: x.title || '',
      sub: x.meta || '',
      start: x.allDay ? null : x.start.getTime(),
      end: x.allDay ? null : x.end.getTime(),
      all_day: !!x.allDay,
      date: x.allDay ? x.dayStart : keyOf(x.start),
      day_end: x.allDay ? x.dayEnd || addDays(x.dayStart, 1) : null,
      color: colorToken(x.color),
      kind: x.kind
    }))
}

export function feedMeals(day, date) {
  if (!day) return []
  const open = day.entries.filter((e) => !e.eaten)
  const meals = [...new Set(open.map((e) => Number(e.meal)))].sort((a, b) => mealRank(a) - mealRank(b))
  return meals.map((m) => {
    const group = open.filter((e) => Number(e.meal) === m)
    const kcal = group.reduce((t, e) => t + (e.totals?.kcal || 0), 0)
    const start = at(date, MEAL_TIME[m] || '12:00')
    return {
      id: `m:${date}:${m}`, title: `${mealInfo(m).name} · ${group.map((e) => e.recipe.name).join(' + ')}`,
      sub: kcal ? `${Math.round(kcal)} kcal` : '', start: start.getTime(), end: start.getTime() + 30 * 60000,
      all_day: false, date, day_end: null, color: 'green', kind: 'meal'
    }
  })
}

export function feedTasks(tasks, categories, today) {
  const cat = Object.fromEntries((categories || []).map((c) => [c.id, c]))
  return tasksForToday(tasks, today).map((t) => ({
    id: t.id, title: t.title, time: t.time || null, priority: Number(t.priority) || 2, done: !!t.done,
    late: !t.done && taskState(t, today) === 'overdue', due: t.planned_date || t.due_date || null,
    color: cat[t.category_id]?.color || 'gray'
  }))
}

export function feedHabits(data) {
  if (!data) return { date: null, items: [] }
  const { habits, categories, ctx, today } = data
  const cat = Object.fromEntries(categories.map((c) => [c.id, c]))
  const items = []
  for (const h of sortHabits(habits.filter((x) => !x.archived && isVisibleOn(x, today, ctx)), categories)) {
    if (h.kind === 'avoid') continue
    const it = todayItem(h, today, ctx)
    if (it.paused) continue
    const auto = h.auto && it.auto === true && !(it.value > 0)
    const done = it.status === 'done' || !!(it.progress && it.doneToday)
    let note = ''
    if (h.kind === 'quantity') note = `${fmtNum(it.value)}/${fmtNum(h.target)}${h.unit ? ` ${h.unit}` : ''}`
    else if (it.progress) note = progressLabel(it).replace(' cette semaine', ' sem.').replace(' ce mois-ci', ' mois')
    else if (auto) note = 'auto'
    else if (h.reminder_time) note = h.reminder_time
    items.push({ id: h.id, name: h.name, color: cat[h.category_id]?.color || 'pink', done, tickable: !auto, note })
  }
  return { date: today, items }
}

