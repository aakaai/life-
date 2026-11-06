// Accueil · « À faire aujourd'hui » (v0.30.2) : seulement les tâches (en retard, puis dans l'ordre de la journée).
// Les habitudes et les séances ont leur propre bloc (HomeHabits) ; les cours restent dans le calendrier du jour.
import { useState } from 'react'
import Icon from '../../components/Icon'
import { useTasks } from '../taches/TasksModule'
import { TaskRow, TaskSheet } from '../taches/ui'
import { tasksForToday, taskState, toMin } from '../taches/logic'

const pad = (n) => String(n).padStart(2, '0')
const keyOf = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
const SECTIONS = [['morning', 'Matin', 0, 12 * 60], ['afternoon', 'Après-midi', 12 * 60, 18 * 60], ['evening', 'Soir', 18 * 60, 1e9]]

export default function TodayList() {
  const today = keyOf(new Date())
  const { data, error, reload, toggle } = useTasks()
  const [sheet, setSheet] = useState(null)

  const catById = Object.fromEntries((data?.categories || []).map((c) => [c.id, c]))
  const projById = Object.fromEntries((data?.projects || []).map((p) => [p.id, p]))
  const items = (data ? tasksForToday(data.tasks, today) : []).map((t) => {
    const late = taskState(t, today) === 'overdue'
    return { key: t.id, late, min: late ? -1 : toMin(t.time), label: late ? '' : t.time || '', task: t }
  })
  const late = items.filter((x) => x.late)
  const timed = items.filter((x) => !x.late && x.min != null).sort((a, b) => a.min - b.min)
  const noTime = items.filter((x) => !x.late && x.min == null)
  const doneCount = items.filter((x) => x.task.done).length

  const row = (x) => (
    <li key={x.key} className="td-item">
      <span className={x.late ? 'td-time is-late' : 'td-time'}>{x.late ? 'retard' : x.label}</span>
      <div className="td-content">
        <TaskRow task={x.task} cat={catById[x.task.category_id]} project={projById[x.task.project_id]} today={today} onToggle={toggle} onOpen={(t) => setSheet({ type: 'task', task: t })} />
      </div>
    </li>
  )
  const sections = SECTIONS.map(([k, name, a, b]) => [k, name, timed.filter((x) => x.min >= a && x.min < b)]).filter(([, , l]) => l.length)

  return (
    <section className="home-card" aria-labelledby="todo-title">
      <div className="home-card-head">
        <h2 id="todo-title" className="home-card-title">Tâches du jour</h2>
        <span className="home-card-hint">{items.length ? `${doneCount} / ${items.length}` : ''}</span>
        <button className="agc-icon" aria-label="Nouvelle tâche" title="Nouvelle tâche" onClick={() => data && setSheet({ type: 'task', task: null })}><Icon name="plus" size={18} stroke={2} /></button>
      </div>
      {error && <p className="group-foot">{error}</p>}
      {!data && !error && <p className="muted-line">Chargement…</p>}
      {data && !items.length && <p className="muted-line">Aucune tâche aujourd’hui. Ajoute-en une avec +.</p>}
      {late.length > 0 && (<><p className="td-section is-late">En retard</p><ul className="td-list">{late.map(row)}</ul></>)}
      {sections.map(([k, name, list]) => (
        <div key={k}><p className="td-section">{name}</p><ul className="td-list">{list.map(row)}</ul></div>
      ))}
      {noTime.length > 0 && (<><p className="td-section">Sans heure</p><ul className="td-list">{noTime.map(row)}</ul></>)}

      {sheet?.type === 'task' && (
        <TaskSheet task={sheet.task} categories={data.categories} projects={data.projects} projectsMissing={data.projectsMissing} today={today}
          onClose={() => setSheet(null)} onSaved={reload} onCategoryCreated={reload} />
      )}
    </section>
  )
}
