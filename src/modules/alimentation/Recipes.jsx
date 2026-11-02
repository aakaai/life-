import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import Icon from '../../components/Icon'
import { listRecipes, getRecipe, saveRecipe, removeRecipe, recipeTotals, loadSettings } from './api'
import { forGrams } from './data'
import { fmt } from './ui'
import FoodPicker from './FoodPicker'
import QuantitySheet from './QuantitySheet'
import { BackBar } from '../sport/ui'

// Liste des recettes et plats en lot.
export function RecipeList() {
  const [list, setList] = useState(null)
  useEffect(() => {
    listRecipes().then(setList)
  }, [])

  return (
    <div className="page food">
      <BackBar to="/alimentation" label="Aujourd’hui" />
      <h1 className="large-title">Recettes</h1>
      <p className="muted-line">
        Pour un plat en lot : note les ingrédients crus, puis pèse le plat cuit. Ensuite, tu notes simplement « 350 g de chili ».
      </p>
      {list && list.length > 0 && (
        <ul className="group">
          {list.map((r) => (
            <li key={r.id}>
              <Link to={r.id} className="row food-row">
                <span className="food-main">
                  <span className="food-name">{r.name}</span>
                  <span className="food-sub">
                    {fmt(r.kcal)} kcal · {fmt(r.protein, 1)} g prot. / 100 g{r.cooked_g ? ` · plat de ${fmt(r.cooked_g)} g` : ''}
                  </span>
                </span>
                <span className="row-chevron"><Icon name="chevron" size={16} /></span>
              </Link>
            </li>
          ))}
        </ul>
      )}
      {list && !list.length && <p className="muted-line">Pas encore de recette.</p>}
      <Link to="nouvelle" className="btn-primary as-link">Nouvelle recette</Link>
    </div>
  )
}

// Création ou modification d'une recette.
export function RecipeEditor() {
  const { id } = useParams()
  const navigate = useNavigate()
  const isNew = id === 'nouvelle'
  const [recipe, setRecipe] = useState(isNew ? { name: '', items: [], cooked_g: '' } : null)
  const [picking, setPicking] = useState(false)
  const [picked, setPicked] = useState(null)
  const [excludeFish, setExcludeFish] = useState(true)
  const [error, setError] = useState('')
  const [confirmDelete, setConfirmDelete] = useState(false)

  useEffect(() => {
    loadSettings().then((s) => setExcludeFish(s.exclude_fish !== false))
    if (!isNew) getRecipe(id).then((r) => setRecipe(r ? { ...r, cooked_g: r.cooked_g ?? '' } : { missing: true }))
  }, [id, isNew])

  if (!recipe) return <div className="page"><BackBar to="/alimentation/recettes" label="Recettes" /><p className="muted-line">Chargement…</p></div>
  if (recipe.missing) return <div className="page"><BackBar to="/alimentation/recettes" label="Recettes" /><p className="muted-line">Recette introuvable.</p></div>

  const t = recipeTotals(recipe.items, recipe.cooked_g)
  const setItems = (items) => setRecipe({ ...recipe, items })

  async function save() {
    if (!recipe.name.trim()) return setError('Donne un nom à la recette.')
    if (!recipe.items.length) return setError('Ajoute au moins un ingrédient.')
    await saveRecipe(recipe)
    navigate('/alimentation/recettes')
  }

  return (
    <div className="page food">
      <BackBar to="/alimentation/recettes" label="Recettes" />
      <input
        className="title-input"
        placeholder="Nom de la recette"
        value={recipe.name}
        onChange={(e) => setRecipe({ ...recipe, name: e.target.value })}
        aria-label="Nom de la recette"
      />

      <h2 className="group-title">Ingrédients (poids crus)</h2>
      <ul className="group">
        {recipe.items.map((it, i) => (
          <li key={i} className="row ingredient-row">
            <span className="food-main">
              <span className="food-name">{it.name}</span>
              <span className="food-sub">{fmt(it.kcal)} kcal · {fmt(it.protein, 1)} g prot.</span>
            </span>
            <span className="grams-input">
              <input
                inputMode="decimal"
                value={it.grams}
                aria-label={`Grammes de ${it.name}`}
                onChange={(e) => {
                  const grams = Number(e.target.value.replace(',', '.')) || 0
                  const per100 = it.per100 || { kcal: (it.kcal / it.grams) * 100, protein: (it.protein / it.grams) * 100, carbs: (it.carbs / it.grams) * 100, fat: (it.fat / it.grams) * 100 }
                  setItems(recipe.items.map((x, j) => (j === i ? { ...x, grams: e.target.value, per100, ...forGrams(per100, grams) } : x)))
                }}
              />
              g
            </span>
            <button className="icon-btn small" aria-label={`Retirer ${it.name}`} onClick={() => setItems(recipe.items.filter((_, j) => j !== i))}>
              <Icon name="close" size={16} />
            </button>
          </li>
        ))}
        <li>
          <button className="row row-action" onClick={() => setPicking(true)}>
            <Icon name="plus" size={18} stroke={2} /> Ajouter un ingrédient
          </button>
        </li>
      </ul>

      <h2 className="group-title">Plat cuit</h2>
      <ul className="group">
        <li className="row row-field">
          <label className="row-label" htmlFor="cooked">Poids total cuit</label>
          <input id="cooked" inputMode="decimal" placeholder={fmt(t.grams)} value={recipe.cooked_g} onChange={(e) => setRecipe({ ...recipe, cooked_g: e.target.value })} />
          <span className="row-value">g</span>
        </li>
      </ul>
      <p className="group-foot">Pèse ta casserole vide, puis pleine une fois cuit : la différence est le poids du plat. Sans poids cuit, on prend le total des ingrédients.</p>

      <div className="stats">
        <div className="stat"><span>Tout le plat</span><strong>{fmt(t.kcal)} kcal</strong></div>
        <div className="stat"><span>Protéines</span><strong>{fmt(t.protein)} g</strong></div>
        <div className="stat"><span>Pour 100 g</span><strong>{fmt(t.per100.kcal)} kcal</strong></div>
      </div>

      {error && <p className="group-foot is-error">{error}</p>}
      <button className="btn-primary" onClick={save}>Enregistrer la recette</button>
      {!isNew && (
        confirmDelete ? (
          <button className="btn-plain danger" onClick={async () => { await removeRecipe(recipe.id); navigate('/alimentation/recettes') }}>
            Confirmer la suppression
          </button>
        ) : (
          <button className="btn-plain danger" onClick={() => setConfirmDelete(true)}>Supprimer la recette</button>
        )
      )}

      {picking && (
        <div className="overlay">
          <div className="overlay-page">
            <div className="back-bar">
              <button className="back-link link-btn" onClick={() => setPicking(false)}>
                <Icon name="back" size={20} stroke={2} /> Recette
              </button>
            </div>
            <h1 className="large-title">Ingrédient</h1>
            <FoodPicker onPick={(item) => setPicked(item)} excludeFish={excludeFish} hideRecipes />
          </div>
        </div>
      )}
      {picked && (
        <QuantitySheet
          item={picked}
          mode="ingredient"
          onClose={() => setPicked(null)}
          onSubmit={({ grams }) => {
            const per100 = { kcal: picked.kcal, protein: picked.protein, carbs: picked.carbs, fat: picked.fat }
            setItems([...recipe.items, { ref: picked.ref, name: picked.name, grams, per100, ...forGrams(per100, grams) }])
            setPicked(null)
            setPicking(false)
          }}
        />
      )}
    </div>
  )
}
