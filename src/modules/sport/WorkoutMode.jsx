import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import Icon from '../../components/Icon'
import { EXERCISES, VARIANTS, WORKOUTS, workoutItems } from './data'
import { suggest, maxLoad, loadStep } from './progression'
import {
  getSession, loadSettings, findWorkout, openWorkout, exerciseHistory,
  saveSet, deleteSet, finishWorkout, setSessionStatus
} from './api'
import { parseDay } from './planner'
import { BackBar, KindIcon, Stepper, VariantTag, StatusTag, fmtClock, fmtDuration, DAY_NAMES } from './ui'
import { beep, keepAwake, unlockAudio } from './device'
import { restActivity } from '../../lib/native'

// Mode séance musculation : consignes, charge proposée, saisie des séries,
// minuteur de repos avec bip, puis résumé.
export default function WorkoutMode() {
  const { id } = useParams()
  const [data, setData] = useState(null)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    try {
      const session = await getSession(id)
      if (!session) return setData({ missing: true })
      const [settings, found] = await Promise.all([loadSettings(), findWorkout(id)])
      const workout = found.open || (session.status === 'done' ? found.finished : null)
      const history = await exerciseHistory({ excludeWorkout: workout?.id })
      const mode = found.open ? 'live' : workout ? 'summary' : 'intro'
      setData({ session, settings, history, workout, sets: workout ? found.sets : [], mode })
    } catch (e) {
      setError(e.message)
    }
  }, [id])

  useEffect(() => {
    load()
  }, [load])

  if (error) return <div className="page"><BackBar /><p className="group-foot is-error">{error}</p></div>
  if (!data) return <div className="page"><BackBar /><p className="muted-line">Chargement…</p></div>
  if (data.missing) {
    return (
      <div className="page">
        <BackBar />
        <p className="muted-line">Cette séance n’existe plus : la semaine a sans doute été réorganisée.</p>
      </div>
    )
  }

  const props = { ...data, setData, reload: load }
  if (data.mode === 'live') return <Live {...props} />
  if (data.mode === 'summary') return <Summary {...props} />
  return <Intro {...props} />
}

/* ---------- Suggestions pour toute la séance ---------- */

function useSuggestions(session, variant, history, settings) {
  return useMemo(() => {
    const items = workoutItems(session.template_key, variant)
    const progress = variant !== 'recup'
    return items.map((it) => ({ item: it, ex: EXERCISES[it.ex], s: suggest(it, history[it.ex] || [], settings, { progress }) }))
  }, [session.template_key, variant, history, settings])
}

const range = (it) => (it.reps[0] === it.reps[1] ? `${it.reps[0]}` : `${it.reps[0]}–${it.reps[1]}`)
const unitOf = (ex) => (ex.load === 'time' ? 's' : ex.unilateral ? 'reps / côté' : 'reps')

/* ---------- Avant la séance ---------- */

function Intro({ session, settings, history, setData }) {
  const navigate = useNavigate()
  const plan = useSuggestions(session, session.variant, history, settings)
  const [busy, setBusy] = useState(false)
  const d = parseDay(session.date)
  const variant = VARIANTS[session.variant]

  async function start() {
    unlockAudio()
    setBusy(true)
    const { workout, sets } = await openWorkout(session)
    setData((x) => ({ ...x, workout, sets, mode: 'live' }))
  }

  // « Démarrer » depuis la semaine (carte du jour) : on lance la séance tout de suite
  const [params] = useSearchParams()
  const autoStarted = useRef(false)
  useEffect(() => {
    if (params.get('go') === '1' && !autoStarted.current && session.status !== 'done') {
      autoStarted.current = true
      start()
    }
  }, [])

  async function toggleSkip() {
    setBusy(true)
    await setSessionStatus(session.id, session.status === 'skipped' ? 'planned' : 'skipped')
    navigate('/sport')
  }

  return (
    <div className="page workout">
      <BackBar />
      <header className="session-head">
        <KindIcon kind="muscu" size={52} />
        <h1 className="doc-title">{WORKOUTS[session.template_key].name}</h1>
        <dl className="props">
          <div className="prop">
            <dt>Quand</dt>
            <dd>{DAY_NAMES[(d.getDay() + 6) % 7]} {d.getDate()} · {session.start_time || '—'}</dd>
          </div>
          <div className="prop">
            <dt>Durée</dt>
            <dd>{fmtDuration(session.duration_min || WORKOUTS[session.template_key].duration)}</dd>
          </div>
          {(variant?.label || session.status !== 'planned') && (
            <div className="prop">
              <dt>Statut</dt>
              <dd className="tags"><VariantTag variant={session.variant} /><StatusTag status={session.status} /></dd>
            </div>
          )}
        </dl>
      </header>

      {(session.note || variant?.hint) && (
        <div className="callout">
          <span className="callout-icon"><Icon name="info" size={20} /></span>
          <div>
            {session.note && <p className="callout-text">{session.note}</p>}
            {variant?.hint && !session.note && <p className="callout-text">{variant.hint}</p>}
          </div>
        </div>
      )}

      <h2 className="group-title">Exercices</h2>
      <ol className="group ex-list">
        {plan.map(({ item, ex, s }, i) => (
          <li key={i} className="ex-line">
            <span className="ex-num">{i + 1}</span>
            <span className="ex-main">
              <span className="ex-name">{ex.name}</span>
              <span className="ex-target">
                {item.sets} × {range(item)} {unitOf(ex)}
                {s.weight != null && <> · <strong>{s.weight} kg</strong></>}
                {' · '}repos {fmtClock(item.rest)}
              </span>
              {s.stagnation && <span className="ex-alert">{s.stagnation}</span>}
            </span>
          </li>
        ))}
      </ol>
      <p className="group-foot">Charges proposées d’après tes dernières séances. RIR = répétitions que tu aurais encore pu faire.</p>

      <button className="btn-primary" onClick={start} disabled={busy}>
        Commencer la séance
      </button>
      <button className="btn-plain" onClick={toggleSkip} disabled={busy}>
        {session.status === 'skipped' ? 'Remettre au planning' : 'Je ne la fais pas cette semaine'}
      </button>
    </div>
  )
}

/* ---------- Pendant la séance ---------- */

function Live({ session, settings, history, workout, sets, setData }) {
  const plan = useSuggestions(session, workout.variant, history, settings)
  const logged = (ex) => sets.filter((s) => s.exercise_key === ex).sort((a, b) => a.set_index - b.set_index)
  const firstOpen = plan.findIndex(({ item }) => logged(item.ex).length < item.sets)
  const [exIdx, setExIdx] = useState(firstOpen === -1 ? plan.length - 1 : firstOpen)
  const [rest, setRest] = useState(null) // { endAt, total, next }
  const [confirmEnd, setConfirmEnd] = useState(false)
  const [saving, setSaving] = useState(false)
  const now = useNow(1000)

  useEffect(() => {
    document.body.classList.add('focus-mode')
    const release = keepAwake()
    return () => {
      document.body.classList.remove('focus-mode')
      release()
      restActivity.hide()
    }
  }, [])

  // App iPhone : le repos s'affiche aussi dans l'île dynamique et sur l'écran verrouillé,
  // avec une notification à la fin (même téléphone en poche).
  useEffect(() => {
    if (!rest) {
      restActivity.hide()
      return
    }
    restActivity.show({
      title: session.label || 'Séance',
      endsAt: rest.endAt,
      total: rest.total,
      next: rest.next,
      detail: rest.detail || ''
    })
  }, [rest, session.label])

  const { item, ex, s } = plan[exIdx]
  const done = logged(item.ex)
  const k = done.length
  const isWeighted = ex.load === 'two' || ex.load === 'one'
  const top = isWeighted ? maxLoad(item.ex, settings) : 0

  // valeurs proposées pour la série suivante (recalculées quand on change d'exercice ou de série)
  const prevW = done.length ? done[done.length - 1].weight_kg : s.weight
  const proposal = { weight: prevW ?? 0, reps: s.targets[Math.min(k, s.targets.length - 1)] ?? item.reps[0], rir: 2 }
  const [entry, setEntry] = useState(proposal)
  const proposalKey = `${exIdx}:${k}`
  const [entryKey, setEntryKey] = useState(proposalKey)
  if (entryKey !== proposalKey) {
    setEntryKey(proposalKey)
    setEntry(proposal)
  }

  const totalSets = plan.reduce((t, p) => t + p.item.sets, 0)
  const allDone = plan.every(({ item: it }) => logged(it.ex).length >= it.sets)

  async function validate() {
    unlockAudio()
    setSaving(true)
    const row = await saveSet({
      workout_id: workout.id,
      exercise_key: item.ex,
      set_index: k,
      weight_kg: isWeighted ? entry.weight : null,
      reps: ex.load === 'time' ? null : entry.reps,
      seconds: ex.load === 'time' ? entry.reps : null,
      rir: ex.load === 'time' ? null : entry.rir
    })
    const nextSets = [...sets, row]
    setData((x) => ({ ...x, sets: nextSets }))
    setSaving(false)
    const lastOfEx = k + 1 >= item.sets
    const lastEx = exIdx >= plan.length - 1
    if (lastOfEx && lastEx) return
    let next
    let detail
    if (lastOfEx) {
      const nx = plan[exIdx + 1]
      next = `${nx.ex.name}`
      detail = setDetail(nx, 0)
      setExIdx(exIdx + 1)
    } else {
      next = `Série ${k + 2} sur ${item.sets}`
      detail = `${ex.name}${isWeighted ? ` · ${String(entry.weight).replace('.', ',')} kg` : ''}`
    }
    setRest({ endAt: Date.now() + item.rest * 1000, total: item.rest, next, detail })
  }

  async function removeSet(row) {
    await deleteSet(row.id)
    setData((x) => ({ ...x, sets: x.sets.filter((r) => r.id !== row.id) }))
  }

  async function finish() {
    if (!allDone && !confirmEnd) return setConfirmEnd(true)
    setSaving(true)
    await finishWorkout(workout, session)
    const updated = await getSession(session.id)
    setData((x) => ({ ...x, session: updated, workout: { ...workout, finished_at: new Date().toISOString() }, mode: 'summary' }))
  }

  const elapsed = (now - new Date(workout.started_at)) / 1000

  return (
    <div className="page workout live">
      <BackBar>
        <span className="live-clock"><Icon name="timer" size={16} /> {fmtClock(elapsed)}</span>
        <button className="link-btn strong" onClick={finish} disabled={saving}>Terminer</button>
      </BackBar>

      <nav className="ex-strip" aria-label="Exercices">
        {plan.map(({ item: it, ex: e }, i) => {
          const n = logged(it.ex).length
          return (
            <button
              key={i}
              className={`ex-chip${i === exIdx ? ' is-current' : ''}${n >= it.sets ? ' is-done' : ''}`}
              onClick={() => setExIdx(i)}
              aria-label={e.name}
            >
              {n >= it.sets ? <Icon name="check" size={14} stroke={2.6} /> : i + 1}
            </button>
          )
        })}
        <span className="ex-strip-count">{sets.length}/{totalSets} séries</span>
      </nav>

      <section className="ex-card">
        <p className="ex-kicker">Exercice {exIdx + 1} sur {plan.length}</p>
        <h1 className="ex-title">{ex.name}</h1>
        <p className="ex-cues">{ex.cues}</p>
        <p className="ex-goal">
          <strong>{item.sets} × {range(item)} {unitOf(ex)}</strong>
          {s.weight != null && <> · {s.weight} kg</>} · repos {fmtClock(item.rest)}
        </p>
        {s.message && <p className="ex-msg">{s.message}</p>}
        {s.stagnation && <p className="ex-alert">{s.stagnation}</p>}
        {s.last && (
          <p className="ex-last">
            Dernière fois : {s.last.sets.map((x) => (x.seconds ? `${x.seconds} s` : `${x.weight_kg ? `${x.weight_kg}×` : ''}${x.reps}`)).join(' · ')}
          </p>
        )}
      </section>

      <ul className="group set-list">
        {done.map((row) => (
          <li key={row.id} className="set-row is-logged">
            <span className="set-num"><Icon name="check" size={14} stroke={2.6} /></span>
            <span className="set-main">
              {isWeighted && <strong>{row.weight_kg} kg</strong>}
              <span>{row.seconds != null ? `${row.seconds} s` : `${row.reps} reps`}</span>
              {row.rir != null && <span className="set-rir">RIR {row.rir}</span>}
            </span>
            <button className="icon-btn small" onClick={() => removeSet(row)} aria-label="Effacer cette série">
              <Icon name="close" size={16} />
            </button>
          </li>
        ))}
        {k < item.sets ? (
          <li className="set-editor">
            <p className="set-editor-title">Série {k + 1} sur {item.sets}</p>
            <div className="set-fields">
              {isWeighted && (
                <label className="field">
                  <span>Charge par haltère</span>
                  <Stepper
                    label="Charge"
                    value={entry.weight}
                    step={loadStep(settings)}
                    min={Number(settings.handle_kg)}
                    max={top}
                    unit="kg"
                    onChange={(v) => setEntry((e) => ({ ...e, weight: v }))}
                  />
                </label>
              )}
              <label className="field">
                <span>{ex.load === 'time' ? 'Durée tenue' : ex.unilateral ? 'Répétitions par côté' : 'Répétitions'}</span>
                <Stepper
                  label="Répétitions"
                  value={entry.reps}
                  step={ex.load === 'time' ? 5 : 1}
                  min={0}
                  max={ex.load === 'time' ? 300 : 100}
                  unit={ex.load === 'time' ? 's' : ''}
                  onChange={(v) => setEntry((e) => ({ ...e, reps: v }))}
                />
              </label>
              {ex.load !== 'time' && (
                <div className="field">
                  <span>En réserve (RIR)</span>
                  <div className="segmented" role="radiogroup" aria-label="Répétitions en réserve">
                    {[0, 1, 2, 3].map((r) => (
                      <button
                        key={r}
                        type="button"
                        role="radio"
                        aria-checked={entry.rir === r}
                        className={entry.rir === r ? 'is-on' : ''}
                        onClick={() => setEntry((e) => ({ ...e, rir: r }))}
                      >
                        {r === 3 ? '3+' : r}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
            <button className="btn-primary" onClick={validate} disabled={saving}>
              Valider la série
            </button>
          </li>
        ) : (
          <li className="set-row set-complete">
            <Icon name="check" size={16} stroke={2.4} /> Exercice terminé
          </li>
        )}
      </ul>

      <div className="ex-nav">
        <button className="btn-plain" onClick={() => setExIdx(Math.max(0, exIdx - 1))} disabled={exIdx === 0}>
          Précédent
        </button>
        {exIdx < plan.length - 1 ? (
          <button className="btn-plain" onClick={() => setExIdx(exIdx + 1)}>Exercice suivant</button>
        ) : (
          <button className="btn-plain strong" onClick={finish} disabled={saving}>Terminer la séance</button>
        )}
      </div>

      {allDone && (
        <div className="callout callout-success">
          <span className="callout-icon"><Icon name="check" size={20} stroke={2.4} /></span>
          <div>
            <p className="callout-lead">Toutes les séries sont faites.</p>
            <button className="btn-primary" onClick={finish} disabled={saving}>Terminer et voir le résumé</button>
          </div>
        </div>
      )}

      {confirmEnd && !allDone && (
        <div className="sheet-backdrop" onClick={() => setConfirmEnd(false)}>
          <div className="sheet" role="dialog" aria-label="Terminer la séance" onClick={(e) => e.stopPropagation()}>
            <p className="sheet-title">Terminer maintenant ?</p>
            <p className="sheet-text">Il reste {totalSets - sets.length} séries. Ce qui est fait est enregistré.</p>
            <button className="btn-primary" onClick={finish}>Terminer quand même</button>
            <button className="btn-plain" onClick={() => setConfirmEnd(false)}>Continuer la séance</button>
          </div>
        </div>
      )}

      {rest && <RestTimer rest={rest} sound={settings.rest_sound !== false} onChange={setRest} />}
    </div>
  )
}

// « Développé couché · 11 kg » : ce qui est prévu pour une série
function setDetail({ ex, s }, k) {
  const weighted = ex.load === 'two' || ex.load === 'one'
  const target = s?.targets?.[k]
  const parts = [ex.name]
  if (weighted && s?.weight != null) parts.push(`${String(s.weight).replace('.', ',')} kg`)
  if (target) parts.push(ex.load === 'time' ? `${target} s` : `${target} rép.`)
  return parts.join(' · ')
}

function useNow(ms) {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), ms)
    return () => clearInterval(t)
  }, [ms])
  return now
}

/* ---------- Minuteur de repos ---------- */

function RestTimer({ rest, sound, onChange }) {
  const now = useNow(250)
  const beeped = useRef(false)
  const left = (rest.endAt - now) / 1000
  const over = left <= 0

  useEffect(() => {
    if (over && !beeped.current) {
      beeped.current = true
      if (sound) beep()
      const t = setTimeout(() => onChange(null), 2500)
      return () => clearTimeout(t)
    }
  }, [over, sound, onChange])

  const adjust = (sec) => {
    beeped.current = false
    onChange({ ...rest, endAt: Math.max(Date.now() + 1000, rest.endAt + sec * 1000), total: Math.max(rest.total + sec, 1) })
  }
  const ratio = Math.min(1, Math.max(0, left / rest.total))
  const R = 88
  const C = 2 * Math.PI * R

  return (
    <div className="rest" role="timer" aria-live="polite">
      <div className="rest-card">
        <p className="rest-kicker">{over ? 'C’est reparti !' : 'Repos'}</p>
        <svg viewBox="0 0 200 200" className="rest-ring" aria-hidden="true">
          <circle cx="100" cy="100" r={R} className="rest-track" />
          <circle
            cx="100" cy="100" r={R} className="rest-progress"
            strokeDasharray={C} strokeDashoffset={C * (1 - ratio)}
            transform="rotate(-90 100 100)"
          />
        </svg>
        <p className="rest-time">{fmtClock(Math.ceil(Math.max(0, left)))}</p>
        <p className="rest-next">Ensuite : {rest.next}</p>
        <div className="rest-actions">
          <button className="pill" onClick={() => adjust(-15)}>−15 s</button>
          <button className="pill pill-strong" onClick={() => onChange(null)}>{over ? 'OK' : 'Passer'}</button>
          <button className="pill" onClick={() => adjust(15)}>+15 s</button>
        </div>
      </div>
    </div>
  )
}

/* ---------- Résumé ---------- */

function Summary({ session, settings, history, workout, sets }) {
  const navigate = useNavigate()
  const plan = useSuggestions(session, workout.variant, history, settings)
  const minutes = workout.finished_at
    ? Math.max(1, Math.round((new Date(workout.finished_at) - new Date(workout.started_at)) / 60000))
    : null
  const volume = sets.reduce((t, s) => {
    const ex = EXERCISES[s.exercise_key]
    const hands = ex?.load === 'two' ? 2 : 1
    return t + (s.weight_kg || 0) * (s.reps || 0) * hands
  }, 0)

  const rows = plan
    .map(({ item, ex }) => {
      const mine = sets.filter((s) => s.exercise_key === item.ex).sort((a, b) => a.set_index - b.set_index)
      if (!mine.length) return null
      const prev = (history[item.ex] || [])[0]
      const best = (list) => Math.max(...list.map((s) => s.weight_kg || 0))
      const reps = (list) => list.reduce((t, s) => t + (s.reps || s.seconds || 0), 0)
      let delta = 'Première fois'
      if (prev) {
        const dw = best(mine) - best(prev.sets)
        const dr = reps(mine) - reps(prev.sets)
        delta = dw > 0 ? `+${dw} kg` : dw < 0 ? `${dw} kg` : dr > 0 ? `+${dr} ${ex.load === 'time' ? 's' : 'reps'}` : dr < 0 ? `${dr} ${ex.load === 'time' ? 's' : 'reps'}` : 'Comme la dernière fois'
      }
      const next = suggest(item, [{ date: workout.started_at, sets: mine }, ...(history[item.ex] || [])], settings, {
        progress: workout.variant !== 'recup'
      })
      return { item, ex, mine, delta, up: /^\+/.test(delta), next }
    })
    .filter(Boolean)

  return (
    <div className="page workout">
      <BackBar />
      <header className="session-head summary-head">
        <span className="summary-badge"><Icon name="check" size={30} stroke={2.4} /></span>
        <h1 className="doc-title">Séance terminée</h1>
        <p className="muted-line">{WORKOUTS[session.template_key].name}</p>
      </header>

      <div className="stats">
        <div className="stat"><span>Durée</span><strong>{minutes ? fmtDuration(minutes) : '—'}</strong></div>
        <div className="stat"><span>Séries</span><strong>{sets.length}</strong></div>
        <div className="stat"><span>Volume</span><strong>{Math.round(volume).toLocaleString('fr-BE')} kg</strong></div>
      </div>

      <h2 className="group-title">Par exercice</h2>
      <ul className="group">
        {rows.map(({ ex, mine, delta, up, next }, i) => (
          <li key={i} className="sum-row">
            <span className="sum-main">
              <span className="ex-name">{ex.name}</span>
              <span className="ex-target">
                {mine.map((s) => (s.seconds != null ? `${s.seconds} s` : `${s.weight_kg ? `${s.weight_kg}×` : ''}${s.reps}`)).join(' · ')}
              </span>
              <span className="ex-next">
                Prochaine fois : {next.weight != null ? `${next.weight} kg × ` : ''}
                {next.targets.join('/')} {next.unit === 's' ? 's' : 'reps'}
              </span>
              {next.stagnation && <span className="ex-alert">{next.stagnation}</span>}
            </span>
            <span className={up ? 'tag tag-live' : 'tag'}>{delta}</span>
          </li>
        ))}
      </ul>

      <button className="btn-primary" onClick={() => navigate('/sport')}>Retour à la semaine</button>
    </div>
  )
}
