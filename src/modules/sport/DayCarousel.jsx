// Semaine sport en cartes de jours (demande du 3 nov.) : 5 jours de face sur ordinateur, 2 sur téléphone ;
// les jours suivants s'inclinent en perspective à droite, les jours passés se replient à gauche.
// Aujourd'hui : carte gris clair. Flèches, clavier ou glisser du doigt pour faire défiler.
import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import Icon from '../../components/Icon'
import { parseDay } from './planner'
import { DAY_NAMES, KindIcon, fmtDuration } from './ui'

const STATUS = { planned: 'Prévue', done: 'Faite', skipped: 'Passée', missed: 'Manquée' }

function useFront() {
  const get = () => (window.innerWidth >= 1100 ? 5 : window.innerWidth >= 900 ? 4 : window.innerWidth >= 560 ? 3 : 2)
  const [n, setN] = useState(get)
  useEffect(() => {
    const on = () => setN(get())
    window.addEventListener('resize', on)
    return () => window.removeEventListener('resize', on)
  }, [])
  return n
}

export default function DayCarousel({ days, sessions, today, focus, setFocus }) {
  const navigate = useNavigate()
  const n = useFront()
  const ref = useRef(null)
  const [w, setW] = useState(0)
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return undefined
    const ro = new ResizeObserver(() => setW(el.clientWidth))
    ro.observe(el)
    setW(el.clientWidth)
    return () => ro.disconnect()
  }, [])

  // glisser du doigt / de la souris (trackpad horizontal aussi)
  const drag = useRef(null)
  const swiped = useRef(false)
  const start = (x, y) => {
    drag.current = { x, y }
    swiped.current = false
  }
  const end = (x, y) => {
    const d = drag.current
    drag.current = null
    if (!d) return
    const dx = x - d.x
    if (Math.abs(dx) > 40 && Math.abs(dx) > Math.abs(y - d.y)) {
      swiped.current = true // le clic qui suit ne doit pas ouvrir la séance
      setFocus(focus + (dx < 0 ? 1 : -1) * (Math.abs(dx) > 220 ? 2 : 1))
    }
  }
  // souris : évènements pointeur ; doigt : évènements tactiles (le navigateur annule les pointeurs en cours de geste)
  const onPointerDown = (e) => e.pointerType === 'mouse' && start(e.clientX, e.clientY)
  const onPointerUp = (e) => e.pointerType === 'mouse' && end(e.clientX, e.clientY)
  const onTouchStart = (e) => start(e.touches[0].clientX, e.touches[0].clientY)
  const onTouchEnd = (e) => end(e.changedTouches[0].clientX, e.changedTouches[0].clientY)
  const onClickCapture = (e) => {
    if (swiped.current) {
      e.preventDefault()
      e.stopPropagation()
      swiped.current = false
    }
  }
  const wheel = useRef(0)
  const onWheel = (e) => {
    if (Math.abs(e.deltaX) <= Math.abs(e.deltaY)) return
    wheel.current += e.deltaX
    if (Math.abs(wheel.current) > 60) {
      setFocus(focus + (wheel.current > 0 ? 1 : -1))
      wheel.current = 0
    }
  }

  const gap = 10
  const side = n >= 4 ? 70 : 36 // place pour les jours repliés / inclinés
  const cw = w ? Math.max(130, (w - side * 2 - gap * (n - 1)) / n) : 0

  return (
    <div className="dc" aria-roledescription="carrousel">
      <button className="dc-arrow is-prev" onClick={() => setFocus(focus - 1)} aria-label="Jour précédent"><Icon name="back" size={20} stroke={2} /></button>
      <div className="dc-stage" ref={ref} onPointerDown={onPointerDown} onPointerUp={onPointerUp} onTouchStart={onTouchStart} onTouchEnd={onTouchEnd} onClickCapture={onClickCapture} onWheel={onWheel}>
        {w > 0 && days.map((d, i) => {
          const k = i - focus
          let left
          let transform = 'none'
          let opacity = 1
          let z = 10
          if (k < 0) {
            // jours d'avant : repliés à gauche
            left = Math.max(0, side - 12 + k * 10)
            transform = 'rotateY(62deg)'
            opacity = Math.max(0, 0.55 + k * 0.12)
            z = 5 + k
          } else if (k < n) {
            left = side + k * (cw + gap)
          } else {
            const j = k - n
            left = side + n * (cw + gap) + j * 14
            transform = `rotateY(-62deg) translateZ(${-20 - j * 25}px)`
            opacity = Math.max(0, 0.8 - j * 0.22)
            z = 5 - j
          }
          const list = sessions.filter((s) => s.date === d && s.status !== 'unplaced')
          const isToday = d === today
          const date = parseDay(d)
          const front = k >= 0 && k < n
          return (
            <section
              key={d}
              className={['dc-card', isToday && 'is-today', d < today && 'is-past', front && 'is-front'].filter(Boolean).join(' ')}
              style={{ width: cw, left, transform, opacity, zIndex: z, transformOrigin: k < 0 ? 'left center' : 'left center', pointerEvents: front ? 'auto' : 'none' }}
              aria-hidden={!front}
              aria-label={`${DAY_NAMES[(date.getDay() + 6) % 7]} ${date.getDate()}`}
            >
              <p className="dc-day">{DAY_NAMES[(date.getDay() + 6) % 7]}{isToday ? ' · aujourd’hui' : ''}</p>
              <p className="dc-date">{date.getDate()}<small> {date.toLocaleDateString('fr-BE', { month: 'short' }).replace('.', '')}</small></p>
              {list.length ? list.map((s) => {
                const to = `/sport/${s.kind === 'muscu' ? 'seance' : 'velo'}/${s.id}`
                return (
                  <div key={s.id} className={`dc-session is-${s.kind} is-${s.status}`}>
                    <Link to={to} className="dc-session-main" tabIndex={front ? 0 : -1}>
                      <span className="dc-session-head">
                        <KindIcon kind={s.kind} size={26} />
                        <span className="dc-time">{s.start_time}<small>{s.duration_min ? ` · ${fmtDuration(s.duration_min)}` : ''}</small></span>
                      </span>
                      <span className="dc-title">{s.status === 'done' ? '✓ ' : ''}{s.label}</span>
                      {s.note && <span className="dc-note">{s.note}</span>}
                    </Link>
                    <div className="dc-foot">
                      <span className="dc-status">{STATUS[s.status] || ''}{s.pinned ? ' · placée par toi' : ''}</span>
                      {(s.status === 'planned' || s.status === 'missed') && (
                        <button className="dc-go" tabIndex={front ? 0 : -1} onClick={() => navigate(s.kind === 'muscu' ? `${to}?go=1` : to)}>Démarrer</button>
                      )}
                    </div>
                  </div>
                )
              }) : <p className="dc-rest">Repos</p>}
            </section>
          )
        })}
      </div>
      <button className="dc-arrow is-next" onClick={() => setFocus(focus + 1)} aria-label="Jour suivant"><Icon name="chevron" size={20} stroke={2} /></button>
    </div>
  )
}
