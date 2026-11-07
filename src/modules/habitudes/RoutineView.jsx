// Routine du matin / du soir (v0.32) : une habitude à la fois, en plein écran.
// « Fait · suivante » coche (une quantité ajoute un pas), « Passer » la laisse pour plus tard,
// la séance d'étirements s'ouvre avec son chrono puis revient ici. À la fin : l'anneau brille.
import { useEffect, useMemo, useState } from 'react'
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom'
import Icon from '../../components/Icon'
import { useHabits, catColor, HabitIcon, fmt } from './ui'
import { progressLabel } from './logic'
import { ROUTINES, routineSteps } from './routine'
import { markShown, skippedKeys, addSkipped } from './routine-store'
import { useDaySessions } from './TodayView'
import { kindInfo, sessionPath } from '../sport/data'
import { setSessionStatus } from '../sport/api'
import { unlockAudio } from '../sport/device'
import { habitReminders } from '../../lib/native'

const OPTIONS = { autoDays: 2 }
const shortLabel = (s) => String(s.label || kindInfo(s.kind).short).split(' — ')[0]
const fmtMin = (m) => (m >= 60 ? `${Math.floor(m / 60)} h${m % 60 ? String(m % 60).padStart(2, '0') : ''}` : `${m} min`)

/** Données d'une routine (aussi utilisé par la carte « Reprendre » de l'accueil). */
export function useRoutine(which) {
  const { data, error, log, reload } = useHabits(OPTIONS)
  const today = data?.today
  const { sessions, toggle } = useDaySessions(today, today)
  const steps = useMemo(() => {
    if (!data || !ROUTINES[which] || (which === 'soir' && sessions === null)) return null
    const skipped = skippedKeys(data.today, which)
    return routineSteps(which, data.habits, data.ctx, data.today, sessions || [], data.categories)
      .map((s) => ({ ...s, skipped: s.skipped || (!s.done && skipped.has(s.key)) }))
  }, [data, sessions, which])
  return { data, error, log, reload, steps, today, toggleSession: toggle }
}

export default function RoutineView() {
  const { which } = useParams()
  const conf = ROUTINES[which]
  const navigate = useNavigate()
  const { data, error, log, steps, today } = useRoutine(which)
  const [idx, setIdx] = useState(null)
  const [, setTick] = useState(0)

  useEffect(() => {
    document.body.classList.add('focus-mode')
    return () => document.body.classList.remove('focus-mode')
  }, [])
  useEffect(() => { if (today && conf) markShown(today, which) }, [today, which, conf])
  // on commence (ou on reprend) sur la première étape pas encore faite ni passée
  useEffect(() => {
    if (!steps || idx != null) return
    const first = steps.findIndex((s) => !s.done && !s.skipped)
    setIdx(first === -1 ? steps.length : first)
  }, [steps, idx])
  const atEnd = steps && idx != null && idx >= steps.length
  // une séance « Pas ce soir » n'est plus à faire : la routine peut être terminée sans elle
  const allDone = atEnd && steps.length > 0 && steps.every((s) => s.done || (s.type === 'session' && s.skipped))
  useEffect(() => { if (allDone) habitReminders.haptic() }, [allDone])

  if (!conf) return <Navigate to="/habitudes" replace />
  if (error) return <Shell conf={conf}><p className="group-foot is-error">{error}</p></Shell>
  if (!data || !steps || idx == null) return <Shell conf={conf}><p className="muted-line">Chargement…</p></Shell>

  if (!steps.length) {
    return (
      <Shell conf={conf} onClose={() => navigate('/')}>
        <div className="rt-big">
          <p className="rt-sub">Rien dans ta {conf.label.toLowerCase()} aujourd’hui. Range des habitudes en « {which === 'matin' ? 'Matin' : 'Soir'} » pour la remplir.</p>
          <Link className="btn-secondary as-link" to="/habitudes/routines">Régler mes routines</Link>
        </div>
      </Shell>
    )
  }

  if (atEnd) return <RoutineEnd conf={conf} steps={steps} allDone={allDone} onClose={() => navigate('/')} onBack={() => setIdx(steps.findIndex((s) => !s.done && !(s.type === 'session' && s.skipped)))} />

  const step = steps[idx]
  const next = steps.slice(idx + 1).find((s) => !s.done && !s.skipped)
  const goNext = () => {
    const j = steps.findIndex((s, i) => i > idx && !s.done && !s.skipped)
    setIdx(j === -1 ? steps.length : j)
  }
  const pass = () => { addSkipped(today, which, step.key); setTick((t) => t + 1); goNext() }

  return (
    <Shell conf={conf} count={`${idx + 1} / ${steps.length}`} onClose={() => navigate('/')}>
      <div className="rt-dots" aria-hidden="true">
        {steps.map((s, i) => <i key={s.key} className={s.done ? 'is-on' : i === idx ? 'is-cur' : s.skipped ? 'is-skip' : ''} />)}
      </div>
      {step.type === 'session'
        ? <SessionStep step={step} next={next} onStart={() => { unlockAudio(); navigate(`${sessionPath(step.session)}?go=1&retour=${encodeURIComponent(`/habitudes/routine/${which}`)}`) }}
            onSkip={async () => { await setSessionStatus(step.session.id, 'skipped').catch(() => {}); window.dispatchEvent(new Event('life:changed')); goNext() }}
            onNext={goNext} />
        : <HabitStep step={step} next={next} cat={data.categories.find((c) => c.id === step.habit.category_id)}
            onLog={(v) => log(step.habit, today, v)} onNext={goNext} onPass={pass} />}
    </Shell>
  )
}

function Shell({ conf, count, onClose, children }) {
  return (
    <div className="page routine">
      <div className="rt-top">
        <strong>{conf.label}</strong>{count && <span>· {count}</span>}
        {onClose && <button type="button" className="link-btn rt-later" onClick={onClose}>Plus tard</button>}
      </div>
      {children}
    </div>
  )
}

function HabitStep({ step, next, cat, onLog, onNext, onPass }) {
  const h = step.habit
  const it = step.item
  const target = Number(h.target) || 1
  const inc = Number(h.step) || 1
  const value = Number(it.value) || 0
  const qty = h.kind === 'quantity'
  const sub = qty ? `Objectif : ${fmt(target)} ${h.unit || ''}` : it.progress ? progressLabel(it) : h.reminder_time ? `Rappel à ${h.reminder_time}` : ''
  const fait = () => {
    if (qty) { if (value < target) onLog(Math.round((value + inc) * 100) / 100) }
    else if (!step.done) onLog(1)
    onNext()
  }
  return (
    <>
      <div className="rt-big" style={{ '--c': catColor(cat) }}>
        <span className="rt-ico"><HabitIcon habit={h} size={44} /></span>
        <h1 className="rt-name">{h.name}</h1>
        {sub && <p className="rt-sub">{sub}</p>}
        {qty && (
          <div className="rt-qty">
            <button type="button" aria-label={`Retirer ${fmt(inc)} ${h.unit || ''}`} disabled={value <= 0} onClick={() => onLog(Math.max(0, Math.round((value - inc) * 100) / 100))}><Icon name="minus" size={20} stroke={2.2} /></button>
            <strong>{fmt(value)} / {fmt(target)} {h.unit || ''}</strong>
            <button type="button" aria-label={`Ajouter ${fmt(inc)} ${h.unit || ''}`} onClick={() => onLog(Math.round((value + inc) * 100) / 100)}><Icon name="plus" size={20} stroke={2.2} /></button>
          </div>
        )}
      </div>
      {next && <p className="rt-next">Ensuite : {next.type === 'session' ? shortLabel(next.session) : next.habit.name}</p>}
      <button type="button" className="rt-cta" style={{ '--c': catColor(cat) }} onClick={fait}>
        {step.done ? 'Déjà fait ✓ · suivante' : qty && value < target ? `+ ${fmt(inc)} ${h.unit || ''} · suivante` : 'Fait · suivante'}
      </button>
      {!step.done && <button type="button" className="rt-sec" onClick={onPass}>Passer</button>}
    </>
  )
}

function SessionStep({ step, next, onStart, onSkip, onNext }) {
  const s = step.session
  const info = kindInfo(s.kind)
  return (
    <>
      <div className="rt-big" style={{ '--c': info.color }}>
        <span className="rt-ico"><Icon name={info.icon} size={44} stroke={1.7} /></span>
        <h1 className="rt-name">{shortLabel(s)}</h1>
        <p className="rt-sub">{s.duration_min ? `${fmtMin(s.duration_min)}, ` : ''}guidé avec le chrono.</p>
      </div>
      {next && <p className="rt-next">Ensuite : {next.type === 'session' ? shortLabel(next.session) : next.habit.name}</p>}
      {step.done
        ? <button type="button" className="rt-cta" style={{ '--c': info.color }} onClick={onNext}>Séance faite ✓ · suivante</button>
        : <>
            <button type="button" className="rt-cta" style={{ '--c': info.color }} onClick={onStart}>Démarrer la séance</button>
            <button type="button" className="rt-sec" onClick={onSkip}>Pas ce soir</button>
          </>}
    </>
  )
}

function RoutineEnd({ conf, steps: all, allDone, onClose, onBack }) {
  const steps = all.filter((s) => !(s.type === 'session' && s.skipped))
  const done = steps.filter((s) => s.done).length
  const R = 58
  const C = 2 * Math.PI * R
  const left = steps.length - done
  return (
    <Shell conf={conf}>
      <div className="rt-big">
        <div className={`rt-ring${allDone ? ' is-complete is-burst' : ''}`}>
          <svg width="140" height="140" viewBox="0 0 140 140" aria-hidden="true">
            <circle cx="70" cy="70" r={R} className="habit-ring-track" style={{ strokeWidth: 12 }} />
            {done > 0 && steps.length > 0 && <circle cx="70" cy="70" r={R} className="habit-ring-fill" style={{ strokeWidth: 12 }} strokeDasharray={`${(C * done) / steps.length} ${C}`} transform="rotate(-90 70 70)" />}
          </svg>
          <strong>{done}/{steps.length}</strong>
        </div>
        <h1 className="rt-name">{allDone ? 'Routine terminée ✓' : `Encore ${left} à faire plus tard`}</h1>
        <ul className="rt-list">
          {all.map((s) => (
            <li key={s.key} className={s.done ? 'is-done' : ''}>
              <span className="rt-tick" aria-hidden="true">{s.done && <Icon name="check" size={12} stroke={3} />}</span>
              {s.type === 'session' ? shortLabel(s.session) : s.habit.name}
              {!s.done && <em>{s.type === 'session' && s.skipped ? 'pas ce soir' : s.skipped ? 'passée' : 'à faire'}</em>}
            </li>
          ))}
        </ul>
      </div>
      <button type="button" className="rt-cta" onClick={onClose}>{conf.end}</button>
      {!allDone && <button type="button" className="rt-sec" onClick={onBack}>Revenir à ce qu’il reste</button>}
    </Shell>
  )
}
