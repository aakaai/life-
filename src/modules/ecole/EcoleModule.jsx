import { useEffect, useMemo, useState } from 'react'
import { Link, Route, Routes } from 'react-router-dom'
import Icon from '../../components/Icon'
import { loadSchool, syncCalendars, sameDayKey } from './api'
import { profName } from './parse'
import { SchoolNav, CourseRow, CourseSheet, hm, fmtDay, cap } from './ui'
import { mondayOf, parseDay, keyOf } from '../sport/planner'
import { isCloud } from '../../lib/supabase'

// Module École : horaire de cours lu dans Hyperplanning (agenda « Horaire de cours »).
export default function EcoleModule() {
  const [data, setData] = useState(null)
  const [sync, setSync] = useState('')

  async function load(force = false) {
    setData(await loadSchool())
    if (!isCloud) return
    try {
      setSync('Lecture de ton horaire…')
      const res = await syncCalendars({ force })
      setSync(res?.report?.find((r) => r.error)?.error || '')
      if (!res?.skipped) setData(await loadSchool())
    } catch (e) {
      setSync(e.message)
    }
  }

  useEffect(() => {
    load()
  }, [])

  return (
    <div className="page food school">
      <header className="sport-head">
        <h1 className="large-title">École</h1>
        <Link to="/sport/reglages" className="icon-btn" aria-label="Agendas reliés"><Icon name="calendar" size={22} /></Link>
      </header>
      <SchoolNav />
      {!data && <p className="muted-line">Chargement de ton horaire…</p>}
      {data && !data.hasSource && <NoSchedule />}
      {data?.hasSource && (
        <>
          {sync && <p className="sync-line"><Icon name="calendar" size={15} /> {sync}</p>}
          <Routes>
            <Route index element={<Today data={data} />} />
            <Route path="semaine" element={<Week data={data} onRefresh={() => load(true)} />} />
            <Route path="cours" element={<Courses data={data} />} />
          </Routes>
        </>
      )}
    </div>
  )
}

function NoSchedule() {
  return (
    <div className="callout">
      <span className="callout-icon"><Icon name="info" size={20} /></span>
      <div>
        <p className="callout-lead">Relie ton horaire Hyperplanning</p>
        <p className="callout-text">
          Dans Hyperplanning (ICHEC), ouvre ton emploi du temps et copie le lien d’export iCal (« Exporter » ou « S’abonner »).
          Puis colle-le dans Sport › Réglages › Agendas reliés, avec le type « Horaire de cours ». Tes cours apparaîtront ici,
          le planning sport les évitera, et les menus sauront quels midis tu manges à l’école.
        </p>
        <Link to="/sport/reglages" className="link-btn">Ajouter mon horaire</Link>
      </div>
    </div>
  )
}

function useNow() {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 30000)
    return () => clearInterval(t)
  }, [])
  return now
}

const inMinutes = (ms) => {
  const m = Math.round(ms / 60000)
  if (m < 60) return `${m} min`
  const h = Math.floor(m / 60)
  return `${h} h${m % 60 ? String(m % 60).padStart(2, '0') : ''}`
}

function holidayOn(holidays, key) {
  return holidays.find((h) => h.from <= key && key < h.to)
}

/* ---------- Aujourd'hui ---------- */

function Today({ data }) {
  const now = useNow()
  const [open, setOpen] = useState(null)
  const key = sameDayKey(now)
  const today = data.courses.filter((c) => sameDayKey(c.start) === key)
  const live = today.find((c) => c.start <= now && c.end > now)
  const next = data.courses.find((c) => c.start > now)
  const holiday = holidayOn(data.holidays, key)
  const tomorrowKey = sameDayKey(new Date(now.getTime() + 86400000))
  const tomorrow = data.courses.filter((c) => sameDayKey(c.start) === tomorrowKey)

  return (
    <>
      <p className="muted-line">{cap(fmtDay.format(now))}</p>
      {holiday && (
        <div className="callout tip">
          <span className="callout-icon"><Icon name="sparkle" size={20} /></span>
          <p className="callout-text">{holiday.title} jusqu’au {fmtDay.format(new Date(parseDay(holiday.to).getTime() - 86400000))}.</p>
        </div>
      )}

      {(live || next) && (
        <section className="next-card" style={{ '--c': data.colors[(live || next).courseKey] }}>
          <p className="next-kicker">
            {live ? `En cours · fin à ${hm(live.end)}` : sameDayKey(next.start) === key ? `Prochain cours dans ${inMinutes(next.start - now)}` : `Prochain cours : ${fmtDay.format(next.start)}`}
          </p>
          <p className="next-title">{(live || next).name}</p>
          <p className="next-meta">
            {hm((live || next).start)}–{hm((live || next).end)}
            {(live || next).room && ` · salle ${(live || next).room}`}
            {(live || next).prof && ` · ${profName((live || next).prof)}`}
          </p>
        </section>
      )}

      <h2 className="group-title">Aujourd’hui</h2>
      {today.length ? (
        <ul className="group">
          {today.map((c) => (
            <li key={c.id}><CourseRow c={c} color={data.colors[c.courseKey]} now={now} onClick={() => setOpen(c)} /></li>
          ))}
        </ul>
      ) : (
        <p className="day-rest">Pas de cours aujourd’hui</p>
      )}
      {today.length > 0 && <p className="group-foot">{lunchNote(today)}</p>}

      <h2 className="group-title">Demain</h2>
      {tomorrow.length ? (
        <ul className="group">
          {tomorrow.map((c) => (
            <li key={c.id}><CourseRow c={c} color={data.colors[c.courseKey]} onClick={() => setOpen(c)} /></li>
          ))}
        </ul>
      ) : (
        <p className="day-rest">Pas de cours demain</p>
      )}

      {open && <CourseSheet c={open} color={data.colors[open.courseKey]} sessions={data.courses.filter((x) => x.courseKey === open.courseKey)} onClose={() => setOpen(null)} />}
    </>
  )
}

function lunchNote(list) {
  const first = list[0].start
  const last = list[list.length - 1].end
  const min = (d) => d.getHours() * 60 + d.getMinutes()
  const atSchool = min(first) < 12.5 * 60 && min(last) > 13.5 * 60
  return `De ${hm(first)} à ${hm(last)}${atSchool ? ' · midi à l’école : pense à ta boîte' : ''}.`
}

/* ---------- Semaine ---------- */

const PX = 46 // pixels par heure

function Week({ data, onRefresh }) {
  const now = useNow()
  const [monday, setMonday] = useState(mondayOf(now))
  const [open, setOpen] = useState(null)
  const shift = (k, n) => {
    const d = parseDay(k)
    d.setDate(d.getDate() + n)
    return keyOf(d)
  }
  const days = Array.from({ length: 7 }, (_, i) => shift(monday, i))
  const week = data.courses.filter((c) => {
    const k = sameDayKey(c.start)
    return k >= days[0] && k <= days[6]
  })
  const shown = days.filter((d, i) => i < 5 || week.some((c) => sameDayKey(c.start) === d))
  const hours = week.length
    ? [Math.min(8, ...week.map((c) => c.start.getHours())), Math.max(18, ...week.map((c) => c.end.getHours() + (c.end.getMinutes() ? 1 : 0)))]
    : [8, 18]
  const fmtR = new Intl.DateTimeFormat('fr-BE', { day: 'numeric', month: 'long' })
  const total = week.reduce((t, c) => t + (c.end - c.start) / 3600000, 0)
  const todayKey = sameDayKey(now)
  const nowTop = (now.getHours() + now.getMinutes() / 60 - hours[0]) * PX

  return (
    <>
      <div className="week-switch">
        <button className="icon-btn" onClick={() => setMonday(shift(monday, -7))} aria-label="Semaine précédente"><Icon name="back" size={20} stroke={2} /></button>
        <div className="week-label">
          <strong>{fmtR.format(parseDay(days[0]))} – {fmtR.format(parseDay(days[6]))}</strong>
          {monday !== mondayOf(now)
            ? <button className="link-btn" onClick={() => setMonday(mondayOf(now))}>Revenir à cette semaine</button>
            : <span>{week.length ? `${week.length} cours · ${String(Math.round(total * 10) / 10).replace('.', ',')} h` : 'Pas de cours'}</span>}
        </div>
        <button className="icon-btn" onClick={() => setMonday(shift(monday, 7))} aria-label="Semaine suivante"><Icon name="chevron" size={20} stroke={2} /></button>
      </div>

      {days.some((d) => holidayOn(data.holidays, d)) && (
        <p className="holiday-band">{holidayOn(data.holidays, days.find((d) => holidayOn(data.holidays, d))).title}</p>
      )}

      <div className="cal" style={{ '--cols': shown.length }}>
        <div className="cal-head">
          <span />
          {shown.map((d) => (
            <span key={d} className={d === todayKey ? 'is-today' : ''}>
              {cap(new Intl.DateTimeFormat('fr-BE', { weekday: 'short' }).format(parseDay(d))).replace('.', '')}
              <strong>{parseDay(d).getDate()}</strong>
            </span>
          ))}
        </div>
        <div className="cal-body" style={{ height: (hours[1] - hours[0]) * PX }}>
          <div className="cal-hours">
            {Array.from({ length: hours[1] - hours[0] }, (_, i) => (
              <span key={i} style={{ top: i * PX }}>{hours[0] + i}h</span>
            ))}
          </div>
          {shown.map((d) => (
            <div key={d} className={d === todayKey ? 'cal-col is-today' : 'cal-col'}>
              {Array.from({ length: hours[1] - hours[0] }, (_, i) => <span key={i} className="cal-line" style={{ top: i * PX }} />)}
              {week.filter((c) => sameDayKey(c.start) === d).map((c) => {
                const top = (c.start.getHours() + c.start.getMinutes() / 60 - hours[0]) * PX
                const h = ((c.end - c.start) / 3600000) * PX
                return (
                  <button key={c.id} className="cal-ev" style={{ top, height: h - 2, '--c': data.colors[c.courseKey] }} onClick={() => setOpen(c)}>
                    <span className="cal-ev-name">{c.name}</span>
                    <span className="cal-ev-meta">{hm(c.start)}{c.room ? ` · ${c.room}` : ''}</span>
                  </button>
                )
              })}
              {d === todayKey && nowTop > 0 && nowTop < (hours[1] - hours[0]) * PX && <span className="cal-now" style={{ top: nowTop }} />}
            </div>
          ))}
        </div>
      </div>
      <p className="group-foot">
        <button className="link-btn" onClick={onRefresh}>Relire l’horaire</button> · Les changements dans Hyperplanning arrivent ici en quelques minutes.
      </p>

      {open && <CourseSheet c={open} color={data.colors[open.courseKey]} sessions={data.courses.filter((x) => x.courseKey === open.courseKey)} onClose={() => setOpen(null)} />}
    </>
  )
}

/* ---------- Mes cours ---------- */

function Courses({ data }) {
  const now = useNow()
  const [open, setOpen] = useState(null)
  const list = useMemo(() => {
    const by = new Map()
    for (const c of data.courses) {
      const cur = by.get(c.courseKey) || { key: c.courseKey, name: c.name, code: c.code, prof: c.prof, sessions: [] }
      cur.sessions.push(c)
      by.set(c.courseKey, cur)
    }
    return [...by.values()].sort((a, b) => a.name.localeCompare(b.name, 'fr'))
  }, [data])

  return (
    <>
      <ul className="group">
        {list.map((c) => {
          const next = c.sessions.find((s) => s.start > now)
          const left = c.sessions.filter((s) => s.start > now).length
          return (
            <li key={c.key}>
              <button className="row course-row" onClick={() => next && setOpen(next)}>
                <span className="course-bar tall" style={{ background: data.colors[c.key] }} />
                <span className="food-main">
                  <span className="food-name">{c.name}</span>
                  <span className="food-sub">
                    {[c.code, profName(c.prof)].filter(Boolean).join(' · ')}
                  </span>
                  <span className="food-sub">
                    {next ? `Prochain : ${fmtDay.format(next.start)} à ${hm(next.start)}${next.room ? `, ${next.room}` : ''} · encore ${left} séance${left > 1 ? 's' : ''} lue${left > 1 ? 's' : ''}` : 'Plus de séance prévue dans les 6 prochains mois'}
                  </span>
                </span>
              </button>
            </li>
          )
        })}
      </ul>
      <p className="group-foot">L’app lit ton horaire sur les 6 prochains mois. Travaux, examens et notes viendront dans une prochaine étape.</p>
      {open && <CourseSheet c={open} color={data.colors[open.courseKey]} sessions={data.courses.filter((x) => x.courseKey === open.courseKey)} onClose={() => setOpen(null)} />}
    </>
  )
}
