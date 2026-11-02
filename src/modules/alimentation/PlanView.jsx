import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import Icon from '../../components/Icon'
import { loadPlanRange, addPlan, updatePlan, removePlan, eatPlan, uneatPlan, plansBetween } from './api'
import { MEALS, DAY_NAMES } from './data'
import { categoryFor } from './seed'
import { qtyLabel } from './plan'
import { FoodNav, fmt, euro } from './ui'
import { RecipeChooser } from './sheets'
import { mondayOf, parseDay, keyOf } from '../sport/planner'

const shift = (key, n) => {
  const d = parseDay(key)
  d.setDate(d.getDate() + n)
  return keyOf(d)
}
const fmtRange = new Intl.DateTimeFormat('fr-BE', { day: 'numeric', month: 'long' })
const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1)

// Planning de la semaine : une recette par repas, glissée d'un repas à l'autre,
// portions de féculents ajustées à la cible de chaque jour.
export default function PlanView() {
  const today = keyOf(new Date())
  const [weekStart, setWeekStart] = useState(mondayOf(new Date()))
  const [data, setData] = useState(null)
  const [choose, setChoose] = useState(null) // { date, meal }
  const [entry, setEntry] = useState(null)
  const [batch, setBatch] = useState(null) // { plan, recipe }
  const [drag, setDrag] = useState(null)
  const [over, setOver] = useState(null)
  const dates = Array.from({ length: 7 }, (_, i) => shift(weekStart, i))

  const load = useCallback(async () => {
    setData(await loadPlanRange(Array.from({ length: 7 }, (_, i) => shift(weekStart, i))))
  }, [weekStart])

  useEffect(() => {
    setData(null)
    load()
  }, [load])

  async function pick(recipe) {
    const plan = await addPlan({ date: choose.date, meal: choose.meal, recipe_id: recipe.id })
    setChoose(null)
    if (recipe.batch && Number(recipe.servings) > 1) setBatch({ plan, recipe })
    load()
  }

  // Place les autres portions d'un plat en lot dans les repas libres suivants.
  async function fillBatch(meals) {
    const { plan, recipe } = batch
    let left = Number(recipe.servings) - 1
    const all = await plansBetween(plan.date, shift(plan.date, 13))
    const taken = new Set(all.map((p) => `${p.date}:${p.meal}`))
    for (let d = 0; d < 14 && left > 0; d++) {
      const date = shift(plan.date, d)
      for (const meal of meals) {
        if (left <= 0) break
        if (d === 0 && meal <= plan.meal) continue
        if (taken.has(`${date}:${meal}`)) continue
        await addPlan({ date, meal, recipe_id: recipe.id })
        left--
      }
    }
    setBatch(null)
    load()
  }

  async function drop(date, meal) {
    setOver(null)
    if (!drag) return
    await updatePlan(drag.id, { date, meal })
    setDrag(null)
    load()
  }

  async function copyLastWeek() {
    const prev = await plansBetween(shift(weekStart, -7), shift(weekStart, -1))
    for (const p of prev) await addPlan({ date: shift(p.date, 7), meal: p.meal, recipe_id: p.recipe_id, servings: Number(p.servings) })
    load()
  }

  const weekCost = data ? Object.values(data.days).reduce((t, d) => t + d.entries.reduce((s, e) => s + (e.totals?.cost || 0), 0), 0) : 0
  const empty = data && Object.values(data.days).every((d) => !d.entries.length)

  return (
    <div className="page food">
      <h1 className="large-title">Alimentation</h1>
      <FoodNav />

      <div className="week-switch">
        <button className="icon-btn" onClick={() => setWeekStart(shift(weekStart, -7))} aria-label="Semaine précédente"><Icon name="back" size={20} stroke={2} /></button>
        <div className="week-label">
          <strong>{fmtRange.format(parseDay(weekStart))} – {fmtRange.format(parseDay(dates[6]))}</strong>
          {weekStart !== mondayOf(new Date())
            ? <button className="link-btn" onClick={() => setWeekStart(mondayOf(new Date()))}>Revenir à cette semaine</button>
            : <span>Cette semaine{data && !empty ? ` · repas prévus ≈ ${euro(weekCost)}` : ''}</span>}
        </div>
        <button className="icon-btn" onClick={() => setWeekStart(shift(weekStart, 7))} aria-label="Semaine suivante"><Icon name="chevron" size={20} stroke={2} /></button>
      </div>

      {!data && <p className="muted-line">Préparation du planning…</p>}
      {empty && (
        <div className="callout">
          <span className="callout-icon"><Icon name="info" size={20} /></span>
          <div>
            <p className="callout-text">Touche « + » dans un repas pour y mettre une recette. Les plats en lot proposent de remplir les jours suivants. Sur ordinateur, tu peux glisser une recette d’un repas à l’autre.</p>
            <button className="link-btn" onClick={copyLastWeek}>Reprendre le planning de la semaine dernière</button>
          </div>
        </div>
      )}

      {data && dates.map((date, i) => {
        const day = data.days[date]
        const t = day.target
        const gap = day.gap
        return (
          <section key={date} className={date === today ? 'plan-day is-today' : date < today ? 'plan-day is-past' : 'plan-day'}>
            <h2 className="day-head plan-head">
              <span>{cap(DAY_NAMES[i])} <span className="day-num">{parseDay(date).getDate()}</span></span>
              <span className="plan-kcal">cible {fmt(t.kcal)} kcal{t.training.length ? ` (${t.training.map((x) => x.label.replace(/ —.*/, '')).join(', ')})` : ''}</span>
            </h2>
            <div className="group plan-grid">
              {MEALS.map((m) => {
                const list = day.entries.filter((e) => e.meal === m.key)
                const slot = `${date}:${m.key}`
                return (
                  <div
                    key={m.key}
                    className={over === slot ? 'plan-meal is-over' : 'plan-meal'}
                    onDragOver={(e) => { e.preventDefault(); setOver(slot) }}
                    onDragLeave={() => setOver(null)}
                    onDrop={(e) => { e.preventDefault(); drop(date, m.key) }}
                  >
                    <span className="plan-meal-name">{m.short}</span>
                    <div className="plan-entries">
                      {list.map((e) => (
                        <button
                          key={e.id}
                          className={e.eaten ? 'plan-chip is-eaten' : 'plan-chip'}
                          draggable
                          onDragStart={() => setDrag(e)}
                          onDragEnd={() => { setDrag(null); setOver(null) }}
                          onClick={() => setEntry(e)}
                        >
                          {e.eaten && <Icon name="check" size={13} stroke={2.6} />}
                          <span className="plan-chip-name">{e.recipe.name}</span>
                          <span className="plan-chip-kcal">{e.eaten ? 'mangé' : `${fmt(e.totals.kcal)} kcal`}{e.servings !== 1 ? ` · ×${String(e.servings).replace('.', ',')}` : ''}</span>
                        </button>
                      ))}
                      <button className="plan-add" aria-label={`Ajouter au ${m.name.toLowerCase()} du ${DAY_NAMES[i]}`} onClick={() => setChoose({ date, meal: m.key })}>
                        <Icon name="plus" size={16} stroke={2.2} />
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
            {day.entries.length > 0 && (
              <p className={Math.abs(gap) > 250 ? 'plan-foot is-warn' : 'plan-foot'}>
                Prévu {fmt(day.plannedKcal + day.eatenKcal)} kcal
                {day.factor !== 1 && ` · féculents ×${String(day.factor).replace('.', ',')}`}
                {gap > 250 && ` · il manque ${fmt(gap)} kcal : ajoute une collation`}
                {gap < -250 && ` · ${fmt(-gap)} kcal de trop`}
              </p>
            )}
          </section>
        )
      })}

      {choose && data && (
        <RecipeChooser
          title={`${MEALS[choose.meal].name} · ${DAY_NAMES[dates.indexOf(choose.date)]}`}
          recipes={data.recipes}
          ingById={data.ingById}
          category={categoryFor(choose.meal)}
          onPick={pick}
          onClose={() => setChoose(null)}
        />
      )}

      {batch && (
        <div className="sheet-backdrop" onClick={() => setBatch(null)}>
          <div className="sheet" role="dialog" aria-label="Plat en lot" onClick={(e) => e.stopPropagation()}>
            <p className="sheet-title">{batch.recipe.name} : {batch.recipe.servings} portions</p>
            <p className="sheet-text">Placer aussi les {batch.recipe.servings - 1} autres portions dans les repas libres suivants ?</p>
            <button className="btn-primary" onClick={() => fillBatch([1])}>Les midis suivants</button>
            <button className="btn-secondary" onClick={() => fillBatch([1, 3])}>Midis et soirs suivants</button>
            <button className="btn-secondary" onClick={() => fillBatch([3])}>Les soirs suivants</button>
            <button className="btn-plain" onClick={() => setBatch(null)}>Non, juste celle-ci</button>
          </div>
        </div>
      )}

      {entry && (
        <EntrySheet
          entry={entry}
          dates={dates}
          today={today}
          onClose={() => setEntry(null)}
          onChange={() => { setEntry(null); load() }}
        />
      )}
    </div>
  )
}

// Détail d'un repas prévu : quantités du jour, portions, déplacer, retirer.
export function EntrySheet({ entry, dates, today, onClose, onChange }) {
  const [servings, setServings] = useState(entry.servings)
  const [move, setMove] = useState(null)
  const t = entry.totals

  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div className="sheet" role="dialog" aria-label={entry.recipe.name} onClick={(e) => e.stopPropagation()}>
        <p className="sheet-title">{entry.recipe.name}</p>
        {entry.eaten ? (
          <p className="sheet-text">Déjà noté dans ton journal.</p>
        ) : (
          <>
            <p className="qty-per100">
              {fmt(t.kcal)} kcal · {fmt(t.protein)} g prot. · {fmt(t.carbs)} g gluc. · {fmt(t.fat)} g lip. · {euro(t.cost)}
            </p>
            <ul className="group lines">
              {entry.lines.map((l, i) => (
                <li key={i} className="row">
                  <span className="row-label">{l.ing.name}</span>
                  <span className={l.scaled ? 'row-value is-scaled' : 'row-value'}>{qtyLabel(l.ing, l.grams)}</span>
                </li>
              ))}
            </ul>
            {entry.lines.some((l) => l.scaled) && <p className="group-foot">En bleu : quantité ajustée à ta cible du jour.</p>}
            <div className="field servings-field">
              <span>Portions</span>
              <div className="segmented small">
                {[0.5, 1, 1.5, 2].map((v) => (
                  <button key={v} className={servings === v ? 'is-on' : ''} onClick={async () => { setServings(v); await updatePlan(entry.id, { servings: v }); onChange() }}>
                    {String(v).replace('.', ',')}
                  </button>
                ))}
              </div>
            </div>
          </>
        )}

        {move ? (
          <div className="move">
            <div className="chips left">
              {dates.map((d) => (
                <button key={d} className={move.date === d ? 'chip is-on' : 'chip'} onClick={() => setMove({ ...move, date: d })}>
                  {DAY_NAMES[(parseDay(d).getDay() + 6) % 7].slice(0, 3)} {parseDay(d).getDate()}
                </button>
              ))}
            </div>
            <div className="segmented meal-seg">
              {MEALS.map((m) => (
                <button key={m.key} className={move.meal === m.key ? 'is-on' : ''} onClick={() => setMove({ ...move, meal: m.key })}>{m.short}</button>
              ))}
            </div>
            <button className="btn-primary" onClick={async () => { await updatePlan(entry.id, { date: move.date, meal: move.meal }); onChange() }}>Déplacer ici</button>
          </div>
        ) : (
          <>
            {entry.date <= today && (
              <button className="btn-primary" onClick={async () => { await (entry.eaten ? uneatPlan(entry) : eatPlan(entry)); onChange() }}>
                {entry.eaten ? 'Retirer du journal' : 'Je l’ai mangé'}
              </button>
            )}
            {!entry.eaten && <button className="btn-secondary" onClick={() => setMove({ date: entry.date, meal: entry.meal })}>Déplacer</button>}
            <Link className="btn-plain as-link" to={`/alimentation/recettes/${entry.recipe.id}`}>Voir la recette</Link>
            <button className="btn-plain danger" onClick={async () => { if (entry.eaten) await uneatPlan(entry); await removePlan(entry.id); onChange() }}>Retirer du planning</button>
          </>
        )}
        <button className="btn-plain" onClick={onClose}>Fermer</button>
      </div>
    </div>
  )
}
