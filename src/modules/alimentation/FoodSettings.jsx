import { useEffect, useState } from 'react'
import { loadSettings, saveSettings } from './api'
import { bmr } from './targets'
import { fmt } from './ui'
import { BackBar } from '../sport/ui'

// Réglages : profil, cibles, préférences.
export default function FoodSettings() {
  const [s, setS] = useState(null)
  const [status, setStatus] = useState('')

  useEffect(() => {
    loadSettings().then(setS)
  }, [])

  if (!s) return <div className="page"><BackBar to="/alimentation" label="Aujourd’hui" /><p className="muted-line">Chargement…</p></div>

  const set = (k) => (e) => setS({ ...s, [k]: e.target.value })
  const n = (v) => Number(String(v).replace(',', '.'))
  const base = Math.round(bmr({ weight: n(s.start_weight_kg), height_cm: n(s.height_cm), age: n(s.age), sex: s.sex }) * n(s.activity))

  async function save(e) {
    e.preventDefault()
    try {
      await saveSettings({
        age: n(s.age), height_cm: n(s.height_cm), sex: s.sex, start_weight_kg: n(s.start_weight_kg),
        activity: n(s.activity), surplus_kcal: n(s.surplus_kcal), protein_g: n(s.protein_g), fat_pct: n(s.fat_pct),
        exclude_fish: s.exclude_fish, veggies: s.veggies
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
    </div>
  )
}
