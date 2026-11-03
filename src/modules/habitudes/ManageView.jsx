import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import Icon from '../../components/Icon'
import { HabitsNav, useHabits, catColor, freqLabel, shortDay, longDay } from './ui'
import { MOMENTS, COLORS, sortHabits, isActive, rate, addDays } from './logic'
import { saveCategory, removeCategory, addPause, removePause } from './api'
import { SUGGESTIONS } from './suggestions'
import { scheduleReminderSync, syncNow } from './native-sync'
import { isNative } from '../../lib/native'

const COLOR_NAMES = { blue: 'Bleu', green: 'Vert', orange: 'Orange', purple: 'Violet', pink: 'Rose', red: 'Rouge', yellow: 'Jaune', brown: 'Brun', gray: 'Gris' }

// Gérer : habitudes, catégories, pauses, archives.
export default function ManageView() {
  const { data, error, reload } = useHabits()
  const [catSheet, setCatSheet] = useState(null)
  const [pauseSheet, setPauseSheet] = useState(false)
  const [remind, setRemind] = useState('')
  const navigate = useNavigate()

  if (error) return <Frame><p className="group-foot is-error">{error}</p></Frame>
  if (!data) return <Frame><p className="muted-line">Chargement…</p></Frame>
  const { habits, categories, pauses, today, ctx } = data
  const live = sortHabits(habits.filter((h) => !h.archived && isActive(h, today) ), categories)
  const upcoming = habits.filter((h) => !h.archived && h.start_date > today)
  const ended = habits.filter((h) => h.archived || (h.end_date && h.end_date < today))
  const groups = [...categories.map((c) => ({ cat: c, list: live.filter((h) => h.category_id === c.id) })), { cat: null, list: live.filter((h) => !categories.some((c) => c.id === h.category_id)) }].filter((g) => g.list.length)
  const currentPauses = pauses.filter((p) => p.end_date >= today)
  const moment = Object.fromEntries(MOMENTS)

  return (
    <Frame>
      <Link to="/habitudes/gerer/nouvelle" className="btn-primary btn-link">Nouvelle habitude</Link>
      <div className="chips left idea-chips">
        {SUGGESTIONS.filter((s) => !habits.some((h) => h.name === s.name)).slice(0, 8).map((s) => (
          <button key={s.name} type="button" className="chip" onClick={() => navigate(`/habitudes/gerer/nouvelle?idee=${encodeURIComponent(s.name)}`)}>
            {s.emoji} {s.name}
          </button>
        ))}
      </div>

      {groups.map(({ cat, list }) => (
        <section key={cat?.id || 'none'}>
          <h2 className="group-title"><span className="cat-dot" style={{ '--c': catColor(cat) }} />{cat ? cat.name : 'Sans catégorie'}</h2>
          <ul className="group">
            {list.map((h) => (
              <li key={h.id}>
                <Link to={`/habitudes/gerer/${h.id}`} className="row">
                  <span className="row-main">
                    <span className="row-label">{h.emoji ? `${h.emoji} ` : ''}{h.name}</span>
                    <span className="row-sub">
                      {freqLabel(h)} · {moment[h.moment]}
                      {h.reminder_time ? ` · rappel ${h.reminder_time}` : ''}
                      {h.auto ? ' · automatique' : ''}
                      {h.frequency === 'challenge' ? ` · jusqu’au ${shortDay(h.end_date)}` : ''}
                    </span>
                  </span>
                  <span className="row-chevron"><Icon name="chevron" size={16} /></span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ))}
      {!live.length && <p className="muted-line">Aucune habitude en cours.</p>}

      {upcoming.length > 0 && (
        <>
          <h2 className="group-title">À venir</h2>
          <ul className="group">
            {upcoming.map((h) => (
              <li key={h.id}><Link to={`/habitudes/gerer/${h.id}`} className="row"><span className="row-label">{h.name}</span><span className="row-value">dès le {shortDay(h.start_date)}</span></Link></li>
            ))}
          </ul>
        </>
      )}

      <h2 className="group-title">Catégories</h2>
      <ul className="group">
        {categories.map((c) => (
          <li key={c.id}>
            <button type="button" className="row" onClick={() => setCatSheet(c)}>
              <span className="cat-dot" style={{ '--c': catColor(c) }} />
              <span className="row-label">{c.name}</span>
              <span className="row-value">{habits.filter((h) => h.category_id === c.id && !h.archived).length}</span>
            </button>
          </li>
        ))}
        <li><button type="button" className="row row-action" onClick={() => setCatSheet({ name: '', color: COLORS[categories.length % COLORS.length] })}><Icon name="plus" size={18} stroke={2} /> Nouvelle catégorie</button></li>
      </ul>

      <h2 className="group-title">Pauses</h2>
      <ul className="group">
        {currentPauses.map((p) => (
          <li key={p.id} className="row">
            <span className="row-main">
              <span className="row-label">{p.habit_id ? habits.find((h) => h.id === p.habit_id)?.name || 'Habitude' : 'Toutes les habitudes'}</span>
              <span className="row-sub">du {shortDay(p.start_date)} au {shortDay(p.end_date)}{p.reason ? ` · ${p.reason}` : ''}</span>
            </span>
            <button type="button" className="icon-btn small" aria-label="Supprimer la pause" onClick={async () => { await removePause(p.id); scheduleReminderSync(0); reload() }}>
              <Icon name="close" size={16} />
            </button>
          </li>
        ))}
        <li><button type="button" className="row row-action" onClick={() => setPauseSheet(true)}><Icon name="pause" size={18} stroke={2} /> Mettre en pause</button></li>
      </ul>
      <p className="group-foot">Malade, examens, voyage : pendant une pause, rien ne compte comme raté et tes séries continuent.</p>

      {isNative && (
        <>
          <h2 className="group-title">Rappels sur l’iPhone</h2>
          <ul className="group">
            <li>
              <button type="button" className="row row-action" onClick={async () => {
                setRemind('Programmation…')
                const r = await syncNow().catch(() => null)
                setRemind(!r ? 'Impossible de programmer les rappels.'
                  : r.status === 'denied' ? 'Notifications refusées : Réglages de l’iPhone › Life › Notifications › Autoriser.'
                    : `${r.scheduled} rappel${r.scheduled > 1 ? 's' : ''} programmé${r.scheduled > 1 ? 's' : ''} pour les 7 prochains jours.`)
              }}>
                <Icon name="bolt" size={18} stroke={2} /> Vérifier mes rappels
              </button>
            </li>
          </ul>
          <p className="group-foot">{remind || 'Les rappels sont reprogrammés à chaque ouverture de l’app et à chaque coche. Ouvre l’app au moins une fois par semaine.'}</p>
        </>
      )}

      {ended.length > 0 && (
        <>
          <h2 className="group-title">Terminées et archivées</h2>
          <ul className="group">
            {ended.map((h) => {
              const r = h.frequency === 'challenge' ? rate(h, h.start_date, h.end_date, ctx) : null
              return (
                <li key={h.id}>
                  <Link to={`/habitudes/gerer/${h.id}`} className="row">
                    <span className="row-main">
                      <span className="row-label">{h.emoji ? `${h.emoji} ` : ''}{h.name}</span>
                      <span className="row-sub">{h.frequency === 'challenge' ? `Défi terminé le ${shortDay(h.end_date)} : ${r.done} / 30 jours` : 'Archivée'}</span>
                    </span>
                    <span className="row-chevron"><Icon name="chevron" size={16} /></span>
                  </Link>
                </li>
              )
            })}
          </ul>
        </>
      )}

      {catSheet && <CategorySheet cat={catSheet} onClose={() => setCatSheet(null)} onDone={() => { setCatSheet(null); reload() }} />}
      {pauseSheet && <PauseSheet habits={live} today={today} onClose={() => setPauseSheet(false)} onDone={() => { setPauseSheet(false); scheduleReminderSync(0); reload() }} />}
    </Frame>
  )
}

function Frame({ children }) {
  return (
    <div className="page food habits">
      <h1 className="large-title">Habitudes</h1>
      <HabitsNav />
      {children}
    </div>
  )
}

function CategorySheet({ cat, onClose, onDone }) {
  const [c, setC] = useState(cat)
  const [sure, setSure] = useState(false)
  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div className="sheet form-sheet" role="dialog" aria-label="Catégorie" onClick={(e) => e.stopPropagation()}>
        <form onSubmit={async (e) => { e.preventDefault(); if (!c.name.trim()) return; await saveCategory(c); onDone() }}>
          <p className="sheet-title">{cat.id ? 'Catégorie' : 'Nouvelle catégorie'}</p>
          <ul className="group">
            <li className="row row-field"><label className="row-label" htmlFor="cn">Nom</label><input id="cn" autoFocus={!cat.id} placeholder="Santé, Études…" value={c.name} onChange={(e) => setC({ ...c, name: e.target.value })} /></li>
          </ul>
          <div className="color-pick" role="radiogroup" aria-label="Couleur">
            {COLORS.map((k) => (
              <button key={k} type="button" role="radio" aria-checked={c.color === k} aria-label={COLOR_NAMES[k]}
                className={c.color === k ? 'color-dot is-on' : 'color-dot'} style={{ '--c': `var(--${k})` }} onClick={() => setC({ ...c, color: k })} />
            ))}
          </div>
          <button className="btn-primary" type="submit">Enregistrer</button>
          {cat.id && (
            <button type="button" className="btn-plain danger" onClick={async () => { if (!sure) return setSure(true); await removeCategory(cat.id); onDone() }}>
              {sure ? 'Confirmer (les habitudes restent, sans catégorie)' : 'Supprimer la catégorie'}
            </button>
          )}
          <button type="button" className="btn-plain" onClick={onClose}>Annuler</button>
        </form>
      </div>
    </div>
  )
}

function PauseSheet({ habits, today, onClose, onDone }) {
  const [p, setP] = useState({ habit_id: '', start_date: today, end_date: addDays(today, 6), reason: '' })
  const [error, setError] = useState('')
  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div className="sheet form-sheet" role="dialog" aria-label="Pause" onClick={(e) => e.stopPropagation()}>
        <form onSubmit={async (e) => {
          e.preventDefault()
          if (p.end_date < p.start_date) return setError('La fin doit être après le début.')
          await addPause({ ...p, habit_id: p.habit_id || null, reason: p.reason.trim() || null })
          onDone()
        }}>
          <p className="sheet-title">Mettre en pause</p>
          <ul className="group">
            <li className="row row-field">
              <label className="row-label" htmlFor="ph">Quoi</label>
              <select id="ph" value={p.habit_id} onChange={(e) => setP({ ...p, habit_id: e.target.value })}>
                <option value="">Toutes les habitudes</option>
                {habits.map((h) => <option key={h.id} value={h.id}>{h.name}</option>)}
              </select>
            </li>
            <li className="row row-field"><label className="row-label" htmlFor="ps">Du</label><input id="ps" type="date" value={p.start_date} onChange={(e) => setP({ ...p, start_date: e.target.value })} /></li>
            <li className="row row-field"><label className="row-label" htmlFor="pe">Au</label><input id="pe" type="date" value={p.end_date} onChange={(e) => setP({ ...p, end_date: e.target.value })} /></li>
            <li className="row row-field"><label className="row-label" htmlFor="pr">Raison</label><input id="pr" placeholder="Voyage, malade…" value={p.reason} onChange={(e) => setP({ ...p, reason: e.target.value })} /></li>
          </ul>
          <p className="group-foot">Du {longDay(p.start_date)} au {longDay(p.end_date)} inclus.</p>
          {error && <p className="group-foot is-error">{error}</p>}
          <button className="btn-primary" type="submit">Mettre en pause</button>
          <button type="button" className="btn-plain" onClick={onClose}>Annuler</button>
        </form>
      </div>
    </div>
  )
}
