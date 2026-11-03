// Accueil · « À faire aujourd'hui » : tâches, habitudes, séances et cours, dans l'ordre de la journée.
// On coche directement ici ; toucher le texte ouvre l'élément.
import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Icon from '../../components/Icon'
import { useTasks } from '../taches/TasksModule'
import { TaskRow, TaskSheet, CheckCircle } from '../taches/ui'
import { tasksForToday, taskState, toMin } from '../taches/logic'
import { useHabits, HabitRow } from '../habitudes/ui'
import { QuantitySheet } from '../habitudes/TodayView'
import { isVisibleOn, todayItem, sortHabits } from '../habitudes/logic'
import { todaySessions, setSessionStatus } from '../sport/api'
import { loadSchool } from '../ecole/api'
import { fmtDuration } from '../sport/ui'

const pad = (n) => String(n).padStart(2, '0')
const keyOf = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
const hm = (d) => `${pad(d.getHours())}:${pad(d.getMinutes())}`
const MOMENT_MIN = { morning: 7 * 60, day: 12 * 60, evening: 20 * 60 }
const MOMENT_LABEL = { morning: 'matin', day: 'journée', evening: 'soir' }
const SECTIONS = [['morning', 'Matin', 0, 12 * 60], ['afternoon', 'Après-midi', 12 * 60, 18 * 60], ['evening', 'Soir', 18 * 60, 1e9]]
const HABIT_OPTIONS = { autoDays: 60 }

function useSportAndCourses() {
  const [state, setState] = useState({ sessions: [], courses: [] })
  const load = useCallback(async () => {
    const today = keyOf(new Date())
    const [sessions, school] = await Promise.all([
      todaySessions().catch(() => []),
      loadSchool().catch(() => ({ courses: [] }))
    ])
    setState({ sessions, courses: school.courses.filter((c) => c.start && keyOf(c.start) === today) })
  }, [])
  useEffect(() => {
    load()
    window.addEventListener('life:changed', load)
    return () => window.removeEventListener('life:changed', load)
  }, [load])
  return [state, load, setState]
}

export default function TodayList() {
  const navigate = useNavigate()
  const today = keyOf(new Date())
  const { data: taskData, error: taskError, reload: reloadTasks, toggle } = useTasks()
  const { data: habitData, log } = useHabits(HABIT_OPTIONS)
  const [{ sessions, courses }, , setSport] = useSportAndCourses()
  const [sheet, setSheet] = useState(null)

  const catById = Object.fromEntries((taskData?.categories || []).map((c) => [c.id, c]))
  const items = []

  // tâches
  for (const t of taskData ? tasksForToday(taskData.tasks, today) : []) {
    const late = taskState(t, today) === 'overdue'
    items.push({ key: `t${t.id}`, type: 'task', late, min: late ? -1 : toMin(t.time), label: late ? '' : t.time || '', task: t, done: t.done })
  }
  // habitudes (la journée Life finit à 3 h : on utilise son « aujourd'hui »)
  if (habitData) {
    const { habits, categories, ctx, today: hToday } = habitData
    const hCat = Object.fromEntries(categories.map((c) => [c.id, c]))
    for (const h of sortHabits(habits.filter((x) => isVisibleOn(x, hToday, ctx)), categories)) {
      const it = todayItem(h, hToday, ctx)
      if (it.paused) continue
      const min = h.reminder_time ? toMin(h.reminder_time) : MOMENT_MIN[h.moment] ?? MOMENT_MIN.day
      items.push({
        key: `h${h.id}`, type: 'habit', min, label: h.reminder_time || MOMENT_LABEL[h.moment] || '', item: it, cat: hCat[h.category_id], date: hToday,
        done: it.status === 'done' || (it.progress && it.doneToday), countable: h.kind !== 'avoid'
      })
    }
  }
  // séances sport
  for (const s of sessions) {
    if (s.status === 'unplaced' || s.status === 'missed') continue
    items.push({ key: `s${s.id}`, type: 'sport', min: toMin(s.start_time), label: s.start_time || '', session: s, done: s.status === 'done', skipped: s.status === 'skipped' })
  }
  // cours (repères, pas de case à cocher)
  for (const c of courses) items.push({ key: `c${c.id}`, type: 'course', min: c.start.getHours() * 60 + c.start.getMinutes(), label: hm(c.start), course: c })

  const late = items.filter((x) => x.late)
  const timed = items.filter((x) => !x.late && x.min != null).sort((a, b) => a.min - b.min || (a.type === 'course' ? -1 : 1))
  const noTime = items.filter((x) => !x.late && x.min == null)
  const checkable = items.filter((x) => x.type !== 'course' && x.countable !== false && !x.skipped)
  const doneCount = checkable.filter((x) => x.done).length

  const toggleSession = async (s) => {
    const status = s.status === 'done' ? 'planned' : 'done'
    setSport((st) => ({ ...st, sessions: st.sessions.map((x) => (x.id === s.id ? { ...x, status } : x)) }))
    await setSessionStatus(s.id, status).catch(() => {})
    window.dispatchEvent(new Event('life:changed'))
  }

  const row = (x) => {
    let content
    if (x.type === 'task') {
      content = <TaskRow task={x.task} cat={catById[x.task.category_id]} today={today} onToggle={toggle} onOpen={(t) => setSheet({ type: 'task', task: t })} />
    } else if (x.type === 'habit') {
      content = <HabitRow item={x.item} date={x.date} cat={x.cat} ctx={habitData.ctx} onLog={log}
        onOpen={(i) => (i.habit.kind === 'quantity' ? setSheet({ type: 'qty', item: i }) : navigate('/habitudes'))} />
    } else if (x.type === 'sport') {
      const s = x.session
      const color = s.kind === 'muscu' ? 'var(--c-muscu)' : 'var(--c-velo)'
      content = (
        <div className={`habit-row${x.done ? ' is-done' : ''}${x.skipped ? ' is-skipped' : ''}`}>
          <CheckCircle done={x.done} color={color} label={`${s.label} : ${x.done ? 'faite' : 'à faire'}`} onClick={() => toggleSession(s)} disabled={x.skipped} />
          <button type="button" className="habit-main" onClick={() => navigate(`/sport/${s.kind === 'muscu' ? 'seance' : 'velo'}/${s.id}`)}>
            <span className="habit-name">{s.label}</span>
            <span className="habit-sub">{[s.kind === 'muscu' ? 'Muscu' : 'Vélo', s.duration_min ? fmtDuration(s.duration_min) : null, x.skipped ? 'passée' : null].filter(Boolean).join(' · ')}</span>
          </button>
          <span className="task-cat" style={{ '--c': color }}>{s.kind === 'muscu' ? 'Muscu' : 'Vélo'}</span>
        </div>
      )
    } else {
      const c = x.course
      content = (
        <button type="button" className="habit-row td-course" onClick={() => navigate('/ecole')}>
          <span className="td-bar" aria-hidden="true" />
          <span className="habit-main as-span">
            <span className="habit-name">{c.name}</span>
            <span className="habit-sub">{hm(c.start)}–{hm(c.end)}{c.room ? ` · ${c.room}` : ''}</span>
          </span>
          <span className="task-cat" style={{ '--c': 'var(--purple)' }}>Cours</span>
        </button>
      )
    }
    return (
      <li key={x.key} className="td-item">
        <span className={x.late ? 'td-time is-late' : 'td-time'}>{x.late ? 'retard' : x.label}</span>
        <div className="td-content">{content}</div>
      </li>
    )
  }

  const sections = SECTIONS.map(([k, name, a, b]) => [k, name, timed.filter((x) => x.min >= a && x.min < b)]).filter(([, , l]) => l.length)
  const loading = !taskData && !taskError && !habitData

  return (
    <section className="home-card" aria-labelledby="todo-title">
      <div className="home-card-head">
        <h2 id="todo-title" className="home-card-title">À faire aujourd’hui</h2>
        <span className="home-card-hint">{checkable.length ? `${doneCount} / ${checkable.length}` : ''}</span>
        <button className="agc-icon" aria-label="Nouvelle tâche" title="Nouvelle tâche" onClick={() => taskData && setSheet({ type: 'task', task: null })}><Icon name="plus" size={18} stroke={2} /></button>
      </div>
      {taskError && <p className="group-foot">{taskError}</p>}
      {loading && <p className="muted-line">Chargement…</p>}
      {!loading && !items.length && <p className="muted-line">Rien de prévu aujourd’hui. Ajoute une tâche avec +.</p>}
      {late.length > 0 && (<><p className="td-section is-late">En retard</p><ul className="td-list">{late.map(row)}</ul></>)}
      {sections.map(([k, name, list]) => (
        <div key={k}><p className="td-section">{name}</p><ul className="td-list">{list.map(row)}</ul></div>
      ))}
      {noTime.length > 0 && (<><p className="td-section">Sans heure</p><ul className="td-list">{noTime.map(row)}</ul></>)}

      {sheet?.type === 'task' && (
        <TaskSheet task={sheet.task} categories={taskData.categories} today={today} onClose={() => setSheet(null)} onSaved={reloadTasks} onCategoryCreated={reloadTasks} />
      )}
      {sheet?.type === 'qty' && (
        <QuantitySheet item={sheet.item} onClose={() => setSheet(null)} onSave={(v) => { log(sheet.item.habit, habitData.today, v); setSheet(null) }} />
      )}
    </section>
  )
}
