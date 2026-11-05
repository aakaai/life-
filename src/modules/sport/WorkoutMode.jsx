import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import Icon from '../../components/Icon'
import { EXERCISES, VARIANTS, WORKOUTS, workoutItems } from './data'
import { suggest, maxLoad, loadStep, applyCheck, plateText, PAIN_AREAS } from './progression'
import {
  getSession, loadSettings, findWorkout, openWorkout, exerciseHistory,
  saveSet, deleteSet, finishWorkout, setSessionStatus, loadNotesContext, saveNote, saveCheck
} from './api'
import { parseDay } from './planner'
import { BackBar, KindIcon, Stepper, VariantTag, StatusTag, fmtClock, fmtDuration, DAY_NAMES } from './ui'
import { beep, keepAwake, unlockAudio } from './device'
import { restActivity, isNative } from '../../lib/native'

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
      const [history, notes] = await Promise.all([exerciseHistory({ excludeWorkout: workout?.id }), loadNotesContext(session.id, workout?.id)])
      const mode = found.open ? 'live' : workout ? 'summary' : 'intro'
      setData({ session, settings, history, notes, workout, sets: workout ? found.sets : [], mode })
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

// Chaque exercice : proposition (double progression), dernière note, réponse au contrôle de gêne.
const NO_NOTES = { available: false, byEx: {}, checks: [], current: [] }
function useSuggestions(session, variant, history, settings, notes = NO_NOTES) {
  return useMemo(() => {
    const items = workoutItems(session.template_key, variant)
    const progress = variant !== 'recup'
    return items.map((it) => {
      const base = suggest(it, history[it.ex] || [], settings, { progress })
      const prev = notes.byEx[it.ex] || null
      const check = notes.checks.find((c) => c.exercise_key === it.ex) || null
      return { item: it, ex: EXERCISES[it.ex], base, s: applyCheck(base, check?.choice, it, settings), prev, check, pending: !!prev?.pain && !check }
    })
  }, [session.template_key, variant, history, settings, notes])
}

const fmtKg = (v) => `${String(v).replace('.', ',')} kg`
const shortDate = (iso) => new Date(iso).toLocaleDateString('fr-BE', { weekday: 'long', day: 'numeric', month: 'short' })
const painLabel = (n) => `gêne${n.area ? ` (${n.area.toLowerCase()})` : ''}`

// Note de la dernière fois, affichée sur l'exercice.
function PrevNote({ note }) {
  if (!note) return null
  return (
    <p className={note.pain ? 'ex-note is-pain' : 'ex-note'}>
      <strong>Dernière fois{note.pain ? ` · ${painLabel(note)}` : ''}</strong>
      {note.note ? ` : « ${note.note} »` : ''}
    </p>
  )
}

// Feuille « Note » : gêne / douleur + zone + texte libre.
function NoteSheet({ title, initial, onSave, onClose }) {
  const [v, setV] = useState({ pain: !!initial?.pain, area: initial?.area || '', note: initial?.note || '' })
  const [busy, setBusy] = useState(false)
  async function save() {
    setBusy(true)
    try {
      await onSave(v)
      onClose()
    } finally {
      setBusy(false)
    }
  }
  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div className="sheet note-sheet" role="dialog" aria-label={`Note · ${title}`} onClick={(e) => e.stopPropagation()}>
        <p className="sheet-title">Note · {title}</p>
        <p className="sheet-text">Elle sera reprise à la prochaine séance.</p>
        <div className="chips left">
          <button type="button" className={v.pain ? 'chip chip-pain is-on' : 'chip chip-pain'} aria-pressed={v.pain} onClick={() => setV({ ...v, pain: !v.pain })}>Gêne / douleur</button>
        </div>
        {v.pain && (
          <>
            <p className="note-label">Où ?</p>
            <div className="chips left">
              {PAIN_AREAS.map((a) => (
                <button key={a} type="button" className={v.area === a ? 'chip is-on' : 'chip'} aria-pressed={v.area === a} onClick={() => setV({ ...v, area: v.area === a ? '' : a })}>{a}</button>
              ))}
            </div>
          </>
        )}
        <textarea className="note-text" rows={3} placeholder="Ex. pincement en haut du mouvement, baissé à 6 kg à la 3e série" value={v.note} onChange={(e) => setV({ ...v, note: e.target.value })} aria-label="Commentaire" />
        <button className="btn-primary" onClick={save} disabled={busy}>{busy ? 'Enregistrement…' : 'Enregistrer la note'}</button>
        {(initial?.pain || initial?.note) && <button className="btn-plain danger" onClick={() => { setV({ pain: false, area: '', note: '' }); onSave({ pain: false, note: '' }).then(onClose) }}>Effacer la note</button>}
        <button className="btn-plain" onClick={onClose}>Annuler</button>
      </div>
    </div>
  )
}

// Enregistre une note et met à jour l'écran.
function useNoteSaver(workout, setData) {
  return async (exKey, v) => {
    const row = await saveNote(workout.id, exKey, v)
    setData((x) => ({
      ...x,
      notes: { ...x.notes, current: [...x.notes.current.filter((n) => n.exercise_key !== exKey), ...(row ? [row] : [])] }
    }))
  }
}

// Carte « Ensuite » pendant le repos : de quoi préparer l'exercice ou la série suivante.
function restCard({ item, ex, s }, k, settings, kicker, weight = s.weight) {
  const target = s.targets?.[k]
  const goal = `${item.sets} × ${range(item)} ${unitOf(ex)}${target ? ` · vise ${target}${ex.load === 'time' ? ' s' : ''}` : ''} · repos ${fmtClock(item.rest)}`
  return { kicker, title: ex.name, goal, weight, plates: plateText(weight, item.ex, settings), cues: ex.cues }
}

const range = (it) => (it.reps[0] === it.reps[1] ? `${it.reps[0]}` : `${it.reps[0]}–${it.reps[1]}`)
const unitOf = (ex) => (ex.load === 'time' ? 's' : ex.unilateral ? 'reps / côté' : 'reps')

/* ---------- Avant la séance ---------- */

function Intro({ session, settings, history, notes, setData }) {
  const navigate = useNavigate()
  const plan = useSuggestions(session, session.variant, history, settings, notes)
  const pending = plan.filter((p) => p.pending)

  async function answer(p, choice) {
    const row = await saveCheck(session.id, p.item.ex, p.prev?.id, choice)
    setData((x) => ({ ...x, notes: { ...x.notes, checks: [...x.notes.checks.filter((c) => c.exercise_key !== p.item.ex), ...(row ? [row] : [])] } }))
  }
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
    if (params.get('go') === '1' && !autoStarted.current && session.status !== 'done' && !pending.length) {
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

      {pending.map((p) => {
        const low = applyCheck(p.base, 'lower', p.item, settings)
        const what = (x) => `${x.weight != null ? `${fmtKg(x.weight)} · ` : ''}${p.item.sets} × ${x.targets[0]}${p.ex.load === 'time' ? ' s' : ''}`
        return (
          <section key={p.item.ex} className="check-card">
            <p className="check-kicker">À vérifier avant de commencer</p>
            <p className="check-ex">{p.ex.name}</p>
            <p className="check-note">
              {shortDate(p.prev.date)} · <strong>{painLabel(p.prev)}</strong>{p.prev.note ? ` · « ${p.prev.note} »` : ''}
            </p>
            <p className="check-q">Comment ça va aujourd’hui ?</p>
            <button className="check-opt" onClick={() => answer(p, 'ok')}>Ça va, comme prévu<small>{what(p.base)}</small></button>
            <button className="check-opt is-rec" onClick={() => answer(p, 'lower')}>Prudence : baisser d’un cran<small>{what(low)}, on remonte si tout va bien</small></button>
            <button className="check-opt" onClick={() => answer(p, 'skip')}>Passer cet exercice aujourd’hui<small>la gêne est encore là</small></button>
          </section>
        )
      })}

      <h2 className="group-title">Exercices</h2>
      <ol className="group ex-list">
        {plan.map(({ item, ex, s, check, pending: wait }, i) => (
          <li key={i} className={s.skipped ? 'ex-line is-skipped' : 'ex-line'}>
            <span className="ex-num">{i + 1}</span>
            <span className="ex-main">
              <span className="ex-name">{ex.name}</span>
              <span className="ex-target">
                {wait ? 'en attente de ta réponse' : s.skipped ? 'passé aujourd’hui' : (
                  <>
                    {item.sets} × {range(item)} {unitOf(ex)}
                    {s.weight != null && <> · <strong>{s.weight} kg</strong></>}
                    {' · '}repos {fmtClock(item.rest)}
                  </>
                )}
              </span>
              {s.stagnation && !s.skipped && <span className="ex-alert">{s.stagnation}</span>}
              {check && check.choice !== 'ok' && (
                <span className="ex-checked">
                  {check.choice === 'lower' ? 'Un cran plus bas (gêne la dernière fois)' : 'Passé à cause de la gêne'} ·{' '}
                  <button className="link-btn" onClick={() => saveCheck(session.id, item.ex, null, null).then(() => setData((x) => ({ ...x, notes: { ...x.notes, checks: x.notes.checks.filter((c) => c.exercise_key !== item.ex) } })))}>Changer</button>
                </span>
              )}
            </span>
            {wait && <span className="tag tag-pain">gêne</span>}
          </li>
        ))}
      </ol>
      <p className="group-foot">Charges proposées d’après tes dernières séances. RIR = répétitions que tu aurais encore pu faire.</p>

      <button className="btn-primary" onClick={start} disabled={busy || pending.length > 0}>
        Commencer la séance
      </button>
      {pending.length > 0 && <p className="group-foot">Réponds d’abord à la question sur {pending.map((p) => p.ex.name).join(', ')}.</p>}
      <button className="btn-plain" onClick={toggleSkip} disabled={busy}>
        {session.status === 'skipped' ? 'Remettre au planning' : 'Je ne la fais pas cette semaine'}
      </button>
    </div>
  )
}

/* ---------- Pendant la séance ---------- */

function Live({ session, settings, history, notes, workout, sets, setData }) {
  const fullPlan = useSuggestions(session, workout.variant, history, settings, notes)
  const plan = useMemo(() => fullPlan.filter((p) => !p.s.skipped), [fullPlan])
  const [noteFor, setNoteFor] = useState(null)
  const [island, setIsland] = useState('')
  const saveNoteFor = useNoteSaver(workout, setData)
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
    }).then((r) => setIsland(r && r.ok === false ? r.error || 'refusé par iOS' : ''))
  }, [rest, session.label])

  const { item, ex, s, prev } = plan[Math.min(exIdx, plan.length - 1)]
  const curNote = notes.current.find((n) => n.exercise_key === item.ex) || null
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
    let card
    if (lastOfEx) {
      const nx = plan[exIdx + 1]
      next = `${nx.ex.name}`
      detail = setDetail(nx, 0)
      card = restCard(nx, 0, settings, `Ensuite · exercice ${exIdx + 2} sur ${plan.length}`)
      setExIdx(exIdx + 1)
    } else {
      next = `Série ${k + 2} sur ${item.sets}`
      detail = `${ex.name}${isWeighted ? ` · ${String(entry.weight).replace('.', ',')} kg` : ''}`
      card = restCard(plan[exIdx], k + 1, settings, `Ensuite · série ${k + 2} sur ${item.sets}`, isWeighted ? entry.weight : null)
    }
    setRest({ endAt: Date.now() + item.rest * 1000, total: item.rest, next, detail, card })
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
        <PrevNote note={prev} />
        {curNote && (
          <p className={curNote.pain ? 'ex-note is-current is-pain' : 'ex-note is-current'}>
            <strong>Ta note{curNote.pain ? ` · ${painLabel(curNote)}` : ''}</strong>{curNote.note ? ` : « ${curNote.note} »` : ''}
          </p>
        )}
        {notes.available && (
          <button className="note-btn" onClick={() => setNoteFor(item.ex)}>
            <Icon name="book" size={15} /> {curNote ? 'Modifier la note' : 'Note'}
          </button>
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

      {rest && <RestTimer rest={rest} sound={settings.rest_sound !== false} onChange={setRest} island={island} />}
      {noteFor && (
        <NoteSheet
          title={EXERCISES[noteFor].name}
          initial={notes.current.find((n) => n.exercise_key === noteFor)}
          onSave={(v) => saveNoteFor(noteFor, v)}
          onClose={() => setNoteFor(null)}
        />
      )}
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

function RestTimer({ rest, sound, onChange, island }) {
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
        {!rest.card && <p className="rest-next">Ensuite : {rest.next}</p>}
        <div className="rest-actions">
          <button className="pill" onClick={() => adjust(-15)}>−15 s</button>
          <button className="pill pill-strong" onClick={() => onChange(null)}>{over ? 'OK' : 'Passer'}</button>
          <button className="pill" onClick={() => adjust(15)}>+15 s</button>
        </div>
        {rest.card && (
          <div className="rest-nextcard">
            <p className="rest-nextcard-kicker">{rest.card.kicker}</p>
            <p className="rest-nextcard-title">{rest.card.title}</p>
            <p className="rest-nextcard-goal">{rest.card.goal}</p>
            {rest.card.weight != null && (
              <div className="rest-load">
                <strong>{fmtKg(rest.card.weight)}</strong>
                {rest.card.plates && <span>{rest.card.plates}</span>}
              </div>
            )}
            <p className="rest-nextcard-cues">{rest.card.cues}</p>
          </div>
        )}
        {isNative && island && <p className="rest-island">Île dynamique indisponible : {island}</p>}
      </div>
    </div>
  )
}

/* ---------- Résumé ---------- */

function Summary({ session, settings, history, notes, workout, sets, setData }) {
  const navigate = useNavigate()
  const plan = useSuggestions(session, workout.variant, history, settings)
  const [noteFor, setNoteFor] = useState(null)
  const saveNoteFor = useNoteSaver(workout, setData)
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
        {rows.map(({ item, ex, mine, delta, up, next }, i) => (
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
              {(() => {
                const n = notes.current.find((x) => x.exercise_key === item.ex)
                if (!notes.available) return null
                return n ? (
                  <button className={n.pain ? 'sum-note is-pain' : 'sum-note'} onClick={() => setNoteFor(item.ex)}>
                    {n.pain && <strong>{painLabel(n)} · </strong>}{n.note ? `« ${n.note} »` : ''} <span className="link-btn">Modifier</span>
                  </button>
                ) : (
                  <button className="link-btn sum-addnote" onClick={() => setNoteFor(item.ex)}>+ Note</button>
                )
              })()}
            </span>
            <span className={up ? 'tag tag-live' : 'tag'}>{delta}</span>
          </li>
        ))}
      </ul>
      {noteFor && (
        <NoteSheet
          title={EXERCISES[noteFor].name}
          initial={notes.current.find((n) => n.exercise_key === noteFor)}
          onSave={(v) => saveNoteFor(noteFor, v)}
          onClose={() => setNoteFor(null)}
        />
      )}

      <button className="btn-primary" onClick={() => navigate('/sport')}>Retour à la semaine</button>
    </div>
  )
}
