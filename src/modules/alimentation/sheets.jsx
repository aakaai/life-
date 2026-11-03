import { useMemo, useState } from 'react'
import Icon from '../../components/Icon'
import { RAYONS, CATEGORIES } from './seed'
import { recipeLines, totals } from './plan'
import { saveIngredient, removeIngredient } from './api'
import { tokens, scoreName } from './ciqual'
import { norm } from './data'
import { fmt, euro } from './ui'

// Modifier un ingrédient : prix, paquet, pièce, rôle dans les portions.
export function IngredientSheet({ ingredient, onSaved, onClose, onDeleted }) {
  const [f, setF] = useState(() => ({
    rayon: 'Épicerie', pack_label: '', ...Object.fromEntries(Object.entries(ingredient).map(([k, v]) => [k, v ?? '']))
  }))
  const [error, setError] = useState('')
  const [confirm, setConfirm] = useState(false)
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value })
  const n = (v) => (v === '' ? '' : Number(String(v).replace(',', '.')))

  async function submit(e) {
    e.preventDefault()
    if (!String(f.name).trim()) return setError('Donne un nom à l’ingrédient.')
    const row = {
      ...f,
      kcal: n(f.kcal), protein: n(f.protein), carbs: n(f.carbs), fat: n(f.fat),
      pack_g: n(f.pack_g), pack_price: n(f.pack_price), unit_g: n(f.unit_g),
      price_changed: String(f.pack_price) !== String(ingredient.pack_price ?? '')
    }
    const saved = await saveIngredient(row)
    onSaved(saved)
  }

  const field = (k, label, props = {}) => (
    <li className="row row-field">
      <label className="row-label" htmlFor={`is-${k}`}>{label}</label>
      <input id={`is-${k}`} value={f[k]} onChange={set(k)} {...props} />
    </li>
  )

  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <form className="sheet form-sheet" role="dialog" aria-label="Ingrédient" onClick={(e) => e.stopPropagation()} onSubmit={submit}>
        <p className="sheet-title">{ingredient.id ? 'Ingrédient' : 'Nouvel ingrédient'}</p>
        <ul className="group">
          {field('name', 'Nom', { autoFocus: !ingredient.name })}
          <li className="row row-field">
            <label className="row-label" htmlFor="is-rayon">Rayon</label>
            <select id="is-rayon" value={f.rayon} onChange={set('rayon')}>
              {RAYONS.map((r) => <option key={r}>{r}</option>)}
            </select>
          </li>
        </ul>
        <p className="group-title">Prix chez Colruyt</p>
        <ul className="group">
          {field('pack_label', 'Paquet', { placeholder: '1 kg' })}
          {field('pack_g', 'Contenu (g ou ml)', { inputMode: 'decimal', placeholder: '1000' })}
          {field('pack_price', 'Prix (€)', { inputMode: 'decimal', placeholder: '1,69', autoFocus: !!ingredient.name })}
        </ul>
        {f.price_date ? <p className="group-foot">Prix noté le {new Date(`${f.price_date}T12:00`).toLocaleDateString('fr-BE')}.</p> : ingredient.key ? <p className="group-foot">Prix estimé : corrige-le avec le ticket de caisse.</p> : null}
        <p className="group-title">Comptage à la pièce (facultatif)</p>
        <ul className="group">
          {field('unit_name', 'Nom d’une pièce', { placeholder: 'œuf, tranche…' })}
          {field('unit_g', 'Poids d’une pièce (g)', { inputMode: 'decimal' })}
        </ul>
        <ul className="group">
          <li className="row">
            <label className="switch">
              <input type="checkbox" checked={!!f.scalable} onChange={(e) => setF({ ...f, scalable: e.target.checked })} />
              <span aria-hidden="true" />
              <span className="row-label">Féculent ajusté à la cible du jour</span>
            </label>
          </li>
          <li className="row">
            <label className="switch">
              <input type="checkbox" checked={!!f.pantry} onChange={(e) => setF({ ...f, pantry: e.target.checked })} />
              <span aria-hidden="true" />
              <span className="row-label">Placard (huile, épices…)</span>
            </label>
          </li>
        </ul>
        <p className="group-title">Pour 100 g</p>
        <ul className="group">
          {field('kcal', 'Énergie (kcal)', { inputMode: 'decimal' })}
          {field('protein', 'Protéines (g)', { inputMode: 'decimal' })}
          {field('carbs', 'Glucides (g)', { inputMode: 'decimal' })}
          {field('fat', 'Lipides (g)', { inputMode: 'decimal' })}
        </ul>
        {error && <p className="group-foot is-error">{error}</p>}
        <button className="btn-primary" type="submit">Enregistrer</button>
        {ingredient.id && onDeleted && (
          <button
            type="button"
            className="btn-plain danger"
            onClick={async () => {
              if (!confirm) return setConfirm(true)
              await removeIngredient(ingredient.id)
              onDeleted()
            }}
          >
            {confirm ? 'Confirmer : les recettes qui l’utilisent le perdront' : 'Supprimer l’ingrédient'}
          </button>
        )}
        <button type="button" className="btn-plain" onClick={onClose}>Annuler</button>
      </form>
    </div>
  )
}

// Choisir une recette (pour le planning).
export function RecipeChooser({ recipes, ingById, category, title, onPick, onClose, onIngredient, onOtherIngredient }) {
  const [cat, setCat] = useState(category || 'tout')
  const [q, setQ] = useState('')
  const list = useMemo(() => {
    const toks = tokens(q)
    return recipes
      .filter((r) => (toks.length ? scoreName(norm(r.name), toks) >= 0 : cat === 'tout' || r.category === cat))
      .map((r) => ({ r, t: totals(recipeLines(r, ingById, 1)) }))
  }, [recipes, ingById, cat, q])
  // aliments seuls (banane, yaourt…) quand on cherche
  const ings = useMemo(() => {
    const toks = tokens(q)
    if (!onIngredient || !toks.length) return []
    return Object.values(ingById).filter((i) => scoreName(norm(i.name), toks) >= 0).slice(0, 8)
  }, [ingById, q, onIngredient])

  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div className="sheet chooser" role="dialog" aria-label={title} onClick={(e) => e.stopPropagation()}>
        <p className="sheet-title">{title}</p>
        <div className="search-bar">
          <Icon name="search" size={18} />
          <input type="search" placeholder={onIngredient ? 'Rechercher une recette ou un aliment' : 'Rechercher une recette'} value={q} onChange={(e) => setQ(e.target.value)} aria-label="Rechercher une recette ou un aliment" />
        </div>
        {onOtherIngredient && !q && (
          <ul className="group">
            <li>
              <button className="row row-action" onClick={onOtherIngredient}>
                <Icon name="plus" size={18} stroke={2} /> Un aliment seul (banane, yaourt, barre…)
              </button>
            </li>
          </ul>
        )}
        {ings.length > 0 && (
          <>
            <p className="group-title">Aliments seuls</p>
            <ul className="group">
              {ings.map((i) => (
                <li key={i.id}>
                  <button className="row food-row" onClick={() => onIngredient(i)}>
                    <span className="food-main">
                      <span className="food-name">{i.name}</span>
                      <span className="food-sub">{fmt(i.kcal)} kcal / 100 g{i.unit_g ? ` · 1 ${i.unit_name || 'pièce'} = ${fmt(i.unit_g)} g` : ''}</span>
                    </span>
                    <span className="row-chevron"><Icon name="plus" size={18} stroke={2} /></span>
                  </button>
                </li>
              ))}
            </ul>
            <p className="group-title">Recettes</p>
          </>
        )}
        {!q && (
          <div className="chips left">
            {[{ key: 'tout', name: 'Toutes' }, ...CATEGORIES].map((c) => (
              <button key={c.key} className={cat === c.key ? 'chip is-on' : 'chip'} onClick={() => setCat(c.key)}>{c.name}</button>
            ))}
          </div>
        )}
        <ul className="group">
          {list.map(({ r, t }) => (
            <li key={r.id}>
              <button className="row food-row" onClick={() => onPick(r)}>
                <span className="food-main">
                  <span className="food-name">{r.name}</span>
                  <span className="food-sub">
                    {fmt(t.kcal)} kcal · {fmt(t.protein)} g prot. · {euro(t.cost)} la portion{r.batch ? ` · en lot (${r.servings})` : ''}
                  </span>
                </span>
                <span className="row-chevron"><Icon name="plus" size={18} stroke={2} /></span>
              </button>
            </li>
          ))}
          {!list.length && <li className="row"><span className="row-label muted">Aucune recette.</span></li>}
        </ul>
        <button className="btn-plain" onClick={onClose}>Fermer</button>
      </div>
    </div>
  )
}
