import { useState } from 'react'
import { saveFood } from './api'

// Créer ou compléter un aliment (valeurs pour 100 g, comme sur l'étiquette).
export default function FoodForm({ initial = {}, message, onSaved, onClose }) {
  const [f, setF] = useState({
    name: '', brand: '', kcal: '', protein: '', carbs: '', fat: '', fiber: '', portion_label: '', portion_g: '',
    source: 'custom', ...Object.fromEntries(Object.entries(initial).map(([k, v]) => [k, v ?? '']))
  })
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value })
  const n = (v) => Number(String(v).replace(',', '.'))

  async function submit(e) {
    e.preventDefault()
    if (!f.name.trim()) return setError('Donne un nom à l’aliment.')
    if (['kcal', 'protein', 'carbs', 'fat'].some((k) => f[k] === '' || Number.isNaN(n(f[k])))) {
      return setError('Remplis les calories, protéines, glucides et lipides (pour 100 g).')
    }
    setBusy(true)
    try {
      const saved = await saveFood({
        ...f,
        kcal: n(f.kcal), protein: n(f.protein), carbs: n(f.carbs), fat: n(f.fat),
        fiber: f.fiber === '' ? null : n(f.fiber),
        portion_g: f.portion_g === '' ? null : n(f.portion_g),
        portion_label: f.portion_g === '' ? null : f.portion_label || '1 portion'
      })
      onSaved(saved)
    } catch (err) {
      setError(err.message)
      setBusy(false)
    }
  }

  const field = (k, label, props = {}) => (
    <li className="row row-field">
      <label className="row-label" htmlFor={`ff-${k}`}>{label}</label>
      <input id={`ff-${k}`} value={f[k]} onChange={set(k)} {...props} />
    </li>
  )

  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <form className="sheet form-sheet" role="dialog" aria-label="Aliment" onClick={(e) => e.stopPropagation()} onSubmit={submit}>
        <p className="sheet-title">{initial.id ? 'Modifier l’aliment' : initial.code ? 'Compléter le produit' : 'Nouvel aliment'}</p>
        {message && <p className="sheet-text">{message}</p>}
        <ul className="group">
          {field('name', 'Nom', { placeholder: 'Skyr nature', autoFocus: !initial.name })}
          {field('brand', 'Marque', { placeholder: 'facultatif' })}
          {initial.code && (
            <li className="row"><span className="row-label">Code-barres</span><span className="row-value">{initial.code}</span></li>
          )}
        </ul>
        <p className="group-title">Pour 100 g (voir l’étiquette)</p>
        <ul className="group">
          {field('kcal', 'Énergie (kcal)', { inputMode: 'decimal', autoFocus: !!initial.name })}
          {field('protein', 'Protéines (g)', { inputMode: 'decimal' })}
          {field('carbs', 'Glucides (g)', { inputMode: 'decimal' })}
          {field('fat', 'Lipides (g)', { inputMode: 'decimal' })}
          {field('fiber', 'Fibres (g)', { inputMode: 'decimal', placeholder: 'facultatif' })}
        </ul>
        <p className="group-title">Portion habituelle (facultatif)</p>
        <ul className="group">
          {field('portion_label', 'Nom', { placeholder: '1 pot' })}
          {field('portion_g', 'Poids (g)', { inputMode: 'decimal', placeholder: '150' })}
        </ul>
        {error && <p className="group-foot is-error">{error}</p>}
        <button className="btn-primary" type="submit" disabled={busy}>Enregistrer</button>
        <button className="btn-plain" type="button" onClick={onClose}>Annuler</button>
      </form>
    </div>
  )
}
