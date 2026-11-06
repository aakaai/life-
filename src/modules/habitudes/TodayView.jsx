// Habitudes (v0.30) : une seule page — la journée en haut, les habitudes en cases par moment
// (un toucher = fait, appui long = fiche), le calendrier en bas, création rapide.
import { useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import Icon from '../../components/Icon'
import { useHabits, longDay, fmt, catColor, freqLabel, HabitIcon, useLongPress, Heatmap } from './ui'
import { MOMENTS, AUTO_SOURCES, addDays, isVisibleOn, todayItem, sortHabits, mondayOf, dayOfWeek, isPaused, streak, rate, globalRate, firstOfMonth, progressLabel } from './logic'
import { saveHabit, addPause, removePause, archiveHabit } from './api'
import { scheduleReminderSync } from './native-sync'

const TODAY_OPTIONS = { autoDays: 400 }

const moment = Object.fromEntries(MOMENTS)
const momentNow = () => {
  const h = new Date().getHours()
  return h < 12 ? 'morning' : h < 18 ? 'day' : 'evening'
}

// Ce que vaut un toucher sur la case
function tapValue(item) {
  const h = item.habit
  if (h.kind === 'quantity') return Math.round(((item.value || 0) + (Number(h.step) || 1)) * 100) / 100
  return item.value > 0 ? 0 : 1
}
const isAutoDone = (item) => !!(item.habit.auto && item.auto === true && !(item.value > 0))
const isDone = (item) => item.status === 'done' || !!(item.progress && item.doneToday)

export default function TodayView() {
  const { data, error, log, reload } = useHabits(TODAY_OPTIONS)
  const [params, setParams] = useSearchParams()
  const [sheet, setSheet] = useState(null)
  const navigate = useNavigate()

  if (error) return <Frame><p className="group-foot is-error">{error}</p></Frame>
  if (!data) return <Frame><p className="muted-line">Chargement…</p></Frame>

  const { habits, categories, ctx, today, reviews } = data
  const date = params.get('jour') && params.get('jour') <= today ? params.get('jour') : today
  const go = (n) => {
    const d = addDays(date, n)
    setParams(d === today ? {} : { jour: d })
  }
  const catById = Object.fromEntries(categories.map((c) => [c.id, c]))
  const items = sortHabits(habits.filter((h) => isVisibleOn(h, date, ctx)), categories).map((h) => todayItem(h, date, ctx))
  const live = habits.filter((h) => !h.archived)

  const counted = items.filter((i) => !i.paused && !i.progress)
  const doneCount = counted.filter((i) => i.status === 'done').length
  const left = counted.filter((i) => i.status !== 'done' && !(i.habit.kind === 'avoid'))
  const allPaused = isPaused({ id: null }, date, { pauses: data.pauses.filter((p) => !p.habit_id) })
  const week = mondayOf(today)
  const reviewDue = date === today && dayOfWeek(today) === 6 && new Date().getHours() >= 18 && !reviews.some((r) => r.week_start === week)
  const goal = reviews.find((r) => r.goal && (r.week_start === week || r.week_start === addDays(week, -7)))
  const month = globalRate(live, firstOfMonth(today), today, ctx)
  // le calendrier commence à ta première habitude (au moins 12 semaines, au plus un an)
  const first = live.reduce((m, h) => (h.start_date && h.start_date < m ? h.start_date : m), today)
  const calWeeks = Math.min(53, Math.max(12, Math.ceil((new Date(today) - new Date(first)) / 604800000) + 2))
  const pct = counted.length ? doneCount / counted.length : 0
  const R = 31
  const C = 2 * Math.PI * R

  function tap(item) {
    if (item.paused || isAutoDone(item)) return setSheet({ type: 'habit', id: item.habit.id })
    log(item.habit, date, tapValue(item))
  }

  return (
    <Frame>
      {!habits.length ? (
        <div className="callout tip">
          <span className="callout-icon"><Icon name="habitudes" size={20} /></span>
          <div>
            <p className="callout-lead">Crée ta première habitude</p>
            <p className="callout-text">Un nom, un rythme, un moment : c’est tout. Certaines se cochent toutes seules grâce au Sport et à l’Alimentation.</p>
          </div>
        </div>
      ) : (
        <div className="habit-hero">
          <div className="habit-ring" aria-label={`${doneCount} habitudes faites sur ${counted.length}`}>
            <svg width="76" height="76" viewBox="0 0 76 76" aria-hidden="true">
              <circle cx="38" cy="38" r={R} className="habit-ring-track" />
              {pct > 0 && <circle cx="38" cy="38" r={R} className="habit-ring-fill" strokeDasharray={`${C * pct} ${C}`} transform="rotate(-90 38 38)" />}
            </svg>
            <strong>{doneCount}/{counted.length}</strong>
          </div>
          <div className="habit-hero-main">
            <div className="habit-hero-day">
              <button className="icon-btn small" onClick={() => go(-1)} aria-label="Jour précédent"><Icon name="back" size={16} stroke={2.2} /></button>
              <span>{date === today ? longDay(date) : date === addDays(today, -1) ? `Hier · ${longDay(date)}` : longDay(date)}</span>
              <button className="icon-btn small" onClick={() => go(1)} aria-label="Jour suivant" disabled={date >= today}><Icon name="chevron" size={16} stroke={2.2} /></button>
            </div>
            <p className="habit-hero-title">
              {!counted.length ? 'Rien de prévu ce jour-là' : left.length ? `Encore ${left.length} ${date === today ? 'aujourd’hui' : 'ce jour-là'}` : 'Tout est fait ✓'}
            </p>
            {left.length > 0 && (
              <div className="habit-left">
                {left.slice(0, 6).map((i) => (
                  <span key={i.habit.id}>
                    {i.habit.name}
                    {i.habit.kind === 'quantity' ? ` ${fmt(i.value)}/${fmt(i.habit.target)} ${i.habit.unit || ''}` : i.habit.reminder_time ? ` ${i.habit.reminder_time}` : ''}
                  </span>
                ))}
                {left.length > 6 && <span>+{left.length - 6}</span>}
              </div>
            )}
            {date !== today && <button className="link-btn" onClick={() => setParams({})}>Revenir à aujourd’hui</button>}
          </div>
        </div>
      )}

      {allPaused && <p className="callout"><Icon name="pause" size={18} /> Pause en cours : rien n’est compté comme raté.</p>}
      {reviewDue && (
        <Link to="/habitudes/bilans?bilan=1" className="callout tip proposal-link">
          <span className="callout-icon"><Icon name="star" size={20} /></span>
          <div>
            <p className="callout-lead">C’est dimanche : fais le bilan de ta semaine</p>
            <p className="callout-text">3 questions, 2 minutes, et ton objectif pour la semaine qui vient.</p>
          </div>
        </Link>
      )}
      {goal && !reviewDue && date === today && <p className="habit-goal"><strong>Objectif de la semaine :</strong> {goal.goal}</p>}

      {MOMENTS.map(([key, label], mi) => {
        const list = items.filter((i) => i.habit.moment === key)
        if (!list.length) return null
        const isLast = !MOMENTS.slice(mi + 1).some(([k]) => items.some((i) => i.habit.moment === k))
        const dayBased = list.filter((i) => !i.paused && !i.progress)
        return (
          <section key={key} className="habit-moment" aria-label={label}>
            <h2 className="habit-moment-head"><span>{label}</span><em>{dayBased.filter((i) => i.status === 'done').length}/{dayBased.length}</em></h2>
            <div className="hcase-grid">
              {list.map((it) => (
                <HabitCase key={it.habit.id} item={it} cat={catById[it.habit.category_id]} onTap={() => tap(it)} onLong={() => setSheet({ type: 'habit', id: it.habit.id })} />
              ))}
              {isLast && <NewCase onClick={() => setSheet({ type: 'new' })} />}
            </div>
          </section>
        )
      })}
      {!items.length && (
        <div className="hcase-grid" style={{ marginTop: 14 }}>
          <NewCase onClick={() => setSheet({ type: 'new' })} />
        </div>
      )}
      {items.length > 0 && <p className="hcase-hint">toucher : fait · appui long : fiche de l’habitude</p>}

      {live.length > 0 && (
        <section className="chart-card habit-cal" aria-label="Calendrier des habitudes">
          <div className="habit-cal-head">
            <strong>{calWeeks >= 53 ? 'Ton année' : 'Depuis le début'}</strong>
            <span>{month.pct != null ? `${Math.round(month.pct * 100)} % ce mois-ci` : ''}</span>
          </div>
          <Heatmap habits={live} ctx={ctx} today={today} weeks={calWeeks} onPick={(d) => setParams(d === today ? {} : { jour: d })} />
          <p className="hm-info">Plus la case est foncée, plus tu as tenu d’habitudes ce jour-là. Touche un jour pour l’ouvrir. <Link to="/habitudes/calendrier">Calendrier détaillé</Link></p>
        </section>
      )}

      {sheet?.type === 'habit' && (() => {
        const h = habits.find((x) => x.id === sheet.id)
        if (!h) return null
        return (
          <HabitSheet habit={h} item={todayItem(h, date, ctx)} date={date} data={data} cat={catById[h.category_id]}
            onLog={(v) => log(h, date, v)} onEdit={() => navigate(`/habitudes/gerer/${h.id}`)}
            onChanged={async () => { await reload(); scheduleReminderSync() }} onClose={() => setSheet(null)} />
        )
      })()}
      {sheet?.type === 'new' && (
        <QuickCreate categories={categories} today={today}
          onMore={(q) => navigate(`/habitudes/gerer/nouvelle?${new URLSearchParams(q)}`)}
          onCreated={async () => { setSheet(null); await reload(); scheduleReminderSync() }} onClose={() => setSheet(null)} />
      )}
    </Frame>
  )
}

function Frame({ children }) {
  return (
    <div className="page food habits">
      <header className="sport-head">
        <h1 className="large-title">Habitudes</h1>
        <Link to="/habitudes/gerer" className="icon-btn" aria-label="Gérer les habitudes, catégories, pauses et bilans"><Icon name="settings" size={20} /></Link>
      </header>
      {children}
    </div>
  )
}

/* ---------- Une case ---------- */

function HabitCase({ item, cat, onTap, onLong }) {
  const h = item.habit
  const press = useLongPress(onLong, onTap)
  const done = isDone(item)
  const autoDone = isAutoDone(item)
  const slip = h.kind === 'avoid' && item.value > 0
  const target = Number(h.target) || 1
  let ratio = done ? 1 : 0
  if (h.kind === 'quantity') ratio = Math.min(1, (item.value || 0) / target)
  else if (item.progress && !item.doneToday) ratio = Math.min(1, item.progress.count / item.progress.target)

  let sub
  if (item.paused) sub = 'en pause'
  else if (slip) sub = 'écart noté'
  else if (h.kind === 'avoid') sub = 'tenu pour l’instant'
  else if (h.kind === 'quantity') sub = `${fmt(item.value)} / ${fmt(target)} ${h.unit || ''}${item.value < target ? ` · +${fmt(h.step || 1)}` : ''}`
  else if (item.progress) sub = `${progressLabel(item)}${item.doneToday ? ' · fait' : ''}`
  else if (autoDone) sub = 'fait ✓'
  else if (h.auto) sub = AUTO_SOURCES[h.auto] ? 'se coche tout seul' : ''
  else if (done) sub = 'fait'
  else sub = h.reminder_time || 'à faire'

  const label = `${h.name} : ${sub}. ${h.kind === 'quantity' ? `Toucher pour ajouter ${fmt(h.step || 1)} ${h.unit || ''}` : h.kind === 'avoid' ? (slip ? 'Toucher pour annuler l’écart' : 'Toucher pour noter un écart') : done ? 'Toucher pour décocher' : 'Toucher pour cocher'}. Appui long : fiche.`
  const cls = ['hcase', done && !slip ? 'is-done' : '', slip ? 'is-slip' : '', item.paused ? 'is-paused' : ''].filter(Boolean).join(' ')

  return (
    <button type="button" className={cls} style={{ '--c': catColor(cat) }} aria-label={label} {...press}>
      {ratio > 0 && !done && !slip && <span className="hcase-fill" style={{ height: `${ratio * 100}%` }} aria-hidden="true" />}
      <span className="hcase-top">
        <span className="hcase-ico"><HabitIcon habit={h} /></span>
        {h.auto && !(item.value > 0) ? <span className="hcase-auto">auto</span>
          : slip ? <span className="hcase-mark is-slip"><Icon name="close" size={12} stroke={2.6} /></span>
          : done ? <span className="hcase-mark is-on"><Icon name="check" size={12} stroke={2.8} /></span>
          : h.kind !== 'avoid' && <span className="hcase-mark" />}
      </span>
      <span className="hcase-name">{h.name}</span>
      <span className="hcase-sub">{sub}</span>
    </button>
  )
}

function NewCase({ onClick }) {
  return (
    <button type="button" className="hcase hcase-new" onClick={onClick}>
      <Icon name="plus" size={20} stroke={2} />
      <span>Habitude</span>
    </button>
  )
}

/* ---------- Fiche d'une habitude ---------- */

const PAUSES = [[3, '3 jours'], [7, '1 semaine'], [14, '2 semaines']]

function HabitSheet({ habit: h, item, date, data, cat, onLog, onEdit, onChanged, onClose }) {
  const { ctx, today } = data
  const [sure, setSure] = useState(false)
  const [pausing, setPausing] = useState(false)
  const st = streak(h, ctx)
  const r30 = rate(h, addDays(today, -29), today, ctx)
  const pause = data.pauses.find((p) => p.habit_id === h.id && p.start_date <= today && p.end_date >= today)
  const autoDone = isAutoDone(item)
  const done = isDone(item)
  const step = Number(h.step) || 1
  const target = Number(h.target) || 1
  const sub = [freqLabel(h), moment[h.moment], h.reminder_time && `rappel ${h.reminder_time}`, cat?.name].filter(Boolean).join(' · ')
  const color = catColor(cat)
  const when = date === today ? 'aujourd’hui' : longDay(date)

  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div className="sheet form-sheet habit-sheet" role="dialog" aria-label={h.name} onClick={(e) => e.stopPropagation()} style={{ '--c': color }}>
        <p className="sheet-title sheet-title-icon"><span className="hcase-ico"><HabitIcon habit={h} size={20} /></span> {h.name}</p>
        <p className="cat-detail-sub">{sub}</p>

        {item.paused ? (
          <p className="callout"><Icon name="pause" size={18} /> En pause{pause ? ` jusqu’au ${longDay(pause.end_date)}` : ''} : rien n’est compté comme raté.</p>
        ) : h.kind === 'quantity' ? (
          <div className="habit-qty-ctl">
            <button type="button" className="qty-btn" aria-label={`Retirer ${fmt(step)} ${h.unit || ''}`} onClick={() => onLog(Math.max(0, Math.round(((item.value || 0) - step) * 100) / 100))}><Icon name="minus" size={20} stroke={2.2} /></button>
            <div><strong>{fmt(item.value)} {h.unit}</strong><span>sur {fmt(target)} {h.unit} {when}</span></div>
            <button type="button" className="qty-btn" aria-label={`Ajouter ${fmt(step)} ${h.unit || ''}`} onClick={() => onLog(Math.round(((item.value || 0) + step) * 100) / 100)}><Icon name="plus" size={20} stroke={2.2} /></button>
          </div>
        ) : h.kind === 'avoid' ? (
          <button type="button" className={item.value > 0 ? 'btn-secondary' : 'btn-secondary danger'} onClick={() => onLog(item.value > 0 ? 0 : 1)}>
            {item.value > 0 ? 'Annuler l’écart' : `J’ai craqué ${when}`}
          </button>
        ) : autoDone ? (
          <p className="habit-auto-note"><Icon name="check" size={16} stroke={2.4} /> Cochée toute seule {when} : {AUTO_SOURCES[h.auto]?.label.toLowerCase()}.</p>
        ) : (
          <button type="button" className={done && item.value > 0 ? 'btn-secondary' : 'btn-primary'} onClick={() => onLog(item.value > 0 ? 0 : 1)}>
            {item.value > 0 ? `Décocher (${when})` : `C’est fait ${when}`}
          </button>
        )}
        {h.auto && !autoDone && !item.paused && <p className="group-foot">{AUTO_SOURCES[h.auto]?.hint}</p>}

        <div className="habit-stats">
          <div><strong>{st.current > 0 ? <><Icon name="flame" size={17} /> {st.current}</> : '0'}</strong><span>{st.unit} de suite</span></div>
          <div><strong>{st.best}</strong><span>meilleure série</span></div>
          <div><strong>{r30.total ? `${Math.round((r30.done / r30.total) * 100)} %` : '—'}</strong><span>sur 30 jours</span></div>
        </div>
        <div className="chart-card habit-cal small">
          <div className="habit-cal-head"><strong>Ses 6 derniers mois</strong></div>
          <Heatmap habits={[h]} habit={h} ctx={ctx} today={today} weeks={26} color={color} />
        </div>

        <div className="acc-actions">
          <button className="btn-secondary" onClick={onEdit}>Modifier</button>
          {pause ? (
            <button className="btn-secondary" onClick={async () => { await removePause(pause.id); await onChanged() }}>Reprendre</button>
          ) : (
            <button className="btn-secondary" aria-expanded={pausing} onClick={() => setPausing(!pausing)}>Pause</button>
          )}
          <button className="btn-secondary danger" onClick={async () => { if (!sure) return setSure(true); await archiveHabit(h.id); onClose(); await onChanged() }}>{sure ? 'Confirmer' : 'Archiver'}</button>
        </div>
        {pausing && !pause && (
          <div className="chips left" style={{ marginTop: 8 }}>
            {PAUSES.map(([n, l]) => (
              <button key={n} type="button" className="chip" onClick={async () => { await addPause({ habit_id: h.id, start_date: today, end_date: addDays(today, n - 1) }); setPausing(false); await onChanged() }}>{l}</button>
            ))}
          </div>
        )}
        {sure && <p className="group-foot">Archivée, elle disparaît de la page mais son historique est gardé (Gérer › Terminées).</p>}
        <button type="button" className="btn-plain" onClick={onClose}>Fermer</button>
      </div>
    </div>
  )
}

/* ---------- Création rapide ---------- */

const RHYTHMS = [
  ['d', 'Chaque jour', { frequency: 'daily' }],
  ['w3', '3× / semaine', { frequency: 'weekly', times: 3 }],
  ['w5', '5× / semaine', { frequency: 'weekly', times: 5 }],
  ['w1', '1× / semaine', { frequency: 'weekly', times: 1 }],
  ['m4', '4× / mois', { frequency: 'monthly', times: 4 }]
]

function QuickCreate({ categories, today, onCreated, onMore, onClose }) {
  const [name, setName] = useState('')
  const [rhythm, setRhythm] = useState('d')
  const [when, setWhen] = useState(momentNow())
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const r = RHYTHMS.find((x) => x[0] === rhythm)[2]
  async function submit(e) {
    e.preventDefault()
    if (!name.trim()) return setError('Donne un nom à ton habitude (Méditer 10 min, Lire…).')
    setBusy(true)
    try {
      await saveHabit({ name, kind: 'check', frequency: r.frequency, times: r.times || 1, moment: when, start_date: today, category_id: categories[0]?.id || null })
      await onCreated()
    } catch (err) {
      setError(err.message)
      setBusy(false)
    }
  }
  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <form className="sheet form-sheet" role="dialog" aria-label="Nouvelle habitude" onClick={(e) => e.stopPropagation()} onSubmit={submit}>
        <p className="sheet-title">Nouvelle habitude</p>
        <input className="ag-title" autoFocus placeholder="Méditer 10 min, Lire, Pas d’écran au lit…" aria-label="Nom" value={name} onChange={(e) => { setError(''); setName(e.target.value) }} enterKeyHint="done" />
        <h2 className="group-title">Rythme</h2>
        <div className="chips left">
          {RHYTHMS.map(([k, l]) => <button key={k} type="button" className={rhythm === k ? 'chip is-on' : 'chip'} onClick={() => setRhythm(k)}>{l}</button>)}
        </div>
        <h2 className="group-title">Moment</h2>
        <div className="segmented wide" role="radiogroup" aria-label="Moment">
          {MOMENTS.map(([k, l]) => <button key={k} type="button" role="radio" aria-checked={when === k} className={when === k ? 'is-on' : ''} onClick={() => setWhen(k)}>{l}</button>)}
        </div>
        {error && <p className="group-foot is-error">{error}</p>}
        <button className="btn-primary" type="submit" disabled={busy} style={{ marginTop: 14 }}>Créer</button>
        <button type="button" className="btn-plain" onClick={() => onMore({ nom: name, freq: r.frequency, fois: r.times || 1, moment: when })}>
          Plus d’options : quantité, à éviter, rappel, catégorie…
        </button>
      </form>
    </div>
  )
}

/* ---------- Quantité (accueil) ---------- */

export function QuantitySheet({ item, onClose, onSave }) {
  const h = item.habit
  const [v, setV] = useState(String(item.value || '').replace('.', ','))
  const step = Number(h.step) || 1
  const num = Number(v.replace(',', '.')) || 0
  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div className="sheet form-sheet" role="dialog" aria-label={h.name} onClick={(e) => e.stopPropagation()}>
        <form onSubmit={(e) => { e.preventDefault(); onSave(num) }}>
          <p className="sheet-title">{h.emoji ? `${h.emoji} ` : ''}{h.name}</p>
          <p className="muted-line">Objectif : {fmt(h.target)} {h.unit}</p>
          <div className="qty-quick">
            {[-step, step, step * 2].map((d) => (
              <button key={d} type="button" className="chip" onClick={() => setV(String(Math.max(0, Math.round((num + d) * 100) / 100)).replace('.', ','))}>
                {d > 0 ? '+' : '−'}{fmt(Math.abs(d))} {h.unit}
              </button>
            ))}
          </div>
          <ul className="group">
            <li className="row row-field">
              <label className="row-label" htmlFor="hq">Aujourd’hui</label>
              <input id="hq" inputMode="decimal" autoFocus value={v} onChange={(e) => setV(e.target.value)} placeholder="0" />
              <span className="row-value">{h.unit}</span>
            </li>
          </ul>
          <button className="btn-primary" type="submit">Enregistrer</button>
          <button type="button" className="btn-plain" onClick={onClose}>Annuler</button>
        </form>
      </div>
    </div>
  )
}
