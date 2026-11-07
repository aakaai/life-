// Accueil · « Ta semaine » (v0.32) : le dimanche dès 19 h et le lundi, la grille des habitudes de la semaine,
// le pourcentage tenu et la comparaison avec la semaine d'avant. « Faire mon bilan » ouvre le bilan guidé.
import { Link } from 'react-router-dom'
import { useHabits } from '../habitudes/ui'
import { weekCardFor } from '../habitudes/week'
import { weekStats, WeekGrid, WeekSummary, weekRange } from '../habitudes/WeekGrid'

const OPTIONS = { autoDays: 21 }

export default function WeekCard() {
  const day = weekCardFor(new Date())
  if (!day) return null
  return <WeekCardInner day={day} />
}

function WeekCardInner({ day }) {
  const { data, error } = useHabits(OPTIONS)
  if (error || !data) return null
  const { grid, before } = weekStats(data, day)
  if (!grid.rows.length) return null
  const reviewed = data.reviews?.some((r) => r.week_start === grid.start)
  return (
    <section className="home-card wk-card" aria-labelledby="wk-title">
      <div className="home-card-head">
        <h2 id="wk-title" className="home-card-title">Ta semaine</h2>
        <span className="wk-range">{weekRange(grid)}</span>
      </div>
      <WeekSummary grid={grid} before={before} />
      <WeekGrid grid={grid} categories={data.categories} />
      <Link className="btn-secondary as-link wk-btn" to={`/habitudes/bilans?bilan=1&semaine=${grid.start}`}>
        {reviewed ? 'Revoir mon bilan' : 'Faire mon bilan'}
      </Link>
    </section>
  )
}
