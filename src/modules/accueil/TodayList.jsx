// Accueil · « Tâches du jour » (v0.30.3) : encadré « Important » (priorité haute ou en retard) en haut,
// puis le reste par heure (sans heure ensuite, basse priorité en dernier), les faites en bas.
// Rond à cocher de la couleur de la catégorie, « ● École » sous le titre.
import { useState } from 'react'
import Icon from '../../components/Icon'
import { useTasks } from '../taches/TasksModule'
import { TaskRow, TaskSheet } from '../taches/ui'
import { tasksForToday, taskState, toMin } from '../taches/logic'

const pad = (n) => String(n).padStart(2, '0')
const keyOf = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`

export function homeTaskGroups(tasks, today) {
  const list = tasksForToday(tasks, today)
  const open = list.filter((t) => !t.done)
  const isImportant = (t) => Number(t.priority) === 3 || taskState(t, today) === 'overdue'
  const byTime = (a, b) => (toMin(a.time) ?? 1e6) - (toMin(b.time) ?? 1e6) || (b.priority || 2) - (a.priority || 2)
  const important = open.filter(isImportant).sort((a, b) =>
    (taskState(a, today) === 'overdue' ? 0 : 1) - (taskState(b, today) === 'overdue' ? 0 : 1) || byTime(a, b))
  const rest = open.filter((t) => !isImportant(t)).sort((a, b) => (Number(a.priority) === 1 ? 1 : 0) - (Number(b.priority) === 1 ? 1 : 0) || byTime(a, b))
  return { important, rest, done: list.filter((t) => t.done), total: list.length }
}

export default function TodayList() {
  const today = keyOf(new Date())
  const { data, error, reload, toggle } = useTasks()
  const [sheet, setSheet] = useState(null)

  const catById = Object.fromEntries((data?.categories || []).map((c) => [c.id, c]))
  const projById = Object.fromEntries((data?.projects || []).map((p) => [p.id, p]))
  const g = data ? homeTaskGroups(data.tasks, today) : { important: [], rest: [], done: [], total: 0 }
  const row = (t) => (
    <li key={t.id}>
      <TaskRow variant="home" task={t} cat={catById[t.category_id]} project={projById[t.project_id]} today={today}
        onToggle={toggle} onOpen={(x) => setSheet({ type: 'task', task: x })} />
    </li>
  )

  return (
    <section className="home-card home-tasks" aria-labelledby="todo-title">
      <div className="home-card-head">
        <h2 id="todo-title" className="home-card-title">Tâches du jour</h2>
        <span className="home-card-hint">{g.total ? `${g.done.length} / ${g.total}` : ''}</span>
        <button className="agc-icon" aria-label="Nouvelle tâche" title="Nouvelle tâche" onClick={() => data && setSheet({ type: 'task', task: null })}><Icon name="plus" size={18} stroke={2} /></button>
      </div>
      {error && <p className="group-foot">{error}</p>}
      {!data && !error && <p className="muted-line">Chargement…</p>}
      {data && !g.total && <p className="muted-line">Aucune tâche aujourd’hui. Ajoute-en une avec +.</p>}
      {g.important.length > 0 && (
        <div className="home-important">
          <p className="home-important-head"><Icon name="flag" size={14} stroke={2.2} /> Important · {g.important.length}</p>
          <ul className="td-list">{g.important.map(row)}</ul>
        </div>
      )}
      {g.rest.length > 0 && (
        <>
          {g.important.length > 0 && <p className="td-section">Le reste</p>}
          <ul className="td-list">{g.rest.map(row)}</ul>
        </>
      )}
      {g.done.length > 0 && (<><p className="td-section">Faites · {g.done.length}</p><ul className="td-list">{g.done.map(row)}</ul></>)}

      {sheet?.type === 'task' && (
        <TaskSheet task={sheet.task} categories={data.categories} projects={data.projects} projectsMissing={data.projectsMissing} today={today}
          onClose={() => setSheet(null)} onSaved={reload} onCategoryCreated={reload} />
      )}
    </section>
  )
}
