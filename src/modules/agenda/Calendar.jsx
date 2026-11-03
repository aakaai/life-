// Calendrier de l'accueil (façon Notion Calendar) : vue Semaine / Mois,
// tes évènements + agenda Google + cours + séances sport.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useLocation } from 'react-router-dom'
import Icon from '../../components/Icon'
import WeekGrid, { useNow } from './WeekGrid'
import MonthGrid, { monthDays } from './MonthGrid'
import { EventSheet, ScopeSheet, DetailSheet, CategoriesSheet } from './sheets'
import { loadRange, runOps, saveCategory, removeCategory, missingTable } from './api'
import { keyOf, parseKey, addDays, mondayOf, atMinutes, planEdit, planDelete, movedFields } from './logic'
import { syncCalendars, loadSettings } from '../sport/api'
import { scheduleReminderSync } from '../habitudes/native-sync'
import { habitReminders } from '../../lib/native'

const fmtMonth = new Intl.DateTimeFormat('fr-BE', { month: 'long', year: 'numeric' })
const fmtMonthShort = new Intl.DateTimeFormat('fr-BE', { month: 'short' })
const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1)
const HIDDEN_KEY = 'life:agenda-hidden'

function useMedia(query) {
  const [match, setMatch] = useState(() => window.matchMedia(query).matches)
  useEffect(() => {
    const m = window.matchMedia(query)
    const on = () => setMatch(m.matches)
    m.addEventListener('change', on)
    return () => m.removeEventListener('change', on)
  }, [query])
  return match
}

function readHidden() {
  try {
    return new Set(JSON.parse(localStorage.getItem(HIDDEN_KEY)) || [])
  } catch {
    return new Set()
  }
}

function title(view, days, cursor) {
  if (view === 'month') return cap(fmtMonth.format(parseKey(cursor)))
  const a = parseKey(days[0])
  const b = parseKey(days[days.length - 1])
  if (a.getMonth() === b.getMonth()) return cap(fmtMonth.format(a))
  const m = (d) => fmtMonthShort.format(d).replace('.', '')
  if (a.getFullYear() === b.getFullYear()) return `${cap(m(a))} – ${m(b)} ${b.getFullYear()}`
  return `${cap(m(a))} ${a.getFullYear()} – ${m(b)} ${b.getFullYear()}`
}

export default function Calendar() {
  const location = useLocation()
  const narrow = useMedia('(max-width: 639px)')
  const now = useNow()
  const today = keyOf(now)
  const [view, setView] = useState('week')
  const [cursor, setCursor] = useState(today)
  const [data, setData] = useState(null)
  const [error, setError] = useState('')
  const [sheet, setSheet] = useState(null)
  const [hidden, setHidden] = useState(readHidden)
  const [keywords, setKeywords] = useState(null)
  const [scrollKey, setScrollKey] = useState(0)

  // ouvert depuis la notification d'un rappel : aller au jour concerné
  useEffect(() => {
    const d = location.state?.agendaDate
    if (d) {
      setView('week')
      setCursor(d)
    }
  }, [location.state])

  const n = narrow ? 3 : 7
  const days = useMemo(() => {
    if (view === 'month') return monthDays(cursor)
    const first = narrow ? cursor : mondayOf(cursor)
    return Array.from({ length: n }, (_, i) => addDays(first, i))
  }, [view, cursor, narrow, n])
  const from = days[0]
  const to = addDays(days[days.length - 1], 1)

  const seq = useRef(0)
  const load = useCallback(async () => {
    const id = ++seq.current
    try {
      const r = await loadRange(from, to)
      if (id === seq.current) {
        setData({ ...r, from, to })
        setError('')
      }
    } catch (e) {
      if (id === seq.current) setError(e.message)
    }
  }, [from, to])

  useEffect(() => {
    load()
  }, [load])

  // relire les agendas reliés (au plus toutes les 10 min), puis réafficher
  const loadRef = useRef(load)
  loadRef.current = load
  useEffect(() => {
    syncCalendars().then((res) => res && !res.skipped && loadRef.current()).catch(() => {})
    loadSettings().then((s) => setKeywords(s.keywords)).catch(() => {})
  }, [])

  /* ---------- navigation ---------- */
  const step = useCallback(
    (dir) => {
      if (view === 'month') {
        const d = parseKey(cursor)
        setCursor(keyOf(new Date(d.getFullYear(), d.getMonth() + dir, 1)))
      } else setCursor((c) => addDays(narrow ? c : mondayOf(c), dir * n))
    },
    [view, cursor, narrow, n]
  )
  const goToday = () => {
    setCursor(today)
    setScrollKey((k) => k + 1)
  }
  const switchView = (v) => {
    setView(v)
    if (v === 'week') setScrollKey((k) => k + 1)
  }

  // raccourcis clavier (ordinateur), comme Notion Calendar
  useEffect(() => {
    const onKey = (e) => {
      if (sheet || e.metaKey || e.ctrlKey || e.altKey) return
      if (/^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName) || e.target.isContentEditable) return
      const k = e.key.toLowerCase()
      if (k === 'w') switchView('week')
      else if (k === 'm') switchView('month')
      else if (k === 't') goToday()
      else if (e.key === 'ArrowLeft') step(-1)
      else if (e.key === 'ArrowRight') step(1)
      else return
      e.preventDefault()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  /* ---------- filtres (légende) ---------- */
  const toggle = (key) =>
    setHidden((h) => {
      const next = new Set(h)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      try {
        localStorage.setItem(HIDDEN_KEY, JSON.stringify([...next]))
      } catch {
        /* stockage indisponible */
      }
      return next
    })

  const fresh = data && data.from === from && data.to === to
  const items = (data?.items || []).filter((it) => !hidden.has(it.filter))
  const categories = data?.categories || []

  const legend = useMemo(() => {
    if (!data) return []
    const out = []
    const google = data.sources.some((s) => s.kind !== 'ecole')
    const school = data.sources.some((s) => s.kind === 'ecole')
    if (google) out.push({ key: 'google', label: 'Agenda Google', color: 'var(--green)' })
    if (school) out.push({ key: 'cours', label: 'Cours', color: 'var(--purple)' })
    out.push({ key: 'sport', label: 'Sport', color: 'var(--c-velo)', color2: 'var(--c-muscu)' })
    for (const c of data.categories) out.push({ key: `cat:${c.id}`, label: c.name, color: `var(--${c.color})` })
    return out
  }, [data])

  /* ---------- créer, modifier, déplacer ---------- */
  const afterChange = async () => {
    await load()
    scheduleReminderSync(0)
  }

  const guardSql = () => {
    if (data?.needsSql) {
      setError('Lance d’abord 011_agenda.sql dans Supabase pour ajouter tes évènements.')
      return false
    }
    return true
  }

  const openDraft = (draft) => {
    if (!guardSql()) return
    setSheet({ type: 'edit', draft })
  }
  const onCreate = ({ date, from: a, to: b }) =>
    openDraft({ all_day: false, start_at: atMinutes(date, a).toISOString(), end_at: atMinutes(date, b).toISOString() })
  const onCreateDays = (a, b) => openDraft({ all_day: true, day_start: a, day_end: addDays(b, 1) })

  const apply = async (ops) => {
    try {
      await runOps(ops)
    } catch (e) {
      setError(missingTable(e) ? 'Lance d’abord 011_agenda.sql dans Supabase.' : e.message)
    }
    await afterChange()
  }

  const onOpen = (it) => {
    if (it.kind === 'agenda') setSheet({ type: 'edit', occ: it.occ })
    else setSheet({ type: 'detail', item: it })
  }

  const onMove = (it, where) => {
    const ev = it.occ.event
    const fields = movedFields(ev, it.occ, where)
    // affichage immédiat, avant la réponse de Supabase
    setData((d) => {
      if (!d) return d
      const moved = { ...it }
      if (it.allDay) {
        moved.dayStart = addDays(it.dayStart, where.shiftDays ?? 0)
        moved.dayEnd = addDays(it.dayEnd, where.shiftDays ?? 0)
      } else {
        moved.start = new Date(fields.start_at)
        moved.end = new Date(fields.end_at)
        moved.dayStart = keyOf(moved.start)
        moved.dayEnd = keyOf(new Date(moved.end.getTime() - 1))
      }
      return { ...d, items: d.items.map((x) => (x.id === it.id ? moved : x)) }
    })
    if (ev.repeat) setSheet({ type: 'scope', item: it, fields })
    else apply(planEdit(ev, it.occ.date, fields))
  }

  const saveEvent = async (fields, scope) => {
    const occ = sheet.occ
    setSheet(null)
    if (fields.reminder_min != null) habitReminders.permission()
    await apply(planEdit(occ?.event || null, occ?.date, fields, scope))
  }
  const deleteEvent = async (scope) => {
    const occ = sheet.occ
    setSheet(null)
    await apply(planDelete(occ.event, occ.date, scope))
  }

  const swipe = (dir) => step(dir)

  return (
    <section className="agc" aria-label="Calendrier">
      <div className="agc-bar">
        <h2 className="agc-title">{title(view, days, view === 'month' ? cursor : days[0])}</h2>
        <div className="agc-nav">
          <button className="agc-icon" aria-label={view === 'month' ? 'Mois précédent' : 'Jours précédents'} onClick={() => step(-1)}><Icon name="back" size={18} /></button>
          <button className="agc-today" onClick={goToday}>Aujourd’hui</button>
          <button className="agc-icon" aria-label={view === 'month' ? 'Mois suivant' : 'Jours suivants'} onClick={() => step(1)}><Icon name="chevron" size={18} /></button>
        </div>
        <div className="segmented small agc-views" role="radiogroup" aria-label="Vue">
          <button role="radio" aria-checked={view === 'week'} className={view === 'week' ? 'is-on' : ''} onClick={() => switchView('week')} title="Semaine (W)">Semaine</button>
          <button role="radio" aria-checked={view === 'month'} className={view === 'month' ? 'is-on' : ''} onClick={() => switchView('month')} title="Mois (M)">Mois</button>
        </div>
        <button className="agc-icon" aria-label="Catégories" title="Catégories" onClick={() => guardSql() && setSheet({ type: 'cats' })}><Icon name="settings" size={18} /></button>
      </div>

      {legend.length > 0 && (
        <div className="agc-legend" aria-label="Afficher ou masquer">
          {legend.map((l) => (
            <button key={l.key} className={hidden.has(l.key) ? 'agc-key is-off' : 'agc-key'} aria-pressed={!hidden.has(l.key)} onClick={() => toggle(l.key)}>
              <span className="ag-dot" style={{ '--c': l.color }} />
              {l.color2 && <span className="ag-dot" style={{ '--c': l.color2 }} />}
              {l.label}
            </button>
          ))}
        </div>
      )}

      {error && <p className="group-foot is-error">{error}</p>}
      {data?.needsSql && !error && <p className="group-foot">Pour ajouter tes propres évènements : lance <strong>011_agenda.sql</strong> dans Supabase › SQL Editor.</p>}

      <div className={fresh ? 'agc-frame' : 'agc-frame is-loading'} aria-busy={!fresh}>
        {view === 'week' ? (
          <WeekGrid
            days={days}
            items={fresh ? items : []}
            hourPx={narrow ? 44 : 48}
            now={now}
            scrollKey={`${scrollKey}-${narrow}`}
            onCreate={onCreate}
            onCreateDays={onCreateDays}
            onMove={onMove}
            onOpen={onOpen}
            onSwipe={swipe}
          />
        ) : (
          <MonthGrid
            days={days}
            month={parseKey(cursor).getMonth()}
            items={fresh ? items : []}
            now={now}
            narrow={narrow}
            onOpenDay={(d) => { setCursor(d); switchView('week') }}
            onCreateDays={onCreateDays}
            onMove={onMove}
            onOpen={onOpen}
            onSwipe={swipe}
          />
        )}
      </div>
      <p className="agc-hint">
        {narrow
          ? 'Appui long puis glisse pour créer ou déplacer · balaie pour changer de jours'
          : 'Glisse sur la grille pour créer · glisse un évènement pour le déplacer · W / M / T'}
      </p>

      {sheet?.type === 'edit' && (
        <EventSheet
          occ={sheet.occ}
          draft={sheet.draft}
          categories={categories}
          keywords={keywords}
          onSave={saveEvent}
          onDelete={deleteEvent}
          onClose={() => setSheet(null)}
        />
      )}
      {sheet?.type === 'scope' && (
        <ScopeSheet
          title={sheet.item.title}
          onPick={(scope) => {
            const { item, fields } = sheet
            setSheet(null)
            apply(planEdit(item.occ.event, item.occ.date, fields, scope))
          }}
          onClose={() => {
            setSheet(null)
            load()
          }}
        />
      )}
      {sheet?.type === 'detail' && <DetailSheet item={sheet.item} courses={data?.courses || []} onClose={() => setSheet(null)} />}
      {sheet?.type === 'cats' && (
        <CategoriesSheet
          categories={categories}
          onSave={async (c) => { await saveCategory(c); await load() }}
          onRemove={async (id) => { await removeCategory(id); await load() }}
          onClose={() => setSheet(null)}
        />
      )}
    </section>
  )
}
