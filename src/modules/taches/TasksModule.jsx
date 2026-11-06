// Espace Tâches (v0.30) : une seule page — Aujourd'hui → Bientôt → Projets → Plus tard / Sans date / Terminées.
import { useCallback, useEffect, useMemo, useState } from 'react'
import Icon from '../../components/Icon'
import { loadTasks, setTaskDone, missingTasksTable, saveTaskCategory, removeTaskCategory, saveProject, setProjectDone, removeProject } from './api'
import { pageSections, keyOf, relDay, shortDay, addDays, projectProgress, sortProjects, daysUntil } from './logic'
import { TaskRow, TaskSheet, catColor, projectIcon } from './ui'
import { CategoriesSheet } from '../agenda/sheets'
import { COLORS } from '../agenda/logic'
import { BudgetIcon, IconPicker } from '../budget/icons'

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

const fmtLong = new Intl.DateTimeFormat('fr-BE', { day: 'numeric', month: 'long' })
const fmtShort = new Intl.DateTimeFormat('fr-BE', { day: 'numeric', month: 'short' })
const dayOf = (k) => {
  const [y, m, d] = k.split('-').map(Number)
  return new Date(y, m - 1, d)
}
const dueShort = (k) => fmtShort.format(dayOf(k)).replace('.', '')

export default function TasksModule() {
  const { data, error, reload, toggle } = useTasks()
  const [sheet, setSheet] = useState(null)
  const [open, setOpen] = useState({})
  const [query, setQuery] = useState(null)
  const today = keyOf(new Date())

  const sec = useMemo(() => (data ? pageSections(data.tasks, today) : null), [data, today])
  const catById = Object.fromEntries((data?.categories || []).map((c) => [c.id, c]))
  const projById = Object.fromEntries((data?.projects || []).map((p) => [p.id, p]))
  const projects = useMemo(() => sortProjects((data?.projects || []).filter((p) => !p.done)), [data])
  const doneProjects = (data?.projects || []).filter((p) => p.done)

  const row = (t, opts = {}) => (
    <li key={t.id}>
      <TaskRow task={t} cat={catById[t.category_id]} project={opts.noProject ? null : projById[t.project_id]} today={today}
        onToggle={toggle} onOpen={(x) => setSheet({ type: 'task', task: x })} withDay={opts.withDay} />
    </li>
  )
  const newTask = (defaults = {}) => setSheet({ type: 'task', task: null, defaults })

  let body = null
  if (data && query != null && query.trim()) {
    const q = query.trim().toLowerCase()
    const found = data.tasks.filter((t) => t.title.toLowerCase().includes(q) || projById[t.project_id]?.name.toLowerCase().includes(q))
    body = found.length
      ? <ul className="group habit-list" style={{ marginTop: 12 }}>{found.slice(0, 80).map((t) => row(t, { withDay: true }))}</ul>
      : <p className="muted-line">Aucune tâche ne correspond.</p>
  } else if (sec) {
    const counts = [sec.late && `${sec.late} en retard`, sec.dueToday && `${sec.dueToday} aujourd’hui`].filter(Boolean).join(' · ')
    body = (
      <div className="tasks-main">
        <div className="tcol">
        <section className="tsec tsec-today" aria-labelledby="t-today">
          <div className="tsec-head"><h2 id="t-today">Aujourd’hui</h2><span>{counts || (sec.today.length ? 'tout est fait ✓' : '')}</span></div>
          {sec.today.length
            ? <ul className="group habit-list">{sec.today.map((t) => row(t))}</ul>
            : <p className="tsec-empty">Rien de prévu aujourd’hui. Touche + pour ajouter une tâche.</p>}
        </section>

        <section className="tsec tsec-soon" aria-labelledby="t-soon">
          <div className="tsec-head"><h2 id="t-soon">Bientôt</h2><span>7 prochains jours</span></div>
          {sec.soon.length ? (
            <ul className="group habit-list">
              {sec.soon.map((g) => (
                <li key={g.date} className="tday-group">
                  <p className="tday">{relDay(g.date, today) === 'demain' ? `Demain · ${shortDay(g.date)}` : shortDay(g.date)}</p>
                  <ul>{g.tasks.map((t) => row(t))}</ul>
                </li>
              ))}
            </ul>
          ) : <p className="tsec-empty">Rien de prévu les 7 prochains jours.</p>}
        </section>
        </div>
        <div className="tcol">

        <section className="tsec tsec-proj" aria-labelledby="t-proj">
          <div className="tsec-head"><h2 id="t-proj">Projets</h2><span>{projects.length ? `${projects.length} en cours` : ''}</span></div>
          {data.projectsMissing ? (
            <div className="callout">
              <span className="callout-icon"><Icon name="info" size={20} /></span>
              <p className="callout-text">Pour les projets et les rappels, lance <strong>019_projets.sql</strong> dans Supabase (SQL Editor).</p>
            </div>
          ) : (
            <div className="proj-grid">
              {projects.map((p) => {
                const pr = projectProgress(p, data.tasks)
                const left = p.due_date ? daysUntil(p.due_date, today) : null
                return (
                  <button key={p.id} type="button" className="proj-case" style={{ '--c': catColor(p) }} onClick={() => setSheet({ type: 'project', id: p.id })}>
                    <span className="proj-ico"><BudgetIcon name={projectIcon(p)} size={16} stroke={1.9} /></span>
                    <span className="proj-name">{p.name}</span>
                    <span className={left != null && left < 0 && pr.open ? 'proj-sub is-late' : 'proj-sub'}>
                      {pr.total ? `${pr.done}/${pr.total}` : 'aucune tâche'}
                      {p.due_date ? ` · ${left < 0 ? 'dépassé' : `avant le ${dueShort(p.due_date)}`}` : ''}
                    </span>
                    <span className="proj-bar" aria-hidden="true"><i style={{ width: `${pr.ratio * 100}%` }} /></span>
                  </button>
                )
              })}
              <button type="button" className="proj-case proj-new" onClick={() => setSheet({ type: 'projectEdit', project: null })}>
                <Icon name="plus" size={20} stroke={2} /><span>Projet</span>
              </button>
            </div>
          )}
        </section>

        <section className="tsec tsec-more" aria-label="Autres tâches">
          {[
            ['later', 'Plus tard', sec.later, true],
            ['nodate', 'Sans date', sec.nodate, false],
            ['done', 'Terminées', sec.done.slice(0, 60), true]
          ].map(([k, label, list, withDay]) => (
            <div key={k} className="tmore">
              <button type="button" className="tmore-head" aria-expanded={!!open[k]} onClick={() => setOpen({ ...open, [k]: !open[k] })}>
                <strong>{label}</strong>
                <span>{k === 'done' ? sec.done.length : list.length} <Icon name="chevron" size={14} stroke={2} /></span>
              </button>
              {open[k] && (list.length
                ? <ul className="group habit-list">{list.map((t) => row(t, { withDay }))}</ul>
                : <p className="tsec-empty">Rien ici.</p>)}
            </div>
          ))}
          {doneProjects.length > 0 && (
            <div className="tmore">
              <button type="button" className="tmore-head" aria-expanded={!!open.dp} onClick={() => setOpen({ ...open, dp: !open.dp })}>
                <strong>Projets terminés</strong><span>{doneProjects.length} <Icon name="chevron" size={14} stroke={2} /></span>
              </button>
              {open.dp && (
                <ul className="group">
                  {doneProjects.map((p) => (
                    <li key={p.id}><button type="button" className="row" onClick={() => setSheet({ type: 'project', id: p.id })}><span className="row-label">{p.name}</span><span className="row-value">{projectProgress(p, data.tasks).total} tâches</span></button></li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </section>
        </div>
      </div>
    )
  }

  const project = sheet?.type === 'project' ? projById[sheet.id] : null

  return (
    <div className="page tasks">
      <header className="sport-head">
        <h1 className="large-title">Tâches</h1>
        {data && (
          <span className="head-actions">
            <button className="icon-btn" aria-label="Chercher une tâche" aria-pressed={query != null} onClick={() => setQuery(query == null ? '' : null)}><Icon name="search" size={20} /></button>
            <button className="icon-btn" aria-label="Catégories" onClick={() => setSheet({ type: 'cats' })}><Icon name="settings" size={20} /></button>
          </span>
        )}
      </header>
      {query != null && (
        <div className="search-bar">
          <Icon name="search" size={18} />
          <input autoFocus placeholder="Chercher une tâche ou un projet" value={query} onChange={(e) => setQuery(e.target.value)} aria-label="Chercher" />
          <button type="button" className="link-btn" onClick={() => setQuery(null)}>Fermer</button>
        </div>
      )}
      {error && <p className="group-foot is-error">{error}</p>}
      {!data && !error && <p className="muted-line">Chargement…</p>}
      {body}
      {data && <button className="fab" aria-label="Nouvelle tâche" onClick={() => newTask()}><Icon name="plus" size={26} stroke={2.2} /></button>}

      {sheet?.type === 'task' && (
        <TaskSheet task={sheet.task} defaults={sheet.defaults} categories={data.categories} projects={data.projects} projectsMissing={data.projectsMissing} today={today}
          onClose={() => setSheet(sheet.back || null)} onSaved={reload} onCategoryCreated={reload} />
      )}
      {sheet?.type === 'cats' && (
        <CategoriesSheet withSport={false} title="Catégories des tâches" categories={data.categories}
          onSave={async (c) => { await saveTaskCategory(c); await reload() }}
          onRemove={async (id) => { await removeTaskCategory(id); await reload() }}
          onClose={() => setSheet(null)} />
      )}
      {project && (
        <ProjectSheet project={project} tasks={data.tasks} today={today} catById={catById} onToggle={toggle}
          onOpenTask={(t) => setSheet({ type: 'task', task: t, back: sheet })}
          onAddTask={() => setSheet({ type: 'task', task: null, defaults: { project_id: project.id, planned_date: '' }, back: sheet })}
          onEdit={() => setSheet({ type: 'projectEdit', project, back: sheet })}
          onDone={async (done) => { await setProjectDone(project, done); await reload() }}
          onRemove={async () => { await removeProject(project.id, data.tasks); setSheet(null); await reload() }}
          onClose={() => setSheet(null)} />
      )}
      {sheet?.type === 'projectEdit' && (
        <ProjectEditSheet project={sheet.project} count={data.projects.length}
          onSaved={async (saved) => { await reload(); setSheet(sheet.back || (saved ? { type: 'project', id: saved.id } : null)) }}
          onClose={() => setSheet(sheet.back || null)} />
      )}
    </div>
  )
}

/* ---------- Un projet ---------- */

function ProjectSheet({ project, tasks, today, catById, onToggle, onOpenTask, onAddTask, onEdit, onDone, onRemove, onClose }) {
  const [sure, setSure] = useState(false)
  const [showDone, setShowDone] = useState(false)
  const pr = projectProgress(project, tasks)
  const list = tasks.filter((t) => t.project_id === project.id)
  const todo = pageSections(list, today)
  const openList = [...todo.today.filter((t) => !t.done), ...todo.soon.flatMap((g) => g.tasks), ...todo.later, ...todo.nodate]
  const left = project.due_date ? daysUntil(project.due_date, today) : null
  const row = (t) => (
    <li key={t.id}><TaskRow task={t} cat={catById[t.category_id]} today={today} onToggle={onToggle} onOpen={onOpenTask} withDay /></li>
  )
  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div className="sheet form-sheet" role="dialog" aria-label={project.name} onClick={(e) => e.stopPropagation()} style={{ '--c': catColor(project) }}>
        <p className="sheet-title sheet-title-icon"><span className="proj-ico"><BudgetIcon name={projectIcon(project)} size={16} stroke={1.9} /></span> {project.name}</p>
        <p className="cat-detail-sub">
          {pr.total ? `${pr.done} faite${pr.done > 1 ? 's' : ''} sur ${pr.total}` : 'Pas encore de tâche'}
          {project.due_date && ` · avant le ${fmtLong.format(dayOf(project.due_date))}`}
          {left != null && !project.done && (left < 0 ? ' (dépassé)' : left === 0 ? ' (aujourd’hui)' : ` (${left} jour${left > 1 ? 's' : ''})`)}
          {project.done && ' · terminé ✓'}
        </p>
        <div className="proj-bar big" aria-hidden="true"><i style={{ width: `${pr.ratio * 100}%` }} /></div>

        <h2 className="group-title">À faire · {openList.length}</h2>
        <ul className="group habit-list">
          {openList.map(row)}
          <li><button type="button" className="row add-row" onClick={onAddTask}><Icon name="plus" size={18} stroke={2} /> Ajouter une tâche au projet</button></li>
        </ul>
        {todo.done.length > 0 && (
          <>
            <button type="button" className="tmore-head" aria-expanded={showDone} onClick={() => setShowDone(!showDone)}>
              <strong>Faites · {todo.done.length}</strong><Icon name="chevron" size={14} stroke={2} />
            </button>
            {showDone && <ul className="group habit-list">{todo.done.map(row)}</ul>}
          </>
        )}

        <div className="acc-actions">
          <button className="btn-secondary" onClick={onEdit}>Modifier</button>
          <button className="btn-secondary" onClick={() => onDone(!project.done)}>{project.done ? 'Rouvrir' : 'Terminer'}</button>
          <button className="btn-secondary danger" onClick={() => (sure ? onRemove() : setSure(true))}>{sure ? 'Confirmer' : 'Supprimer'}</button>
        </div>
        {sure && <p className="group-foot">Les tâches du projet sont gardées, elles n’auront simplement plus de projet.</p>}
        <button type="button" className="btn-plain" onClick={onClose}>Fermer</button>
      </div>
    </div>
  )
}

/* ---------- Créer / modifier un projet ---------- */

function ProjectEditSheet({ project, count, onSaved, onClose }) {
  const [f, setF] = useState(() => ({ name: '', color: COLORS[(count * 3 + 1) % COLORS.length], icon: null, due_date: '', ...(project ? { ...project, due_date: project.due_date || '' } : {}) }))
  const [error, setError] = useState('')
  const set = (p) => setF((x) => ({ ...x, ...p }))
  const icon = f.icon || projectIcon({ name: f.name })
  async function submit(e) {
    e.preventDefault()
    if (!f.name.trim()) return setError('Donne un nom au projet (Voyage, Mémoire…).')
    try {
      const saved = await saveProject({ ...f, icon })
      onSaved(project ? null : saved)
    } catch (err) {
      setError(missingTasksTable(err) ? 'Lance d’abord 019_projets.sql dans Supabase.' : err.message)
    }
  }
  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <form className="sheet form-sheet" role="dialog" aria-label={project ? project.name : 'Nouveau projet'} onClick={(e) => e.stopPropagation()} onSubmit={submit}>
        <p className="sheet-title">{project ? 'Modifier le projet' : 'Nouveau projet'}</p>
        <ul className="group">
          <li className="row row-field"><label className="row-label" htmlFor="pj-n">Nom</label><input id="pj-n" autoFocus={!project} placeholder="Voyage Thaïlande, Mémoire…" value={f.name} onChange={(e) => set({ name: e.target.value })} /></li>
          <li className="row row-field"><label className="row-label" htmlFor="pj-d">Fini avant le</label><input id="pj-d" type="date" value={f.due_date} onChange={(e) => set({ due_date: e.target.value })} />{f.due_date && <button type="button" className="row-action" onClick={() => set({ due_date: '' })}>Retirer</button>}</li>
        </ul>
        <p className="group-foot">La date de fin est facultative.</p>
        <h2 className="group-title">Couleur</h2>
        <div className="color-pick" role="radiogroup" aria-label="Couleur">
          {COLORS.map((c) => (
            <button key={c} type="button" role="radio" aria-checked={f.color === c} aria-label={c} className={f.color === c ? 'is-on' : ''} style={{ '--c': `var(--${c})` }} onClick={() => set({ color: c })} />
          ))}
        </div>
        <h2 className="group-title">Icône</h2>
        <IconPicker value={icon} onChange={(k) => set({ icon: k })} />
        {error && <p className="group-foot is-error">{error}</p>}
        <button className="btn-primary" type="submit">{project ? 'Enregistrer' : 'Créer le projet'}</button>
        <button type="button" className="btn-plain" onClick={onClose}>Annuler</button>
      </form>
    </div>
  )
}
