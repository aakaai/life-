import { useCallback, useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import Icon from '../../components/Icon'
import { loadPlanRange, addPlan, updatePlan, removePlan, eatPlan, uneatPlan, plansBetween, proposeMenus, weeklyReset, planningMonday, changePlanRecipe, listRecipes, listIngredients, indexById } from './api'
import { MEALS, DAY_NAMES, mealInfo, mealRank } from './data'
import { categoryFor } from './seed'
import { qtyLabel } from './plan'
import { FoodNav, fmt, euro } from './ui'
import { RecipeChooser } from './sheets'
import { IngredientChooser } from './Recipes'
import { mondayOf, parseDay, keyOf } from '../sport/planner'

const shift = (key, n) => {
  const d = parseDay(key)
  d.setDate(d.getDate() + n)
  return keyOf(d)
}
const fmtRange = new Intl.DateTimeFormat('fr-BE', { day: 'numeric', month: 'long' })
const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1)

// Planning de la semaine : une recette par repas, glissée d'un repas à l'autre,
// quantités des recettes gardées, féculents « conseillés » selon la cible de chaque jour.
export default function PlanView() {
  const today = keyOf(new Date())
  const [params] = useSearchParams()
  // dès le samedi, le planning s'ouvre sur la semaine suivante (v0.33)
  const [weekStart, setWeekStart] = useState(params.get('semaine') || planningMonday(keyOf(new Date())))
  const [proposal, setProposal] = useState(null)
  const [busy, setBusy] = useState(false)
  let [data, setData] = useState(null) // eslint-disable-line prefer-const
  const [choose, setChoose] = useState(null) // { date, meal }
  const [entry, setEntry] = useState(null)
  const [otherIng, setOtherIng] = useState(null) // { date, meal } : choisir un aliment seul
  const [qtyIng, setQtyIng] = useState(null) // { ing, date, meal }
  const [batch, setBatch] = useState(null) // { plan, recipe }
  const [drag, setDrag] = useState(null)
  const [over, setOver] = useState(null)
  const dates = Array.from({ length: 7 }, (_, i) => shift(weekStart, i))

  const load = useCallback(async () => {
    await weeklyReset(today).catch(() => null)
    const res = await loadPlanRange(Array.from({ length: 7 }, (_, i) => shift(weekStart, i)))
    setData({ ...res, weekStart })
  }, [weekStart, today])

  async function propose() {
    setBusy(true)
    const from = weekStart > today ? weekStart : today
    const days = dates.filter((d) => d >= from)
    if (!days.length) return setBusy(false)
    const res = await proposeMenus(days, { today })
    setProposal(res)
    setBusy(false)
    load()
  }

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
        if (d === 0 && mealRank(meal) <= mealRank(plan.meal)) continue
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
    for (const p of prev) await addPlan({ date: shift(p.date, 7), meal: p.meal, recipe_id: p.recipe_id, ingredient_id: p.ingredient_id, grams: p.grams, servings: Number(p.servings) })
    load()
  }

  if (data && data.weekStart !== weekStart) data = null
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

      {data && dates[6] >= today && (
        <div className="propose-bar">
          <button className="btn-secondary" onClick={propose} disabled={busy}>
            <Icon name="sparkle" size={18} stroke={1.9} />
            {busy ? 'Calcul des menus…' : empty ? 'Proposer les menus de la semaine' : 'Reproposer les menus'}
          </button>
          {!empty && <p className="group-foot">Garde ce que tu as placé toi-même et ce que tu as déjà mangé ; recalcule le reste.</p>}
        </div>
      )}
      {proposal && <ProposalNote res={proposal} onClose={() => setProposal(null)} />}

      {!data && <p className="muted-line">Préparation du planning…</p>}
      {empty && (
        <div className="callout">
          <span className="callout-icon"><Icon name="info" size={20} /></span>
          <div>
            <p className="callout-text">Chaque samedi, le planning repart à vide pour la semaine suivante : touche « + » dans un repas pour le remplir, ou demande des menus selon ton sport et tes midis à l’école. Sur ordinateur, glisse une recette d’un repas à l’autre.</p>
            <button className="link-btn" onClick={copyLastWeek}>Reprendre le planning de la semaine dernière</button>
          </div>
        </div>
      )}

      {data && <div className="plan-days">{dates.map((date, i) => {
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
                          <span className="plan-chip-name">
                            {e.cook && !e.eaten && <span className="chip-flag cook" title="À cuisiner"><Icon name="pan" size={13} stroke={2} /></span>}
                            {e.box && !e.eaten && <span className="chip-flag box" title="À emporter"><Icon name="box" size={13} stroke={2} /></span>}
                            {singleLabel(e)}
                          </span>
                          <span className="plan-chip-kcal">{e.eaten ? 'mangé' : `${fmt(e.totals.kcal)} kcal`}{e.servings !== 1 ? ` · ×${String(e.servings).replace('.', ',')}` : ''}</span>
                        </button>
                      ))}
                      <button className="plan-add" aria-label={`Ajouter : ${m.name}, ${DAY_NAMES[i]}`} onClick={() => setChoose({ date, meal: m.key })}>
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
                {day.factor !== 1 && ` · avec les féculents conseillés : ${fmt(day.advisedKcal + day.eatenKcal)} kcal`}
                {gap > 250 && ` · il manque ${fmt(gap)} kcal : ${day.factor > 1 ? 'suis les quantités conseillées ou ' : ''}ajoute une collation`}
                {gap < -250 && ` · ${fmt(-gap)} kcal de trop`}
              </p>
            )}
          </section>
        )
      })}</div>}

      {choose && data && (
        <RecipeChooser
          title={`${mealInfo(choose.meal).name} · ${DAY_NAMES[dates.indexOf(choose.date)]}`}
          recipes={data.recipes}
          ingById={data.ingById}
          category={categoryFor(choose.meal)}
          onPick={pick}
          onClose={() => setChoose(null)}
          onIngredient={(ing) => { setQtyIng({ ing, ...choose }); setChoose(null) }}
          onOtherIngredient={() => { setOtherIng(choose); setChoose(null) }}
        />
      )}

      {otherIng && data && (
        <IngredientChooser
          ings={data.ings}
          onClose={() => setOtherIng(null)}
          onCreated={load}
          onPick={(ing) => { setQtyIng({ ing, ...otherIng }); setOtherIng(null) }}
        />
      )}

      {qtyIng && (
        <IngredientQtySheet
          ing={qtyIng.ing}
          title={`${mealInfo(qtyIng.meal).name} · ${DAY_NAMES[dates.indexOf(qtyIng.date)] || ''}`}
          onClose={() => setQtyIng(null)}
          onSave={async (grams) => {
            try {
              await addPlan({ date: qtyIng.date, meal: qtyIng.meal, ingredient_id: qtyIng.ing.id, grams })
            } catch (e) {
              alertSql(e)
            }
            setQtyIng(null)
            load()
          }}
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

function ProposalNote({ res, onClose }) {
  const fmtD = (k) => `${DAY_NAMES[(parseDay(k).getDay() + 6) % 7]} ${parseDay(k).getDate()}`
  return (
    <div className="callout tip proposal">
      <span className="callout-icon"><Icon name="sparkle" size={20} /></span>
      <div>
        <p className="callout-lead">{res.count ? `${res.count} repas proposés` : 'Aucun repas proposé'}</p>
        <p className="callout-text">
          {res.school?.length
            ? `Boîtes pour l’école : ${res.school.map(fmtD).join(', ')}${res.fromSchedule ? ' (d’après ton horaire de cours)' : ' (jours par défaut : relie ton horaire de cours dans Sport › Réglages pour que ce soit automatique)'}.`
            : 'Pas de midi à l’école cette semaine.'}{' '}
          Les plats marqués d’une casserole se cuisinent ce soir-là, en lot ; tes quantités sont gardées, avec une quantité de féculents conseillée selon ta cible du jour.
        </p>
        {res.missing?.length > 0 && <p className="callout-text">Ajoute des recettes {res.missing.join(', ')} pour que je remplisse aussi ces repas.</p>}
        {res.leftovers?.length > 0 && <p className="callout-text">Restes en fin de semaine : {res.leftovers.map((l) => `${l.left} portion${l.left > 1 ? 's' : ''} de ${l.recipe}`).join(', ')} (congélateur ou semaine suivante).</p>}
        <button className="link-btn" onClick={onClose}>OK</button>
      </div>
    </div>
  )
}

// Détail d'un repas prévu : quantités du jour, portions, déplacer, retirer.
export function EntrySheet({ entry, dates, today, onClose, onChange }) {
  const [servings, setServings] = useState(entry.servings)
  const [move, setMove] = useState(null)
  const [batch, setBatch] = useState(null)
  const [changing, setChanging] = useState(null)
  const t = entry.totals

  useEffect(() => {
    if (!entry.batch_id) return
    const days = Array.from({ length: 6 }, (_, i) => shift(entry.date, i - 1))
    loadPlanRange(days).then((r) => {
      const parts = Object.values(r.days).flatMap((d) => d.entries).filter((e) => e.batch_id === entry.batch_id)
      setBatch(parts.sort((a, b) => (a.date + mealRank(a.meal) < b.date + mealRank(b.meal) ? -1 : 1)))
    })
  }, [entry])

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
                  <span className="row-value">
                    {qtyLabel(l.ing, l.grams)}
                    {l.advice && <span className="qty-advice">conseillé : {qtyLabel(l.ing, l.advice)}</span>}
                  </span>
                </li>
              ))}
            </ul>
            {entry.lines.some((l) => l.advice) && <p className="group-foot">Tes quantités ne changent pas. « Conseillé » : ce qu’il faudrait de féculents (poids cru) pour coller à ta cible du jour.</p>}
            {entry.recipe.single ? (
              <SingleQty entry={entry} onChange={onChange} />
            ) : (
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
            )}
          </>
        )}

        {entry.cook && batch && <BatchCook parts={batch} />}
        {!entry.cook && entry.batch_id && batch && (
          <p className="group-foot">
            Plat en lot cuisiné {(() => { const c = batch.find((b) => b.cook); return c ? `le ${DAY_NAMES[(parseDay(c.date).getDay() + 6) % 7]} ${mealInfo(c.meal).name.toLowerCase()}` : 'plus tôt' })()}.
            {entry.box ? ' À emporter dans une boîte.' : ''}
          </p>
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
            {!entry.eaten && !entry.recipe.single && (
              <button
                className="btn-secondary"
                onClick={async () => {
                  const [recipes, ings] = await Promise.all([listRecipes(), listIngredients()])
                  setChanging({ recipes, ingById: indexById(ings) })
                }}
              >
                Changer de recette{entry.batch_id ? ' (tout le lot)' : ''}
              </button>
            )}
            {!entry.recipe.single && <Link className="btn-plain as-link" to={`/alimentation/recettes/${entry.recipe.id}`}>Voir la recette</Link>}
            <button className="btn-plain danger" onClick={async () => { if (entry.eaten) await uneatPlan(entry); await removePlan(entry.id); onChange() }}>Retirer du planning</button>
          </>
        )}
        <button className="btn-plain" onClick={onClose}>Fermer</button>
      </div>
      {changing && (
        <RecipeChooser
          title="Changer de recette"
          recipes={changing.recipes}
          ingById={changing.ingById}
          category={entry.recipe.category}
          onPick={async (r) => { await changePlanRecipe(entry, r); onChange() }}
          onClose={() => setChanging(null)}
        />
      )}
    </div>
  )
}

// Fiche de batch cooking : tout ce qu'il faut cuisiner, puis comment répartir les portions.
function BatchCook({ parts }) {
  const total = new Map()
  for (const p of parts) {
    for (const l of p.lines || []) {
      const cur = total.get(l.ing.name) || { ing: l.ing, grams: 0 }
      cur.grams += l.grams
      total.set(l.ing.name, cur)
    }
  }
  const label = (p) => `${DAY_NAMES[(parseDay(p.date).getDay() + 6) % 7].slice(0, 3)}. ${mealInfo(p.meal).short.toLowerCase()}${p.box ? ' (boîte)' : ''}`
  const scaledNames = [...new Set(parts.flatMap((p) => (p.lines || []).filter((l) => l.ing.scalable).map((l) => l.ing.name)))]
  return (
    <div className="batch">
      <p className="group-title">Batch cooking : {parts.length} portion{parts.length > 1 ? 's' : ''} à préparer</p>
      <ul className="group lines">
        {[...total.values()].map((x) => (
          <li key={x.ing.name} className="row">
            <span className="row-label">{x.ing.name}</span>
            <span className="row-value">{qtyLabel(x.ing, x.grams)}</span>
          </li>
        ))}
      </ul>
      {scaledNames.length > 0 && (
        <>
          <p className="group-title">Répartition des féculents (poids crus)</p>
          <ul className="group lines">
            {parts.map((p) => (
              <li key={p.id} className="row">
                <span className="row-label">{label(p)}</span>
                <span className="row-value">
                  {(p.lines || []).filter((l) => l.ing.scalable).map((l) => `${l.ing.name.toLowerCase()} ${Math.round(l.grams)} g${l.advice ? ` (conseillé ${l.advice} g)` : ''}`).join(' · ')}
                </span>
              </li>
            ))}
          </ul>
          <p className="group-foot">Les quantités sont celles de ta recette. Entre parenthèses : la quantité conseillée selon la cible du jour (plus grande les jours de sport), si tu veux l’ajuster toi-même.</p>
        </>
      )}
    </div>
  )
}

// « 1 banane », « Skyr 150 g » ; le nom de la recette sinon.
function singleLabel(e) {
  const l = e.recipe.single && e.lines?.[0]
  if (!l) return e.recipe.name
  return l.ing.unit_g && l.ing.unit_name ? `${e.recipe.name} · ${qtyLabel(l.ing, l.grams)}` : `${e.recipe.name} · ${Math.round(l.grams)} g`
}

// Le planning refuse un aliment seul tant que 010_collations_aliments.sql n'a pas été exécuté.
function alertSql(e) {
  window.alert(/ingredient_id|grams|null value|violates|schema cache/i.test(e.message)
    ? 'Exécute d’abord 010_collations_aliments.sql dans Supabase (SQL Editor) pour ajouter des aliments seuls au planning.'
    : e.message)
}

// Quantité d'un aliment seul : en pièces si l'aliment en a (banane, œuf…), sinon en grammes.
function IngredientQtySheet({ ing, title, onSave, onClose, initialGrams }) {
  const unit = Number(ing.unit_g) || 0
  const [n, setN] = useState(() => (unit ? Math.max(0.5, Math.round(((initialGrams || unit) / unit) * 2) / 2) : null))
  const [g, setG] = useState(() => String(initialGrams || (unit ? '' : 100)))
  const grams = unit ? n * unit : Number(String(g).replace(',', '.')) || 0
  const k = grams / 100
  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div className="sheet form-sheet" role="dialog" aria-label={ing.name} onClick={(e) => e.stopPropagation()}>
        <p className="sheet-title">{ing.name}</p>
        {title && <p className="muted-line">{title}</p>}
        {unit ? (
          <div className="field servings-field">
            <span>Combien</span>
            <div className="stepper">
              <button type="button" className="stepper-btn" aria-label="Moins" onClick={() => setN(Math.max(0.5, n - (n > 1 ? 1 : 0.5)))}><Icon name="minus" size={18} stroke={2.2} /></button>
              <span className="stepper-value"><strong>{String(n).replace('.', ',')}</strong><small>{'\u00a0'}{ing.unit_name || 'pièce'}{n > 1 ? 's' : ''}</small></span>
              <button type="button" className="stepper-btn" aria-label="Plus" onClick={() => setN(n < 1 ? 1 : n + 1)}><Icon name="plus" size={18} stroke={2.2} /></button>
            </div>
          </div>
        ) : (
          <ul className="group">
            <li className="row row-field">
              <label className="row-label" htmlFor="iq">Quantité</label>
              <input id="iq" inputMode="decimal" autoFocus value={g} onChange={(e) => setG(e.target.value)} />
              <span className="row-value">g</span>
            </li>
          </ul>
        )}
        <p className="qty-per100">
          {fmt(grams)} g · {fmt((Number(ing.kcal) || 0) * k)} kcal · {fmt((Number(ing.protein) || 0) * k)} g prot.
          {!unit && ' · astuce : indique le poids d’une pièce dans Ingrédients pour compter en pièces'}
        </p>
        <button className="btn-primary" disabled={!grams} onClick={() => onSave(Math.round(grams))}>{initialGrams ? 'Enregistrer' : 'Ajouter au planning'}</button>
        <button className="btn-plain" onClick={onClose}>Annuler</button>
      </div>
    </div>
  )
}

function SingleQty({ entry, onChange }) {
  const [open, setOpen] = useState(false)
  const line = entry.lines[0]
  if (!line) return null
  return (
    <>
      <button className="btn-secondary" onClick={() => setOpen(true)}>Changer la quantité ({qtyLabel(line.ing, line.grams)})</button>
      {open && (
        <IngredientQtySheet
          ing={line.ing}
          initialGrams={line.grams}
          onClose={() => setOpen(false)}
          onSave={async (grams) => { await updatePlan(entry.id, { grams }); setOpen(false); onChange() }}
        />
      )}
    </>
  )
}
