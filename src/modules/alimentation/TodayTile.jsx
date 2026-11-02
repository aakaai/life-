import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { loadDay } from './api'
import { sumLogs } from './data'
import { Rings, fmt } from './ui'
import { keyOf } from '../sport/planner'

// Bloc « Alimentation aujourd'hui » de l'accueil.
export default function TodayTile() {
  const [day, setDay] = useState(null)
  useEffect(() => {
    const today = keyOf(new Date())
    loadDay(today, { today }).then(setDay).catch(() => setDay(false))
  }, [])
  if (!day) return null
  const t = sumLogs(day.logs)
  return (
    <section aria-labelledby="today-food">
      <h2 id="today-food" className="group-title">Alimentation aujourd’hui</h2>
      <Link to="/alimentation" className="food-tile">
        <Rings kcal={t.kcal} kcalTarget={day.target.kcal} protein={t.protein} proteinTarget={day.target.protein} size={64} />
        <span className="food-tile-main">
          <span><strong>{fmt(t.kcal)}</strong> / {fmt(day.target.kcal)} kcal</span>
          <span><strong>{fmt(t.protein)}</strong> / {fmt(day.target.protein)} g de protéines</span>
          {day.tips[0] && <span className="food-tile-tip">{day.tips[0].title}</span>}
        </span>
        <span className="row-chevron">›</span>
      </Link>
    </section>
  )
}
