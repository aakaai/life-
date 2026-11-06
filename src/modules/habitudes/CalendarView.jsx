import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { HabitsNav, useHabits, catColor, longDay, fmt } from './ui'
import { addDays, mondayOf, dayScore, habitCell, streak, rate, globalRate, sortHabits, daysBetween, firstOfMonth, lastOfMonth } from './logic'

const fmtMonth = new Intl.DateTimeFormat('fr-BE', { month: 'short' })
const fmtMonthLong = new Intl.DateTimeFormat('fr-BE', { month: 'long', year: 'numeric' })
const monthLabel = (key) => fmtMonth.format(new Date(Number(key.slice(0, 4)), Number(key.slice(5, 7)) - 1, 1)).replace('.', '')
const ROW_LABELS = ['L', '', 'M', '', 'V', '', '']

// Calendrier : une case par jour sur un an, plus foncée quand plus d'habitudes sont faites.
export default function CalendarView() {
  const { data, error } = useHabits()
  const [sel, setSel] = useState('all')
  const [hover, setHover] = useState(null)
  const scroller = useRef(null)
  const navigate = useNavigate()

  const model = useMemo(() => {
    if (!data) return null
    const { habits, ctx, today, categories } = data
    const habit = sel === 'all' ? null : habits.find((h) => h.id === sel)
    const lastMonday = mondayOf(today)
    const firstMonday = addDays(lastMonday, -52 * 7)
    const weeks = []
    for (let w = firstMonday; w <= lastMonday; w = addDays(w, 7)) {
      weeks.push(Array.from({ length: 7 }, (_, i) => {
        const date = addDays(w, i)
        if (date > today) return { date, kind: 'future', level: 0 }
        if (habit) {
          const c = habitCell(habit, date, ctx)
          return { date, kind: c.status, level: c.level }
        }
        const s = dayScore(habits, date, ctx)
        return { date, kind: s ? 'score' : 'none', level: s ? s.score : 0, s }
      }))
    }
    // mois (tableau « Données ») : 12 derniers mois
    const months = []
    let m = firstOfMonth(today)
    for (let i = 0; i < 12; i++) {
      const end = lastOfMonth(m)
      const r = habit ? rate(habit, m, end, ctx) : globalRate(habits.filter((h) => !h.archived), m, end, ctx)
      const perfect = habit ? null : daysBetween(m, end > today ? today : end).filter((d) => dayScore(habits, d, ctx)?.score === 1).length
      if (r.total) months.push({ m, r, perfect })
      m = firstOfMonth(addDays(m, -1))
    }
    const st = habit ? streak(habit, ctx) : null
    const r30 = habit ? rate(habit, addDays(today, -29), today, ctx) : globalRate(habits.filter((h) => !h.archived), addDays(today, -29), today, ctx)
    const color = habit ? catColor(categories.find((c) => c.id === habit.category_id)) : 'var(--pink)'
    return { weeks, months, st, r30, color, habit, list: sortHabits(habits.filter((h) => !h.archived), categories) }
  }, [data, sel])

  useEffect(() => {
    if (scroller.current) scroller.current.scrollLeft = scroller.current.scrollWidth
  }, [model])

  if (error) return <Frame><p className="group-foot is-error">{error}</p></Frame>
  if (!model) return <Frame><p className="muted-line">Chargement…</p></Frame>
  if (!data.habits.length) return <Frame><p className="muted-line">Crée une habitude dans « Gérer » pour remplir ton calendrier.</p></Frame>

  const { weeks, months, st, r30, color, habit, list } = model
  const pct = (r) => (r.total ? `${Math.round((r.done / r.total) * 100)} %` : '—')
  const describe = (c) => {
    if (!c) return habit ? 'Survole ou touche une case.' : 'Survole ou touche une case : plus elle est foncée, plus tu as tenu d’habitudes ce jour-là.'
    const d = longDay(c.date)
    if (c.kind === 'future') return d
    if (c.kind === 'score') return `${d} : ${c.s.done} / ${c.s.total} habitudes`
    const labels = { done: 'fait', joker: 'raté, couvert par le joker', missed: 'raté', paused: 'en pause', pending: 'pas encore fait', none: 'pas prévu', empty: 'rien noté' }
    return `${d} : ${labels[c.kind] || ''}`
  }
  const cellClass = (c) => {
    if (c.kind === 'future' || c.kind === 'none') return 'hm-cell is-none'
    if (c.kind === 'paused') return 'hm-cell is-paused'
    const step = c.level <= 0 ? 0 : Math.min(4, Math.ceil(c.level * 4))
    return `hm-cell l${step}${c.kind === 'joker' ? ' is-joker' : ''}`
  }

  return (
    <Frame>
      <div className="chips left cat-chips" role="group" aria-label="Habitude">
        <button type="button" className={sel === 'all' ? 'chip is-on' : 'chip'} onClick={() => setSel('all')}>Toutes</button>
        {list.map((h) => (
          <button key={h.id} type="button" className={sel === h.id ? 'chip is-on' : 'chip'} onClick={() => setSel(h.id)}>
            {h.emoji ? `${h.emoji} ` : ''}{h.name}
          </button>
        ))}
      </div>

      <div className="kpis three">
        <div className="kpi"><span className="kpi-label">30 derniers jours</span><strong className="kpi-value">{pct(r30)}</strong><span className="kpi-sub">{fmt(r30.done, 0)} réussites sur {r30.total}</span></div>
        {st ? (
          <>
            <div className="kpi"><span className="kpi-label">Série en cours</span><strong className="kpi-value">{st.current} {st.unit}</strong></div>
            <div className="kpi"><span className="kpi-label">Record</span><strong className="kpi-value">{st.best} {st.unit}</strong></div>
          </>
        ) : (
          <>
            <div className="kpi"><span className="kpi-label">Jours parfaits ce mois-ci</span><strong className="kpi-value">{months[0]?.perfect ?? 0}</strong><span className="kpi-sub">toutes les habitudes du jour tenues</span></div>
            <div className="kpi"><span className="kpi-label">Habitudes suivies</span><strong className="kpi-value">{list.length}</strong><span className="kpi-sub">en cours</span></div>
          </>
        )}
      </div>

      <section className="chart-card hm-card" style={{ '--c': color }}>
        <div className="hm-scroll" ref={scroller}>
          <div className="hm" role="grid" aria-label={habit ? `Calendrier : ${habit.name}` : 'Calendrier de toutes les habitudes'}>
            <div className="hm-months" aria-hidden="true">
              {weeks.map((w, i) => {
                const m = w[0].date.slice(0, 7)
                const prev = i ? weeks[i - 1][0].date.slice(0, 7) : null
                return <span key={i}>{m !== prev && i > 0 ? monthLabel(w[0].date) : ''}</span>
              })}
            </div>
            <div className="hm-body">
              <div className="hm-rows" aria-hidden="true">{ROW_LABELS.map((l, i) => <span key={i}>{l}</span>)}</div>
              {weeks.map((w, i) => (
                <div key={i} className="hm-week" role="row">
                  {w.map((c) => (
                    <button key={c.date} type="button" role="gridcell" className={cellClass(c)} aria-label={describe(c)}
                      disabled={c.kind === 'future'}
                      onPointerEnter={() => setHover(c)} onFocus={() => setHover(c)}
                      onClick={() => (hover?.date === c.date ? navigate(`/habitudes?jour=${c.date}`) : setHover(c))} />
                  ))}
                </div>
              ))}
            </div>
          </div>
        </div>
        <p className="hm-info" aria-live="polite">{describe(hover)}{hover && hover.kind !== 'future' ? ' — touche encore pour ouvrir ce jour.' : ''}</p>
        <div className="hm-legend" aria-hidden="true">
          <span>Moins</span>
          {[0, 1, 2, 3, 4].map((l) => <i key={l} className={`hm-cell l${l}`} />)}
          <span>Plus</span>
          {habit && <><i className="hm-cell l1 is-joker" /><span>joker</span></>}
          <i className="hm-cell is-paused" /><span>pause</span>
        </div>
        {months.length > 0 && (
          <details className="chart-data">
            <summary>Données</summary>
            <div className="chart-table-wrap">
              <table>
                <thead><tr><th>Mois</th><th>Réussite</th><th>Réussites</th>{!habit && <th>Jours parfaits</th>}</tr></thead>
                <tbody>
                  {months.map(({ m, r, perfect }) => (
                    <tr key={m}>
                      <td>{fmtMonthLong.format(new Date(Number(m.slice(0, 4)), Number(m.slice(5, 7)) - 1, 1))}</td>
                      <td>{pct(r)}</td>
                      <td>{fmt(r.done, 0)} / {r.total}</td>
                      {!habit && <td>{perfect}</td>}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </details>
        )}
      </section>
    </Frame>
  )
}

function Frame({ children }) {
  return (
    <div className="page food habits">
      <HabitsNav />
      <h1 className="large-title">Calendrier</h1>
      {children}
    </div>
  )
}
