// Accueil · « Prochain repas » : le prochain repas prévu dans le planning, en grand,
// avec « Je l'ai mangé » et les anneaux calories / protéines du jour.
import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { loadPlanRange, logsFor, eatPlan } from '../alimentation/api'
import { mealInfo, mealRank, mealForTime, sumLogs } from '../alimentation/data'
import { Rings, fmt } from '../alimentation/ui'

const pad = (n) => String(n).padStart(2, '0')
const keyOf = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`

export default function NextMeal() {
  const [state, setState] = useState(null)
  const [busy, setBusy] = useState(false)
  const load = useCallback(async () => {
    const today = keyOf(new Date())
    try {
      const [{ days }, logs] = await Promise.all([loadPlanRange([today]), logsFor(today)])
      setState({ day: days[today], eaten: sumLogs(logs), today })
    } catch {
      setState(false)
    }
  }, [])
  useEffect(() => {
    load()
    window.addEventListener('life:changed', load)
    return () => window.removeEventListener('life:changed', load)
  }, [load])

  if (state === false) return null
  if (!state) return <section className="home-card"><p className="home-card-title">Prochain repas</p><p className="muted-line">Chargement…</p></section>

  const { day, eaten } = state
  const nowRank = mealRank(mealForTime())
  const open = day.entries.filter((e) => !e.eaten)
  // le repas en cours ou le suivant ; s'il n'y en a plus, le dernier pas encore mangé (oublié plus tôt)
  const ranks = [...new Set(open.map((e) => mealRank(e.meal)))].sort((a, b) => a - b)
  const rank = ranks.find((r) => r >= nowRank) ?? ranks[ranks.length - 1]
  const group = rank == null ? [] : open.filter((e) => mealRank(e.meal) === rank)
  const kcal = group.reduce((t, e) => t + (e.totals?.kcal || 0), 0)
  const protein = group.reduce((t, e) => t + (e.totals?.protein || 0), 0)

  async function eatAll() {
    setBusy(true)
    try {
      for (const e of group) await eatPlan(e)
    } finally {
      setBusy(false)
      window.dispatchEvent(new Event('life:changed'))
    }
  }

  return (
    <section className="home-card" aria-labelledby="meal-title">
      <div className="home-card-head">
        <h2 id="meal-title" className="home-card-title">Prochain repas</h2>
        <span className="home-card-hint">{fmt(eaten.kcal)} / {fmt(day.target.kcal)} kcal</span>
      </div>
      <div className="meal-next">
        <Link to="/alimentation" aria-label="Ouvrir Alimentation">
          <Rings kcal={eaten.kcal} kcalTarget={day.target.kcal} protein={eaten.protein} proteinTarget={day.target.protein} size={60} />
        </Link>
        {group.length ? (
          <div className="meal-next-main">
            <p className="meal-next-kicker">{mealInfo(group[0].meal).name}{rank < nowRank ? ' · pas encore noté' : ''}</p>
            <p className="meal-next-name">{group.map((e) => e.recipe.name).join(' + ')}</p>
            <p className="meal-next-sub">{fmt(kcal)} kcal · {fmt(protein)} g prot.{group.length === 1 && group[0].lines?.find((l) => l.scaled) ? ` · ${group[0].lines.find((l) => l.scaled).ing.name.toLowerCase()} ${fmt(group[0].lines.find((l) => l.scaled).grams)} g` : ''}</p>
            <button className="btn-secondary meal-eat" disabled={busy} onClick={eatAll}>{busy ? 'Enregistrement…' : 'Je l’ai mangé'}</button>
          </div>
        ) : (
          <div className="meal-next-main">
            <p className="meal-next-name">{day.entries.length ? 'Tout est mangé pour aujourd’hui' : 'Rien de prévu aujourd’hui'}</p>
            <p className="meal-next-sub">{fmt(eaten.protein)} / {fmt(day.target.protein)} g de protéines</p>
            <Link className="btn-plain as-link meal-eat" to="/alimentation/planning">Ouvrir le planning</Link>
          </div>
        )}
      </div>
    </section>
  )
}
