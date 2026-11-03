import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import Icon from '../../components/Icon'
import { ensureSeed, listRecipes, listIngredients, indexById, getRecipe, saveRecipeV2, removeRecipe, addPlan, loadSettings } from './api'
import { CATEGORIES, RAYONS } from './seed'
import { recipeLines, totals, qtyLabel, lineValues } from './plan'
import { MEALS, DAY_NAMES } from './data'
import { tokens, scoreName } from './ciqual'
import { norm } from './data'
import { FoodNav, fmt, euro } from './ui'
import { IngredientSheet } from './sheets'
import FoodPicker from './FoodPicker'
import ScanSheet from './ScanSheet'
import { lookupBarcode } from './off'
import { BackBar } from '../sport/ui'
import { keyOf, parseDay } from '../sport/planner'

const catName = (k) => CATEGORIES.find((c) => c.key === k)?.name || k
const catOrder = (k) => CATEGORIES.findIndex((c) => c.key === k)
const recipeMeta = (r) =>
  [catName(r.category), r.batch && r.category !== 'plat' ? 'en lot' : null, Number(r.servings) > 1 ? `${r.servings} portions` : null, r.prep_min ? `${r.prep_min} min` : null]
    .filter(Boolean)
    .join(' · ')

function useCatalog() {
  const [data, setData] = useState(null)
  const reload = async () => {
    await ensureSeed()
    const [recipes, ings] = await Promise.all([listRecipes(), listIngredients()])
    setData({ recipes, ings, ingById: indexById(ings) })
  }
  useEffect(() => {
    reload()
  }, [])
  return [data, reload]
}

/* ---------- Bibliothèque ---------- */

export function RecipeList() {
  const [data] = useCatalog()
  const [cat, setCat] = useState('tout')
  const [q, setQ] = useState('')

  const list = useMemo(() => {
    if (!data) return []
    const toks = tokens(q)
    return data.recipes
      .filter((r) => (toks.length ? scoreName(norm(r.name), toks) >= 0 : cat === 'tout' || r.category === cat))
      .sort((a, b) => catOrder(a.category) - catOrder(b.category) || a.name.localeCompare(b.name, 'fr'))
      .map((r) => ({ r, t: totals(recipeLines(r, data.ingById, 1)) }))
  }, [data, cat, q])

  return (
    <div className="page food">
      <h1 className="large-title">Alimentation</h1>
      <FoodNav />
      <div className="search-bar">
        <Icon name="search" size={18} />
        <input type="search" placeholder="Rechercher une recette" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Rechercher une recette" />
      </div>
      {!q && (
        <div className="chips left cat-chips">
          {[{ key: 'tout', name: 'Toutes' }, ...CATEGORIES].map((c) => (
            <button key={c.key} className={cat === c.key ? 'chip is-on' : 'chip'} onClick={() => setCat(c.key)}>{c.name}</button>
          ))}
        </div>
      )}
      {!data && <p className="muted-line">Chargement…</p>}
      {data && !data.recipes.length && (
        <div className="callout">
          <span className="callout-icon"><Icon name="info" size={20} /></span>
          <p className="callout-text">
            Pas encore de recette. Crée les tiennes avec « Nouvelle recette » : choisis les ingrédients (prix et valeurs déjà connus), les quantités pour toutes les portions, et les étapes.
          </p>
        </div>
      )}
      <ul className="recipe-grid">
        {list.map(({ r, t }) => (
          <li key={r.id}>
            <Link to={r.id} className="recipe-card">
              <span className="recipe-cat">{recipeMeta(r)}</span>
              <span className="recipe-name">{r.name}</span>
              <span className="recipe-macros">
                <strong>{fmt(t.kcal)}</strong> kcal · <strong>{fmt(t.protein)}</strong> g prot.
              </span>
              <span className="recipe-cost">{euro(t.cost)} la portion</span>
            </Link>
          </li>
        ))}
      </ul>
      <Link to="nouvelle" className="btn-primary as-link">Nouvelle recette</Link>
      <Link to="/alimentation/ingredients" className="btn-plain as-link">Ingrédients et prix</Link>
    </div>
  )
}

/* ---------- Fiche recette ---------- */

export function RecipeDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [data] = useCatalog()
  const [servings, setServings] = useState(null)
  const [planning, setPlanning] = useState(false)
  const [confirm, setConfirm] = useState(false)

  const recipe = data?.recipes.find((r) => r.id === id)
  useEffect(() => {
    if (recipe && servings == null) setServings(Number(recipe.servings) || 1)
  }, [recipe, servings])

  if (!data) return <div className="page food"><BackBar to="/alimentation/recettes" label="Recettes" /><p className="muted-line">Chargement…</p></div>
  if (!recipe) return <div className="page food"><BackBar to="/alimentation/recettes" label="Recettes" /><p className="muted-line">Recette introuvable.</p></div>

  const one = totals(recipeLines(recipe, data.ingById, 1))
  const lines = recipeLines(recipe, data.ingById, servings || recipe.servings)
  const all = totals(lines)

  return (
    <div className="page food">
      <BackBar to="/alimentation/recettes" label="Recettes" />
      <p className="recipe-cat">{recipeMeta(recipe)}</p>
      <h1 className="doc-title">{recipe.name}</h1>

      <div className="stats four">
        <div className="stat"><span>kcal</span><strong>{fmt(one.kcal)}</strong></div>
        <div className="stat"><span>Protéines</span><strong>{fmt(one.protein)} g</strong></div>
        <div className="stat"><span>Glucides</span><strong>{fmt(one.carbs)} g</strong></div>
        <div className="stat"><span>Prix</span><strong>{euro(one.cost)}</strong></div>
      </div>
      <p className="group-foot">Pour 1 portion · lipides {fmt(one.fat)} g. Dans le planning, les féculents s’ajustent à ta cible du jour.</p>

      <h2 className="group-title recipe-ing-title">
        <span>Ingrédients</span>
        <span className="servings-step">
          <button className="icon-btn small" aria-label="Moins de portions" onClick={() => setServings(Math.max(1, servings - 1))}><Icon name="minus" size={16} /></button>
          {servings} portion{servings > 1 ? 's' : ''}
          <button className="icon-btn small" aria-label="Plus de portions" onClick={() => setServings(servings + 1)}><Icon name="plus" size={16} /></button>
        </span>
      </h2>
      <ul className="group lines">
        {lines.map((l, i) => (
          <li key={i} className="row">
            <span className="row-label">{l.ing.name}</span>
            <span className="row-value">{qtyLabel(l.ing, l.grams)}</span>
            <span className="line-cost">{euro(l.cost)}</span>
          </li>
        ))}
      </ul>
      <p className="group-foot">Total : {fmt(all.kcal)} kcal · {euro(all.cost)} pour {servings} portion{servings > 1 ? 's' : ''}.</p>

      {recipe.steps && (
        <>
          <h2 className="group-title">Préparation</h2>
          <ol className="steps">
            {recipe.steps.split('\n').filter(Boolean).map((s, i) => <li key={i}>{s}</li>)}
          </ol>
        </>
      )}

      <button className="btn-primary" onClick={() => setPlanning(true)}>Planifier</button>
      <Link to="modifier" className="btn-secondary as-link">Modifier</Link>
      <button className="btn-plain danger" onClick={async () => { if (!confirm) return setConfirm(true); await removeRecipe(recipe.id); navigate('/alimentation/recettes') }}>
        {confirm ? 'Confirmer la suppression' : 'Supprimer la recette'}
      </button>

      {planning && <PlanSheet recipe={recipe} onClose={() => setPlanning(false)} onDone={() => navigate('/alimentation/planning')} />}
    </div>
  )
}

function PlanSheet({ recipe, onClose, onDone }) {
  const today = keyOf(new Date())
  const days = Array.from({ length: 10 }, (_, i) => {
    const d = parseDay(today)
    d.setDate(d.getDate() + i)
    return keyOf(d)
  })
  const cat = CATEGORIES.find((c) => c.key === recipe.category)
  const [date, setDate] = useState(today)
  const [meal, setMeal] = useState(cat?.meals[0] ?? 1)
  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div className="sheet" role="dialog" aria-label="Planifier" onClick={(e) => e.stopPropagation()}>
        <p className="sheet-title">Planifier « {recipe.name} »</p>
        <div className="chips left">
          {days.map((d, i) => (
            <button key={d} className={date === d ? 'chip is-on' : 'chip'} onClick={() => setDate(d)}>
              {i === 0 ? 'Aujourd’hui' : i === 1 ? 'Demain' : `${DAY_NAMES[(parseDay(d).getDay() + 6) % 7].slice(0, 3)} ${parseDay(d).getDate()}`}
            </button>
          ))}
        </div>
        <div className="segmented meal-seg">
          {MEALS.map((m) => <button key={m.key} className={meal === m.key ? 'is-on' : ''} onClick={() => setMeal(m.key)}>{m.short}</button>)}
        </div>
        <button className="btn-primary" onClick={async () => { await addPlan({ date, meal, recipe_id: recipe.id }); onDone() }}>Ajouter au planning</button>
        <button className="btn-plain" onClick={onClose}>Annuler</button>
      </div>
    </div>
  )
}

/* ---------- Création / modification ---------- */

export function RecipeEditor() {
  const { id } = useParams()
  const navigate = useNavigate()
  const isNew = !id
  const [data, reload] = useCatalog()
  const [recipe, setRecipe] = useState(null)
  const [choosing, setChoosing] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!data || recipe) return
    if (isNew) setRecipe({ name: '', category: 'plat', servings: 4, prep_min: '', batch: true, steps: '', lines: [], cooked_g: '' })
    else getRecipe(id).then((r) => setRecipe(r ? { ...r, prep_min: r.prep_min ?? '', cooked_g: r.cooked_measured ? r.cooked_g : '', lines: r.lines || [] } : { missing: true }))
  }, [data, id, isNew, recipe])

  if (!data || !recipe) return <div className="page food"><BackBar to="/alimentation/recettes" label="Recettes" /><p className="muted-line">Chargement…</p></div>
  if (recipe.missing) return <div className="page food"><BackBar to="/alimentation/recettes" label="Recettes" /><p className="muted-line">Recette introuvable.</p></div>

  const set = (patch) => setRecipe({ ...recipe, ...patch })
  const lines = recipe.lines.map((l, idx) => ({ ...l, idx, ing: data.ingById[l.ingredient_id] })).filter((l) => l.ing)
  const t = totals(lines.map((l) => ({ grams: Number(String(l.grams).replace(',', '.')) || 0, ...lineValues(l.ing, Number(String(l.grams).replace(',', '.')) || 0) })))
  const n = Number(recipe.servings) || 1

  async function save() {
    if (!recipe.name.trim()) return setError('Donne un nom à la recette.')
    if (!recipe.lines.length && !recipe.items?.length) return setError('Ajoute au moins un ingrédient.')
    const saved = await saveRecipeV2(recipe, data.ingById)
    navigate(`/alimentation/recettes/${saved.id}`)
  }

  return (
    <div className="page food">
      <BackBar to={isNew ? '/alimentation/recettes' : `/alimentation/recettes/${id}`} label={isNew ? 'Recettes' : 'Recette'} />
      <input className="title-input" placeholder="Nom de la recette" value={recipe.name} onChange={(e) => set({ name: e.target.value })} aria-label="Nom de la recette" />

      <div className="chips left">
        {CATEGORIES.map((c) => (
          <button key={c.key} className={recipe.category === c.key ? 'chip is-on' : 'chip'} onClick={() => set({ category: c.key, batch: c.key === 'plat' })}>{c.name}</button>
        ))}
      </div>
      <ul className="group">
        <li className="row row-field">
          <label className="row-label" htmlFor="re-serv">Nombre de portions</label>
          <input id="re-serv" inputMode="numeric" value={recipe.servings} onChange={(e) => set({ servings: e.target.value })} />
        </li>
        <li className="row row-field">
          <label className="row-label" htmlFor="re-min">Temps de préparation</label>
          <input id="re-min" inputMode="numeric" placeholder="20" value={recipe.prep_min} onChange={(e) => set({ prep_min: e.target.value })} />
          <span className="row-value">min</span>
        </li>
        <li className="row">
          <label className="switch">
            <input type="checkbox" checked={!!recipe.batch} onChange={(e) => set({ batch: e.target.checked })} />
            <span aria-hidden="true" />
            <span className="row-label">Plat en lot (plusieurs repas)</span>
          </label>
        </li>
      </ul>

      <h2 className="group-title">Ingrédients pour {n} portion{n > 1 ? 's' : ''} (poids crus)</h2>
      <ul className="group">
        {lines.map((l, i) => (
          <li key={i} className="row ingredient-row">
            <span className="food-main">
              <span className="food-name">{l.ing.name}</span>
              <span className="food-sub">{fmt(lineValues(l.ing, Number(String(l.grams).replace(',', '.')) || 0).kcal)} kcal · {euro(lineValues(l.ing, Number(String(l.grams).replace(',', '.')) || 0).cost)}</span>
            </span>
            <span className="grams-input">
              <input inputMode="decimal" value={l.grams} aria-label={`Grammes de ${l.ing.name}`} onChange={(e) => set({ lines: recipe.lines.map((x, k) => (k === l.idx ? { ...x, grams: e.target.value } : x)) })} />
              g
            </span>
            <button className="icon-btn small" aria-label={`Retirer ${l.ing.name}`} onClick={() => set({ lines: recipe.lines.filter((_, k) => k !== l.idx) })}>
              <Icon name="close" size={16} />
            </button>
          </li>
        ))}
        <li>
          <button className="row row-action" onClick={() => setChoosing(true)}>
            <Icon name="plus" size={18} stroke={2} /> Ajouter un ingrédient
          </button>
        </li>
      </ul>
      <div className="stats">
        <div className="stat"><span>Par portion</span><strong>{fmt(t.kcal / n)} kcal</strong></div>
        <div className="stat"><span>Protéines</span><strong>{fmt(t.protein / n)} g</strong></div>
        <div className="stat"><span>Prix</span><strong>{euro(t.cost / n)}</strong></div>
      </div>

      <ul className="group">
        <li className="row row-field">
          <label className="row-label" htmlFor="re-cooked">Poids du plat cuit</label>
          <input id="re-cooked" inputMode="decimal" placeholder="facultatif" value={recipe.cooked_g} onChange={(e) => set({ cooked_g: e.target.value })} />
          <span className="row-value">g</span>
        </li>
      </ul>
      <p className="group-foot">Pèse la casserole vide puis pleine : utile pour noter une portion en grammes (« 350 g de chili »). Sinon, on compte en portions.</p>

      <h2 className="group-title">Préparation (une étape par ligne)</h2>
      <textarea className="steps-input" rows={6} value={recipe.steps || ''} onChange={(e) => set({ steps: e.target.value })} placeholder={'Faire revenir…\nAjouter…'} />

      {error && <p className="group-foot is-error">{error}</p>}
      <button className="btn-primary" onClick={save}>Enregistrer la recette</button>

      {choosing && (
        <IngredientChooser
          ings={data.ings}
          onClose={() => setChoosing(false)}
          onCreated={reload}
          onPick={(ing) => {
            set({ lines: [...recipe.lines, { ingredient_id: ing.id, grams: ing.unit_g || 100 }] })
            setChoosing(false)
          }}
        />
      )}
    </div>
  )
}

/* ---------- Choisir ou créer un ingrédient ---------- */

export function IngredientChooser({ ings, onPick, onClose, onCreated, startNew = false }) {
  const [q, setQ] = useState('')
  const [fromCiqual, setFromCiqual] = useState(startNew)
  const [scanning, setScanning] = useState(false)
  const [scanMsg, setScanMsg] = useState('')
  const [draft, setDraft] = useState(null)
  const [excludeFish, setExcludeFish] = useState(true)
  useEffect(() => {
    loadSettings().then((s) => setExcludeFish(s.exclude_fish !== false))
  }, [])
  const toks = tokens(q)
  const list = toks.length ? ings.filter((i) => scoreName(norm(i.name), toks) >= 0) : ings

  return (
    <div className="overlay">
      <div className="overlay-page">
        <div className="back-bar">
          <button className="back-link link-btn" onClick={fromCiqual && !startNew ? () => setFromCiqual(false) : onClose}>
            <Icon name="back" size={20} stroke={2} /> {fromCiqual && !startNew ? 'Mes ingrédients' : 'Retour'}
          </button>
        </div>
        <h1 className="large-title">{fromCiqual ? 'Nouvel ingrédient' : 'Ingrédient'}</h1>
        {fromCiqual && (
          <p className="muted-line">
            Cherche le produit dans la table Ciqual (valeurs remplies pour toi), scanne son code-barres, ou crée-le à partir de l’étiquette.
            {scanMsg && <><br />{scanMsg}</>}
          </p>
        )}
        {fromCiqual ? (
          <FoodPicker
            excludeFish={excludeFish}
            hideRecipes
            onScan={() => setScanning(true)}
            onCreate={(name) => setDraft({ name: name || '', rayon: 'Épicerie', kcal: '', protein: '', carbs: '', fat: '' })}
            onPick={(item) =>
              setDraft({
                name: item.name, rayon: 'Épicerie', ciqual_code: item.source === 'ciqual' ? item.code : null,
                kcal: item.kcal, protein: item.protein, carbs: item.carbs, fat: item.fat,
                unit_g: item.portions?.[0]?.g ?? '', unit_name: item.portions?.[0]?.label?.replace(/^1 /, '') ?? ''
              })
            }
          />
        ) : (
          <>
            <div className="search-bar">
              <Icon name="search" size={18} />
              <input type="search" autoFocus placeholder="Rechercher dans tes ingrédients" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Rechercher un ingrédient" />
            </div>
            <button className="btn-secondary" onClick={() => setFromCiqual(true)}>
              <Icon name="plus" size={18} stroke={2} /> Nouvel ingrédient (table Ciqual ou étiquette)
            </button>
            {RAYONS.map((rayon) => {
              const sub = list.filter((i) => i.rayon === rayon)
              if (!sub.length) return null
              return (
                <section key={rayon}>
                  <h2 className="group-title">{rayon}</h2>
                  <ul className="group">
                    {sub.map((i) => (
                      <li key={i.id}>
                        <button className="row food-row" onClick={() => onPick(i)}>
                          <span className="food-main">
                            <span className="food-name">{i.name}</span>
                            <span className="food-sub">{fmt(i.kcal)} kcal · {fmt(i.protein, 1)} g prot. / 100 g · {i.pack_price != null ? `${euro(i.pack_price)} (${i.pack_label || ''})` : 'prix ?'}</span>
                          </span>
                          <span className="row-chevron"><Icon name="plus" size={18} stroke={2} /></span>
                        </button>
                      </li>
                    ))}
                  </ul>
                </section>
              )
            })}
          </>
        )}
      </div>
      {scanning && (
        <ScanSheet
          onClose={() => setScanning(false)}
          onCode={async (code) => {
            setScanning(false)
            setScanMsg(`Code ${code} : recherche du produit…`)
            try {
              const res = await lookupBarcode(code)
              const f = res.found ? res.food : {}
              setScanMsg(res.found ? (res.complete ? '' : 'Produit incomplet : complète les valeurs de l’étiquette.') : 'Produit inconnu d’Open Food Facts : recopie l’étiquette.')
              setDraft({
                name: f.name || '', rayon: 'Épicerie', kcal: f.kcal ?? '', protein: f.protein ?? '', carbs: f.carbs ?? '', fat: f.fat ?? '',
                pack_label: f.quantity || '', pack_g: f.pack_g ?? ''
              })
            } catch (e) {
              setScanMsg(e.message)
              setDraft({ name: '', rayon: 'Épicerie', kcal: '', protein: '', carbs: '', fat: '' })
            }
          }}
        />
      )}
      {draft && (
        <IngredientSheet
          ingredient={draft}
          onClose={() => setDraft(null)}
          onSaved={async (saved) => {
            setDraft(null)
            await onCreated()
            onPick(saved)
          }}
        />
      )}
    </div>
  )
}

/* ---------- Catalogue des ingrédients et prix ---------- */

export function IngredientsView() {
  const [data, reload] = useCatalog()
  const [editing, setEditing] = useState(null)
  const [adding, setAdding] = useState(false)
  if (!data) return <div className="page food"><BackBar to="/alimentation/recettes" label="Recettes" /><p className="muted-line">Chargement…</p></div>
  return (
    <div className="page food">
      <BackBar to="/alimentation/recettes" label="Recettes" />
      <h1 className="large-title">Ingrédients et prix</h1>
      <p className="muted-line">Prix Colruyt estimés au départ : corrige-les avec ton ticket, toutes les recettes et la liste de courses suivent.</p>
      {RAYONS.map((rayon) => {
        const sub = data.ings.filter((i) => i.rayon === rayon)
        if (!sub.length) return null
        return (
          <section key={rayon}>
            <h2 className="group-title">{rayon}</h2>
            <ul className="group">
              {sub.map((i) => (
                <li key={i.id}>
                  <button className="row food-row" onClick={() => setEditing(i)}>
                    <span className="food-main">
                      <span className="food-name">{i.name}{i.scalable ? ' · féculent' : ''}{i.pantry ? ' · placard' : ''}</span>
                      <span className="food-sub">{i.pack_label || '—'}{i.price_date ? ` · prix du ${new Date(`${i.price_date}T12:00`).toLocaleDateString('fr-BE')}` : ' · prix estimé'}</span>
                    </span>
                    <span className="row-value">{i.pack_price != null ? euro(i.pack_price) : '—'}</span>
                  </button>
                </li>
              ))}
            </ul>
          </section>
        )
      })}
      <button className="btn-primary" onClick={() => setAdding(true)}>Nouvel ingrédient</button>
      {editing && <IngredientSheet ingredient={editing} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); reload() }} onDeleted={() => { setEditing(null); reload() }} />}
      {adding && <IngredientChooser startNew ings={data.ings} onClose={() => setAdding(false)} onCreated={reload} onPick={() => setAdding(false)} />}
    </div>
  )
}
