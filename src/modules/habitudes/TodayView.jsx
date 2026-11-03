import { useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import Icon from '../../components/Icon'
import { HabitsNav, HabitRow, useHabits, longDay, fmt } from './ui'
import { MOMENTS, addDays, isVisibleOn, todayItem, sortHabits, mondayOf, dayOfWeek, isPaused } from './logic'
import { SUGGESTIONS } from './suggestions'

const TODAY_OPTIONS = { autoDays: 120 }

// Aujourd'hui : les habitudes du jour, rangées par moment, à cocher.
export default function TodayView() {
  const { data, error, log } = useHabits(TODAY_OPTIONS)
  const [params, setParams] = useSearchParams()
  const [qty, setQty] = useState(null)
  const navigate = useNavigate()

  if (error) return <Frame><p className="group-foot is-error">{error}</p></Frame>
  if (!data) return <Frame><p className="muted-line">Chargement…</p></Frame>

  const { habits, categories, ctx, today, reviews } = data
  const date = params.get('jour') && params.get('jour') <= today ? params.get('jour') : today
  const go = (n) => {
    const d = addDays(date, n)
    setParams(d === today ? {} : { jour: d })
  }
  const catById = Object.fromEntries(categories.map((c) => [c.id, c]))
  const items = sortHabits(habits.filter((h) => isVisibleOn(h, date, ctx)), categories).map((h) => todayItem(h, date, ctx))

  if (!habits.length) {
    return (
      <Frame>
        <div className="callout tip">
          <span className="callout-icon"><Icon name="habitudes" size={20} /></span>
          <div>
            <p className="callout-lead">Crée tes habitudes</p>
            <p className="callout-text">Oui/non, quantité avec un objectif ou « à éviter » ; tous les jours, X fois par semaine ou par mois, tâche du mois ou défi de 30 jours. Certaines se cochent toutes seules grâce au Sport et à l’Alimentation.</p>
          </div>
        </div>
        <Link to="/habitudes/gerer/nouvelle" className="btn-primary btn-link">Nouvelle habitude</Link>
        <h2 className="group-title">Idées pour démarrer</h2>
        <div className="chips left">
          {SUGGESTIONS.map((s) => (
            <button key={s.name} type="button" className="chip" onClick={() => navigate(`/habitudes/gerer/nouvelle?idee=${encodeURIComponent(s.name)}`)}>
              {s.emoji} {s.name}
            </button>
          ))}
        </div>
      </Frame>
    )
  }

  const counted = items.filter((i) => !i.paused && !i.progress)
  const doneCount = counted.filter((i) => i.status === 'done').length
  const allPaused = isPaused({ id: null }, date, { pauses: data.pauses.filter((p) => !p.habit_id) })
  const week = mondayOf(today)
  const reviewDue = date === today && dayOfWeek(today) === 6 && new Date().getHours() >= 18 && !reviews.some((r) => r.week_start === week)
  const goal = reviews.find((r) => r.goal && (r.week_start === week || r.week_start === addDays(week, -7)))

  return (
    <Frame>
      <div className="week-switch">
        <button className="icon-btn" onClick={() => go(-1)} aria-label="Jour précédent"><Icon name="back" size={20} stroke={2} /></button>
        <div className="week-label">
          <strong>{date === today ? 'Aujourd’hui' : date === addDays(today, -1) ? 'Hier' : longDay(date)}</strong>
          {date === today ? <span>{longDay(date)}</span> : <button className="link-btn" onClick={() => setParams({})}>Revenir à aujourd’hui</button>}
        </div>
        <button className="icon-btn" onClick={() => go(1)} aria-label="Jour suivant" disabled={date >= today}><Icon name="chevron" size={20} stroke={2} /></button>
      </div>

      {counted.length > 0 && (
        <div className="week-progress" aria-label={`${doneCount} habitudes faites sur ${counted.length}`}>
          <div className="week-bar habit-bar"><span style={{ width: `${(doneCount / counted.length) * 100}%` }} /></div>
          <span>{doneCount}/{counted.length} faites</span>
        </div>
      )}

      {allPaused && <p className="callout"><Icon name="pause" size={18} /> Pause en cours : rien n’est compté comme raté.</p>}

      {reviewDue && (
        <Link to="/habitudes/bilans?bilan=1" className="callout tip proposal-link">
          <span className="callout-icon"><Icon name="star" size={20} /></span>
          <div>
            <p className="callout-lead">C’est dimanche : fais le bilan de ta semaine</p>
            <p className="callout-text">3 questions, 2 minutes, et ton objectif pour la semaine qui vient.</p>
          </div>
        </Link>
      )}
      {goal && !reviewDue && date === today && (
        <p className="habit-goal"><strong>Objectif de la semaine :</strong> {goal.goal}</p>
      )}

      {MOMENTS.map(([key, label]) => {
        const list = items.filter((i) => i.habit.moment === key)
        if (!list.length) return null
        return (
          <section key={key}>
            <h2 className="day-head">{label}</h2>
            <ul className="group habit-list">
              {list.map((it) => (
                <li key={it.habit.id}>
                  <HabitRow item={it} date={date} cat={catById[it.habit.category_id]} ctx={ctx} onLog={log}
                    onOpen={(i) => (i.habit.kind === 'quantity' ? setQty(i) : navigate(`/habitudes/gerer/${i.habit.id}`))} />
                </li>
              ))}
            </ul>
          </section>
        )
      })}
      {!items.length && <p className="muted-line">Rien de prévu ce jour-là.</p>}

      <p className="group-foot">Un jour raté par semaine est couvert par un joker : ta série continue. La journée se termine à 3 h du matin.</p>

      {qty && (
        <QuantitySheet item={qty} onClose={() => setQty(null)}
          onSave={(v) => {
            log(qty.habit, date, v)
            setQty(null)
          }} />
      )}
    </Frame>
  )
}

function Frame({ children }) {
  return (
    <div className="page food habits">
      <h1 className="large-title">Habitudes</h1>
      <HabitsNav />
      {children}
    </div>
  )
}

export function QuantitySheet({ item, onClose, onSave }) {
  const h = item.habit
  const [v, setV] = useState(String(item.value || '').replace('.', ','))
  const step = Number(h.step) || 1
  const num = Number(v.replace(',', '.')) || 0
  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div className="sheet form-sheet" role="dialog" aria-label={h.name} onClick={(e) => e.stopPropagation()}>
        <form onSubmit={(e) => { e.preventDefault(); onSave(num) }}>
          <p className="sheet-title">{h.emoji ? `${h.emoji} ` : ''}{h.name}</p>
          <p className="muted-line">Objectif : {fmt(h.target)} {h.unit}</p>
          <div className="qty-quick">
            {[-step, step, step * 2].map((d) => (
              <button key={d} type="button" className="chip" onClick={() => setV(String(Math.max(0, Math.round((num + d) * 100) / 100)).replace('.', ','))}>
                {d > 0 ? '+' : '−'}{fmt(Math.abs(d))} {h.unit}
              </button>
            ))}
          </div>
          <ul className="group">
            <li className="row row-field">
              <label className="row-label" htmlFor="hq">Aujourd’hui</label>
              <input id="hq" inputMode="decimal" autoFocus value={v} onChange={(e) => setV(e.target.value)} placeholder="0" />
              <span className="row-value">{h.unit}</span>
            </li>
          </ul>
          <button className="btn-primary" type="submit">Enregistrer</button>
          <button type="button" className="btn-plain" onClick={onClose}>Annuler</button>
        </form>
      </div>
    </div>
  )
}
