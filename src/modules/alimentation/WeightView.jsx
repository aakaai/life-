import { useEffect, useState } from 'react'
import Icon from '../../components/Icon'
import { listWeights, listAdjustments, saveWeight, removeWeight, maybeAdjust } from './api'
import { totalAdjust } from './targets'
import { fmt, FoodNav } from './ui'
import { BackBar } from '../sport/ui'
import { ChartCard, LineChart, shortDate } from '../../components/charts'
import { keyOf, parseDay } from '../sport/planner'

const fmtLong = new Intl.DateTimeFormat('fr-BE', { weekday: 'long', day: 'numeric', month: 'long' })

// Pesées, moyenne sur 7 jours et ajustements automatiques de la cible.
export default function WeightView() {
  const today = keyOf(new Date())
  const [weights, setWeights] = useState(null)
  const [adjustments, setAdjustments] = useState([])
  const [kg, setKg] = useState('')
  const [status, setStatus] = useState('')

  async function load() {
    const [w, a] = await Promise.all([listWeights(), listAdjustments()])
    setWeights(w)
    setAdjustments(a)
    const t = w.find((x) => x.date === today)
    if (t) setKg(String(t.kg).replace('.', ','))
  }

  useEffect(() => {
    load()
  }, [])

  async function save(e) {
    e.preventDefault()
    const v = Number(kg.replace(',', '.'))
    if (!v || v < 30 || v > 200) return setStatus('Entre ton poids en kg, par exemple 55,2.')
    await saveWeight(today, v)
    const adj = await maybeAdjust(today)
    setStatus(adj ? `Pesée enregistrée. ${adj.note}` : 'Pesée enregistrée.')
    load()
  }

  if (!weights) return <div className="page"><BackBar to="/alimentation" label="Aujourd’hui" /><p className="muted-line">Chargement…</p></div>

  const lastW = weights.length ? { ...weights[weights.length - 1], kg: Number(weights[weights.length - 1].kg) } : null
  const first = weights[0]?.date
  const adjustTotal = totalAdjust(adjustments)

  return (
    <div className="page food">
      <h1 className="large-title">Alimentation</h1>
      <FoodNav />

      <form onSubmit={save}>
        <ul className="group">
          <li className="row row-field">
            <label className="row-label" htmlFor="kg">Ce matin, à jeun</label>
            <input id="kg" inputMode="decimal" placeholder="55,0" value={kg} onChange={(e) => setKg(e.target.value)} />
            <span className="row-value">kg</span>
          </li>
          <li><button className="row row-action" type="submit">Enregistrer</button></li>
        </ul>
      </form>
      <p className="group-foot" role="status">
        {status || 'Pèse-toi chaque samedi matin, à jeun, après être passé aux toilettes, toujours dans les mêmes conditions. Une pesée varie d’un jour à l’autre : l’app regarde la tendance sur 3 semaines.'}
      </p>

      <div className="stats">
        <div className="stat"><span>Dernière pesée</span><strong>{lastW ? `${fmt(lastW.kg, 1)} kg` : '—'}</strong></div>
        <div className="stat"><span>Depuis le début</span><strong>{lastW && weights.length > 1 ? `${lastW.kg - weights[0].kg >= 0 ? '+' : ''}${fmt(lastW.kg - weights[0].kg, 1)} kg` : '—'}</strong></div>
        <div className="stat"><span>Ajustement</span><strong>{adjustTotal > 0 ? '+' : ''}{fmt(adjustTotal)} kcal</strong></div>
      </div>

      {weights.length > 1 && <WeightChart weights={weights} today={today} />}

      <h2 className="group-title">Ajustements de la cible</h2>
      {adjustments.length ? (
        <ul className="group">
          {[...adjustments].reverse().map((a) => (
            <li key={a.id} className="row adj-row">
              <span className={a.delta > 0 ? 'tag tag-live' : a.delta < 0 ? 'tag tag-variant' : 'tag'}>
                {a.delta > 0 ? '+' : a.delta < 0 ? '−' : '±'}{fmt(Math.abs(a.delta))} kcal
              </span>
              <span className="food-main">
                <span className="food-name">{fmtLong.format(parseDay(a.date))}</span>
                <span className="food-sub">{a.note}</span>
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="group-foot">
          {first
            ? `Premier point le ${fmtLong.format(new Date(parseDay(first).getTime() + 28 * 86400000))} (les 2 premières semaines ne comptent pas : ton corps stocke un peu plus d’eau au début). Ensuite, toutes les 2 semaines, d’après la tendance de tes 3 dernières pesées.`
            : 'Premier ajustement 4 semaines après ta première pesée, puis toutes les 2 semaines : +150 kcal si tu prends moins de 0,1 kg par semaine, −150 kcal au-dessus de 0,3 kg.'}
        </p>
      )}

      {weights.length > 0 && (
        <>
          <h2 className="group-title">Pesées</h2>
          <ul className="group">
            {[...weights].reverse().slice(0, 30).map((w) => (
              <li key={w.id} className="row">
                <span className="row-label">{fmtLong.format(parseDay(w.date))}</span>
                <span className="row-value">{fmt(w.kg, 1)} kg</span>
                <button className="icon-btn small" aria-label="Supprimer cette pesée" onClick={async () => { await removeWeight(w.id); load() }}>
                  <Icon name="close" size={16} />
                </button>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  )
}

// Courbe des pesées sur les 12 dernières semaines.
function WeightChart({ weights, today }) {
  const from = keyOf(new Date(parseDay(today).getTime() - 83 * 86400000))
  const list = weights.filter((w) => w.date >= from).map((w) => ({ date: w.date, value: Number(w.kg) }))
  if (list.length < 2) return null
  return (
    <div className="weight-card">
      <ChartCard
        title="Tes pesées"
        sub="12 dernières semaines"
        table={{ head: ['Date', 'Poids'], rows: [...list].reverse().map((w) => [shortDate(w.date), `${fmt(w.value, 1)} kg`]) }}
      >
        <LineChart ariaLabel="Évolution du poids" from={from} to={today} format={(x) => `${fmt(x, 1)} kg`}
          series={[{ name: 'Poids', color: 'var(--c-1)', points: list }]} />
      </ChartCard>
    </div>
  )
}
