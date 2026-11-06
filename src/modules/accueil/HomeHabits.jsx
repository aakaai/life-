// Accueil · bloc « Habitudes » (v0.30.2) : les habitudes et les séances du jour en petites cases.
// Un toucher = fait ; appui long = la fiche de l'habitude (ou la séance).
import { Link, useNavigate } from 'react-router-dom'
import { useHabits } from '../habitudes/ui'
import { isVisibleOn, todayItem, sortHabits, MOMENTS } from '../habitudes/logic'
import { useDaySessions, HabitCase, SessionCase, SPORT_AUTOS, sessionMoment, tapValue, isAutoDone } from '../habitudes/TodayView'
import { kindInfo, sessionPath } from '../sport/data'

const HABIT_OPTIONS = { autoDays: 60 }
const RANK = Object.fromEntries(MOMENTS.map(([k], i) => [k, i]))

export default function HomeHabits() {
  const navigate = useNavigate()
  const { data, error, log } = useHabits(HABIT_OPTIONS)
  const today = data?.today
  const { sessions, toggle } = useDaySessions(today, today)

  if (error) return null
  const cases = []
  if (data) {
    const { habits, categories, ctx } = data
    const catById = Object.fromEntries(categories.map((c) => [c.id, c]))
    for (const h of sortHabits(habits.filter((x) => isVisibleOn(x, today, ctx) && !(sessions && SPORT_AUTOS.includes(x.auto))), categories)) {
      const it = todayItem(h, today, ctx)
      cases.push({ key: `h${h.id}`, rank: RANK[h.moment] ?? 1, time: h.reminder_time || '', type: 'habit', it, cat: catById[h.category_id] })
    }
    for (const s of sessions || []) {
      cases.push({ key: `s${s.id}`, rank: RANK[sessionMoment(s)], time: s.start_time || '', type: 'session', x: { s, info: kindInfo(s.kind), done: s.status === 'done', skipped: s.status === 'skipped' } })
    }
    cases.sort((a, b) => a.rank - b.rank || (a.time || '99').localeCompare(b.time || '99'))
  }
  const counted = cases.filter((c) => (c.type === 'habit' ? !c.it.paused && !c.it.progress : !c.x.skipped))
  const done = counted.filter((c) => (c.type === 'habit' ? c.it.status === 'done' : c.x.done)).length

  return (
    <section className="home-card" aria-labelledby="hab-title">
      <div className="home-card-head">
        <h2 id="hab-title" className="home-card-title">Habitudes</h2>
        <span className="home-card-hint">{counted.length ? `${done} / ${counted.length}` : ''}</span>
        <Link to="/habitudes" className="home-card-link">Tout voir</Link>
      </div>
      {!data && <p className="muted-line">Chargement…</p>}
      {data && !cases.length && <p className="muted-line">Rien de prévu aujourd’hui. <Link to="/habitudes">Crée une habitude</Link></p>}
      {cases.length > 0 && (
        <div className="hcase-grid home-hgrid">
          {cases.map((c) => (c.type === 'habit'
            ? <HabitCase key={c.key} item={c.it} cat={c.cat}
                onTap={() => (c.it.paused || isAutoDone(c.it) ? navigate(`/habitudes?fiche=${c.it.habit.id}`) : log(c.it.habit, today, tapValue(c.it)))}
                onLong={() => navigate(`/habitudes?fiche=${c.it.habit.id}`)} />
            : <SessionCase key={c.key} x={c.x} onTap={() => toggle(c.x.s)} onLong={() => navigate(sessionPath(c.x.s))} />))}
        </div>
      )}
    </section>
  )
}
