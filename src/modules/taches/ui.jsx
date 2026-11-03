// Éléments communs des tâches : ligne à cocher et fiche d'une tâche.
import { useState } from 'react'
import Icon from '../../components/Icon'
import { PRIORITIES, PRIORITY_MARK, taskMeta, isDueLate, taskState, keyOf, addDays } from './logic'
import { saveTask, removeTask, saveTaskCategory } from './api'
import { COLORS } from '../agenda/logic'

export const catColor = (cat) => `var(--${cat?.color || 'gray'})`

// Rond à cocher (même dessin que les habitudes).
export function CheckCircle({ done, color, label, onClick, disabled }) {
  return (
    <button type="button" className="habit-check" style={{ '--c': color }} onClick={onClick} aria-pressed={done} aria-label={label} disabled={disabled}>
      <svg viewBox="0 0 36 36" aria-hidden="true">
        <circle cx="18" cy="18" r="15" className="habit-check-track" />
      </svg>
      {done ? <Icon name="check" size={17} stroke={2.6} /> : null}
    </button>
  )
}

export function TaskRow({ task, cat, today, onToggle, onOpen, withDay = false }) {
  const st = taskState(task, today)
  const late = st === 'overdue' || isDueLate(task, today)
  const meta = taskMeta(task, today, { withDay: withDay || st === 'overdue' })
  return (
    <div className={`habit-row task-row${task.done ? ' is-done' : ''}`}>
      <CheckCircle done={task.done} color={late && !task.done ? 'var(--red)' : catColor(cat)}
        label={`${task.title} : ${task.done ? 'faite' : 'à faire'}`} onClick={() => onToggle(task, !task.done)} />
      <button type="button" className="habit-main" onClick={() => onOpen(task)}>
        <span className="habit-name">{task.title}</span>
        {meta && <span className={late && !task.done ? 'habit-sub is-late' : 'habit-sub'}>{meta}</span>}
      </button>
      <span className={`task-prio p${task.priority || 2}`} aria-label={`Priorité ${PRIORITIES[task.priority || 2].toLowerCase()}`}>{PRIORITY_MARK[task.priority || 2]}</span>
      {cat && <span className="task-cat" style={{ '--c': catColor(cat) }}>{cat.name}</span>}
    </div>
  )
}

/* ---------- Fiche d'une tâche ---------- */

const DURATIONS = [15, 30, 45, 60, 90, 120, 180]
const durLabel = (m) => (m >= 60 ? `${Math.floor(m / 60)} h${m % 60 ? ` ${m % 60}` : ''}` : `${m} min`)

export function TaskSheet({ task, categories, today = keyOf(new Date()), onClose, onSaved, onCategoryCreated }) {
  const [f, setF] = useState(() => ({
    title: '', category_id: categories[0]?.id || '', priority: 2, planned_date: today, time: '', duration_min: '',
    due_date: '', busy: false,
    ...(task ? Object.fromEntries(Object.entries(task).map(([k, v]) => [k, v ?? ''])) : {})
  }))
  const [newCat, setNewCat] = useState(null)
  const [error, setError] = useState('')
  const [sure, setSure] = useState(false)
  const set = (p) => setF((x) => ({ ...x, ...p }))

  async function submit(e) {
    e?.preventDefault()
    if (!f.title.trim()) return setError('Donne un titre à la tâche.')
    try {
      let category_id = f.category_id
      if (newCat?.trim()) {
        category_id = (await saveTaskCategory({ name: newCat.trim(), color: COLORS[(categories.length + 5) % COLORS.length], sort: categories.length })).id
        onCategoryCreated?.()
      }
      await saveTask({ ...f, category_id, duration_min: f.time ? f.duration_min || 30 : null })
      onSaved?.()
      onClose()
    } catch (err) {
      setError(/relation|does not exist|schema cache/i.test(err.message) ? 'Lance d’abord 014_taches.sql dans Supabase.' : err.message)
    }
  }

  const quick = [['Aujourd’hui', today], ['Demain', addDays(today, 1)], ['Sans date', '']]

  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <form className="sheet form-sheet ag-sheet" role="dialog" aria-label={task ? task.title : 'Nouvelle tâche'} onClick={(e) => e.stopPropagation()} onSubmit={submit}>
        <input className="ag-title" autoFocus={!task} placeholder="Nouvelle tâche" aria-label="Titre" value={f.title} onChange={(e) => set({ title: e.target.value })} enterKeyHint="done" />

        <div className="ag-cats" role="radiogroup" aria-label="Catégorie">
          {categories.map((c) => (
            <button key={c.id} type="button" role="radio" aria-checked={f.category_id === c.id && newCat == null}
              className={f.category_id === c.id && newCat == null ? 'ag-cat is-on' : 'ag-cat'} style={{ '--c': catColor(c) }}
              onClick={() => { set({ category_id: c.id }); setNewCat(null) }}>
              <span className="ag-dot" />{c.name}
            </button>
          ))}
          <button type="button" className={newCat != null ? 'ag-cat is-on' : 'ag-cat'} onClick={() => setNewCat('')}>+ Catégorie</button>
          <button type="button" className={!f.category_id && newCat == null ? 'ag-cat is-on' : 'ag-cat'} onClick={() => { set({ category_id: '' }); setNewCat(null) }}>Aucune</button>
        </div>
        {newCat != null && (
          <ul className="group"><li className="row row-field"><label className="row-label" htmlFor="tk-nc">Nouvelle catégorie</label><input id="tk-nc" autoFocus placeholder="TFE, Maison…" value={newCat} onChange={(e) => setNewCat(e.target.value)} /></li></ul>
        )}

        <h2 className="group-title">Quand</h2>
        <div className="chips left">
          {quick.map(([l, v]) => (
            <button key={l} type="button" className={f.planned_date === v ? 'chip is-on' : 'chip'} onClick={() => set({ planned_date: v, ...(v ? {} : { time: '', busy: false }) })}>{l}</button>
          ))}
        </div>
        <ul className="group">
          <li className="row row-field"><label className="row-label" htmlFor="tk-d">Prévue le</label><input id="tk-d" type="date" value={f.planned_date} onChange={(e) => set({ planned_date: e.target.value })} /></li>
          {f.planned_date && (
            <li className="row row-field"><label className="row-label" htmlFor="tk-t">Heure</label><input id="tk-t" type="time" step={900} value={f.time} onChange={(e) => set({ time: e.target.value })} />{f.time && <button type="button" className="row-action" onClick={() => set({ time: '', busy: false })}>Retirer</button>}</li>
          )}
          {f.planned_date && f.time && (
            <li className="row row-field">
              <label className="row-label" htmlFor="tk-du">Durée</label>
              <select id="tk-du" value={f.duration_min || 30} onChange={(e) => set({ duration_min: Number(e.target.value) })}>
                {DURATIONS.map((m) => <option key={m} value={m}>{durLabel(m)}</option>)}
              </select>
            </li>
          )}
          <li className="row row-field"><label className="row-label" htmlFor="tk-due">Date limite</label><input id="tk-due" type="date" value={f.due_date} onChange={(e) => set({ due_date: e.target.value })} />{f.due_date && <button type="button" className="row-action" onClick={() => set({ due_date: '' })}>Retirer</button>}</li>
        </ul>
        <p className="group-foot">
          {f.planned_date && f.time ? 'Avec une heure, elle apparaît aussi dans le calendrier.' : 'Sans heure, elle reste dans la liste du jour.'}
          {' '}Pas faite le jour prévu : elle reste en retard, en rouge, en haut de la liste.
        </p>

        <h2 className="group-title">Priorité</h2>
        <div className="segmented wide" role="radiogroup" aria-label="Priorité">
          {[1, 2, 3].map((p) => (
            <button key={p} type="button" role="radio" aria-checked={Number(f.priority) === p} className={Number(f.priority) === p ? 'is-on' : ''} onClick={() => set({ priority: p })}>{PRIORITIES[p]}</button>
          ))}
        </div>

        {f.planned_date && f.time && (
          <>
            <ul className="group" style={{ marginTop: 12 }}>
              <li className="row">
                <label className="switch">
                  <input type="checkbox" checked={!!f.busy} onChange={(e) => set({ busy: e.target.checked })} />
                  <span aria-hidden="true" />
                  <span className="row-label">Bloque le sport</span>
                </label>
              </li>
            </ul>
            <p className="group-foot">{f.busy ? 'Le planning sport déplace les séances qui tombent sur ce créneau.' : 'Le planning sport l’ignore.'}</p>
          </>
        )}

        {error && <p className="group-foot is-error">{error}</p>}
        <button className="btn-primary" type="submit" style={{ marginTop: 12 }}>{task ? 'Enregistrer' : 'Ajouter'}</button>
        {task && (
          <button type="button" className="btn-plain danger" onClick={async () => { if (!sure) return setSure(true); await removeTask(task.id); onSaved?.(); onClose() }}>
            {sure ? 'Confirmer la suppression' : 'Supprimer'}
          </button>
        )}
        <button type="button" className="btn-plain" onClick={onClose}>Annuler</button>
      </form>
    </div>
  )
}
