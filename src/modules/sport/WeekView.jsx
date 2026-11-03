import { useCallback, useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import Icon from '../../components/Icon'
import { ensureWeek, syncCalendars, listSources } from './api'
import { mondayOf, parseDay, keyOf, weekInfo } from './planner'
import { DAY_NAMES, KindIcon, StatusTag, VariantTag, fmtDuration, SportNav } from './ui'
import { isCloud } from '../../lib/supabase'
import DayCarousel, { useFront, centerOf } from './DayCarousel'

const fmtRange = new Intl.DateTimeFormat('fr-BE', { day: 'numeric', month: 'long' })
const fmtTime = new Intl.DateTimeFormat('fr-BE', { hour: '2-digit', minute: '2-digit' })

function shiftWeek(key, n) {
  const d = parseDay(key)
  d.setDate(d.getDate() + 7 * n)
  return keyOf(d)
}

// La semaine sport : générée toute seule à partir de la semaine type,
// puis ajustée à tes agendas. Affichée en cartes de jours qui défilent (v0.20) ;
// on charge la semaine affichée + la suivante pour que les cartes continuent après dimanche.
const dayIndex = (key) => (parseDay(key).getDay() + 6) % 7

export default function WeekView() {
  const thisWeek = mondayOf(new Date())
  const todayKey = keyOf(new Date())
  const [weekStart, setWeekStart] = useState(thisWeek)
  const [focus, setFocusRaw] = useState(() => dayIndex(todayKey))
  const [sessions, setSessions] = useState(null)
  const [nextSessions, setNextSessions] = useState([])
  const [prevSessions, setPrevSessions] = useState([])
  const lead = centerOf(useFront()) // flèches de semaine : lundi en premier
  const [error, setError] = useState('')
  const [sync, setSync] = useState({ state: 'idle' })
  const [hasSources, setHasSources] = useState(null)

  const load = useCallback(
    async ({ force = false } = {}) => {
      setError('')
      try {
        const [first, second, before] = await Promise.all([
          ensureWeek(weekStart),
          ensureWeek(shiftWeek(weekStart, 1)).catch(() => ({ sessions: [] })),
          ensureWeek(shiftWeek(weekStart, -1)).catch(() => ({ sessions: [] }))
        ])
        setSessions(first.sessions)
        setNextSessions(second.sessions)
        setPrevSessions(before.sessions)
      } catch (e) {
        setError(e.message)
        return
      }
      if (weekStart < thisWeek) return
      try {
        const sources = await listSources()
        setHasSources(sources.length > 0)
        if (!sources.length || !isCloud) return
        setSync({ state: 'syncing' })
        const res = await syncCalendars({ force })
        const failed = res?.report?.filter((r) => r.error) || []
        if (res?.skipped) setSync({ state: 'idle' })
        else setSync({ state: failed.length ? 'error' : 'ok', at: new Date(), message: failed.map((f) => `${f.name} : ${f.error}`).join(' · ') })
        if (!res?.skipped) {
          setSessions((await ensureWeek(weekStart)).sessions)
          setPrevSessions((await ensureWeek(shiftWeek(weekStart, -1))).sessions)
          setNextSessions((await ensureWeek(shiftWeek(weekStart, 1))).sessions)
        }
      } catch (e) {
        setSync({ state: 'error', message: e.message })
      }
    },
    [weekStart, thisWeek]
  )

  useEffect(() => {
    load() // on garde l'affichage précédent pendant le chargement : les cartes ne clignotent pas
  }, [load])

  // faire défiler les jours : au-delà de dimanche on passe à la semaine suivante (et inversement)
  const setFocus = (f) => {
    if (f < 0) {
      setWeekStart((w) => shiftWeek(w, -1))
      setFocusRaw(f + 7)
    } else if (f >= 7) {
      setWeekStart((w) => shiftWeek(w, 1))
      setFocusRaw(f - 7)
    } else setFocusRaw(f)
  }
  const focusRef = useRef(focus)
  focusRef.current = focus
  useEffect(() => {
    const onKey = (e) => {
      if (/^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName) || e.metaKey || e.ctrlKey || e.altKey) return
      if (e.key === 'ArrowRight') setFocus(focusRef.current + 1)
      else if (e.key === 'ArrowLeft') setFocus(focusRef.current - 1)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const info = weekInfo(weekStart)
  const days = Array.from({ length: 7 }, (_, i) => keyOf(new Date(parseDay(weekStart).getTime() + i * 86400000 + 3600000)))
  // semaine d'avant + semaine affichée + suivante : le jour du milieu a toujours ses voisins
  const days21 = Array.from({ length: 21 }, (_, i) => {
    const d = parseDay(weekStart)
    d.setDate(d.getDate() + i - 7)
    return keyOf(d)
  })
  const today = keyOf(new Date())
  const visible = (sessions || []).filter((s) => s.status !== 'unplaced')
  const unplaced = (sessions || []).filter((s) => s.status === 'unplaced')
  const done = visible.filter((s) => s.status === 'done').length
  const counted = visible.filter((s) => s.status !== 'skipped').length
  const end = parseDay(days[6])

  return (
    <div className="page sport">
      <header className="sport-head">
        <div>
          <h1 className="large-title">Sport</h1>
          <div className="sport-props">
            <span className="tag tag-phase">{info.phase.name}</span>
            {info.index >= 0 && <span className="tag">Semaine {info.index + 1}</span>}
            {info.isRecovery && <span className="tag tag-variant">Semaine allégée</span>}
          </div>
        </div>
        <Link to="reglages" className="icon-btn" aria-label="Réglages sport">
          <Icon name="settings" size={22} />
        </Link>
      </header>
      <SportNav />

      <div className="week-switch">
        <button className="icon-btn" onClick={() => { setWeekStart(shiftWeek(weekStart, -1)); setFocusRaw(lead) }} aria-label="Semaine précédente">
          <Icon name="back" size={20} stroke={2} />
        </button>
        <div className="week-label">
          <strong>
            {parseDay(weekStart).getMonth() === end.getMonth()
              ? fmtRange.format(parseDay(weekStart)).replace(/ .*/, '')
              : fmtRange.format(parseDay(weekStart))}
            {' – '}
            {fmtRange.format(end)}
          </strong>
          {weekStart !== thisWeek ? (
            <button className="link-btn" onClick={() => { setWeekStart(thisWeek); setFocusRaw(dayIndex(todayKey)) }}>Revenir à cette semaine</button>
          ) : (
            <span>Cette semaine</span>
          )}
        </div>
        <button className="icon-btn" onClick={() => { setWeekStart(shiftWeek(weekStart, 1)); setFocusRaw(lead) }} aria-label="Semaine suivante">
          <Icon name="chevron" size={20} stroke={2} />
        </button>
      </div>

      {sessions && counted > 0 && (
        <div className="week-progress" aria-label={`${done} séances faites sur ${counted}`}>
          <div className="week-bar"><span style={{ width: `${(done / counted) * 100}%` }} /></div>
          <span>{done}/{counted} faites</span>
        </div>
      )}

      <SyncLine sync={sync} hasSources={hasSources} onRefresh={() => load({ force: true })} />
      {error && <p className="group-foot is-error">{error}</p>}
      {!sessions && !error && <p className="muted-line">Préparation de la semaine…</p>}

      {sessions && (
        <DayCarousel days={days21} sessions={[...prevSessions, ...sessions, ...nextSessions]} today={today} focus={focus + 7} setFocus={(i) => setFocus(i - 7)} />
      )}

      {unplaced.length > 0 && (
        <section className="day">
          <h2 className="day-head"><span>Pas casées cette semaine</span></h2>
          <ul className="group sessions">
            {unplaced.map((s) => (
              <li key={s.id}>
                <SessionRow s={s} />
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  )
}

export function SessionRow({ s, base = '' }) {
  const to = `${base}${s.kind === 'muscu' ? 'seance' : 'velo'}/${s.id}`
  return (
    <Link to={to} className={`session-row is-${s.status}`}>
      <span className="session-time">
        {s.status === 'unplaced' ? '—' : s.start_time}
        {s.duration_min > 0 && <small>{fmtDuration(s.duration_min)}</small>}
      </span>
      <KindIcon kind={s.kind} size={32} />
      <span className="session-main">
        <span className="session-title">
          {s.label}
          <VariantTag variant={s.variant} />
          <StatusTag status={s.status} />
        </span>
        {s.note && <span className="session-note">{s.note}</span>}
      </span>
      {s.status === 'done' ? (
        <span className="session-check"><Icon name="check" size={18} stroke={2.4} /></span>
      ) : (
        <span className="row-chevron"><Icon name="chevron" size={16} /></span>
      )}
    </Link>
  )
}

function SyncLine({ sync, hasSources, onRefresh }) {
  if (!isCloud) {
    return <p className="sync-line">Mode test : les agendas seront lus une fois l’app reliée à Supabase.</p>
  }
  if (hasSources === false) {
    return (
      <p className="sync-line">
        <Icon name="calendar" size={15} /> Aucun agenda relié. <Link to="reglages">Ajouter ton agenda Google</Link> pour que la semaine s’adapte.
      </p>
    )
  }
  if (hasSources == null) return null
  return (
    <p className={sync.state === 'error' ? 'sync-line is-error' : 'sync-line'}>
      <Icon name="calendar" size={15} />
      {sync.state === 'syncing' && 'Lecture de tes agendas…'}
      {sync.state === 'ok' && `Agendas lus à ${fmtTime.format(sync.at)}`}
      {sync.state === 'idle' && 'Agendas reliés'}
      {sync.state === 'error' && (sync.message || 'Impossible de lire tes agendas')}
      <button className="link-btn" onClick={onRefresh} disabled={sync.state === 'syncing'}>
        Actualiser
      </button>
    </p>
  )
}
