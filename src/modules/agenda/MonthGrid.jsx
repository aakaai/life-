// Vue Mois : 6 semaines, les évènements en pastilles.
// Toucher un jour = sa semaine ; glisser sur des jours (ou maintenir sur un jour) = évènement « journée entière » ;
// glisser un de tes évènements = le changer de jour.
import { useMemo, useRef, useState } from 'react'
import { usePress, cellAt } from './gestures'
import { keyOf, parseKey, addDays, hm } from './logic'

const WEEKDAYS = ['lun', 'mar', 'mer', 'jeu', 'ven', 'sam', 'dim']
const ORDER = { off: 0, agenda: 1, google: 2, sport: 3, cours: 4 }

export default function MonthGrid({ days, month, items, now, narrow, onOpenDay, onCreateDays, onMove, onOpen, onSwipe }) {
  const today = keyOf(now)
  const ref = useRef(null)
  const [sel, setSel] = useState(null)
  const byId = useMemo(() => new Map(items.map((it) => [it.id, it])), [items])
  const max = narrow ? 3 : 4

  const perDay = days.map((d) => {
    const list = items.filter((it) => (it.allDay ? it.dayStart <= d && it.dayEnd > d : it.dayStart <= d && it.dayEnd >= d))
    return list.sort((a, b) =>
      (b.allDay - a.allDay) || (a.allDay ? ORDER[a.kind] - ORDER[b.kind] : a.start - b.start))
  })

  const handlers = useRef(null)
  handlers.current = {
    start(target, x, y, touch) {
      const cell = cellAt(ref.current, x, y)
      const evEl = target.closest('[data-ev]')
      if (evEl) {
        const it = byId.get(evEl.dataset.ev)
        if (!it) return null
        if (!it.editable) return { mode: 'tap', item: it, noActivate: true }
        return { mode: 'move', item: it, c0: cell ?? 0, touch }
      }
      if (cell == null) return null
      return { mode: 'create', c0: cell, holdToActivate: true, touch }
    },
    activate(g) {
      setSel(g.mode === 'create' ? { a: g.c0, b: g.c0 } : { id: g.item.id, at: g.c0 })
    },
    move(g, x, y) {
      const c = cellAt(ref.current, x, y)
      if (c == null) return
      g.last = c
      setSel(g.mode === 'create' ? { a: Math.min(g.c0, c), b: Math.max(g.c0, c) } : { id: g.item.id, at: c })
    },
    end(g, { active, moved, swipe }) {
      setSel(null)
      if (!active) {
        if (swipe) return onSwipe?.(-swipe)
        if (moved) return undefined
        if (g.item) return onOpen(g.item)
        return onOpenDay(days[g.c0])
      }
      const c = g.last ?? g.c0
      if (g.mode === 'create') return onCreateDays(days[Math.min(g.c0, c)], days[Math.max(g.c0, c)])
      if (c !== g.c0) onMove(g.item, { shiftDays: c - g.c0 })
    }
  }
  usePress(ref, handlers)

  return (
    <div className="agc-month">
      <div className="agc-month-head">
        {WEEKDAYS.map((w) => <span key={w}>{w}</span>)}
      </div>
      <div className="agc-month-grid" ref={ref}>
        {days.map((d, i) => {
          const list = perDay[i]
          const shown = list.slice(0, list.length > max ? max - 1 : max)
          const rest = list.length - shown.length
          const dt = parseKey(d)
          const out = dt.getMonth() !== month
          const selected = sel && ((sel.a != null && i >= sel.a && i <= sel.b) || sel.at === i)
          return (
            <div key={d} data-cell={i} className={['agc-day', out && 'is-out', d === today && 'is-today', selected && 'is-sel'].filter(Boolean).join(' ')}>
              <span className="agc-day-num">{dt.getDate() === 1 ? `${dt.getDate()} ${dt.toLocaleDateString('fr-BE', { month: 'short' }).replace('.', '')}` : dt.getDate()}</span>
              {shown.map((it) => (
                <div
                  key={it.id}
                  data-ev={it.id}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && onOpen(it)}
                  className={['agc-mpill', it.allDay ? 'is-allday' : 'is-timed', `is-${it.kind}`, sel?.id === it.id && 'is-ghost'].filter(Boolean).join(' ')}
                  style={{ '--c': it.color }}
                  title={it.title}
                >
                  {!it.allDay && !narrow && <span className="agc-mtime">{hm(it.start)}</span>}
                  <span className="agc-mname">{it.title}</span>
                </div>
              ))}
              {rest > 0 && <span className="agc-more">+{rest}</span>}
            </div>
          )
        })}
      </div>
    </div>
  )
}

export function monthDays(cursor) {
  const d = parseKey(cursor)
  const first = keyOf(new Date(d.getFullYear(), d.getMonth(), 1))
  const start = addDays(first, -((parseKey(first).getDay() + 6) % 7))
  return Array.from({ length: 42 }, (_, i) => addDays(start, i))
}
