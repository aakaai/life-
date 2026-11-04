// Widget iPhone « Ma journée » (v0.23, demande du 4 nov.) : résumé de la journée lu par le widget.
// Calendrier d'aujourd'hui et de demain (agenda Google + Life, cours, sport, repas prévus), tâches du jour
// et en retard, habitudes du jour. Construit par l'app (web ou iPhone) et écrit dans widget_feed ;
// le widget le lit avec la clé privée via la fonction Edge « widget ».
import { loadRange } from '../agenda/api'
import { addDays } from '../agenda/logic'
import { loadTasks } from '../taches/api'
import { loadHabits } from '../habitudes/api'
import { loadPlanRange } from '../alimentation/api'
import { feedEvents, feedMeals, feedTasks, feedHabits } from './logic'

const pad = (n) => String(n).padStart(2, '0')
const keyOf = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`

export async function buildFeed(now = new Date()) {
  const today = keyOf(now)
  const after = addDays(today, 2)
  const [range, taskData, habitData, plan] = await Promise.all([
    loadRange(today, after).catch(() => ({ items: [] })),
    loadTasks().catch(() => null),
    loadHabits({ from: addDays(today, -40), now, autoDays: 3 }).catch(() => null),
    loadPlanRange([today]).catch(() => null)
  ])
  const events = [...feedEvents(range.items, today, after), ...feedMeals(plan?.days?.[today], today)]
    .sort((a, b) => Number(b.all_day) - Number(a.all_day) || (a.start ?? 0) - (b.start ?? 0))
  const habits = feedHabits(habitData)
  return {
    v: 1,
    generated_at: now.getTime(),
    today,
    events,
    tasks: taskData ? feedTasks(taskData.tasks, taskData.categories, today) : [],
    habits: habits.items,
    habits_date: habits.date || today
  }
}
