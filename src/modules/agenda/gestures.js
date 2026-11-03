// Gestes du calendrier, communs à la souris et au doigt.
//   - souris : appuyer puis bouger (ou maintenir pour certains gestes) ;
//   - doigt : appui long (0,35 s) puis glisser ; sans appui long, le doigt fait défiler
//     la grille normalement, et un balayage horizontal change de jours.
// Les écouteurs sont posés à la main (touchmove non « passive ») : c'est la seule façon
// d'empêcher le défilement pendant qu'on glisse un évènement sur iPhone.
import { useEffect } from 'react'

const HOLD_MS = 350

/**
 * handlersRef.current = {
 *   start(target, x, y, touch) → données du geste ou null (ignorer)
 *                                (data.holdToActivate : la souris active aussi en maintenant)
 *                                (data.noActivate : simple toucher, jamais de glisser)
 *   activate(data, x, y), move(data, x, y), end(data, { active, moved, swipe, x, y })
 * }
 */
export function usePress(ref, handlersRef) {
  useEffect(() => {
    const el = ref.current
    if (!el) return undefined
    let g = null
    let timer = null
    let lastTouch = 0
    const h = () => handlersRef.current

    const activate = () => {
      if (!g || g.active || g.data.noActivate) return
      g.active = true
      h().activate?.(g.data, g.x, g.y)
      if (g.touch) navigator.vibrate?.(8)
    }

    const begin = (target, x, y, touch) => {
      const data = h().start(target, x, y, touch)
      if (!data) return false
      g = { data, x0: x, y0: y, x, y, touch, active: false, moved: false }
      if (!data.noActivate && (touch || data.holdToActivate)) timer = setTimeout(activate, HOLD_MS)
      return true
    }

    const moveTo = (x, y) => {
      if (!g) return false
      g.x = x
      g.y = y
      if (!g.active) {
        if (Math.hypot(x - g.x0, y - g.y0) <= (g.touch ? 8 : 5)) return false
        g.moved = true
        clearTimeout(timer)
        if (g.touch || g.data.noActivate) return false // le doigt fait défiler / balaye
        activate()
      }
      h().move?.(g.data, x, y)
      return true
    }

    const finish = (x, y) => {
      if (!g) return
      clearTimeout(timer)
      const done = g
      g = null
      const dx = x - done.x0
      const dy = y - done.y0
      const swipe = done.touch && !done.active && Math.abs(dx) > 60 && Math.abs(dx) > 2 * Math.abs(dy) ? Math.sign(dx) : 0
      h().end?.(done.data, { active: done.active, moved: done.moved, swipe, x, y })
    }

    /* souris */
    const onMouseMove = (e) => moveTo(e.clientX, e.clientY)
    const onMouseUp = (e) => {
      window.removeEventListener('mousemove', onMouseMove)
      window.removeEventListener('mouseup', onMouseUp)
      finish(e.clientX, e.clientY)
    }
    const onMouseDown = (e) => {
      if (e.button !== 0 || Date.now() - lastTouch < 800) return
      if (!begin(e.target, e.clientX, e.clientY, false)) return
      e.preventDefault() // pas de sélection de texte pendant le glisser
      window.addEventListener('mousemove', onMouseMove)
      window.addEventListener('mouseup', onMouseUp)
    }

    /* doigt */
    const onTouchStart = (e) => {
      lastTouch = Date.now()
      if (e.touches.length > 1) {
        clearTimeout(timer)
        g = null
        return
      }
      const t = e.touches[0]
      begin(e.target, t.clientX, t.clientY, true)
    }
    const onTouchMove = (e) => {
      if (!g) return
      const t = e.touches[0]
      moveTo(t.clientX, t.clientY)
      if (g?.active) e.preventDefault()
    }
    const onTouchEnd = (e) => {
      lastTouch = Date.now()
      const t = e.changedTouches[0]
      if (g?.active) e.preventDefault() // pas de clic fantôme après un glisser
      finish(t.clientX, t.clientY)
    }
    const onTouchCancel = () => {
      clearTimeout(timer)
      if (g) h().end?.(g.data, { active: false, moved: true, swipe: 0, cancelled: true })
      g = null
    }
    const onContext = (e) => {
      if (g) e.preventDefault() // pas de menu contextuel sur l'appui long
    }

    el.addEventListener('mousedown', onMouseDown)
    el.addEventListener('touchstart', onTouchStart, { passive: true })
    el.addEventListener('touchmove', onTouchMove, { passive: false })
    el.addEventListener('touchend', onTouchEnd, { passive: false })
    el.addEventListener('touchcancel', onTouchCancel)
    el.addEventListener('contextmenu', onContext)
    return () => {
      clearTimeout(timer)
      el.removeEventListener('mousedown', onMouseDown)
      el.removeEventListener('touchstart', onTouchStart)
      el.removeEventListener('touchmove', onTouchMove)
      el.removeEventListener('touchend', onTouchEnd)
      el.removeEventListener('touchcancel', onTouchCancel)
      el.removeEventListener('contextmenu', onContext)
      window.removeEventListener('mousemove', onMouseMove)
      window.removeEventListener('mouseup', onMouseUp)
    }
  }, [ref, handlersRef])
}

// Case (data-cell) sous le doigt / la souris, dans `root`.
export function cellAt(root, x, y) {
  const el = document.elementFromPoint(x, y)?.closest('[data-cell]')
  if (!el || !root.contains(el)) return null
  return Number(el.dataset.cell)
}
