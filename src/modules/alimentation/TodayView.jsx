import { useCallback, useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import Icon from '../../components/Icon'
import { loadDay, logsFor, copyMeal, updateLog, removeLog, resolveRef, setFavorite, loadPlanRange, eatPlan, autoPropose, plansBetween } from './api'
import { MEALS, sumLogs, logTime } from './data'
import { Rings, MacroBar, FoodNav, fmt } from './ui'
import QuantitySheet from './QuantitySheet'
import { EntrySheet } from './PlanView'
import { keyOf, parseDay, mondayOf } from '../sport/planner'

const fmtDay = new Intl.DateTimeFormat('fr-BE', { weekday: 'long', day: 'numeric', month: 'long' })
const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1)
const shift = (key, n) => {
  const d = parseDay(key)
  d.setDate(d.getDate() + n)
  return keyOf(d)
}

// Écran « Aujourd'hui » : cible du jour (selon les séances sport), anneaux, repas.
export default function TodayView() {
  const [params, setParams] = useSearchParams()
  const today = keyOf(new Date())
  const date = params.get('date') || today
  const [day, setDay] = useState(null)
  const [yesterday, setYesterday] = useState([])
  const [editing, setEditing] = useState(null) // { log, item }
  const [plan, setPlan] = useState(null)
  const [entry, setEntry] = useState(null)
  const [nextWeek, setNextWeek] = useState(null)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    try {
      const auto = date === today ? await autoPropose(today).catch(() => null) : null
      const [d, y, p] = await Promise.all([loadDay(date, { today }), logsFor(shift(date, -1)), loadPlanRange([date])])
      if (date === today && (parseDay(today).getDay() === 0)) {
        const monday = shift(today, 1)
        const n = auto?.monday === monday ? auto.count : (await plansBetween(monday, shift(monday, 6))).length
        setNextWeek({ monday, count: n })
      } else setNextWeek(null)
      setDay(d)
      setYesterday(y)
      setPlan(p.days[date])
    } catch (e) {
      setError(e.message)
    }
  }, [date, today])

  useEffect(() => {
    setDay(null)
    load()
  }, [load])

  const go = (n) => {
    const next = shift(date, n)
    setDay(null)
    setParams(next === today ? {} : { date: next })
  }

  const totals = day ? sumLogs(day.logs) : null
  const t = day?.target

  async function openLog(log) {
    const item = (log.ref && (await resolveRef(log.ref))) || {
      ref: log.ref, name: log.name, kcal: (log.kcal / log.grams) * 100, protein: (log.protein / log.grams) * 100,
      carbs: (log.carbs / log.grams) * 100, fat: (log.fat / log.grams) * 100, portions: []
    }
    setEditing({ log, item })
  }

  return (
    <div className="page food">
      <header className="sport-head">
        <h1 className="large-title">Alimentation</h1>
        <Link to="reglages" className="icon-btn" aria-label="Réglages alimentation"><Icon name="settings" size={22} /></Link>
      </header>
      <FoodNav />

      <div className="week-switch">
        <button className="icon-btn" onClick={() => go(-1)} aria-label="Jour précédent"><Icon name="back" size={20} stroke={2} /></button>
        <div className="week-label">
          <strong>{date === today ? 'Aujourd’hui' : date === shift(today, -1) ? 'Hier' : date === shift(today, 1) ? 'Demain' : cap(fmtDay.format(parseDay(date)))}</strong>
          {date !== today ? (
            <button className="link-btn" onClick={() => { setDay(null); setParams({}) }}>Revenir à aujourd’hui</button>
          ) : (
            <span>{cap(fmtDay.format(parseDay(date)))}</span>
          )}
        </div>
        <button className="icon-btn" onClick={() => go(1)} aria-label="Jour suivant"><Icon name="chevron" size={20} stroke={2} /></button>
      </div>

      {error && <p className="group-foot is-error">{error}</p>}
      {!day && !error && <p className="muted-line">Calcul de ta journée…</p>}

      {day && (
        <div className="today-grid">
          <div className="today-side">
          <section className="food-card" aria-label="Bilan du jour">
            <Rings kcal={totals.kcal} kcalTarget={t.kcal} protein={totals.protein} proteinTarget={t.protein} />
            <div className="food-card-main">
              <div className="ring-stat">
                <span className="ring-dot" style={{ background: 'var(--green)' }} />
                <div>
                  <p className="ring-label">Calories</p>
                  <p className="ring-value"><strong>{fmt(totals.kcal)}</strong> / {fmt(t.kcal)}</p>
                  <p className="ring-left">{totals.kcal <= t.kcal ? `Reste ${fmt(t.kcal - totals.kcal)} kcal` : `${fmt(totals.kcal - t.kcal)} kcal au-dessus`}</p>
                </div>
              </div>
              <div className="ring-stat">
                <span className="ring-dot" style={{ background: 'var(--blue)' }} />
                <div>
                  <p className="ring-label">Protéines</p>
                  <p className="ring-value"><strong>{fmt(totals.protein)}</strong> / {fmt(t.protein)} g</p>
                </div>
              </div>
            </div>
          </section>
          <div className="macros">
            <MacroBar label="Glucides" value={totals.carbs} target={t.carbs} color="var(--yellow)" />
            <MacroBar label="Lipides" value={totals.fat} target={t.fat} color="var(--purple)" />
          </div>
          <p className="target-line">
            Cible : base {fmt(t.base)} + surplus {fmt(t.surplus)}
            {t.training.map((x, i) => (
              <span key={i}> + {x.label.replace(/ —.*/, '')} {fmt(x.kcal)}{x.real ? ' (réel)' : ''}</span>
            ))}
            {t.adjust ? ` ${t.adjust > 0 ? '+' : '−'} ajustement ${fmt(Math.abs(t.adjust))}` : ''} = <strong>{fmt(t.kcal)} kcal</strong>
          </p>

          {nextWeek && (
            <Link to={`planning?semaine=${nextWeek.monday}`} className="callout tip proposal-link">
              <span className="callout-icon"><Icon name="sparkle" size={20} /></span>
              <div>
                <p className="callout-lead">{nextWeek.count ? 'Les menus de la semaine prochaine sont prêts' : 'Prépare les menus de la semaine prochaine'}</p>
                <p className="callout-text">
                  {nextWeek.count
                    ? `${nextWeek.count} repas proposés selon ton sport et tes midis à l’école. Vérifie-les, puis la liste de courses de lundi se fait toute seule.`
                    : 'Crée au moins un plat en lot (2 portions ou plus) dans Recettes pour que je propose les menus.'}
                </p>
              </div>
            </Link>
          )}

          {day.tips.map((tip, i) => (
            <div className="callout tip" key={i}>
              <span className="callout-icon"><Icon name="bolt" size={20} /></span>
              <div>
                <p className="callout-lead">{tip.title}</p>
                <p className="callout-text">{tip.text}</p>
              </div>
            </div>
          ))}

          {date === today && ((parseDay(date).getDay() + 6) % 7 === Number(day.settings.weigh_day ?? 5) || day.weighedToday) && (
            <ul className="group weigh-row">
              <li>
                <Link to="poids" className="row">
                  <Icon name="scale" size={20} />
                  <span className="row-label">{day.weighedToday ? 'Pesée du jour' : 'C’est samedi : pèse-toi ce matin'}</span>
                  <span className="row-value">{day.weighedToday ? `${fmt(day.weighedToday.kg, 1)} kg` : 'Noter'}</span>
                  <span className="row-chevron"><Icon name="chevron" size={16} /></span>
                </Link>
              </li>
            </ul>
          )}

          </div>
          <div className="today-meals">
          {MEALS.map((m) => {
            const list = day.logs.filter((l) => l.meal === m.key)
            const planned = (plan?.entries || []).filter((e) => e.meal === m.key && !e.eaten)
            const sum = sumLogs(list)
            const prev = yesterday.filter((l) => l.meal === m.key)
            return (
              <section key={m.key} className="meal">
                <h2 className="day-head meal-head">
                  <span>{m.name}</span>
                  {list.length > 0 && <span className="meal-kcal">{fmt(sum.kcal)} kcal · {fmt(sum.protein)} g prot.</span>}
                </h2>
                <ul className="group">
                  {planned.map((e) => (
                    <li key={e.id} className="plan-row">
                      <button className="row food-row" onClick={() => setEntry(e)}>
                        <span className="food-main">
                          <span className="food-name">{e.recipe.name}</span>
                          <span className="food-sub">
                            {e.cook ? 'À cuisiner en lot' : e.box ? 'Boîte à emporter' : 'Prévu'} · {fmt(e.totals.kcal)} kcal · {fmt(e.totals.protein)} g prot.
                            {e.lines.some((x) => x.scaled) && ' · portion ajustée'}
                          </span>
                        </span>
                      </button>
                      <button className="pill pill-small pill-strong" onClick={async () => { await eatPlan(e); load() }}>Mangé</button>
                    </li>
                  ))}
                  {list.map((l) => (
                    <li key={l.id}>
                      <button className="row food-row" onClick={() => openLog(l)}>
                        <span className="food-main">
                          <span className="food-name">{l.name}</span>
                          <span className="food-sub">{logTime(l) && <span className="log-time">{logTime(l)} · </span>}{fmt(l.grams)} g · {fmt(l.protein, 1)} g prot.</span>
                        </span>
                        <span className="row-value">{fmt(l.kcal)}</span>
                      </button>
                    </li>
                  ))}
                  {!list.length && !planned.length && prev.length > 0 && (
                    <li>
                      <button
                        className="row row-action"
                        onClick={async () => {
                          await copyMeal(shift(date, -1), date, m.key)
                          load()
                        }}
                      >
                        <Icon name="refresh" size={18} /> Comme hier · {prev.length} aliment{prev.length > 1 ? 's' : ''}, {fmt(sumLogs(prev).kcal)} kcal
                      </button>
                    </li>
                  )}
                  <li>
                    <Link to={`ajouter?repas=${m.key}${date !== today ? `&date=${date}` : ''}`} className="row row-action">
                      <Icon name="plus" size={18} stroke={2} /> Ajouter
                    </Link>
                  </li>
                </ul>
              </section>
            )
          })}
          </div>
        </div>
      )}

      {entry && (
        <EntrySheet
          entry={entry}
          dates={Array.from({ length: 7 }, (_, i) => shift(mondayOf(parseDay(date)), i))}
          today={today}
          onClose={() => setEntry(null)}
          onChange={() => { setEntry(null); load() }}
        />
      )}

      {editing && (
        <QuantitySheet
          item={editing.item}
          grams={Number(editing.log.grams)}
          meal={editing.log.meal}
          mode="edit"
          onClose={() => setEditing(null)}
          onFavorite={editing.item.source && editing.item.source !== 'recipe' ? (fav) => setFavorite(editing.item, fav) : null}
          onDelete={async () => {
            await removeLog(editing.log.id)
            setEditing(null)
            load()
          }}
          onSubmit={async ({ grams, meal }) => {
            await updateLog(editing.log, { grams, meal, item: editing.item.ref ? editing.item : null })
            setEditing(null)
            load()
          }}
        />
      )}
    </div>
  )
}
