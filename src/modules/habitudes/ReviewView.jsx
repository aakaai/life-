import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import Icon from '../../components/Icon'
import { HabitsNav, useHabits, catColor, shortDay, fmt } from './ui'
import { addDays, mondayOf, firstOfMonth, lastOfMonth, rate, globalRate, sortHabits, isActive, dayOfWeek } from './logic'
import { saveReview } from './api'

const fmtMonth = new Intl.DateTimeFormat('fr-BE', { month: 'long', year: 'numeric' })
const monthName = (key) => fmtMonth.format(new Date(Number(key.slice(0, 4)), Number(key.slice(5, 7)) - 1, 1))
const pct = (r) => (r.total ? Math.round((r.done / r.total) * 100) : null)

// Bilans : taux de réussite (semaine / mois, comparé à la période d'avant) et bilan guidé du dimanche.
export default function ReviewView() {
  const { data, error, reload } = useHabits()
  const [params, setParams] = useSearchParams()
  const [mode, setMode] = useState('week')
  const [offset, setOffset] = useState(0)
  const [editing, setEditing] = useState(null)

  if (error) return <Frame><p className="group-foot is-error">{error}</p></Frame>
  if (!data) return <Frame><p className="muted-line">Chargement…</p></Frame>
  const { habits, categories, ctx, today, reviews } = data

  // période affichée et période d'avant
  let from
  let to
  let pFrom
  let pTo
  let title
  if (mode === 'week') {
    from = addDays(mondayOf(today), 7 * offset)
    to = addDays(from, 6)
    pFrom = addDays(from, -7)
    pTo = addDays(to, -7)
    title = offset === 0 ? 'Cette semaine' : offset === -1 ? 'La semaine dernière' : `Semaine du ${shortDay(from)}`
  } else {
    let m = firstOfMonth(today)
    for (let i = 0; i < -offset; i++) m = firstOfMonth(addDays(m, -1))
    from = m
    to = lastOfMonth(m)
    pFrom = firstOfMonth(addDays(m, -1))
    pTo = lastOfMonth(pFrom)
    title = offset === 0 ? 'Ce mois-ci' : monthName(m)
  }
  const list = sortHabits(habits.filter((h) => !h.archived && h.start_date <= to && (!h.end_date || h.end_date >= from)), categories)
  const now = globalRate(list, from, to, ctx)
  const before = globalRate(list.filter((h) => isActive(h, pTo) || h.start_date <= pTo), pFrom, pTo, ctx)
  const rows = list
    .map((h) => ({ h, r: rate(h, from, to, ctx), p: rate(h, pFrom, pTo, ctx) }))
    .filter((x) => x.r.total)
    .sort((a, b) => (pct(b.r) ?? 0) - (pct(a.r) ?? 0))
  const delta = now.total && before.total ? Math.round((now.pct - before.pct) * 100) : null
  const week = mondayOf(today)
  const thisReview = reviews.find((r) => r.week_start === week)
  const openReview = editing || (params.get('bilan') ? { week_start: week, ...(thisReview || {}) } : null)
  const catById = Object.fromEntries(categories.map((c) => [c.id, c]))

  return (
    <Frame>
      <div className="segmented wide" role="radiogroup" aria-label="Période">
        <button type="button" role="radio" aria-checked={mode === 'week'} className={mode === 'week' ? 'is-on' : ''} onClick={() => { setMode('week'); setOffset(0) }}>Semaine</button>
        <button type="button" role="radio" aria-checked={mode === 'month'} className={mode === 'month' ? 'is-on' : ''} onClick={() => { setMode('month'); setOffset(0) }}>Mois</button>
      </div>
      <div className="week-switch">
        <button className="icon-btn" onClick={() => setOffset(offset - 1)} aria-label="Période précédente"><Icon name="back" size={20} stroke={2} /></button>
        <div className="week-label"><strong>{title}</strong><span>du {shortDay(from)} au {shortDay(to)}</span></div>
        <button className="icon-btn" onClick={() => setOffset(offset + 1)} aria-label="Période suivante" disabled={offset >= 0}><Icon name="chevron" size={20} stroke={2} /></button>
      </div>

      <div className="kpis three">
        <div className="kpi">
          <span className="kpi-label">Réussite</span>
          <strong className="kpi-value">{now.total ? `${Math.round(now.pct * 100)} %` : '—'}</strong>
          <span className="kpi-sub">{delta == null ? 'Pas de comparaison' : `${delta > 0 ? '+' : delta < 0 ? '−' : '±'}${Math.abs(delta)} pts vs ${mode === 'week' ? 'semaine' : 'mois'} d’avant`}</span>
        </div>
        <div className="kpi"><span className="kpi-label">Réussites</span><strong className="kpi-value">{fmt(now.done, 0)} / {now.total}</strong><span className="kpi-sub">jours, semaines ou mois tenus</span></div>
        <div className="kpi"><span className="kpi-label">Habitudes</span><strong className="kpi-value">{rows.filter((x) => pct(x.r) === 100).length} / {rows.length}</strong><span className="kpi-sub">tenues à 100 %</span></div>
      </div>

      <h2 className="group-title">Par habitude</h2>
      {rows.length ? (
        <ul className="group">
          {rows.map(({ h, r, p }) => {
            const v = pct(r)
            const d = p.total ? v - pct(p) : null
            return (
              <li key={h.id} className="row rate-row">
                <span className="row-main">
                  <span className="row-label">{h.emoji ? `${h.emoji} ` : ''}{h.name}</span>
                  <span className="rate-bar" style={{ '--c': catColor(catById[h.category_id]) }} role="img" aria-label={`${v} %`}><span style={{ width: `${v}%` }} /></span>
                </span>
                <span className="rate-value">
                  <strong>{v} %</strong>
                  <small>{fmt(r.done, 1)} / {r.total}{d != null && d !== 0 ? ` · ${d > 0 ? '+' : '−'}${Math.abs(d)} pts` : ''}</small>
                </span>
              </li>
            )
          })}
        </ul>
      ) : (
        <p className="muted-line">Rien à compter sur cette période.</p>
      )}
      <p className="group-foot">Les jours en pause et la journée en cours (pas encore cochée) ne comptent pas. Un joker compte comme raté ici, mais ne casse pas la série.</p>

      <h2 className="group-title">Bilan du dimanche</h2>
      <ul className="group">
        <li>
          <button type="button" className="row row-action" onClick={() => setEditing({ week_start: week, ...(thisReview || {}) })}>
            <Icon name="star" size={18} stroke={2} /> {thisReview ? 'Modifier le bilan de cette semaine' : dayOfWeek(today) >= 5 ? 'Faire le bilan de la semaine' : 'Faire le bilan de la semaine (prévu dimanche)'}
          </button>
        </li>
        {reviews.map((r) => (
          <li key={r.id}>
            <button type="button" className="row" onClick={() => setEditing(r)}>
              <span className="row-main">
                <span className="row-label">Semaine du {shortDay(r.week_start)}{r.rating ? ` · ${'★'.repeat(r.rating)}${'☆'.repeat(5 - r.rating)}` : ''}</span>
                <span className="row-sub">{r.goal ? `Objectif : ${r.goal}` : r.went_well || 'Sans objectif'}</span>
              </span>
              <span className="row-chevron"><Icon name="chevron" size={16} /></span>
            </button>
          </li>
        ))}
      </ul>

      {openReview && (
        <ReviewSheet
          review={openReview}
          summary={globalRate(list, openReview.week_start, addDays(openReview.week_start, 6), ctx)}
          onClose={() => { setEditing(null); if (params.get('bilan')) setParams({}) }}
          onDone={() => { setEditing(null); if (params.get('bilan')) setParams({}); reload() }}
        />
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

function ReviewSheet({ review, summary, onClose, onDone }) {
  const [r, setR] = useState({ went_well: '', blocked: '', goal: '', rating: 0, ...review })
  const [error, setError] = useState('')
  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div className="sheet form-sheet" role="dialog" aria-label="Bilan de la semaine" onClick={(e) => e.stopPropagation()}>
        <form onSubmit={async (e) => {
          e.preventDefault()
          try {
            await saveReview(r)
            onDone()
          } catch (err) {
            setError(err.message)
          }
        }}>
          <p className="sheet-title">Semaine du {shortDay(review.week_start)}</p>
          <p className="muted-line">{summary.total ? `Habitudes tenues : ${Math.round(summary.pct * 100)} % (${fmt(summary.done, 0)} sur ${summary.total}).` : 'Pas encore de données cette semaine.'}</p>
          <h3 className="group-title">Ta semaine en une note</h3>
          <div className="stars" role="radiogroup" aria-label="Note de la semaine">
            {[1, 2, 3, 4, 5].map((n) => (
              <button key={n} type="button" role="radio" aria-checked={r.rating === n} aria-label={`${n} sur 5`}
                className={n <= r.rating ? 'star is-on' : 'star'} onClick={() => setR({ ...r, rating: n })}>★</button>
            ))}
          </div>
          <label className="field-label" htmlFor="rw">Qu’est-ce qui a bien marché ?</label>
          <textarea id="rw" className="field-area" rows={2} value={r.went_well || ''} onChange={(e) => setR({ ...r, went_well: e.target.value })} />
          <label className="field-label" htmlFor="rb">Qu’est-ce qui a coincé ?</label>
          <textarea id="rb" className="field-area" rows={2} value={r.blocked || ''} onChange={(e) => setR({ ...r, blocked: e.target.value })} />
          <label className="field-label" htmlFor="rg">Ton objectif pour la semaine qui vient</label>
          <textarea id="rg" className="field-area" rows={2} placeholder="Ex. me coucher avant minuit 5 soirs sur 7" value={r.goal || ''} onChange={(e) => setR({ ...r, goal: e.target.value })} />
          {error && <p className="group-foot is-error">{error}</p>}
          <button className="btn-primary" type="submit">Enregistrer le bilan</button>
          <button type="button" className="btn-plain" onClick={onClose}>Annuler</button>
        </form>
      </div>
    </div>
  )
}
