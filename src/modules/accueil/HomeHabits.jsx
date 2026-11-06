// Accueil · bloc « Habitudes » (v0.30.3, option A) : un gros anneau du jour + « plus que N »,
// puis une bulle par habitude ou séance, dans l'ordre de la journée, de la couleur de sa catégorie.
// Bulle pleine = fait ; anneau autour qui se remplit pour les quantités et les « X fois par semaine ».
// Un toucher = fait ; appui long = la fiche de l'habitude (ou la séance).
import { Link, useNavigate } from 'react-router-dom'
import Icon from '../../components/Icon'
import { useHabits, catColor, HabitIcon, useLongPress, fmt } from '../habitudes/ui'
import { isVisibleOn, todayItem, sortHabits, MOMENTS } from '../habitudes/logic'
import { useDaySessions, SPORT_AUTOS, sessionMoment, tapValue, isAutoDone, isDone } from '../habitudes/TodayView'
import { kindInfo, sessionPath } from '../sport/data'

const HABIT_OPTIONS = { autoDays: 60 }
const RANK = Object.fromEntries(MOMENTS.map(([k], i) => [k, i]))
const shortLabel = (s) => String(s.label || kindInfo(s.kind).short).split(' — ')[0]

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
      const target = Number(h.target) || 1
      const done = isDone(it)
      const slip = h.kind === 'avoid' && it.value > 0
      let ratio = done ? 1 : 0
      let info = ''
      if (it.paused) info = 'en pause'
      else if (slip) info = 'écart'
      else if (h.kind === 'quantity') { ratio = Math.min(1, (it.value || 0) / target); info = `${fmt(it.value)}/${fmt(target)} ${h.unit || ''}`.trim() }
      else if (it.progress) { if (!it.doneToday) ratio = Math.min(1, it.progress.count / it.progress.target); info = `${it.progress.count}/${it.progress.target} ${h.frequency === 'weekly' ? 'sem.' : 'mois'}` }
      else if (h.kind === 'avoid') info = 'tenu'
      else if (done) info = isAutoDone(it) ? 'auto ✓' : 'fait'
      else info = h.reminder_time || ''
      items.push({
        key: `h${h.id}`, rank: RANK[h.moment] ?? 1, time: h.reminder_time || '',
        name: h.name, info, done: done && !slip, slip, ratio, paused: it.paused, color: catColor(catById[h.category_id]),
        counted: !it.paused && !it.progress, icon: <HabitIcon habit={h} size={21} />,
        tap: () => (it.paused || isAutoDone(it) ? navigate(`/habitudes?fiche=${h.id}`) : log(h, today, tapValue(it))),
        long: () => navigate(`/habitudes?fiche=${h.id}`)
      })
    }
    for (const s of sessions || []) {
      const info = kindInfo(s.kind)
      const done = s.status === 'done'
      items.push({
        key: `s${s.id}`, rank: RANK[sessionMoment(s)], time: s.start_time || '',
        name: shortLabel(s), info: done ? 'faite' : s.status === 'skipped' ? 'passée' : s.start_time || '', done, ratio: done ? 1 : 0,
        paused: s.status === 'skipped', color: info.color, counted: s.status !== 'skipped', icon: <Icon name={info.icon} size={21} stroke={1.8} />,
        tap: () => toggle(s), long: () => navigate(sessionPath(s))
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
          <div className="hh-bubbles">
            {items.map((x) => <Bubble key={x.key} x={x} />)}
          </div>
        </>
      )}
    </section>
  )
}

function Bubble({ x }) {
  const press = useLongPress(x.long, x.tap)
  const r = 28
  const c = 2 * Math.PI * r
  const cls = ['hh-bubble', x.done ? 'is-done' : '', x.slip ? 'is-slip' : '', x.paused ? 'is-paused' : ''].filter(Boolean).join(' ')
  return (
    <button type="button" className={cls} style={{ '--c': x.color }} aria-label={`${x.name}${x.info ? ` : ${x.info}` : ''}. Toucher : fait. Appui long : fiche.`} {...press}>
      <span className="hh-dot">
        {!x.done && !x.slip && x.ratio > 0 && (
          <svg className="hh-arc" width="62" height="62" viewBox="0 0 62 62" aria-hidden="true">
            <circle cx="31" cy="31" r={r} strokeDasharray={`${c * x.ratio} ${c}`} transform="rotate(-90 31 31)" />
          </svg>
        )}
        {x.slip ? <Icon name="close" size={20} stroke={2.4} /> : x.icon}
      </span>
      <span className="hh-name">{x.name}</span>
      {x.info && <span className="hh-info">{x.info}</span>}
    </button>
  )
}
