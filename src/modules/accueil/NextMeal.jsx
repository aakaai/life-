// Accueil · « Prochain repas » (v0.22, demande du 4 nov.) : le repas logique du moment selon l'heure,
// même si rien n'est prévu dans Alimentation. Un repas déjà noté fait passer au suivant.
// Prévu → « Je l'ai mangé » ; rien de prévu → ce que tu manges d'habitude à ce repas (ajout d'un toucher).
// Toujours « + Collation » et « + Repas » en bas (une 2e collation à 11 h reste possible).
import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { loadPlanRange, logsFor, eatPlan, addLog, removeLog, mealSuggestions } from '../alimentation/api'
import { MEALS, MEAL_START, mealInfo, mealRank, mealForTime, snackForTime, mainMealForTime, sumLogs } from '../alimentation/data'
import { Rings, fmt } from '../alimentation/ui'

const pad = (n) => String(n).padStart(2, '0')
const keyOf = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
const SHORT = { 0: 'Petit-déj.', 5: 'Collation', 1: 'Midi', 2: 'Collation', 3: 'Soir', 4: 'Coucher' }
const hourLabel = (h) => `${Math.floor(h)} h${h % 1 ? ` ${pad(Math.round((h % 1) * 60))}` : ''}`

// Le repas à montrer : celui de l'heure, ou le suivant pas encore noté. null = journée bouclée.
export function currentMeal(logs, now = new Date()) {
  const noted = new Set(logs.map((l) => Number(l.meal)))
  const from = mealRank(mealForTime(now))
  return MEALS.slice(from).find((m) => !noted.has(m.key))?.key ?? null
}

export default function NextMeal() {
  const navigate = useNavigate()
  const [state, setState] = useState(null)
  const [busy, setBusy] = useState(false)
  const [added, setAdded] = useState(null) // { log, name } pour « Annuler »
  const undoTimer = useRef(null)

  const load = useCallback(async () => {
    const now = new Date()
    const today = keyOf(now)
    try {
      const [{ days }, logs] = await Promise.all([loadPlanRange([today]), logsFor(today)])
      const meal = currentMeal(logs, now)
      const open = meal == null ? [] : days[today].entries.filter((e) => !e.eaten && Number(e.meal) === meal)
      const suggestions = meal != null && !open.length ? await mealSuggestions(meal, 3).catch(() => []) : []
      setState({ day: days[today], logs, eaten: sumLogs(logs), today, meal, open, suggestions, now })
    } catch {
      setState(false)
    }
  }, [])
  useEffect(() => {
    load()
    window.addEventListener('life:changed', load)
    // l'heure passe : on revérifie le repas du moment toutes les 5 minutes
    const t = setInterval(load, 5 * 60 * 1000)
    return () => {
      window.removeEventListener('life:changed', load)
      clearInterval(t)
    }
  }, [load])
  useEffect(() => () => clearTimeout(undoTimer.current), [])

  if (state === false) return null
  if (!state) return <section className="home-card"><p className="home-card-title">Prochain repas</p><p className="muted-line">Chargement…</p></section>

  const { day, logs, eaten, today, meal, open, suggestions, now } = state
  const nowH = now.getHours() + now.getMinutes() / 60
  const kcal = open.reduce((t, e) => t + (e.totals?.kcal || 0), 0)
  const protein = open.reduce((t, e) => t + (e.totals?.protein || 0), 0)
  const scaled = open.length === 1 ? open[0].lines?.find((l) => l.advice) : null
  const later = meal != null && MEAL_START[meal] > nowH ? ` · à ${hourLabel(MEAL_START[meal])}` : ''
  const addUrl = (m) => `/alimentation/ajouter?repas=${m}&date=${today}&retour=accueil`
  // repas déjà notés aujourd'hui (pastilles)
  const done = MEALS.map((m) => ({ m, k: logs.filter((l) => Number(l.meal) === m.key).reduce((t, l) => t + Number(l.kcal || 0), 0), n: logs.some((l) => Number(l.meal) === m.key) })).filter((x) => x.n)
  // repas principaux déjà passés et pas notés (oubli ?) : petite pastille pour les noter
  const curRank = meal == null ? MEALS.length : mealRank(meal)
  const missed = MEALS.filter((m) => !m.snack && mealRank(m.key) < Math.min(curRank, mealRank(mealForTime(now))) && !logs.some((l) => Number(l.meal) === m.key))

  const changed = () => window.dispatchEvent(new Event('life:changed'))
  async function eatAll() {
    setBusy(true)
    try {
      for (const e of open) await eatPlan(e)
    } finally {
      setBusy(false)
      changed()
    }
  }
  async function quickAdd({ item, grams }) {
    setBusy(true)
    try {
      const log = await addLog({ item, grams, meal, date: today })
      clearTimeout(undoTimer.current)
      setAdded({ log, name: item.name })
      undoTimer.current = setTimeout(() => setAdded(null), 8000)
    } finally {
      setBusy(false)
      changed()
    }
  }
  async function undo() {
    const a = added
    setAdded(null)
    if (a) await removeLog(a.log.id)
    changed()
  }

  return (
    <section className="home-card" aria-labelledby="meal-title">
      <div className="home-card-head">
        <h2 id="meal-title" className="home-card-title">Prochain repas</h2>
        <span className="home-card-hint">{fmt(eaten.kcal)} / {fmt(day.target.kcal)} kcal</span>
      </div>
      <div className={open.length || meal == null ? 'meal-next' : 'meal-next is-top'}>
        <Link to="/alimentation" aria-label="Ouvrir Alimentation">
          <Rings kcal={eaten.kcal} kcalTarget={day.target.kcal} protein={eaten.protein} proteinTarget={day.target.protein} size={60} />
        </Link>
        {meal == null ? (
          <div className="meal-next-main">
            <p className="meal-next-name">Journée bouclée</p>
            <p className="meal-next-sub">{fmt(eaten.protein)} / {fmt(day.target.protein)} g de protéines</p>
          </div>
        ) : open.length ? (
          <div className="meal-next-main">
            <p className="meal-next-kicker">{mealInfo(meal).name}<span className="meal-next-when">{later}</span></p>
            <p className="meal-next-name">{open.map((e) => e.recipe.name).join(' + ')}</p>
            <p className="meal-next-sub">{fmt(kcal)} kcal · {fmt(protein)} g prot.{scaled ? ` · ${scaled.ing.name.toLowerCase()} conseillé ${fmt(scaled.advice)} g` : ''}</p>
            <button className="btn-secondary meal-eat" disabled={busy} onClick={eatAll}>{busy ? 'Enregistrement…' : 'Je l’ai mangé'}</button>
          </div>
        ) : (
          <div className="meal-next-main">
            <p className="meal-next-kicker">{mealInfo(meal).name}<span className="meal-next-when">{later || ' · rien de prévu'}</span></p>
            {suggestions.length > 0 && (
              <ul className="meal-sugg">
                {suggestions.map((s) => (
                  <li key={s.item.ref}>
                    <button className="meal-sugg-row" disabled={busy} onClick={() => quickAdd(s)} aria-label={`Ajouter ${s.item.name}, ${fmt(s.grams)} g`}>
                      <span className="meal-sugg-main">
                        <span className="meal-sugg-name">{s.item.name}</span>
                        <span className="meal-sugg-sub">{fmt((s.item.kcal * s.grams) / 100)} kcal · {fmt((s.item.protein * s.grams) / 100)} g prot. · {fmt(s.grams)} g</span>
                      </span>
                      <span className="meal-sugg-plus" aria-hidden="true">+</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
            <button className="btn-secondary meal-eat" onClick={() => navigate(addUrl(meal))}>{suggestions.length ? 'Autre chose…' : 'Ajouter'}</button>
          </div>
        )}
      </div>
      {added && (
        <p className="meal-added" role="status">
          {added.name} ajouté à {mealInfo(added.log.meal).name.toLowerCase()} · <button className="link-btn" onClick={undo}>Annuler</button>
        </p>
      )}
      {(done.length > 0 || missed.length > 0) && (
        <p className="meal-done">
          {done.map(({ m, k }) => <span key={m.key}>{SHORT[m.key]} ✓ {fmt(k)}</span>)}
          {missed.map((m) => <Link key={m.key} className="is-missed" to={addUrl(m.key)}>{SHORT[m.key]} · à noter</Link>)}
        </p>
      )}
      <div className="meal-extra">
        <button className="btn-tonal" onClick={() => navigate(addUrl(snackForTime(now)))}>+ Collation</button>
        <button className="btn-tonal" onClick={() => navigate(addUrl(mainMealForTime(now)))}>+ Repas</button>
      </div>
    </section>
  )
}
