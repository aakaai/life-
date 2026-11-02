import { useCallback, useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import Icon from '../../components/Icon'
import { RIDES, VARIANTS, rideBlocks, blocksDuration } from './data'
import { getSession, loadSettings, logRide, rideLogFor, setSessionStatus } from './api'
import { parseDay, weekInfo } from './planner'
import { downloadZwo } from './zwift'
import { BackBar, KindIcon, StatusTag, VariantTag, DAY_NAMES, fmtDuration, fmtClock } from './ui'

// Couleur de zone (Coggan) selon le % de FTP.
const zone = (p) =>
  p < 56 ? { n: 'Z1', c: 'var(--gray)' }
    : p < 76 ? { n: 'Z2', c: 'var(--blue)' }
      : p < 88 ? { n: 'Z3', c: 'var(--green)' }
        : p < 106 ? { n: p < 95 ? 'SS' : 'Z4', c: 'var(--yellow)' }
          : p < 121 ? { n: 'Z5', c: 'var(--orange)' }
            : { n: 'Z6', c: 'var(--red)' }

// Déplie les blocs en segments (pour le graphique).
function segments(blocks) {
  const out = []
  for (const b of blocks) {
    if (!b.repeat) {
      out.push({ min: b.min, pct: (b.lo + b.hi) / 2 })
      continue
    }
    for (let i = 0; i < b.repeat; i++) {
      if (b.work.micro) {
        for (let j = 0; j < b.work.micro.reps; j++) {
          out.push({ min: b.work.micro.on / 60, pct: (b.work.lo + b.work.hi) / 2 })
          out.push({ min: b.work.micro.off / 60, pct: b.work.micro.offPct })
        }
      } else out.push({ min: b.work.min, pct: (b.work.lo + b.work.hi) / 2 })
      if (i < b.repeat - 1) out.push({ min: b.rest.min, pct: (b.rest.lo + b.rest.hi) / 2 })
    }
  }
  return out
}

function Profile({ blocks }) {
  const segs = segments(blocks)
  const total = segs.reduce((t, s) => t + s.min, 0)
  const maxPct = Math.max(130, ...segs.map((s) => s.pct))
  let x = 0
  return (
    <svg className="ride-profile" viewBox="0 0 600 140" preserveAspectRatio="none" role="img" aria-label="Profil de la séance">
      <line x1="0" x2="600" y1={140 - (100 / maxPct) * 136} y2={140 - (100 / maxPct) * 136} className="ftp-line" />
      {segs.map((s, i) => {
        const w = (s.min / total) * 600
        const h = (s.pct / maxPct) * 136
        const r = <rect key={i} x={x} y={140 - h} width={Math.max(w - 0.6, 0.6)} height={h} rx="1.5" fill={zone(s.pct).c} />
        x += w
        return r
      })}
    </svg>
  )
}

const watts = (ftp, b) => `${Math.round((ftp * b.lo) / 100)}–${Math.round((ftp * b.hi) / 100)} W`
const len = (min) => (min < 1 ? `${Math.round(min * 60)} s` : fmtDuration(min) || `${min} min`)

export default function RideView() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [data, setData] = useState(null)
  const [form, setForm] = useState({ duration_min: '', avg_power: '', rpe: null, note: '' })
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    const session = await getSession(id)
    if (!session) return setData({ missing: true })
    const [settings, log] = await Promise.all([loadSettings(), rideLogFor(id)])
    setData({ session, settings, log })
    setForm((f) => ({ ...f, duration_min: f.duration_min || String(session.duration_min || '') }))
  }, [id])

  useEffect(() => {
    load()
  }, [load])

  if (!data) return <div className="page"><BackBar /><p className="muted-line">Chargement…</p></div>
  if (data.missing) {
    return <div className="page"><BackBar /><p className="muted-line">Cette séance n’existe plus : la semaine a sans doute été réorganisée.</p></div>
  }

  const { session, settings, log } = data
  const ftp = Number(settings.ftp) || 210
  const info = weekInfo(session.week_start)
  const blocks = rideBlocks(session.template_key, info.inPhase, session.duration_min)
  const total = blocksDuration(blocks)
  const d = parseDay(session.date)
  const ride = RIDES[session.template_key]

  async function save(e) {
    e.preventDefault()
    setBusy(true)
    await logRide(session, form)
    await load()
    setBusy(false)
  }

  async function toggleSkip() {
    setBusy(true)
    await setSessionStatus(session.id, session.status === 'skipped' ? 'planned' : 'skipped')
    navigate('/sport')
  }

  function zwift() {
    const name = `Life – ${session.label}`
    const file = `life-${session.date}-${session.template_key}.zwo`
    downloadZwo({ name, description: `Séance prévue le ${session.date}. FTP ${ftp} W.`, blocks }, file)
  }

  return (
    <div className="page workout">
      <BackBar />
      <header className="session-head">
        <KindIcon kind="velo" size={52} />
        <h1 className="doc-title">{session.label}</h1>
        <dl className="props">
          <div className="prop">
            <dt>Quand</dt>
            <dd>{DAY_NAMES[(d.getDay() + 6) % 7]} {d.getDate()} · {session.start_time || '—'}</dd>
          </div>
          <div className="prop"><dt>Durée</dt><dd>{fmtDuration(total)}</dd></div>
          <div className="prop"><dt>FTP</dt><dd>{ftp} W</dd></div>
          {(VARIANTS[session.variant]?.label || session.status !== 'planned') && (
            <div className="prop">
              <dt>Statut</dt>
              <dd className="tags"><VariantTag variant={session.variant} /><StatusTag status={session.status} /></dd>
            </div>
          )}
        </dl>
      </header>

      {session.note && (
        <div className="callout">
          <span className="callout-icon"><Icon name="info" size={20} /></span>
          <p className="callout-text">{session.note}</p>
        </div>
      )}

      <div className="ride-card">
        <Profile blocks={blocks} />
        <div className="ride-legend">
          <span>0</span>
          <span>Ligne pointillée = FTP</span>
          <span>{fmtDuration(total)}</span>
        </div>
      </div>

      <h2 className="group-title">Déroulé</h2>
      <ul className="group">
        {blocks.map((b, i) =>
          b.repeat ? (
            <li key={i} className="block-row">
              <span className="block-dot" style={{ background: zone((b.work.lo + b.work.hi) / 2).c }} />
              <span className="block-main">
                <strong>{b.repeat} × {b.work.label}</strong>
                <span>
                  {b.work.micro
                    ? `séries de ${fmtClock(b.work.min * 60)} à ${watts(ftp, b.work)} les 30 s fortes`
                    : `${len(b.work.min)} à ${watts(ftp, b.work)}`}
                  {' · '}récup {len(b.rest.min)} à {watts(ftp, b.rest)}
                </span>
              </span>
            </li>
          ) : (
            <li key={i} className="block-row">
              <span className="block-dot" style={{ background: zone((b.lo + b.hi) / 2).c }} />
              <span className="block-main">
                <strong>{b.label}</strong>
                <span>{len(b.min)} à {watts(ftp, b)}</span>
              </span>
            </li>
          )
        )}
      </ul>
      {ride?.hard && <p className="group-foot">Cadence libre, 85–95 tr/min. Si tu ne tiens pas la puissance, baisse de 5 % plutôt que d’arrêter.</p>}

      <button className="btn-secondary" onClick={zwift}>
        <Icon name="download" size={18} stroke={2} /> Télécharger pour Zwift
      </button>
      <p className="group-foot">
        Sur Mac : mets le fichier dans Documents › Zwift › Workouts › (ton numéro), puis relance Zwift. Il apparaît dans « Custom Workouts ».
      </p>

      <h2 className="group-title">Après la sortie</h2>
      {log ? (
        <ul className="group">
          <li className="row"><span className="row-label">Durée</span><span className="row-value">{log.duration_min ? fmtDuration(log.duration_min) : '—'}</span></li>
          <li className="row"><span className="row-label">Puissance moyenne</span><span className="row-value">{log.avg_power ? `${log.avg_power} W` : '—'}</span></li>
          <li className="row"><span className="row-label">Ressenti</span><span className="row-value">{log.rpe ? `${log.rpe}/10` : '—'}</span></li>
          {log.note && <li className="row"><span className="row-label">{log.note}</span></li>}
        </ul>
      ) : (
        <form onSubmit={save}>
          <ul className="group">
            <li className="row row-field">
              <label className="row-label" htmlFor="ride-dur">Durée (min)</label>
              <input id="ride-dur" inputMode="numeric" value={form.duration_min} onChange={(e) => setForm({ ...form, duration_min: e.target.value })} />
            </li>
            <li className="row row-field">
              <label className="row-label" htmlFor="ride-pw">Puissance moyenne (W)</label>
              <input id="ride-pw" inputMode="numeric" placeholder="facultatif" value={form.avg_power} onChange={(e) => setForm({ ...form, avg_power: e.target.value })} />
            </li>
            <li className="row rpe-row">
              <span className="row-label">Ressenti</span>
              <div className="segmented small" role="radiogroup" aria-label="Ressenti de 1 à 10">
                {[2, 4, 6, 7, 8, 9, 10].map((v) => (
                  <button type="button" key={v} role="radio" aria-checked={form.rpe === v} className={form.rpe === v ? 'is-on' : ''} onClick={() => setForm({ ...form, rpe: v })}>
                    {v}
                  </button>
                ))}
              </div>
            </li>
            <li className="row row-field">
              <label className="row-label" htmlFor="ride-note">Note</label>
              <input id="ride-note" placeholder="facultatif" value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} />
            </li>
          </ul>
          <p className="group-foot">Ressenti : 2 = très facile, 6 = dur mais tenable, 10 = à fond.</p>
          <button className="btn-primary" type="submit" disabled={busy}>Marquer comme faite</button>
          <button className="btn-plain" type="button" onClick={toggleSkip} disabled={busy}>
            {session.status === 'skipped' ? 'Remettre au planning' : 'Je ne la fais pas cette semaine'}
          </button>
        </form>
      )}
    </div>
  )
}
