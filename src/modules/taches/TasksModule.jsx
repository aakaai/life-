// Espace Tâches : Aujourd'hui (avec les tâches en retard), À venir, Sans date, Terminées.
import { useCallback, useEffect, useMemo, useState } from 'react'
import Icon from '../../components/Icon'
import { loadTasks, setTaskDone, missingTasksTable, saveTaskCategory, removeTaskCategory } from './api'
import { tabsOf, keyOf, taskState, relDay, shortDay } from './logic'
import { TaskRow, TaskSheet } from './ui'
import { CategoriesSheet } from '../agenda/sheets'

const TABS = [
  ['today', 'Aujourd’hui'],
  ['upcoming', 'À venir'],
  ['nodate', 'Sans date'],
  ['done', 'Terminées']
]

export function useTasks() {
  const [data, setData] = useState(null)
  const [error, setError] = useState('')
  const load = useCallback(async () => {
    try {
      setData(await loadTasks())
      setError('')
    } catch (e) {
      setError(missingTasksTable(e) ? 'Lance d’abord 014_taches.sql dans Supabase › SQL Editor pour créer tes tâches.' : e.message)
    }
  }, [])
  useEffect(() => {
    load()
    window.addEventListener('life:changed', load)
    return () => window.removeEventListener('life:changed', load)
  }, [load])
  // cocher : affichage immédiat, puis enregistrement
  const toggle = useCallback(async (task, done) => {
    setData((d) => d && { ...d, tasks: d.tasks.map((t) => (t.id === task.id ? { ...t, done, done_at: done ? new Date().toISOString() : null } : t)) })
    try {
      await setTaskDone(task, done)
    } catch (e) {
      setError(e.message)
      load()
    }
  }, [load])
  return { data, error, reload: load, toggle }
}

export default function TasksModule() {
  const { data, error, reload, toggle } = useTasks()
  const [tab, setTab] = useState('today')
  const [cat, setCat] = useState('all')
  const [sheet, setSheet] = useState(null)
  const today = keyOf(new Date())

  const tabs = useMemo(() => {
    if (!data) return null
    const list = cat === 'all' ? data.tasks : data.tasks.filter((t) => (cat === 'none' ? !t.category_id : t.category_id === cat))
    return tabsOf(list, today)
  }, [data, cat, today])
  const catById = Object.fromEntries((data?.categories || []).map((c) => [c.id, c]))

  const row = (t, withDay) => (
    <li key={t.id}>
      <TaskRow task={t} cat={catById[t.category_id]} today={today} onToggle={toggle} onOpen={(x) => setSheet({ type: 'task', task: x })} withDay={withDay} />
    </li>
  )

  let body = null
  if (tabs) {
    const list = tabs[tab]
    if (!list.length) {
      body = <p className="muted-line">{{ today: 'Rien pour aujourd’hui. Ajoute une tâche avec le bouton +.', upcoming: 'Aucune tâche prévue les prochains jours.', nodate: 'Aucune tâche sans date.', done: 'Aucune tâche terminée pour l’instant.' }[tab]}</p>
    } else if (tab === 'today') {
      const late = list.filter((t) => taskState(t, today) === 'overdue')
      const now = list.filter((t) => taskState(t, today) !== 'overdue')
      body = (
        <>
          {late.length > 0 && (<><h2 className="group-title is-late">En retard · {late.length}</h2><ul className="group habit-list">{late.map((t) => row(t, true))}</ul></>)}
          {now.length > 0 && (<><h2 className="group-title">Aujourd’hui · {now.length}</h2><ul className="group habit-list">{now.map((t) => row(t))}</ul></>)}
        </>
      )
    } else if (tab === 'upcoming') {
      const byDay = {}
      for (const t of list) (byDay[t.planned_date] ||= []).push(t)
      body = Object.entries(byDay).map(([d, ts]) => (
        <section key={d}>
          <h2 className="group-title">{relDay(d, today) === 'demain' ? `Demain · ${shortDay(d)}` : shortDay(d)}</h2>
          <ul className="group habit-list">{ts.map((t) => row(t))}</ul>
        </section>
      ))
    } else {
      body = <ul className="group habit-list" style={{ marginTop: 12 }}>{list.slice(0, tab === 'done' ? 60 : 500).map((t) => row(t, tab === 'done'))}</ul>
    }
  }

  return (
    <div className="page tasks">
      <header className="sport-head">
        <h1 className="large-title">Tâches</h1>
        {data && <button className="icon-btn" aria-label="Catégories" onClick={() => setSheet({ type: 'cats' })}><Icon name="settings" size={20} /></button>}
      </header>
      <nav className="food-nav" aria-label="Tâches">
        {TABS.map(([k, l]) => (
          <button key={k} type="button" className={tab === k ? 'food-tab active' : 'food-tab'} onClick={() => setTab(k)} aria-pressed={tab === k}>
            {l}{tabs && k !== 'done' && tabs[k].length > 0 ? ` · ${tabs[k].length}` : ''}
          </button>
        ))}
      </nav>
      {data && (
        <div className="chips left task-filters">
          <button className={cat === 'all' ? 'chip is-on' : 'chip'} onClick={() => setCat('all')}>Toutes</button>
          {data.categories.map((c) => (
            <button key={c.id} className={cat === c.id ? 'chip is-on' : 'chip'} onClick={() => setCat(c.id)}>
              <span className="ag-dot" style={{ '--c': `var(--${c.color})`, display: 'inline-block', marginRight: 6 }} />{c.name}
            </button>
          ))}
        </div>
      )}
      {error && <p className="group-foot is-error">{error}</p>}
      {!data && !error && <p className="muted-line">Chargement…</p>}
      {body}
      {data && <button className="fab" aria-label="Nouvelle tâche" onClick={() => setSheet({ type: 'task', task: null })}><Icon name="plus" size={26} stroke={2.2} /></button>}

      {sheet?.type === 'task' && (
        <TaskSheet task={sheet.task} categories={data.categories} today={today}
          onClose={() => setSheet(null)} onSaved={reload} onCategoryCreated={reload} />
      )}
      {sheet?.type === 'cats' && (
        <CategoriesSheet withSport={false} title="Catégories des tâches" categories={data.categories}
          onSave={async (c) => { await saveTaskCategory(c); await reload() }}
          onRemove={async (id) => { await removeTaskCategory(id); await reload() }}
          onClose={() => setSheet(null)} />
      )}
    </div>
  )
}
