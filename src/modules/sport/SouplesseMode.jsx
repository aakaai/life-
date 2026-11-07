// Étirements du soir et séances de mobilité (v0.26) : liste des mouvements, puis mode guidé
// avec chrono, bips, île dynamique et écran allumé. Terminer coche l'habitude « Étirements ».
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import Icon from '../../components/Icon'
import { getSession, finishSouplesse, setSessionStatus } from './api'
import { parseDay, keyOf } from './planner'
import { BackBar, KindIcon, StatusTag, fmtClock, DAY_NAMES } from './ui'
import { beep, keepAwake, unlockAudio } from './device'
import { restActivity } from '../../lib/native'
import { scheduleReminderSync } from '../habitudes/native-sync'
import { MOVES, routineOf, routineSteps, stepsDuration, moveDose, fmtMinSec, advance, nextMoveIndex } from './souplesse'

const CUTOFF_HOURS = 3 // comme les habitudes : 0 h 30 compte encore pour la veille
const todayKey = (now = new Date()) => keyOf(new Date(now.getTime() - CUTOFF_HOURS * 3600000))
const saveKey = (id) => `life:souplesse:${id}`

function readProgress(id) {
  try {
    const p = JSON.parse(localStorage.getItem(saveKey(id)) || 'null')
    // reprise seulement si la séance a été quittée il y a moins de 2 h
    return p && Date.now() - (p.savedAt || 0) < 2 * 3600000 ? p : null
  } catch {
    return null
  }
}
function writeProgress(id, st) {
  try {
    if (st) localStorage.setItem(saveKey(id), JSON.stringify({ ...st, savedAt: Date.now() }))
    else localStorage.removeItem(saveKey(id))
  } catch {
    /* stockage indisponible : pas de reprise, pas grave */
  }
}

export default function SouplesseMode() {
  const { id } = useParams()
  const [params] = useSearchParams()
  const navigate = useNavigate()
  // v0.32 : lancée depuis une routine (?go=1&retour=/habitudes/routine/soir) → démarre tout de suite, puis y revient
  const retour = params.get('retour')?.startsWith('/habitudes/routine/') ? params.get('retour') : null
  const [session, setSession] = useState(null)
  const [error, setError] = useState('')
  const [mode, setMode] = useState('intro') // intro | guided | done

  const load = useCallback(async () => {
    try {
      const s = await getSession(id)
      setSession(s || { missing: true })
      if (s && s.status !== 'done' && (readProgress(id) || (params.get('go') && s.date === todayKey()))) setMode('guided')
    } catch (e) {
      setError(e.message)
    }
  }, [id])
  useEffect(() => {
    load()
  }, [load])

  if (error) return <div className="page"><BackBar /><p className="group-foot is-error">{error}</p></div>
  if (!session) return <div className="page"><BackBar /><p className="muted-line">Chargement…</p></div>
  if (session.missing) {
    return (
      <div className="page">
        <BackBar />
        <p className="muted-line">Cette séance n’existe plus : la semaine a sans doute été réorganisée.</p>
      </div>
    )
  }

  if (mode === 'guided') {
    return (
      <Guided
        session={session}
        onEnd={async ({ count, startedAt }) => {
          writeProgress(session.id, null)
          if (count) {
            await finishSouplesse(session, { startedAt, today: todayKey() }).catch((e) => setError(e.message))
            window.dispatchEvent(new Event('life:changed'))
            scheduleReminderSync(0)
            setSession({ ...session, status: 'done' })
            if (retour) navigate(retour, { replace: true })
            else setMode('done')
          } else if (retour) navigate(retour, { replace: true })
          else setMode('intro')
        }}
      />
    )
  }
  if (mode === 'done') return <Done session={session} />
  return <Intro session={session} setSession={setSession} onStart={() => { unlockAudio(); setMode('guided') }} />
}

/* ---------- Avant de commencer ---------- */

function Intro({ session, setSession, onStart }) {
  const routine = routineOf(session)
  const total = useMemo(() => stepsDuration(routineSteps(session.template_key)), [session.template_key])
  const [busy, setBusy] = useState(false)
  const d = parseDay(session.date)
  const past = session.date < todayKey() && session.status !== 'done'
  const etirements = session.kind === 'etirements'

  const toggleSkip = async () => {
    setBusy(true)
    const status = session.status === 'skipped' ? 'planned' : 'skipped'
    await setSessionStatus(session.id, status).catch(() => {})
    setSession({ ...session, status })
    window.dispatchEvent(new Event('life:changed'))
    setBusy(false)
  }

  return (
    <div className="page souplesse">
      <BackBar />
      <header className="session-head">
        <KindIcon kind={session.kind} size={52} />
        <h1 className="doc-title">{etirements ? routine.name : routine.short}</h1>
        <p className="soft-sub">{etirements ? 'Dimanche → jeudi · ' : `${routine.sub} · `}{routine.where}</p>
        <dl className="props">
          <div className="prop">
            <dt>Quand</dt>
            <dd>{DAY_NAMES[(d.getDay() + 6) % 7]} {d.getDate()} · {session.start_time || '—'}</dd>
          </div>
          <div className="prop">
            <dt>Durée</dt>
            <dd>{fmtMinSec(total)}</dd>
          </div>
          {session.status !== 'planned' && (
            <div className="prop">
              <dt>Statut</dt>
              <dd className="tags"><StatusTag status={session.status} soft /></dd>
            </div>
          )}
        </dl>
      </header>

      {past ? (
        <div className="callout">
          <span className="callout-icon"><Icon name="info" size={20} /></span>
          <p className="callout-text">Pas {etirements ? 'faits' : 'faite'} ce jour-là : on l’oublie, rien n’est reporté.</p>
        </div>
      ) : session.note ? (
        <div className="callout">
          <span className="callout-icon"><Icon name="info" size={20} /></span>
          <p className="callout-text">{session.note}</p>
        </div>
      ) : null}

      <h2 className="group-title">Mouvements</h2>
      <ol className="group ex-list">
        {routine.moves.map((mk, i) => (
          <li key={mk} className="ex-line">
            <span className="ex-num">{i + 1}</span>
            <span className="ex-main">
              <span className="ex-name">{MOVES[mk].name}</span>
              <span className="ex-target">{MOVES[mk].zone} · {moveDose(mk)}</span>
            </span>
          </li>
        ))}
      </ol>
      <p className="group-foot">
        Une tension qui tire, oui ; une douleur, non. Si ça fait mal, réduis l’amplitude ou passe le mouvement.
        {' '}Terminer coche ton habitude « Étirements ».
      </p>

      {!past && session.status !== 'skipped' && (
        <button className="btn-primary" onClick={onStart}>
          {session.status === 'done' ? 'Recommencer' : 'Commencer'} · {fmtMinSec(total)}
        </button>
      )}
      {!past && session.status !== 'done' && (
        <button className="btn-plain" onClick={toggleSkip} disabled={busy}>
          {session.status === 'skipped' ? 'Remettre au planning' : etirements ? 'Pas ce soir' : 'Je ne la fais pas cette semaine'}
        </button>
      )}
    </div>
  )
}

/* ---------- Mode guidé ---------- */

function useNow(ms) {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), ms)
    return () => clearInterval(t)
  }, [ms])
  return now
}

const sideLabel = (step, move) => {
  if (!step.side) return move.rounds > 1 ? `Passage ${step.round} / ${move.rounds}` : ''
  const round = move.rounds > 1 ? ` · passage ${step.round} / ${move.rounds}` : ''
  return step.side === 'droit' ? `Côté droit · puis gauche${round}` : `Côté gauche${round}`
}

function Guided({ session, onEnd }) {
  const routine = routineOf(session)
  const steps = useMemo(() => routineSteps(session.template_key), [session.template_key])
  const [st, setSt] = useState(() => {
    const saved = readProgress(session.id)
    if (saved && saved.idx < steps.length) {
      return saved.paused ? saved : { ...saved, ...advance(saved, steps, Date.now()) }
    }
    return { idx: 0, endAt: Date.now() + steps[0].secs * 1000, paused: false, left: 0, plus: 0, startedAt: Date.now() }
  })
  const [confirm, setConfirm] = useState(false)
  const [pain, setPain] = useState(false)
  const [island, setIsland] = useState('')
  const now = useNow(250)
  const ended = useRef(false)

  // écran allumé, interface sans barre d'onglets
  useEffect(() => {
    document.body.classList.add('focus-mode')
    const release = keepAwake()
    return () => {
      document.body.classList.remove('focus-mode')
      release()
      restActivity.hide()
    }
  }, [])

  const finish = useCallback((count) => {
    if (ended.current) return
    ended.current = true
    restActivity.hide()
    onEnd({ count, startedAt: new Date(st.startedAt) })
  }, [onEnd, st.startedAt])

  // le temps avance (rattrape aussi le temps passé hors de l'app)
  useEffect(() => {
    if (st.paused || ended.current) return
    const a = advance(st, steps, Date.now())
    if (!a.advanced) return
    const from = steps[st.idx]
    const to = steps[a.idx]
    if (!to) {
      beep({ times: 3 })
      finish(true)
      return
    }
    if (to.type === 'work') beep({ times: 1, freq: 990 })
    else if (from?.type === 'work') beep({ times: 2, freq: 660 })
    setPain(false)
    setSt({ ...st, idx: a.idx, endAt: a.endAt, plus: 0 })
  }, [now, st, steps, finish])

  useEffect(() => {
    writeProgress(session.id, st)
  }, [st, session.id])

  const step = steps[Math.min(st.idx, steps.length - 1)]
  const move = MOVES[step.move]
  const total = step.secs + (st.plus || 0)
  const left = st.paused ? st.left : Math.max(0, (st.endAt - now) / 1000)
  const nextIdx = nextMoveIndex(steps, st.idx)
  const nextMove = steps[nextIdx] ? steps[nextIdx].move : null

  // île dynamique (app iPhone) : le passage en cours, mis à jour à chaque étape
  useEffect(() => {
    if (st.paused) {
      restActivity.hide()
      return
    }
    const s = steps[st.idx]
    if (!s) return
    const m = MOVES[s.move]
    restActivity.show({
      title: `${routine.short} · ${m.name}`,
      endsAt: st.endAt,
      total: s.secs + (st.plus || 0),
      next: s.type === 'work' ? (nextMove ? MOVES[nextMove].name : 'Fin') : m.name,
      detail: s.type === 'prep' ? 'Mets-toi en place' : s.type === 'switch' ? 'Change de côté' : sideLabel(s, m),
      notify: false
    }).then((r) => setIsland(r && r.ok === false ? r.error || 'refusé par iOS' : ''))
  }, [st.idx, st.paused, st.endAt, st.plus, steps, routine.short, nextMove])

  const goTo = (idx) => {
    if (idx >= steps.length) return finish(true)
    setPain(false)
    if (steps[idx].type === 'work') beep({ times: 1, freq: 990 })
    setSt({ ...st, idx, endAt: Date.now() + steps[idx].secs * 1000, paused: false, left: 0, plus: 0 })
  }
  const togglePause = () => {
    unlockAudio()
    if (st.paused) setSt({ ...st, paused: false, endAt: Date.now() + st.left * 1000 })
    else setSt({ ...st, paused: true, left: Math.max(1, (st.endAt - Date.now()) / 1000) })
  }
  const addTime = () => {
    if (st.paused) setSt({ ...st, left: st.left + 15, plus: (st.plus || 0) + 15 })
    else setSt({ ...st, endAt: st.endAt + 15000, plus: (st.plus || 0) + 15 })
  }

  const R = 88
  const C = 2 * Math.PI * R
  const ratio = Math.min(1, Math.max(0, left / total))
  const workDone = steps.slice(0, st.idx).filter((s) => s.type === 'work').length
  const kicker = step.type === 'prep' ? 'Mets-toi en place' : step.type === 'switch' ? (step.side ? 'Change de côté' : 'Encore une fois') : move.zone

  return (
    <div className="page soft-live" role="timer" aria-live="polite">
      <div className="soft-bar">
        <span>{routine.short} · {step.index + 1} / {routine.moves.length}</span>
        <button className="link-btn" onClick={() => setConfirm(true)}>Terminer</button>
      </div>
      <div className="soft-dots" aria-hidden="true">
        {routine.moves.map((mk, i) => (
          <i key={mk} className={i < step.index ? 'is-done' : i === step.index ? 'is-cur' : ''} />
        ))}
      </div>

      <p className={`soft-kicker${step.type !== 'work' ? ' is-prep' : ''}`}>{kicker}</p>
      <h1 className="soft-name">{move.name}</h1>
      <p className="soft-side">{sideLabel(step, move) || ' '}</p>

      <div className={`soft-ring${step.type !== 'work' ? ' is-prep' : ''}${st.paused ? ' is-paused' : ''}`}>
        <svg viewBox="0 0 200 200" aria-hidden="true">
          <circle cx="100" cy="100" r={R} className="soft-track" />
          <circle cx="100" cy="100" r={R} className="soft-progress" strokeDasharray={C} strokeDashoffset={C * (1 - ratio)} transform="rotate(-90 100 100)" />
        </svg>
        <p className="soft-time">{fmtClock(Math.ceil(left))}</p>
        {st.paused && <p className="soft-paused">En pause</p>}
      </div>

      <p className="soft-cue">{move.cue}</p>

      <div className="soft-actions">
        <button className="pill" onClick={togglePause}>{st.paused ? 'Reprendre' : 'Pause'}</button>
        <button className="pill pill-strong" onClick={() => goTo(st.idx + 1)}>{step.type === 'work' ? 'Suivant' : 'C’est parti'}</button>
        <button className="pill" onClick={addTime}>+15 s</button>
      </div>

      <p className="soft-next">
        {nextMove ? <>Ensuite : <strong>{MOVES[nextMove].name}</strong> · {moveDose(nextMove)}</> : 'Dernier mouvement'}
      </p>

      {pain ? (
        <div className="soft-pain">
          <p>Réduis l’amplitude jusqu’à une simple tension, sans forcer. Si la douleur reste, passe ce mouvement.</p>
          <button className="pill pill-small" onClick={() => goTo(nextIdx)}>Passer ce mouvement</button>
        </div>
      ) : (
        <button className="link-btn soft-pain-btn" onClick={() => setPain(true)}>Ça fait mal ?</button>
      )}
      {island && <p className="group-foot">Île dynamique indisponible : {island}</p>}

      {confirm && (
        <div className="soft-confirm" role="dialog" aria-label="Terminer">
          <div className="soft-confirm-card">
            <p className="sheet-title">Arrêter maintenant ?</p>
            <p className="group-foot">{workDone} passage{workDone > 1 ? 's' : ''} sur {steps.filter((s) => s.type === 'work').length} faits.</p>
            <button className="btn-primary" onClick={() => finish(true)}>Arrêter et compter comme fait</button>
            <button className="btn-secondary" onClick={() => finish(false)}>Arrêter sans compter</button>
            <button className="btn-plain" onClick={() => setConfirm(false)}>Continuer</button>
          </div>
        </div>
      )}
    </div>
  )
}

/* ---------- Fin ---------- */

function Done({ session }) {
  const routine = routineOf(session)
  return (
    <div className="page souplesse">
      <BackBar />
      <div className="soft-done">
        <span className="soft-done-check"><Icon name="check" size={34} stroke={2.6} /></span>
        <h1 className="doc-title">Bien joué</h1>
        <p className="soft-sub">{routine.short} {session.kind === 'etirements' ? 'faits' : 'faite'}. Ton habitude « Étirements » est cochée pour aujourd’hui.</p>
        <Link className="btn-primary as-link" to="/sport">Voir la semaine</Link>
        <Link className="btn-plain as-link" to="/habitudes">Voir mes habitudes</Link>
      </div>
    </div>
  )
}
