import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useHabits, HabitRow } from './ui'
import { QuantitySheet } from './TodayView'
import { isVisibleOn, todayItem, sortHabits } from './logic'

const HOME_OPTIONS = { autoDays: 60 }

// Bloc « Habitudes du jour » de l'accueil : on coche directement d'ici.
export default function TodayTile() {
  const { data, log } = useHabits(HOME_OPTIONS)
  const [qty, setQty] = useState(null)
  const navigate = useNavigate()
  if (!data?.habits.length) return null
  const { habits, categories, ctx, today } = data
  const catById = Object.fromEntries(categories.map((c) => [c.id, c]))
  const items = sortHabits(habits.filter((h) => isVisibleOn(h, today, ctx)), categories)
    .map((h) => todayItem(h, today, ctx))
    .filter((i) => !i.paused)
  if (!items.length) return null
  const daily = items.filter((i) => !i.progress)
  const done = daily.filter((i) => i.status === 'done').length
  // à faire d'abord, puis les faites ; 6 au maximum
  const shown = [...items.filter((i) => i.status !== 'done'), ...items.filter((i) => i.status === 'done')].slice(0, 6)

  return (
    <section aria-labelledby="today-habits">
      <h2 id="today-habits" className="group-title home-habits-title">
        <span>Habitudes du jour</span>
        {daily.length > 0 && <span className="home-habits-count">{done}/{daily.length}</span>}
      </h2>
      <ul className="group habit-list">
        {shown.map((it) => (
          <li key={it.habit.id}>
            <HabitRow item={it} date={today} cat={catById[it.habit.category_id]} ctx={ctx} onLog={log}
              onOpen={(i) => (i.habit.kind === 'quantity' ? setQty(i) : navigate('/habitudes'))} />
          </li>
        ))}
        {items.length > shown.length && (
          <li><Link to="/habitudes" className="row row-action">Voir les {items.length} habitudes</Link></li>
        )}
      </ul>
      {qty && <QuantitySheet item={qty} onClose={() => setQty(null)} onSave={(v) => { log(qty.habit, today, v); setQty(null) }} />}
    </section>
  )
}
