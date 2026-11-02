import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { loadSchool, sameDayKey } from './api'
import { hm } from './ui'

// Bloc « Cours aujourd'hui » de l'accueil (seulement si l'horaire est relié).
export default function TodayTile() {
  const [data, setData] = useState(null)
  useEffect(() => {
    loadSchool().then(setData).catch(() => setData(null))
  }, [])
  if (!data?.hasSource) return null
  const now = new Date()
  const today = data.courses.filter((c) => sameDayKey(c.start) === sameDayKey(now) && c.end > now)
  const next = data.courses.find((c) => c.start > now)
  return (
    <section aria-labelledby="today-school">
      <h2 id="today-school" className="group-title">Cours aujourd’hui</h2>
      <Link to="/ecole" className="food-tile school-tile">
        {today.length ? (
          <span className="food-tile-main">
            {today.slice(0, 3).map((c) => (
              <span key={c.id} className="school-line">
                <span className="course-bar" style={{ background: data.colors[c.courseKey] }} />
                <strong>{hm(c.start)}</strong> {c.name}{c.room ? ` · ${c.room}` : ''}
              </span>
            ))}
          </span>
        ) : (
          <span className="food-tile-main">
            <span>Plus de cours aujourd’hui</span>
            {next && <span>Prochain : {new Intl.DateTimeFormat('fr-BE', { weekday: 'long' }).format(next.start)} à {hm(next.start)} · {next.name}</span>}
          </span>
        )}
        <span className="row-chevron">›</span>
      </Link>
    </section>
  )
}
