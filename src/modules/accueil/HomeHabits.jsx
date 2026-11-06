// Accueil · bloc « Habitudes » : un gros anneau du jour + « plus que N » (v0.30.3),
// puis une case par habitude ou séance, comme sur la page Habitudes (v0.30.5), dans l'ordre de la journée.
// Case teintée = fait ; remplissage du bas pour les quantités et les « X fois par semaine ».
// Un toucher = fait ; appui long = la fiche de l'habitude (ou la séance).
import { Link, useNavigate } from 'react-router-dom'
import { useHabits } from '../habitudes/ui'
import { isVisibleOn, todayItem, sortHabits, MOMENTS } from '../habitudes/logic'
import { useDaySessions, SPORT_AUTOS, sessionMoment, tapValue, isAutoDone, isDone, HabitCase, SessionCase } from '../habitudes/TodayView'
import { kindInfo, sessionPath } from '../sport/data'

const HABIT_OPTIONS = { autoDays: 60 }
const RANK = Object.fromEntries(MOMENTS.map(([k], i) => [k, i]))

export default function HomeHabits() {
  const navigate = useNavigate()
  const { data, error, log } = useHabits(HABIT_OPTIONS)
  const today = data?.today
  const { sessions, toggle } = useDaySessions(today, today)

  if (error) return null
  const items = []
  if (data) {
    const { habits, categories, ctx } = data
    const catById = Object.fromEntries(categories.map((c) => [c.id, c]))
    for (const h of sortHabits(habits.filter((x) => isVisibleOn(x, today, ctx) && !(sessions && SPORT_AUTOS.includes(x.auto))), categories)) {
      const it = todayItem(h, today, ctx)
      const slip = h.kind === 'avoid' && it.value > 0
      const open = () => navigate(`/habitudes?fiche=${h.id}`)
      items.push({
        key: `h${h.id}`, rank: RANK[h.moment] ?? 1, time: h.reminder_time || '',
        done: isDone(it) && !slip, counted: !it.paused && !it.progress,
        el: <HabitCase key={`h${h.id}`} item={it} cat={catById[h.category_id]} onLong={open}
          onTap={() => (it.paused || isAutoDone(it) ? open() : log(h, today, tapValue(it)))} />
      })
    }
    for (const s of sessions || []) {
      const info = kindInfo(s.kind)
      const done = s.status === 'done'
      const skipped = s.status === 'skipped'
      items.push({
        key: `s${s.id}`, rank: RANK[sessionMoment(s)], time: s.start_time || '', done, counted: !skipped,
        el: <SessionCase key={`s${s.id}`} x={{ s, info, done, skipped }} onTap={() => toggle(s)} onLong={() => navigate(sessionPath(s))} />
      })
    }
    items.sort((a, b) => a.rank - b.rank || (a.time || '99').localeCompare(b.time || '99'))
  }
  const counted = items.filter((x) => x.counted)
  const done = counted.filter((x) => x.done).length
  const left = counted.length - done
  const pct = counted.length ? done / counted.length : 0
  const R = 36
  const C = 2 * Math.PI * R

  return (
    <section className="home-card home-habits" aria-labelledby="hab-title">
      <div className="home-card-head">
        <h2 id="hab-title" className="home-card-title">Habitudes</h2>
        <Link to="/habitudes" className="home-card-link" style={{ marginLeft: 'auto' }}>Tout voir</Link>
      </div>
      {!data && <p className="muted-line">Chargement…</p>}
      {data && !items.length && <p className="muted-line">Rien de prévu aujourd’hui. <Link to="/habitudes">Crée une habitude</Link></p>}
      {items.length > 0 && (
        <>
          <div className="hh-hero">
            <div className="hh-ring" aria-label={`${done} faites sur ${counted.length}`}>
              <svg width="88" height="88" viewBox="0 0 88 88" aria-hidden="true">
                <circle cx="44" cy="44" r={R} className="habit-ring-track" style={{ strokeWidth: 9 }} />
                {pct > 0 && <circle cx="44" cy="44" r={R} className="habit-ring-fill" style={{ strokeWidth: 9 }} strokeDasharray={`${C * pct} ${C}`} transform="rotate(-90 44 44)" />}
              </svg>
              <strong>{done}/{counted.length}</strong>
            </div>
            <p className="hh-msg">
              {!counted.length ? 'Rien à cocher aujourd’hui' : left ? <>Plus que <strong>{left}</strong> aujourd’hui</> : <strong>Tout est fait ✓</strong>}
            </p>
          </div>
          <div className="hcase-grid hh-cases">
            {items.map((x) => x.el)}
          </div>
        </>
      )}
    </section>
  )
}
