import { NavLink } from 'react-router-dom'
import { profName } from './parse'

const TABS = [
  ['/ecole', 'Aujourd’hui', true],
  ['/ecole/semaine', 'Semaine'],
  ['/ecole/cours', 'Mes cours']
]

export function SchoolNav() {
  return (
    <nav className="food-nav" aria-label="École">
      {TABS.map(([to, label, end]) => (
        <NavLink key={to} to={to} end={end} className="food-tab">{label}</NavLink>
      ))}
    </nav>
  )
}

export const hm = (d) => `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
export const fmtDay = new Intl.DateTimeFormat('fr-BE', { weekday: 'long', day: 'numeric', month: 'long' })
export const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1)

export function CourseRow({ c, color, now, onClick }) {
  const live = now && c.start <= now && c.end > now
  return (
    <button className={live ? 'row course-row is-live' : 'row course-row'} onClick={onClick}>
      <span className="course-time">
        {hm(c.start)}
        <small>{hm(c.end)}</small>
      </span>
      <span className="course-bar" style={{ background: color }} />
      <span className="food-main">
        <span className="food-name">
          {c.name}
          {c.exam && <span className="tag tag-danger">Examen</span>}
          {live && <span className="tag tag-live">En cours</span>}
        </span>
        <span className="food-sub">
          {[c.room, profName(c.prof)].filter(Boolean).join(' · ')}
        </span>
      </span>
    </button>
  )
}

export function CourseSheet({ c, color, sessions, onClose }) {
  const upcoming = sessions.filter((s) => s.end > new Date()).slice(0, 6)
  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div className="sheet" role="dialog" aria-label={c.name} onClick={(e) => e.stopPropagation()}>
        <div className="course-sheet-head">
          <span className="course-dot" style={{ background: color }} />
          <div>
            <p className="sheet-title">{c.name}</p>
            <p className="qty-brand">{c.code}</p>
          </div>
        </div>
        <ul className="group lines">
          <li className="row"><span className="row-label">Quand</span><span className="row-value">{cap(fmtDay.format(c.start))}, {hm(c.start)}–{hm(c.end)}</span></li>
          {c.room && <li className="row"><span className="row-label">Salle</span><span className="row-value">{c.room}{c.roomType ? ` · ${c.roomType}` : ''}</span></li>}
          {c.prof && <li className="row"><span className="row-label">Professeur</span><span className="row-value">{profName(c.prof)}</span></li>}
          {c.level && <li className="row"><span className="row-label">Niveau</span><span className="row-value">{c.level}</span></li>}
        </ul>
        {upcoming.length > 0 && (
          <>
            <p className="group-title">Prochaines séances</p>
            <ul className="group lines">
              {upcoming.map((s) => (
                <li key={s.id} className="row">
                  <span className="row-label">{cap(fmtDay.format(s.start))}</span>
                  <span className="row-value">{hm(s.start)}–{hm(s.end)}{s.room ? ` · ${s.room}` : ''}</span>
                </li>
              ))}
            </ul>
          </>
        )}
        <button className="btn-plain" onClick={onClose}>Fermer</button>
      </div>
    </div>
  )
}
