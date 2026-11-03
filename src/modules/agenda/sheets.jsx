// Feuilles du calendrier : fiche d'un de tes évènements, aperçu d'un cours / d'une séance /
// d'un évènement Google, choix « celui-ci / tous les suivants », catégories.
import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  REPEATS, REMINDERS_TIMED, REMINDERS_ALLDAY, DAY_LETTERS, COLORS, COLOR_NAMES,
  addDays, atMinutes, fromHHMM, hm, keyOf, weekdayIdx, defaultBusy, whenLabel, longDay, daysBetween
} from './logic'
import { WORKOUTS, EXERCISES } from '../sport/data'
import { profName } from '../ecole/parse'
import { fmtDuration } from '../sport/ui'

function Sheet({ label, children, onClose, className = '' }) {
  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div className={`sheet form-sheet ${className}`} role="dialog" aria-label={label} onClick={(e) => e.stopPropagation()}>
        {children}
      </div>
    </div>
  )
}

/* ---------- Fiche d'un évènement (création ou modification) ---------- */

function initialForm({ occ, draft, categories }) {
  const src = occ ? { ...occ.event } : draft
  const timedStart = occ ? occ.start : src.start_at ? new Date(src.start_at) : null
  const timedEnd = occ ? occ.end : src.end_at ? new Date(src.end_at) : null
  const allDay = !!src.all_day
  const date = allDay ? (occ ? occ.dayStart : src.day_start) : keyOf(timedStart)
  const endDate = allDay ? addDays(occ ? occ.dayEnd : src.day_end, -1) : keyOf(timedEnd)
  return {
    title: src.title || '',
    category_id: src.category_id ?? (occ ? '' : categories[0]?.id || ''),
    all_day: allDay,
    date,
    endDate,
    startTime: allDay ? '09:00' : hm(timedStart),
    endTime: allDay ? '10:00' : hm(timedEnd),
    location: src.location || '',
    note: src.note || '',
    busy: src.busy ?? true,
    busyTouched: !!occ,
    reminder_min: src.reminder_min ?? null,
    repeat: src.repeat || '',
    repeat_days: src.repeat_days || [],
    repeat_until: src.repeat_until || ''
  }
}

export function EventSheet({ occ, draft, categories, keywords, onSave, onDelete, onClose }) {
  const [f, setF] = useState(() => initialForm({ occ, draft, categories }))
  const [error, setError] = useState('')
  const [sure, setSure] = useState(false)
  const recurring = !!occ?.event.repeat
  const cat = categories.find((c) => c.id === f.category_id) || null

  const set = (patch) =>
    setF((x) => {
      const next = { ...x, ...patch }
      if (!next.busyTouched) {
        next.busy = defaultBusy({ category: categories.find((c) => c.id === next.category_id), title: next.title, allDay: next.all_day, keywords })
      }
      return next
    })

  // Changer le début déplace la fin (même durée), comme dans Calendrier.
  const setStart = (date, time) => {
    const oldStart = atMinutes(f.date, fromHHMM(f.startTime))
    const oldEnd = atMinutes(f.endDate, fromHHMM(f.endTime))
    const ns = atMinutes(date, fromHHMM(time))
    const ne = new Date(ns.getTime() + Math.max(15 * 60000, oldEnd - oldStart))
    if (f.all_day) set({ date, endDate: addDays(date, Math.max(0, daysBetween(f.date, f.endDate))) })
    else set({ date, startTime: time, endDate: keyOf(ne), endTime: hm(ne) })
  }

  const reminders = f.all_day ? REMINDERS_ALLDAY : REMINDERS_TIMED
  const weekly = f.repeat === 'weekly' || f.repeat === 'biweekly'
  const days = f.repeat_days.length ? f.repeat_days : [weekdayIdx(f.date)]

  function fields() {
    const base = {
      title: f.title.trim(),
      category_id: f.category_id || null,
      location: f.location.trim() || null,
      note: f.note.trim() || null,
      busy: f.busy,
      reminder_min: f.reminder_min,
      repeat: f.repeat || null,
      repeat_days: weekly ? [...days].sort() : null,
      repeat_until: f.repeat ? f.repeat_until || null : null
    }
    if (f.all_day) return { ...base, all_day: true, day_start: f.date, day_end: addDays(f.endDate, 1), start_at: null, end_at: null }
    return {
      ...base, all_day: false, day_start: null, day_end: null,
      start_at: atMinutes(f.date, fromHHMM(f.startTime)).toISOString(),
      end_at: atMinutes(f.endDate, fromHHMM(f.endTime)).toISOString()
    }
  }

  function submit(scope) {
    if (!f.title.trim()) return setError('Donne un titre à l’évènement.')
    const out = fields()
    if (f.all_day ? f.endDate < f.date : new Date(out.end_at) <= new Date(out.start_at)) return setError('La fin doit être après le début.')
    if (f.repeat && f.repeat_until && f.repeat_until < f.date) return setError('La fin de la répétition est avant le début.')
    return onSave(out, scope)
  }

  return (
    <Sheet label={occ ? f.title || 'Évènement' : 'Nouvel évènement'} onClose={onClose} className="ag-sheet">
      <form onSubmit={(e) => { e.preventDefault(); submit(recurring ? 'one' : undefined) }}>
        <input
          className="ag-title"
          autoFocus={!occ}
          placeholder="Ajouter un titre"
          aria-label="Titre"
          value={f.title}
          onChange={(e) => set({ title: e.target.value })}
          enterKeyHint="done"
        />

        <div className="ag-cats" role="radiogroup" aria-label="Catégorie">
          {categories.map((c) => (
            <button key={c.id} type="button" role="radio" aria-checked={f.category_id === c.id}
              className={f.category_id === c.id ? 'ag-cat is-on' : 'ag-cat'} style={{ '--c': `var(--${c.color})` }}
              onClick={() => set({ category_id: c.id })}>
              <span className="ag-dot" />{c.name}
            </button>
          ))}
        </div>

        <ul className="group">
          <li className="row">
            <label className="switch">
              <input type="checkbox" checked={f.all_day} onChange={(e) => set({ all_day: e.target.checked, reminder_min: null })} />
              <span aria-hidden="true" />
              <span className="row-label">Journée entière</span>
            </label>
          </li>
          <li className="row ag-when">
            <span className="row-label">Début</span>
            <input type="date" aria-label="Date de début" value={f.date} onChange={(e) => e.target.value && setStart(e.target.value, f.startTime)} />
            {!f.all_day && <input type="time" step={900} aria-label="Heure de début" value={f.startTime} onChange={(e) => e.target.value && setStart(f.date, e.target.value)} />}
          </li>
          <li className="row ag-when">
            <span className="row-label">Fin</span>
            <input type="date" aria-label="Date de fin" value={f.endDate} min={f.date} onChange={(e) => e.target.value && set({ endDate: e.target.value })} />
            {!f.all_day && <input type="time" step={900} aria-label="Heure de fin" value={f.endTime} onChange={(e) => e.target.value && set({ endTime: e.target.value })} />}
          </li>
        </ul>

        <ul className="group">
          <li className="row row-field">
            <label className="row-label" htmlFor="ag-rep">Répétition</label>
            <select id="ag-rep" value={f.repeat} onChange={(e) => set({ repeat: e.target.value })}>
              <option value="">Aucune</option>
              {Object.entries(REPEATS).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
            </select>
          </li>
          {weekly && (
            <li className="row ag-days" role="group" aria-label="Jours">
              {DAY_LETTERS.map((l, i) => (
                <button key={i} type="button" aria-pressed={days.includes(i)} className={days.includes(i) ? 'is-on' : ''}
                  onClick={() => set({ repeat_days: days.includes(i) ? (days.length > 1 ? days.filter((d) => d !== i) : days) : [...days, i] })}>
                  {l}
                </button>
              ))}
            </li>
          )}
          {f.repeat && (
            <li className="row row-field">
              <label className="row-label" htmlFor="ag-until">Jusqu’au</label>
              <input id="ag-until" type="date" min={f.date} value={f.repeat_until} onChange={(e) => set({ repeat_until: e.target.value })} />
            </li>
          )}
          <li className="row row-field">
            <label className="row-label" htmlFor="ag-rem">Rappel</label>
            <select id="ag-rem" value={f.reminder_min ?? ''} onChange={(e) => set({ reminder_min: e.target.value === '' ? null : Number(e.target.value) })}>
              {reminders.map(([v, l]) => <option key={l} value={v ?? ''}>{l}</option>)}
            </select>
          </li>
        </ul>
        {f.reminder_min != null && <p className="group-foot">Notification sur l’app iPhone (pas sur le site).</p>}

        <ul className="group">
          <li className="row row-field"><label className="row-label" htmlFor="ag-loc">Lieu</label><input id="ag-loc" placeholder="facultatif" value={f.location} onChange={(e) => set({ location: e.target.value })} /></li>
        </ul>
        <textarea className="field-area" rows={2} placeholder="Note" aria-label="Note" value={f.note} onChange={(e) => set({ note: e.target.value })} />

        <ul className="group" style={{ marginTop: 8 }}>
          <li className="row">
            <label className="switch">
              <input type="checkbox" checked={f.busy} onChange={(e) => set({ busy: e.target.checked, busyTouched: true })} />
              <span aria-hidden="true" />
              <span className="row-label">Bloque le sport</span>
            </label>
          </li>
        </ul>
        <p className="group-foot">
          {f.busy
            ? f.all_day ? 'Aucune séance ne sera placée ces jours-là.' : 'Le planning sport déplace les séances qui tombent sur ce créneau.'
            : `Le planning sport l’ignore${cat && !cat.blocks_sport ? ` (catégorie ${cat.name})` : ''}${f.all_day ? ', sauf les mots-clés voyage / examen / escalade' : ''}.`}
        </p>

        {error && <p className="group-foot is-error">{error}</p>}
        {recurring ? (
          <>
            <button className="btn-primary" type="submit">Enregistrer celui-ci</button>
            <button className="btn-secondary" type="button" onClick={() => submit('following')}>Celui-ci et les suivants</button>
          </>
        ) : (
          <button className="btn-primary" type="submit">{occ ? 'Enregistrer' : 'Ajouter'}</button>
        )}
        {occ && !recurring && (
          <button type="button" className="btn-plain danger" onClick={() => (sure ? onDelete() : setSure(true))}>
            {sure ? 'Confirmer la suppression' : 'Supprimer'}
          </button>
        )}
        {occ && recurring && (
          sure ? (
            <div className="ag-scope-row">
              <button type="button" className="btn-plain danger" onClick={() => onDelete('one')}>Supprimer celui-ci</button>
              <button type="button" className="btn-plain danger" onClick={() => onDelete('following')}>Celui-ci et les suivants</button>
            </div>
          ) : (
            <button type="button" className="btn-plain danger" onClick={() => setSure(true)}>Supprimer…</button>
          )
        )}
        <button type="button" className="btn-plain" onClick={onClose}>Annuler</button>
      </form>
    </Sheet>
  )
}

/* ---------- « Celui-ci ou tous les suivants ? » (déplacement d'un évènement répété) ---------- */

export function ScopeSheet({ title, onPick, onClose }) {
  return (
    <Sheet label="Évènement répété" onClose={onClose}>
      <p className="sheet-title">Déplacer « {title} »</p>
      <p className="sheet-text">C’est un évènement qui se répète.</p>
      <button className="btn-primary" onClick={() => onPick('one')}>Celui-ci seulement</button>
      <button className="btn-secondary" onClick={() => onPick('following')}>Celui-ci et les suivants</button>
      <button className="btn-plain" onClick={onClose}>Annuler</button>
    </Sheet>
  )
}

/* ---------- Aperçu d'un cours, d'une séance sport ou d'un évènement Google ---------- */

const STATUS = { planned: 'Prévue', done: 'Faite ✓', skipped: 'Passée', missed: 'Manquée' }

export function DetailSheet({ item, courses, onUnpin, onClose }) {
  const s = item.session
  const c = item.course
  const next = useMemo(() => {
    if (!c) return []
    return courses.filter((x) => x.courseKey === c.courseKey && x.start > new Date() && x.id !== c.id).slice(0, 3)
  }, [c, courses])

  const kicker = { cours: 'Cours', sport: s?.kind === 'muscu' ? 'Séance muscu' : 'Séance vélo', google: item.source ? `Agenda · ${item.source}` : 'Agenda relié', off: 'Horaire de cours' }[item.kind]
  const workout = s?.kind === 'muscu' ? WORKOUTS[s.template_key] : null

  return (
    <Sheet label={item.title} onClose={onClose}>
      <div className="course-sheet-head">
        <span className="course-dot" style={{ background: item.color }} />
        <div>
          <p className="qty-brand">{kicker}</p>
          <p className="sheet-title">{item.title}</p>
        </div>
      </div>
      <ul className="group lines">
        <li className="row"><span className="row-label">Quand</span><span className="row-value">{whenLabel(item)}</span></li>
        {c?.room && <li className="row"><span className="row-label">Salle</span><span className="row-value">{c.room}{c.roomType ? ` · ${c.roomType}` : ''}</span></li>}
        {c?.prof && <li className="row"><span className="row-label">Professeur</span><span className="row-value">{profName(c.prof)}</span></li>}
        {s && <li className="row"><span className="row-label">Durée</span><span className="row-value">{fmtDuration(s.duration_min)}</span></li>}
        {s && <li className="row"><span className="row-label">Statut</span><span className="row-value">{STATUS[s.status] || s.status}</span></li>}
        {item.raw?.location && <li className="row"><span className="row-label">Lieu</span><span className="row-value">{item.raw.location}</span></li>}
      </ul>
      {workout && (
        <>
          <p className="group-title">Exercices</p>
          <ul className="group lines">
            {workout.items.map((x, i) => (
              <li key={i} className="row">
                <span className="row-label">{EXERCISES[x.ex]?.name || x.ex}</span>
                <span className="row-value">{x.sets} × {x.reps[0]}–{x.reps[1]}</span>
              </li>
            ))}
          </ul>
        </>
      )}
      {s?.note && <p className="group-foot">{s.note}</p>}
      {item.raw?.description && item.kind === 'google' && <p className="ag-desc">{item.raw.description.slice(0, 400)}</p>}
      {next.length > 0 && (
        <>
          <p className="group-title">Prochaines séances</p>
          <ul className="group lines">
            {next.map((x) => (
              <li key={x.id} className="row"><span className="row-label">{longDay(keyOf(x.start))}</span><span className="row-value">{hm(x.start)}–{hm(x.end)}</span></li>
            ))}
          </ul>
        </>
      )}
      {s && (
        <Link className="btn-primary as-link" to={`/sport/${s.kind === 'muscu' ? 'seance' : 'velo'}/${s.id}`}>
          {s.kind === 'muscu' ? 'Ouvrir la séance' : 'Ouvrir la sortie'}
        </Link>
      )}
      {s?.pinned && s.status === 'planned' && (
        <button className="btn-secondary" onClick={() => onUnpin(s)}>Laisser le planning choisir l’heure</button>
      )}
      {s && <Link className="btn-plain as-link" to="/sport">Voir la semaine sport</Link>}
      {s && (s.status === 'planned' || s.status === 'missed') && !s.pinned && (
        <p className="group-foot">Pour la déplacer : glisse-la dans le calendrier{' '}(sur iPhone : appui long puis glisse). Elle reste dans sa semaine.</p>
      )}
      {(item.kind === 'cours' || item.kind === 'off') && <Link className="btn-primary as-link" to="/ecole/semaine">Ouvrir École</Link>}
      {item.kind === 'google' && <p className="group-foot">Lecture seule : modifie-le dans ton agenda Google.</p>}
      <button className="btn-plain" onClick={onClose}>Fermer</button>
    </Sheet>
  )
}

/* ---------- Catégories ---------- */

export function CategoriesSheet({ categories, onSave, onRemove, onClose }) {
  const [edit, setEdit] = useState(null)
  const [sure, setSure] = useState(false)

  if (edit) {
    const set = (p) => setEdit((x) => ({ ...x, ...p }))
    return (
      <Sheet label="Catégorie" onClose={onClose}>
        <p className="sheet-title">{edit.id ? 'Modifier la catégorie' : 'Nouvelle catégorie'}</p>
        <ul className="group">
          <li className="row row-field"><label className="row-label" htmlFor="ag-cn">Nom</label><input id="ag-cn" autoFocus={!edit.id} placeholder="Études, Famille…" value={edit.name} onChange={(e) => set({ name: e.target.value })} /></li>
        </ul>
        <div className="ag-swatches" role="radiogroup" aria-label="Couleur">
          {COLORS.map((c) => (
            <button key={c} type="button" role="radio" aria-checked={edit.color === c} aria-label={COLOR_NAMES[c]} title={COLOR_NAMES[c]}
              className={edit.color === c ? 'is-on' : ''} style={{ '--c': `var(--${c})` }} onClick={() => set({ color: c })} />
          ))}
        </div>
        <ul className="group">
          <li className="row">
            <label className="switch">
              <input type="checkbox" checked={edit.blocks_sport} onChange={(e) => set({ blocks_sport: e.target.checked })} />
              <span aria-hidden="true" />
              <span className="row-label">Bloque le sport par défaut</span>
            </label>
          </li>
        </ul>
        <p className="group-foot">Valeur proposée pour chaque nouvel évènement de cette catégorie ; tu peux la changer évènement par évènement.</p>
        <button className="btn-primary" disabled={!edit.name.trim()} onClick={async () => { await onSave({ ...edit, name: edit.name.trim() }); setEdit(null) }}>Enregistrer</button>
        {edit.id && (
          <button className="btn-plain danger" onClick={async () => { if (!sure) return setSure(true); await onRemove(edit.id); setSure(false); setEdit(null) }}>
            {sure ? 'Confirmer (les évènements gardent leur place, sans catégorie)' : 'Supprimer la catégorie'}
          </button>
        )}
        <button className="btn-plain" onClick={() => { setEdit(null); setSure(false) }}>Retour</button>
      </Sheet>
    )
  }

  return (
    <Sheet label="Catégories" onClose={onClose}>
      <p className="sheet-title">Catégories de l’agenda</p>
      <ul className="group">
        {categories.map((c) => (
          <li key={c.id}>
            <button className="row" onClick={() => setEdit({ ...c })}>
              <span className="ag-dot big" style={{ '--c': `var(--${c.color})` }} />
              <span className="row-label">{c.name}</span>
              <span className="row-value">{c.blocks_sport ? 'bloque le sport' : 'ne bloque pas'}</span>
            </button>
          </li>
        ))}
      </ul>
      <button className="btn-secondary" onClick={() => setEdit({ name: '', color: COLORS[(categories.length + 5) % COLORS.length], blocks_sport: true, sort: categories.length })}>Nouvelle catégorie</button>
      <button className="btn-plain" onClick={onClose}>Fermer</button>
    </Sheet>
  )
}

