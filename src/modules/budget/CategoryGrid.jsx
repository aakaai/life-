// Catégories du mois en cases (v0.21, demande du 3 nov.) : 2 par ligne sur téléphone, 4 sur ordinateur.
// La case se remplit en gris avec le budget utilisé, toute rouge si dépassé ; « + » en haut à droite = dépense
// dans cette catégorie ; toucher la case = détail. Maintenir (doigt) ou glisser (souris) pour réorganiser.
// Catégories sans plafond : pas de remplissage, cachées si rien dépensé ce mois-ci.
import { useEffect, useRef, useState } from 'react'
import Icon from '../../components/Icon'
import { BudgetIcon, iconOf } from './icons'
import { euro } from './ui'

export const isOver = (r) => r.budget != null && r.spent > r.budget + 0.004
export const visibleRows = (rows) => rows.filter((r) => r.budget != null || r.spent > 0)

export function CaseBody({ icon, name, main, unit, sub, extra = null, ratio = null, over = false }) {
  return (
    <>
      {ratio != null && <span className="bcase-fill" style={{ height: `${(over ? 1 : Math.min(1, ratio)) * 100}%` }} />}
      <span className="bcase-head"><BudgetIcon name={icon} size={19} /><span className="bcase-name">{name}</span></span>
      <span className="bcase-amt">{main}{unit && <small> {unit}</small>}</span>
      {extra}
      <span className="bcase-of">{sub}</span>
    </>
  )
}

export function caseText(r) {
  if (r.budget == null) return { main: euro(r.spent), unit: '', sub: 'dépensés · sans plafond' }
  const left = Math.round((r.budget - r.spent) * 100) / 100
  if (isOver(r)) return { main: euro(-left), unit: 'de trop', sub: `${euro(r.spent)} / ${euro(r.budget)}` }
  return { main: euro(left), unit: 'restants', sub: `${euro(r.spent)} / ${euro(r.budget)}` }
}

export default function CategoryGrid({ rows, uncategorized = 0, onOpen, onAdd, onReorder }) {
  const shown = visibleRows(rows)
  const byId = Object.fromEntries(shown.map((r) => [r.cat.id, r]))
  const [order, setOrder] = useState(null)
  const [dragId, setDragId] = useState(null)
  const ids = (order || shown.map((r) => r.cat.id)).filter((id) => byId[id])
  const idsRef = useRef(ids)
  idsRef.current = ids
  const drag = useRef(null)
  const suppress = useRef(false)
  const grid = useRef(null)

  const begin = (id) => {
    drag.current.active = true
    setDragId(id)
    setOrder(shown.map((r) => r.cat.id))
    navigator.vibrate?.(10)
  }
  const moveTo = (x, y) => {
    const over = document.elementFromPoint(x, y)?.closest('[data-cat]')?.dataset.cat
    const id = drag.current?.id
    if (!over || !id || over === id) return
    const cur = [...idsRef.current]
    const to = cur.indexOf(over)
    cur.splice(cur.indexOf(id), 1)
    cur.splice(to, 0, id)
    setOrder(cur)
  }
  const finish = async () => {
    const d = drag.current
    drag.current = null
    clearTimeout(d?.timer)
    if (!d?.active) return
    suppress.current = true
    setTimeout(() => (suppress.current = false), 50)
    setDragId(null)
    const final = idsRef.current
    const before = shown.map((r) => r.cat.id)
    if (final.join() !== before.join()) await onReorder(final)
    setOrder(null)
  }

  // souris : glisser au-delà de 6 px
  const onPointerDown = (e, id) => {
    if (e.pointerType !== 'mouse' || e.button !== 0) return
    drag.current = { id, x: e.clientX, y: e.clientY, active: false }
    const move = (ev) => {
      const d = drag.current
      if (!d) return
      if (!d.active && Math.hypot(ev.clientX - d.x, ev.clientY - d.y) > 6) begin(id)
      if (d.active) moveTo(ev.clientX, ev.clientY)
    }
    const up = () => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
      finish()
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
  }
  // doigt : maintenir 0,35 s puis glisser (sinon la page défile normalement)
  const onTouchStart = (e, id) => {
    const t = e.touches[0]
    drag.current = { id, x: t.clientX, y: t.clientY, active: false, timer: setTimeout(() => drag.current && begin(id), 350) }
  }
  useEffect(() => {
    const el = grid.current
    if (!el) return undefined
    const move = (e) => {
      const d = drag.current
      if (!d) return
      const t = e.touches[0]
      if (!d.active) {
        if (Math.hypot(t.clientX - d.x, t.clientY - d.y) > 8) {
          clearTimeout(d.timer)
          drag.current = null
        }
        return
      }
      e.preventDefault()
      moveTo(t.clientX, t.clientY)
    }
    const end = () => finish()
    el.addEventListener('touchmove', move, { passive: false })
    el.addEventListener('touchend', end)
    el.addEventListener('touchcancel', end)
    return () => {
      el.removeEventListener('touchmove', move)
      el.removeEventListener('touchend', end)
      el.removeEventListener('touchcancel', end)
    }
  })

  return (
    <div className={dragId ? 'bcase-grid compact is-sorting' : 'bcase-grid compact'} ref={grid}>
      {ids.map((id) => {
        const r = byId[id]
        const t = caseText(r)
        const over = isOver(r)
        return (
          <div key={id} data-cat={id} className={['bcase', over && 'is-over', r.budget == null && 'is-nobud', dragId === id && 'is-dragging'].filter(Boolean).join(' ')}>
            <button
              className="bcase-main"
              onClick={() => !suppress.current && onOpen(r)}
              onPointerDown={(e) => onPointerDown(e, id)}
              onTouchStart={(e) => onTouchStart(e, id)}
              onContextMenu={(e) => e.preventDefault()}
              aria-label={`${r.cat.name} : ${t.main} ${t.unit || ''}, ${t.sub}`}
            >
              <CaseBody icon={iconOf(r.cat)} name={r.cat.name} main={t.main} unit={t.unit} sub={t.sub} ratio={r.budget != null ? r.spent / (r.budget || 1) : null} over={over} />
            </button>
            <button className="bcase-add" onClick={() => onAdd(r.cat)} aria-label={`Ajouter une dépense : ${r.cat.name}`}>
              <Icon name="plus" size={16} stroke={2.2} />
            </button>
          </div>
        )
      })}
      {uncategorized > 0 && (
        <div className="bcase is-nobud">
          <div className="bcase-main is-static">
            <CaseBody icon="inconnu" name="Sans catégorie" main={euro(uncategorized)} sub="dépensés" />
          </div>
        </div>
      )}
    </div>
  )
}
