import { useState } from 'react'
import Icon from '../../components/Icon'
import { MEALS, forGrams } from './data'
import { fmt, per100Line } from './ui'

// Feuille « quantité » : combien de grammes, dans quel repas.
// mode : 'add' (ajouter au journal), 'edit' (modifier une ligne), 'ingredient' (recette, sans repas)
export default function QuantitySheet({ item, grams: initialGrams, meal: initialMeal = 0, mode = 'add', onSubmit, onDelete, onClose, onFavorite }) {
  const firstPortion = item.portions?.[0]
  const [grams, setGrams] = useState(String(initialGrams ?? firstPortion?.g ?? 100))
  const [meal, setMeal] = useState(initialMeal)
  const [fav, setFav] = useState(!!item.favorite)
  const [busy, setBusy] = useState(false)
  const g = Number(String(grams).replace(',', '.')) || 0
  const v = forGrams(item, g)

  async function submit(e) {
    e.preventDefault()
    if (!g) return
    setBusy(true)
    try {
      await onSubmit({ grams: g, meal })
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <form className="sheet qty-sheet" role="dialog" aria-label={item.name} onClick={(e) => e.stopPropagation()} onSubmit={submit}>
        <div className="qty-head">
          <div>
            <p className="sheet-title">{item.name}</p>
            {item.brand && <p className="qty-brand">{item.brand}</p>}
          </div>
          {onFavorite && (
            <button
              type="button"
              className={fav ? 'icon-btn fav is-on' : 'icon-btn fav'}
              aria-pressed={fav}
              aria-label={fav ? 'Retirer des favoris' : 'Ajouter aux favoris'}
              onClick={async () => {
                setFav(!fav)
                await onFavorite(!fav)
              }}
            >
              <Icon name="star" size={22} />
            </button>
          )}
        </div>
        <p className="qty-per100">{per100Line(item)}</p>

        <label className="qty-grams">
          <input
            inputMode="decimal"
            autoFocus
            value={grams}
            onChange={(e) => setGrams(e.target.value)}
            onFocus={(e) => e.target.select()}
            aria-label="Quantité en grammes"
          />
          <span>g</span>
        </label>
        <div className="chips">
          {(item.portions || []).map((p) => (
            <button type="button" key={p.label} className="chip" onClick={() => setGrams(String(p.g))}>
              {p.label} · {fmt(p.g)} g
            </button>
          ))}
          {[50, 100, 150, 200].map((n) => (
            <button type="button" key={n} className="chip" onClick={() => setGrams(String(n))}>{n} g</button>
          ))}
        </div>

        <div className="qty-values">
          <div><strong>{fmt(v.kcal)}</strong><span>kcal</span></div>
          <div><strong>{fmt(v.protein, 1)}</strong><span>protéines</span></div>
          <div><strong>{fmt(v.carbs, 1)}</strong><span>glucides</span></div>
          <div><strong>{fmt(v.fat, 1)}</strong><span>lipides</span></div>
        </div>

        {mode !== 'ingredient' && (
          <div className="segmented meal-seg" role="radiogroup" aria-label="Repas">
            {MEALS.map((m) => (
              <button type="button" key={m.key} role="radio" aria-checked={meal === m.key} className={meal === m.key ? 'is-on' : ''} onClick={() => setMeal(m.key)}>
                {m.short}
              </button>
            ))}
          </div>
        )}

        <button className="btn-primary" type="submit" disabled={busy || !g}>
          {mode === 'edit' ? 'Enregistrer' : mode === 'ingredient' ? 'Ajouter à la recette' : 'Ajouter'}
        </button>
        {onDelete && (
          <button type="button" className="btn-plain danger" onClick={onDelete} disabled={busy}>Supprimer</button>
        )}
        <button type="button" className="btn-plain" onClick={onClose}>Annuler</button>
      </form>
    </div>
  )
}
