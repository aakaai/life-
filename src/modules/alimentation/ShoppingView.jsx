import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import Icon from '../../components/Icon'
import { loadPlanRange, loadSettings, shoppingState, saveShoppingState } from './api'
import { periodFor, daysOf, shoppingList, qtyLabel } from './plan'
import { RAYONS } from './seed'
import { DEFAULT_SETTINGS } from './data'
import { FoodNav, euro } from './ui'
import { IngredientSheet } from './sheets'
import { parseDay, keyOf } from '../sport/planner'

const shift = (key, n) => {
  const d = parseDay(key)
  d.setDate(d.getDate() + n)
  return keyOf(d)
}
const fmtDay = new Intl.DateTimeFormat('fr-BE', { weekday: 'long', day: 'numeric', month: 'long' })
const fmtShort = new Intl.DateTimeFormat('fr-BE', { weekday: 'short', day: 'numeric' })
const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1)

// Réserves : produits qui se gardent, souvent encore en stock d'une liste à l'autre.
const RESERVES = ['Épicerie', 'Conserves et sauces']

// Liste de courses : tout ce qu'il faut pour les repas prévus jusqu'aux prochaines courses.
export default function ShoppingView() {
  const today = keyOf(new Date())
  const [shopDays, setShopDays] = useState(null)
  const [period, setPeriod] = useState(null)
  const [items, setItems] = useState(null)
  const [state, setState] = useState(null)
  const [editing, setEditing] = useState(null)

  useEffect(() => {
    loadSettings().then((s) => {
      const days = Array.isArray(s.shop_days) && s.shop_days.length ? s.shop_days : DEFAULT_SETTINGS.shop_days
      setShopDays(days)
      setPeriod(periodFor(today, days))
    })
  }, [today])

  const load = useCallback(async () => {
    if (!period) return
    const [{ days }, st] = await Promise.all([loadPlanRange(daysOf(period)), shoppingState(period.start)])
    setItems(shoppingList(Object.values(days)))
    setState(st)
  }, [period])

  useEffect(() => {
    setItems(null)
    load()
  }, [load])

  async function toggle(list, id) {
    const has = state[list].includes(id)
    const next = { ...state, [list]: has ? state[list].filter((x) => x !== id) : [...state[list], id] }
    setState(next)
    const saved = await saveShoppingState(next)
    if (!next.id) setState({ ...next, id: saved.id })
  }

  if (!period) return <div className="page food"><h1 className="large-title">Alimentation</h1><FoodNav /></div>

  const buy = (items || []).filter((i) => !i.ing.pantry)
  const pantry = (items || []).filter((i) => i.ing.pantry)
  const toPay = buy.filter((i) => !state?.skipped.includes(i.ing.id)).reduce((t, i) => t + i.cost, 0)
  const fresh = buy.filter((i) => !RESERVES.includes(i.ing.rayon)).reduce((t, i) => t + i.cost, 0)
  const used = (items || []).reduce((t, i) => t + i.used, 0)
  const nDays = daysOf(period).length

  return (
    <div className="page food">
      <h1 className="large-title">Alimentation</h1>
      <FoodNav />

      <div className="week-switch">
        <button className="icon-btn" onClick={() => setPeriod(periodFor(shift(period.start, -1), shopDays))} aria-label="Courses précédentes"><Icon name="back" size={20} stroke={2} /></button>
        <div className="week-label">
          <strong>Courses du {fmtDay.format(parseDay(period.start))}</strong>
          <span>pour {nDays} jour{nDays > 1 ? 's' : ''} : {fmtShort.format(parseDay(period.start))} → {fmtShort.format(parseDay(period.end))}</span>
        </div>
        <button className="icon-btn" onClick={() => setPeriod(periodFor(shift(period.end, 1), shopDays))} aria-label="Courses suivantes"><Icon name="chevron" size={20} stroke={2} /></button>
      </div>

      {!items && <p className="muted-line">Calcul de la liste…</p>}
      {items && !items.length && (
        <div className="callout">
          <span className="callout-icon"><Icon name="info" size={20} /></span>
          <p className="callout-text">
            Rien de prévu entre le {fmtDay.format(parseDay(period.start))} et le {fmtDay.format(parseDay(period.end))}.{' '}
            <Link to="/alimentation/planning">Place des recettes dans le planning</Link> : la liste se remplit toute seule.
          </p>
        </div>
      )}

      {items && items.length > 0 && (
        <>
          <div className="stats">
            <div className="stat"><span>À payer</span><strong>{euro(toPay)}</strong></div>
            <div className="stat"><span>Sans les réserves</span><strong>{euro(fresh)}</strong></div>
            <div className="stat"><span>Coût des repas</span><strong>{euro(used)}</strong></div>
          </div>
          <p className="group-foot">
            « À payer » compte des paquets entiers. Touche « J’en ai » pour ce qu’il te reste à la maison. Prix Colruyt estimés : touche un produit pour corriger son prix.
          </p>

          {RAYONS.map((rayon) => {
            const list = buy.filter((i) => i.ing.rayon === rayon)
            if (!list.length) return null
            return (
              <section key={rayon}>
                <h2 className="group-title">{rayon}{RESERVES.includes(rayon) ? ' · vérifie tes réserves' : ''}</h2>
                <ul className="group">
                  {list.map((it) => {
                    const checked = state.checked.includes(it.ing.id)
                    const skipped = state.skipped.includes(it.ing.id)
                    return (
                      <li key={it.ing.id} className={`shop-row${checked ? ' is-checked' : ''}${skipped ? ' is-skipped' : ''}`}>
                        <button className="check" role="checkbox" aria-checked={checked} aria-label={`Acheté : ${it.ing.name}`} onClick={() => toggle('checked', it.ing.id)}>
                          {checked && <Icon name="check" size={14} stroke={2.8} />}
                        </button>
                        <button className="shop-main" onClick={() => setEditing(it.ing)}>
                          <span className="food-name">{it.ing.name}</span>
                          <span className="food-sub">
                            {qtyLabel(it.ing, it.grams)} → {it.packs} × {it.ing.pack_label || 'paquet'} · {it.recipes.slice(0, 2).join(', ')}{it.recipes.length > 2 ? '…' : ''}
                          </span>
                        </button>
                        <span className="shop-price">{skipped ? '—' : euro(it.cost)}</span>
                        <button className={skipped ? 'pill pill-small is-on' : 'pill pill-small'} onClick={() => toggle('skipped', it.ing.id)}>J’en ai</button>
                      </li>
                    )
                  })}
                </ul>
              </section>
            )
          })}

          {pantry.length > 0 && (
            <>
              <h2 className="group-title">Placard : vérifie que tu en as</h2>
              <ul className="group">
                {pantry.map((it) => (
                  <li key={it.ing.id} className="shop-row is-pantry">
                    <button className="shop-main" onClick={() => setEditing(it.ing)}>
                      <span className="food-name">{it.ing.name}</span>
                      <span className="food-sub">{qtyLabel(it.ing, it.grams)} pour cette période</span>
                    </button>
                  </li>
                ))}
              </ul>
            </>
          )}
        </>
      )}

      <p className="group-foot">
        Jours de courses : {(shopDays || []).map((d) => ['lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi', 'dimanche'][d]).join(' et ')} (modifiables dans les <Link to="/alimentation/reglages">réglages</Link>).
      </p>

      {editing && (
        <IngredientSheet
          ingredient={editing}
          onClose={() => setEditing(null)}
          onSaved={() => { setEditing(null); load() }}
        />
      )}
    </div>
  )
}
