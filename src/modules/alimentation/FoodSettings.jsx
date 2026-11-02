import { useEffect, useState } from 'react'
import { loadSettings, saveSettings, ensureSeed } from './api'
import { DAY_NAMES, DEFAULT_SETTINGS } from './data'
import { bmr } from './targets'
import { fmt } from './ui'
import { BackBar } from '../sport/ui'

// Réglages : profil, cibles, préférences.
export default function FoodSettings() {
  const [s, setS] = useState(null)
  const [status, setStatus] = useState('')
  const [seedStatus, setSeedStatus] = useState('')

  useEffect(() => {
    loadSettings().then(setS)
  }, [])

  if (!s) return <div className="page"><BackBar to="/alimentation" label="Aujourd’hui" /><p className="muted-line">Chargement…</p></div>

  const set = (k) => (e) => setS({ ...s, [k]: e.target.value })
  const n = (v) => Number(String(v).replace(',', '.'))
  const shopDays = Array.isArray(s.shop_days) ? s.shop_days.map(Number) : DEFAULT_SETTINGS.shop_days
  const toggleShop = (d) => setS({ ...s, shop_days: shopDays.includes(d) ? shopDays.filter((x) => x !== d) : [...shopDays, d].sort() })
  const base = Math.round(bmr({ weight: n(s.start_weight_kg), height_cm: n(s.height_cm), age: n(s.age), sex: s.sex }) * n(s.activity))

  async function save(e) {
    e.preventDefault()
    try {
      await saveSettings({
        age: n(s.age), height_cm: n(s.height_cm), sex: s.sex, start_weight_kg: n(s.start_weight_kg),
        activity: n(s.activity), surplus_kcal: n(s.surplus_kcal), protein_g: n(s.protein_g), fat_pct: n(s.fat_pct),
        exclude_fish: s.exclude_fish, veggies: s.veggies,
        weigh_day: Number(s.weigh_day), shop_days: shopDays, auto_portions: s.auto_portions !== false
      })
      setStatus('Enregistré.')
    } catch (err) {
      setStatus(`Échec : ${err.message}`)
    }
  }

  const field = (k, label, unit) => (
    <li className="row row-field">
      <label className="row-label" htmlFor={`fs-${k}`}>{label}</label>
      <input id={`fs-${k}`} inputMode="decimal" value={s[k]} onChange={set(k)} />
      {unit && <span className="row-value">{unit}</span>}
    </li>
  )

  return (
    <div className="page settings">
      <BackBar to="/alimentation" label="Aujourd’hui" />
      <h1 className="large-title">Réglages alimentation</h1>
      <form onSubmit={save}>
        <h2 className="group-title">Toi</h2>
        <ul className="group">
          {field('age', 'Âge', 'ans')}
          {field('height_cm', 'Taille', 'cm')}
          {field('start_weight_kg', 'Poids de départ', 'kg')}
          <li className="row">
            <span className="row-label">Sexe</span>
            <div className="segmented small" role="radiogroup" aria-label="Sexe">
              {[['m', 'Homme'], ['f', 'Femme']].map(([v, l]) => (
                <button type="button" key={v} role="radio" aria-checked={s.sex === v} className={s.sex === v ? 'is-on' : ''} onClick={() => setS({ ...s, sex: v })}>{l}</button>
              ))}
            </div>
          </li>
        </ul>
        <p className="group-foot">Dès que tu te pèses, l’app utilise ta moyenne sur 7 jours à la place du poids de départ.</p>

        <h2 className="group-title">Cibles</h2>
        <ul className="group">
          {field('activity', 'Activité hors sport', '×')}
          {field('surplus_kcal', 'Surplus', 'kcal')}
          {field('protein_g', 'Protéines', 'g / jour')}
          {field('fat_pct', 'Lipides', '% des kcal')}
        </ul>
        <p className="group-foot">
          Dépense de base calculée : {fmt(base)} kcal (formule de Mifflin-St Jeor × activité). La cible du jour ajoute le surplus et tes séances de sport.
        </p>

        <h2 className="group-title">Rythme</h2>
        <ul className="group">
          <li className="row row-field">
            <label className="row-label" htmlFor="fs-weigh">Jour de pesée</label>
            <select id="fs-weigh" value={s.weigh_day ?? 5} onChange={set('weigh_day')}>
              {DAY_NAMES.map((d, i) => <option key={d} value={i}>{d}</option>)}
            </select>
          </li>
          <li className="row shop-days">
            <span className="row-label">Jours de courses</span>
            <div className="chips">
              {DAY_NAMES.map((d, i) => (
                <button type="button" key={d} className={shopDays.includes(i) ? 'chip is-on' : 'chip'} onClick={() => toggleShop(i)}>{d.slice(0, 3)}</button>
              ))}
            </div>
          </li>
          <li className="row">
            <label className="switch">
              <input type="checkbox" checked={s.auto_portions !== false} onChange={(e) => setS({ ...s, auto_portions: e.target.checked })} />
              <span aria-hidden="true" />
              <span className="row-label">Ajuster les féculents à la cible du jour</span>
            </label>
          </li>
        </ul>
        <p className="group-foot">La liste de courses couvre les repas prévus d’un jour de courses jusqu’à la veille du suivant.</p>

        <h2 className="group-title">Préférences</h2>
        <ul className="group">
          <li className="row">
            <label className="switch">
              <input type="checkbox" checked={s.exclude_fish !== false} onChange={(e) => setS({ ...s, exclude_fish: e.target.checked })} />
              <span aria-hidden="true" />
              <span className="row-label">Pas de poisson</span>
            </label>
          </li>
          <li className="row row-field veggies">
            <label className="row-label" htmlFor="fs-veggies">Légumes que tu aimes</label>
            <input id="fs-veggies" value={s.veggies} placeholder="carottes, maïs, poivrons…" onChange={set('veggies')} />
          </li>
        </ul>
        <p className="group-foot">Le poisson passe en fin de recherche avec une étiquette. Ta liste de légumes servira aux recettes et aux courses.</p>

        <button className="btn-primary" type="submit">Enregistrer</button>
        {status && <p className="group-foot" role="status">{status}</p>}
      </form>

      <h2 className="group-title">Base de recettes</h2>
      <ul className="group">
        <li>
          <button
            className="row row-action"
            onClick={async () => {
              setSeedStatus('Installation…')
              await ensureSeed({ force: true })
              setSeedStatus('Les recettes et ingrédients de base manquants ont été remis. Tes recettes et tes prix sont gardés.')
            }}
          >
            Remettre les recettes de base supprimées
          </button>
        </li>
      </ul>
      {seedStatus && <p className="group-foot" role="status">{seedStatus}</p>}
    </div>
  )
}
