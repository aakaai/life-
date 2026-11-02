import { useEffect, useMemo, useState } from 'react'
import Icon from '../../components/Icon'
import { loadCiqual, searchCiqual, tokens, scoreName } from './ciqual'
import { favorites, listFoods, listRecipes, recentItems, foodItem, recipeItem } from './api'
import { norm } from './data'
import { fmt } from './ui'

// Recherche d'aliments : tes aliments et recettes d'abord, puis la table Ciqual.
// Sans recherche : récents, favoris, recettes.
export default function FoodPicker({ onPick, onScan, onCreate, excludeFish = true, autoFocus = true, hideRecipes = false }) {
  const [q, setQ] = useState('')
  const [ciqual, setCiqual] = useState(null)
  const [mine, setMine] = useState({ foods: [], recipes: [], recents: [], favs: [] })

  useEffect(() => {
    loadCiqual().then(setCiqual)
    Promise.all([listFoods(), listRecipes(), recentItems(), favorites()]).then(([foods, recipes, recents, favs]) =>
      setMine({
        foods: foods.filter((f) => f.source !== 'ciqual').map(foodItem),
        recipes: hideRecipes ? [] : recipes.map(recipeItem),
        recents: hideRecipes ? recents.filter((r) => r.source !== 'recipe') : recents,
        favs
      })
    )
  }, [hideRecipes])

  const results = useMemo(() => {
    const toks = tokens(q)
    if (!toks.length) return null
    const own = [...mine.recipes, ...mine.foods]
      .map((item) => ({ item, s: scoreName(norm(`${item.name} ${item.brand || ''}`), toks) }))
      .filter((x) => x.s >= 0)
      .sort((a, b) => b.s - a.s)
      .map((x) => x.item)
    const base = ciqual ? searchCiqual(ciqual, q, { excludeFish, limit: 40 }) : []
    return { own, base }
  }, [q, ciqual, mine, excludeFish])

  return (
    <div className="picker">
      <div className="search-bar">
        <Icon name="search" size={18} />
        <input
          type="search"
          placeholder="Rechercher un aliment"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          autoFocus={autoFocus}
          aria-label="Rechercher un aliment"
          enterKeyHint="search"
        />
        {q && (
          <button className="icon-btn small" onClick={() => setQ('')} aria-label="Effacer">
            <Icon name="close" size={16} />
          </button>
        )}
      </div>

      {(onScan || onCreate) && (
        <div className="picker-actions">
          {onScan && (
            <button className="btn-secondary" onClick={onScan}>
              <Icon name="barcode" size={20} stroke={1.9} /> Scanner
            </button>
          )}
          {onCreate && (
            <button className="btn-secondary" onClick={() => onCreate(q)}>
              <Icon name="plus" size={18} stroke={2} /> Créer
            </button>
          )}
        </div>
      )}

      {results ? (
        <>
          {results.own.length > 0 && <ItemGroup title="Tes aliments et recettes" items={results.own} onPick={onPick} />}
          {!ciqual && <p className="muted-line">Chargement de la table Ciqual…</p>}
          {ciqual && results.base.length > 0 && <ItemGroup title="Table Ciqual" items={results.base} onPick={onPick} excludeFish={excludeFish} />}
          {ciqual && !results.own.length && !results.base.length && (
            <p className="muted-line">Rien trouvé. Essaie un autre mot, scanne l’emballage ou crée l’aliment.</p>
          )}
        </>
      ) : (
        <>
          {mine.recents.length > 0 && <ItemGroup title="Récents" items={mine.recents} onPick={onPick} showLast />}
          {mine.favs.length > 0 && <ItemGroup title="Favoris" items={mine.favs} onPick={onPick} />}
          {mine.recipes.length > 0 && <ItemGroup title="Mes recettes" items={mine.recipes} onPick={onPick} />}
          {!mine.recents.length && !mine.favs.length && (
            <p className="muted-line">Tape le nom d’un aliment : « riz cru », « oeuf », « poulet filet »… ou scanne un emballage.</p>
          )}
        </>
      )}
      <p className="source-note">Valeurs nutritionnelles : Anses, table Ciqual 2025 · Open Food Facts.</p>
    </div>
  )
}

function ItemGroup({ title, items, onPick, showLast, excludeFish }) {
  return (
    <>
      <h2 className="group-title">{title}</h2>
      <ul className="group">
        {items.map((it) => (
          <li key={it.ref}>
            <button className={`row food-row${excludeFish && it.fish ? ' is-excluded' : ''}`} onClick={() => onPick(it)}>
              <span className="food-main">
                <span className="food-name">
                  {it.name}
                  {it.brand && <span className="food-brand"> · {it.brand}</span>}
                </span>
                <span className="food-sub">
                  {fmt(it.kcal)} kcal · {fmt(it.protein, 1)} g prot. / 100 g
                  {showLast && it.lastGrams ? ` · dernière fois ${fmt(it.lastGrams)} g` : ''}
                </span>
              </span>
              {it.source === 'recipe' && <span className="tag">Recette</span>}
              {it.source === 'off' && <span className="tag">Scanné</span>}
              {it.favorite && <span className="fav-dot" aria-label="Favori"><Icon name="star" size={14} /></span>}
              {excludeFish && it.fish && <span className="tag">Poisson</span>}
              <span className="row-chevron"><Icon name="plus" size={18} stroke={2} /></span>
            </button>
          </li>
        ))}
      </ul>
    </>
  )
}
