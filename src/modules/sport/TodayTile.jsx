import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { todaySessions } from './api'
import { SessionRow } from './WeekView'

// Bloc « Aujourd'hui » de l'accueil : les séances sport du jour.
export default function TodayTile() {
  const [list, setList] = useState(null)

  useEffect(() => {
    todaySessions().then(setList).catch(() => setList([]))
  }, [])

  if (!list) return null
  return (
    <section aria-labelledby="today-sport">
      <h2 id="today-sport" className="group-title">Sport aujourd’hui</h2>
      {list.length ? (
        <ul className="group sessions">
          {list.map((s) => (
            <li key={s.id}>
              <SessionRow s={s} base="/sport/" />
            </li>
          ))}
        </ul>
      ) : (
        <ul className="group">
          <li>
            <Link to="/sport" className="row">
              <span className="row-label">Repos aujourd’hui</span>
              <span className="row-value">Voir la semaine</span>
            </Link>
          </li>
        </ul>
      )}
    </section>
  )
}
