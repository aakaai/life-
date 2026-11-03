// Vue Semaine : bande « journée entière » + grille horaire 0 h → 24 h.
// Glisser sur une plage vide = nouvel évènement ; glisser un de tes évènements = le déplacer ;
// tirer son bord du bas = changer sa durée. Les cours, séances et évènements Google s'ouvrent au toucher.
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { usePress, cellAt } from './gestures'
import { keyOf, parseKey, addDays, daysBetween, layoutDay, layoutLanes, hm, toHHMM } from './logic'

const SNAP = 15
const fmtWd = new Intl.DateTimeFormat('fr-BE', { weekday: 'short' })
const wd = (k) => fmtWd.format(parseKey(k)).replace('.', '')

const minutesFrom = (date, dayKey) => Math.round((date - parseKey(dayKey)) / 60000)

export default function WeekGrid({ days, items, hourPx, now, scrollKey, onCreate, onCreateDays, onMove, onOpen, onSwipe }) {
  const today = keyOf(now)
  const first = days[0]
  const scrollRef = useRef(null)
  const bodyRef = useRef(null)
  const alldayRef = useRef(null)
  const [drag, setDrag] = useState(null)
  const [band, setBand] = useState(null)

  const timed = items.filter((it) => !it.allDay)
  const allDay = items.filter((it) => it.allDay)
  const byId = useMemo(() => new Map(items.map((it) => [it.id, it])), [items])

  // au premier affichage (et quand on change de vue) : se placer une heure avant maintenant
  useLayoutEffect(() => {
    const el = scrollRef.current
    if (el) el.scrollTop = Math.max(0, (now.getHours() - 1) * hourPx)
  }, [scrollKey, hourPx])

  /* ---------- évènements de chaque jour ---------- */
  const columns = days.map((d) => {
    const segs = []
    for (const it of timed) {
      if (it.dayStart > d || it.dayEnd < d) continue
      const from = Math.max(0, minutesFrom(it.start, d))
      const to = Math.min(1440, minutesFrom(it.end, d))
      if (to < from || from >= 1440) continue
      segs.push({ it, from, to: Math.max(to, from + 15) })
    }
    return layoutDay(segs)
  })

  const lanes = layoutLanes(
    allDay
      .map((it) => ({
        it,
        a: Math.max(0, daysBetween(first, it.dayStart)),
        b: Math.min(days.length - 1, daysBetween(first, addDays(it.dayEnd, -1)))
      }))
      .filter((x) => x.a <= days.length - 1 && x.b >= 0 && x.a <= x.b)
  )
  const offDays = new Set()
  for (const l of lanes) if (l.it.kind === 'off') for (let i = l.a; i <= l.b; i++) offDays.add(i)
  const laneCount = Math.max(1, ...lanes.map((l) => l.lane + 1))

  /* ---------- glisser dans la grille horaire ---------- */
  const point = (x, y) => {
    const body = bodyRef.current
    const r = body.getBoundingClientRect()
    const cols = [...body.querySelectorAll('[data-col]')]
    let dayIdx = cols.findIndex((c) => {
      const cr = c.getBoundingClientRect()
      return x >= cr.left && x < cr.right
    })
    if (dayIdx === -1) dayIdx = x < cols[0].getBoundingClientRect().left ? 0 : cols.length - 1
    const raw = ((y - r.top) / hourPx) * 60
    return { dayIdx, raw, min: Math.min(1440, Math.max(0, Math.round(raw / SNAP) * SNAP)) }
  }

  const autoScroll = (y) => {
    const el = scrollRef.current
    const r = el.getBoundingClientRect()
    if (y < r.top + 36) el.scrollTop -= 14
    else if (y > r.bottom - 36) el.scrollTop += 14
  }

  const preview = (g, x, y) => {
    const p = point(x, y)
    if (g.mode === 'create') {
      const a = Math.floor(g.p0.raw / SNAP) * SNAP
      const from = Math.min(a, p.min)
      const to = Math.max(a + (g.touch ? 30 : SNAP), p.min)
      return { mode: 'create', dayIdx: g.p0.dayIdx, from, to: Math.min(1440, to) }
    }
    const it = g.item
    const dur = Math.max(SNAP, Math.round((it.end - it.start) / 60000))
    if (g.mode === 'move') {
      const from = Math.min(1440 - SNAP, Math.max(0, Math.round((p.raw - g.offset) / SNAP) * SNAP))
      return { mode: 'move', id: it.id, dayIdx: p.dayIdx, from, to: from + dur }
    }
    // resize : le début ne bouge pas
    const startDay = Math.max(0, daysBetween(first, keyOf(it.start)))
    const from = minutesFrom(it.start, days[startDay])
    const endInStartDay = p.min + (p.dayIdx - startDay) * 1440
    return { mode: 'resize', id: it.id, dayIdx: startDay, from, to: Math.max(from + SNAP, endInStartDay) }
  }

  const grid = useRef(null)
  grid.current = {
    start(target, x, y, touch) {
      const evEl = target.closest('[data-ev]')
      if (evEl) {
        const it = byId.get(evEl.dataset.ev)
        if (!it) return null
        if (!it.editable) return { mode: 'tap', item: it, noActivate: true }
        const p = point(x, y)
        const resize = !!target.closest('[data-resize]') && it.resizable
        return { mode: resize ? 'resize' : 'move', item: it, touch, offset: p.raw - minutesFrom(it.start, days[p.dayIdx]) }
      }
      if (!target.closest('[data-col]')) return null
      return { mode: 'create', p0: point(x, y), touch }
    },
    activate(g, x, y) {
      setDrag(preview(g, x, y))
    },
    move(g, x, y) {
      autoScroll(y)
      setDrag(preview(g, x, y))
    },
    end(g, { active, moved, swipe, x, y }) {
      setDrag(null)
      if (!active) {
        if (swipe) return onSwipe?.(-swipe)
        if (!moved && g.item) onOpen(g.item)
        return
      }
      const p = preview(g, x, y)
      if (g.mode === 'create') return onCreate({ date: days[p.dayIdx], from: p.from, to: p.to })
      const it = g.item
      const unchanged = p.dayIdx === daysBetween(first, keyOf(it.start)) && p.from === minutesFrom(it.start, days[p.dayIdx]) && p.to - p.from === Math.round((it.end - it.start) / 60000)
      if (unchanged) return undefined
      return onMove(it, { date: days[p.dayIdx], startMin: p.from, endMin: p.to })
    }
  }
  usePress(bodyRef, grid)

  /* ---------- glisser dans la bande « journée entière » ---------- */
  const strip = useRef(null)
  strip.current = {
    start(target, x, y, touch) {
      const evEl = target.closest('[data-ev]')
      const cell = cellAt(alldayRef.current, x, y)
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
      setBand(g.mode === 'create' ? { a: g.c0, b: g.c0 } : { id: g.item.id, delta: 0 })
    },
    move(g, x, y) {
      const c = cellAt(alldayRef.current, x, y)
      if (c == null) return
      setBand(g.mode === 'create' ? { a: Math.min(g.c0, c), b: Math.max(g.c0, c) } : { id: g.item.id, delta: c - g.c0 })
      g.last = c
    },
    end(g, { active, moved, swipe }) {
      setBand(null)
      if (!active) {
        if (swipe) return onSwipe?.(-swipe)
        if (!moved && g.item) onOpen(g.item)
        return
      }
      const c = g.last ?? g.c0
      if (g.mode === 'create') return onCreateDays(days[Math.min(g.c0, c)], days[Math.max(g.c0, c)])
      if (c !== g.c0) onMove(g.item, { shiftDays: c - g.c0 })
    }
  }
  usePress(alldayRef, strip)

  const nowTop = (now.getHours() * 60 + now.getMinutes()) * (hourPx / 60)
  const hourLabels = Array.from({ length: 24 }, (_, h) => h)

  return (
    <div className="agc-week" style={{ '--cols': days.length, '--hpx': `${hourPx}px` }}>
      <div className="agc-head">
        <span />
        {days.map((d) => (
          <span key={d} className={d === today ? 'is-today' : ''}>
            {wd(d)}
            <strong>{parseKey(d).getDate()}</strong>
          </span>
        ))}
      </div>

      <div className="agc-allday" ref={alldayRef} style={{ '--lanes': laneCount }}>
        <span className="agc-allday-label">jour</span>
        {days.map((d, i) => (
          <span key={d} data-cell={i} className={['agc-allday-cell', band && band.a != null && i >= band.a && i <= band.b && 'is-sel'].filter(Boolean).join(' ')} style={{ gridColumn: i + 2, gridRow: `1 / span ${laneCount}` }} />
        ))}
        {lanes.map(({ it, a, b, lane }) => {
          const shifted = band?.id === it.id ? band.delta : 0
          return (
            <div
              key={it.id}
              data-ev={it.id}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && onOpen(it)}
              className={['agc-pill', `is-${it.kind}`, shifted && 'is-dragging'].filter(Boolean).join(' ')}
              style={{ '--c': it.color, gridColumn: `${Math.max(0, Math.min(days.length - 1, a + shifted)) + 2} / span ${b - a + 1}`, gridRow: lane + 1 }}
              title={it.title}
            >
              {it.title}
            </div>
          )
        })}
      </div>

      <div className="agc-scroll" ref={scrollRef}>
        <div className="agc-body" ref={bodyRef} style={{ height: 24 * hourPx }}>
          <div className="agc-hours">
            {hourLabels.map((h) => <span key={h} style={{ top: h * hourPx }}>{h ? `${h}:00` : ''}</span>)}
          </div>
          {days.map((d, i) => (
            <div key={d} data-col={i} className={['agc-col', d === today && 'is-today', offDays.has(i) && 'is-off'].filter(Boolean).join(' ')}>
              {hourLabels.map((h) => <span key={h} className="agc-line" style={{ top: h * hourPx }} />)}
              {columns[i].map(({ it, from, to, col, cols }) => {
                const moving = drag && drag.id === it.id
                const short = to - from <= 35
                return (
                  <div
                    key={it.id}
                    data-ev={it.id}
                    role="button"
                    tabIndex={0}
                    aria-label={`${it.title}, ${hm(it.start)}–${hm(it.end)}`}
                    onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && onOpen(it)}
                    className={['agc-ev', `is-${it.kind}`, it.editable && 'is-movable', it.session && `is-${it.session.status}`, it.task?.done && 'is-done', moving && 'is-ghost', short && 'is-short'].filter(Boolean).join(' ')}
                    style={{
                      '--c': it.color,
                      top: (from * hourPx) / 60,
                      height: Math.max(16, ((to - from) * hourPx) / 60 - 2),
                      left: `calc(${(col / cols) * 100}% + 1px)`,
                      width: `calc(${100 / cols}% - 3px)`
                    }}
                  >
                    <span className="agc-ev-name">{it.title}</span>
                    {!short && <span className="agc-ev-meta">{hm(it.start)}{it.meta ? ` · ${it.meta}` : ''}</span>}
                    {it.resizable && <span className="agc-resize" data-resize aria-hidden="true" />}
                  </div>
                )
              })}
              {drag && drag.dayIdx === i && (
                <div className={`agc-ev is-preview is-${drag.mode}`} style={{ '--c': drag.mode === 'create' ? 'var(--accent)' : byId.get(drag.id)?.color, top: (drag.from * hourPx) / 60, height: Math.max(16, ((drag.to - drag.from) * hourPx) / 60 - 2), left: 1, right: 2 }}>
                  <span className="agc-ev-name">{drag.mode === 'create' ? 'Nouvel évènement' : byId.get(drag.id)?.title}</span>
                  <span className="agc-ev-meta">{toHHMM(drag.from)}–{toHHMM(drag.to)}</span>
                </div>
              )}
              {d === today && <span className="agc-now" style={{ top: nowTop }} />}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

export function useNow(step = 60000) {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), step)
    return () => clearInterval(t)
  }, [step])
  return now
}
