import { useEffect, useMemo, useState } from 'react'
import Icon from '../../components/Icon'
import { ColumnChart, LineChart, ChartCard, shortDate, nf } from '../../components/charts'
import { loadProgress, addFtpTest, removeFtpTest } from './api'
import { RANGES, weeksFor, ftpTimeline, rideEntries, weekly, strengthSeries, workoutTotals, records, regularity, compare } from './stats'
import { keyOf, parseDay } from './planner'
import { SportNav, fmtDuration } from './ui'

const RANGE_KEY = 'life:sport-range'
const fmtHours = (h) => {
  const m = Math.round(h * 60)
  if (!m) return '0 h'
  return m < 60 ? `${m} min` : `${Math.floor(m / 60)} h${m % 60 ? ` ${String(m % 60).padStart(2, '0')}` : ''}`
}
const fmtTons = (kg) => (kg >= 1000 ? `${nf(kg / 1000, 1)} t` : `${nf(kg)} kg`)
const signed = (v, f) => `${v > 0 ? '+' : v < 0 ? '−' : ''}${f(Math.abs(v))}`
const weekLabel = (w) => `Semaine du ${shortDate(w)}`

// Progrès : des graphiques pour suivre le vélo, la muscu, la régularité et le poids.
export default function ProgressView() {
  const [data, setData] = useState(null)
  const [error, setError] = useState('')
  const [range, setRange] = useState(() => {
    try {
      return localStorage.getItem(RANGE_KEY) || '12w'
    } catch {
      return '12w'
    }
  })
  const [veloMetric, setVeloMetric] = useState('hours')
  const [exKey, setExKey] = useState(null)
  const [ftpOpen, setFtpOpen] = useState(false)

  async function load() {
    try {
      setData(await loadProgress())
    } catch (e) {
      setError(e.message)
    }
  }
  useEffect(() => {
    load()
  }, [])

  function pickRange(k) {
    setRange(k)
    try {
      localStorage.setItem(RANGE_KEY, k)
    } catch {
      /* stockage indisponible : on garde le choix pour cette visite */
    }
  }

  const v = useMemo(() => (data ? compute(data, range) : null), [data, range])

  if (error) return <Frame><p className="group-foot is-error">{error}</p></Frame>
  if (!v) return <Frame><p className="muted-line">Chargement…</p></Frame>

  const ex = v.series[exKey] || v.series[v.records[0]?.key]
  const exPoints = ex ? ex.points.filter((p) => p.date >= v.from) : []
  const exFmt = (val) => `${nf(val, ex?.unit === 'kg' ? 1 : 0)} ${ex?.unit === 'rép.' ? 'rép.' : ex?.unit}`

  return (
    <Frame>
      <div className="chips left progress-ranges" role="group" aria-label="Période">
        {RANGES.map((r) => (
          <button key={r.key} type="button" className={range === r.key ? 'chip is-on' : 'chip'} aria-pressed={range === r.key} onClick={() => pickRange(r.key)}>
            {r.label}
          </button>
        ))}
      </div>

      {v.isEmpty && (
        <div className="callout tip">
          Tes graphiques se rempliront au fil des séances : chaque série muscu enregistrée, chaque sortie vélo notée et chaque pesée du samedi y apparaîtront.
        </div>
      )}

      <div className="kpis">
        <Kpi label="Séances faites" value={v.reg.planned ? `${v.reg.done} / ${v.reg.planned}` : `${v.reg.done}`}
          sub={v.reg.planned ? `${Math.round((v.reg.done / v.reg.planned) * 100)} % de régularité` : 'Aucune séance prévue'} />
        <Kpi label="Vélo" value={fmtHours(v.velo.hours.now)} sub={deltaText(v.velo.hours, fmtHours)} />
        <Kpi label="Énergie vélo" value={`${nf(v.velo.kj.now)} kJ`} sub={deltaText(v.velo.kj, (x) => `${nf(x)} kJ`)} />
        <Kpi label="Charge muscu" value={fmtTons(v.muscu.tonnage.now)} sub={`${v.muscu.count} séance${v.muscu.count > 1 ? 's' : ''}`} />
        <Kpi label="FTP" value={`${v.ftp.current} W`} sub={v.wkg ? `${nf(v.wkg, 2)} W/kg` : 'Ajoute une pesée pour les W/kg'}
          action={<button type="button" className="link-btn" onClick={() => setFtpOpen(true)}>Nouveau test</button>} />
      </div>

      <h2 className="group-title progress-title"><Icon name="sport" size={16} /> Vélo</h2>
      <div className="chart-grid">
        <ChartCard
          title={veloMetric === 'hours' ? 'Temps de selle par semaine' : 'Énergie par semaine'}
          sub={veloMetric === 'hours' ? 'Toutes les sorties enregistrées' : 'kJ dépensés (estimés sans capteur de puissance)'}
          actions={
            <div className="segmented small chart-switch">
              <button type="button" className={veloMetric === 'hours' ? 'is-on' : ''} onClick={() => setVeloMetric('hours')}>Heures</button>
              <button type="button" className={veloMetric === 'kj' ? 'is-on' : ''} onClick={() => setVeloMetric('kj')}>kJ</button>
            </div>
          }
          empty={v.ridesIn.length ? null : 'Pas encore de sortie sur cette période. Note ta sortie depuis la séance vélo pour la voir ici.'}
          table={{
            head: ['Semaine', 'Sorties', 'Temps', 'Énergie'],
            rows: v.velo.weeks.filter((w) => w.count).map((w) => [shortDate(w.week), w.count, fmtHours(w.hours), `${nf(w.kj)} kJ`])
          }}
        >
          <ColumnChart
            color="var(--c-velo)"
            ariaLabel={veloMetric === 'hours' ? 'Heures de vélo par semaine' : 'Énergie vélo par semaine'}
            format={veloMetric === 'hours' ? fmtHours : (x) => `${nf(x)} kJ`}
            data={v.velo.weeks.map((w) => ({
              key: w.week,
              label: shortDate(w.week),
              value: veloMetric === 'hours' ? w.hours : w.kj,
              tip: (
                <>
                  <strong>{veloMetric === 'hours' ? fmtHours(w.hours) : `${nf(w.kj)} kJ`}</strong>
                  <span>{weekLabel(w.week)} · {w.count} sortie{w.count > 1 ? 's' : ''}</span>
                </>
              )
            }))}
          />
        </ChartCard>

        <ChartCard
          title="Puissance moyenne et FTP"
          sub="Chaque point est une sortie avec capteur de puissance"
          value={v.powerPoints.length ? `${v.powerPoints[v.powerPoints.length - 1].value} W` : null}
          empty={v.powerPoints.length || v.ftpPoints.length > 1 ? null : 'Indique la puissance moyenne en notant tes sorties Zwift pour suivre ta forme. Ta FTP actuelle est de ' + v.ftp.current + ' W.'}
          table={{
            head: ['Date', 'Séance', 'Durée', 'Puissance', '% FTP', 'RPE'],
            rows: [...v.ridesIn].reverse().map((r) => [shortDate(r.date), r.name, fmtDuration(r.min), r.power ? `${r.power} W` : '—', r.intensity ? `${Math.round(r.intensity * 100)} %` : '—', r.rpe ?? '—'])
          }}
        >
          <LineChart
            ariaLabel="Puissance moyenne par sortie et FTP"
            from={v.from}
            to={v.today}
            format={(x) => `${nf(x)} W`}
            series={[
              ...(v.powerPoints.length ? [{ name: 'Puissance moyenne', color: 'var(--c-velo)', points: v.powerPoints }] : []),
              { name: 'FTP', color: 'var(--c-context)', points: v.ftpPoints, step: true }
            ]}
          />
        </ChartCard>
      </div>

      <h2 className="group-title progress-title"><Icon name="dumbbell" size={16} /> Musculation</h2>
      <div className="chart-grid">
        <ChartCard
          title={ex ? ex.name : 'Progression par exercice'}
          sub={ex ? `${ex.metric} à chaque séance` : null}
          value={exPoints.length ? exFmt(exPoints[exPoints.length - 1].value) : null}
          actions={
            v.records.length > 1 && (
              <div className="chips left cat-chips ex-chips" role="group" aria-label="Exercice">
                {v.records.map((r) => (
                  <button key={r.key} type="button" className={ex?.key === r.key ? 'chip is-on' : 'chip'} onClick={() => setExKey(r.key)}>
                    {r.name}
                  </button>
                ))}
              </div>
            )
          }
          empty={exPoints.length ? null : ex ? 'Pas de séance pour cet exercice sur cette période.' : 'Termine une séance muscu pour voir tes charges progresser ici.'}
          table={{
            head: ['Date', ex?.metric || 'Valeur', 'Détail'],
            rows: [...exPoints].reverse().map((p) => [shortDate(p.date), exFmt(p.value), p.detail])
          }}
        >
          {exPoints.length > 0 && (
            <LineChart
              ariaLabel={`${ex.metric} – ${ex.name}`}
              from={v.from}
              to={v.today}
              format={exFmt}
              series={[{ name: ex.metric, color: 'var(--c-muscu)', points: exPoints.map((p) => ({ ...p, tip: p.detail })) }]}
            />
          )}
        </ChartCard>

        <ChartCard
          title="Charge soulevée par semaine"
          sub="kg × répétitions, toutes les séries avec haltères"
          empty={v.muscu.count ? null : 'Aucune séance muscu terminée sur cette période.'}
          table={{
            head: ['Semaine', 'Séances', 'Séries', 'Charge'],
            rows: v.muscu.weeks.filter((w) => w.count).map((w) => [shortDate(w.week), w.count, w.sets, fmtTons(w.tonnage)])
          }}
        >
          <ColumnChart
            color="var(--c-muscu)"
            ariaLabel="Charge soulevée par semaine"
            format={fmtTons}
            data={v.muscu.weeks.map((w) => ({
              key: w.week,
              label: shortDate(w.week),
              value: w.tonnage,
              tip: (
                <>
                  <strong>{fmtTons(w.tonnage)}</strong>
                  <span>{weekLabel(w.week)} · {w.sets} série{w.sets > 1 ? 's' : ''}</span>
                </>
              )
            }))}
          />
        </ChartCard>
      </div>

      {v.records.length > 0 && (
        <>
          <h3 className="group-title">Records</h3>
          <ul className="group records">
            {v.records.map((r) => (
              <li key={r.key} className="row">
                <div className="row-main">
                  <span className="row-label">{r.name}</span>
                  <span className="row-sub">{r.sessions} séance{r.sessions > 1 ? 's' : ''} · record le {shortDate(r.best.date)}</span>
                </div>
                <div className="record-value">
                  <strong>{nf(r.best.value, r.unit === 'kg' ? 1 : 0)} {r.unit}</strong>
                  {r.gain > 0 && <span className="tag tag-live">{signed(r.gain, (x) => nf(x, r.unit === 'kg' ? 1 : 0))} {r.unit}</span>}
                </div>
              </li>
            ))}
          </ul>
          <p className="group-foot">Haltères : 1RM estimé, la charge que tu pourrais soulever une fois (formule d’Epley). Poids du corps : répétitions totales. Gainage : meilleur temps.</p>
        </>
      )}

      <h2 className="group-title progress-title"><Icon name="check" size={16} /> Régularité et poids</h2>
      <div className="chart-grid">
        <ChartCard
          title="Séances faites par semaine"
          sub="Colonne pleine : faites · fond clair : prévues"
          value={v.reg.planned ? `${Math.round((v.reg.done / v.reg.planned) * 100)} %` : null}
          empty={v.reg.planned || v.reg.done ? null : 'Aucune séance prévue sur cette période.'}
          table={{
            head: ['Semaine', 'Faites', 'Prévues'],
            rows: v.regWeeks.filter((w) => w.planned || w.done).map((w) => [shortDate(w.week), w.done, w.planned])
          }}
        >
          <ColumnChart
            color="var(--c-1)"
            ariaLabel="Séances faites et prévues par semaine"
            format={(x) => nf(x)}
            labelMax={false}
            data={v.regWeeks.map((w) => ({
              key: w.week,
              label: shortDate(w.week),
              value: w.done,
              track: w.planned,
              tip: (
                <>
                  <strong>{w.done} / {w.planned}</strong>
                  <span>{weekLabel(w.week)} · faites / prévues</span>
                </>
              )
            }))}
          />
        </ChartCard>

        <ChartCard
          title="Poids"
          sub="Pesées du module Alimentation"
          value={v.weights.length ? `${nf(v.weights[v.weights.length - 1].value, 1)} kg` : null}
          empty={v.weights.length ? null : 'Pas de pesée sur cette période. Pèse-toi le samedi dans Alimentation › Poids.'}
          table={{ head: ['Date', 'Poids'], rows: [...v.weights].reverse().map((w) => [shortDate(w.date), `${nf(w.value, 1)} kg`]) }}
        >
          {v.weights.length > 0 && (
            <LineChart ariaLabel="Poids" from={v.from} to={v.today} format={(x) => `${nf(x, 1)} kg`}
              series={[{ name: 'Poids', color: 'var(--c-1)', points: v.weights }]} />
          )}
        </ChartCard>
      </div>

      {ftpOpen && (
        <FtpSheet
          tests={data.ftp.rows}
          missing={data.ftp.missing}
          current={v.ftp.current}
          onClose={() => setFtpOpen(false)}
          onDone={() => {
            setFtpOpen(false)
            load()
          }}
          onChange={load}
        />
      )}
    </Frame>
  )
}

function Frame({ children }) {
  return (
    <div className="page sport progress">
      <h1 className="large-title">Sport</h1>
      <SportNav />
      {children}
    </div>
  )
}

function Kpi({ label, value, sub, action }) {
  return (
    <div className="kpi">
      <span className="kpi-label">{label}</span>
      <strong className="kpi-value">{value}</strong>
      {sub && <span className="kpi-sub">{sub}</span>}
      {action}
    </div>
  )
}

function deltaText({ now, before }, f) {
  if (!before && !now) return 'Rien sur cette période'
  if (!before) return 'Rien sur la période d’avant'
  const d = now - before
  return `${signed(d, f)} vs période d’avant`
}

/* ---------- Calculs ---------- */

function compute(data, range) {
  const now = new Date()
  const today = keyOf(now)
  const firstDate = [
    data.rides[0]?.date,
    data.workouts[0]?.started_at && keyOf(new Date(data.workouts[0].started_at)),
    data.sessions.find((s) => s.status === 'done')?.date,
    data.weights[0]?.date
  ].filter(Boolean).sort()[0]
  const weeks = weeksFor(range, now, firstDate)
  const from = weeks[0]

  // FTP
  const ftp = ftpTimeline(data.ftp.rows, data.settings.ftp)
  const ftpPoints = [{ date: from, value: ftp.at(from) }, ...ftp.rows.filter((r) => r.date > from).map((r) => ({ date: r.date, value: Number(r.ftp) }))]

  // Vélo
  const rides = rideEntries(data.rides, ftp.at)
  const ridesIn = rides.filter((r) => r.date >= from)
  const hoursW = weekly(weeks, rides, (r) => r.date, (r) => r.min / 60)
  const kjW = weekly(weeks, rides, (r) => r.date, (r) => r.kj)
  const countW = weekly(weeks, rides, (r) => r.date, () => 1)
  const powerPoints = ridesIn
    .filter((r) => r.power)
    .map((r) => ({
      date: r.date,
      value: r.power,
      tip: `${r.name} · ${fmtDuration(r.min)}${r.intensity ? ` · ${Math.round(r.intensity * 100)} % FTP` : ''}`
    }))
  // une seule valeur par jour (deux sorties le même jour : moyenne)
  const byDay = {}
  for (const p of powerPoints) (byDay[p.date] ||= []).push(p)
  const powerDaily = Object.values(byDay).map((ps) => (ps.length === 1 ? ps[0] : { ...ps[0], value: Math.round(ps.reduce((t, p) => t + p.value, 0) / ps.length), tip: `${ps.length} sorties ce jour-là` }))

  // Muscu
  const series = strengthSeries(data.workouts, data.sets)
  const recs = records(series)
  const totals = workoutTotals(data.workouts, data.sets)
  const tonW = weekly(weeks, totals, (t) => t.date, (t) => t.tonnage)
  const setsW = weekly(weeks, totals, (t) => t.date, (t) => t.sets)
  const wkCountW = weekly(weeks, totals, (t) => t.date, () => 1)

  // Régularité
  const regWeeks = regularity(weeks, data.sessions, today)
  const reg = regWeeks.reduce((a, w) => ({ done: a.done + w.done, planned: a.planned + w.planned }), { done: 0, planned: 0 })

  // Poids
  const weights = data.weights.filter((w) => w.date >= from).map((w) => ({ date: w.date, value: Number(w.kg) }))
  const lastWeight = data.weights.length ? Number(data.weights[data.weights.length - 1].kg) : null

  return {
    today,
    from,
    weeks,
    ftp,
    ftpPoints,
    wkg: lastWeight ? ftp.current / lastWeight : null,
    ridesIn,
    powerPoints: powerDaily.sort((a, b) => (a.date < b.date ? -1 : 1)),
    velo: {
      weeks: weeks.map((w, i) => ({ week: w, hours: hoursW[i].value, kj: kjW[i].value, count: countW[i].value })),
      hours: compare(rides, weeks, (r) => r.date, (r) => r.min / 60),
      kj: compare(rides, weeks, (r) => r.date, (r) => r.kj)
    },
    series,
    records: recs,
    muscu: {
      weeks: weeks.map((w, i) => ({ week: w, tonnage: tonW[i].value, sets: setsW[i].value, count: wkCountW[i].value })),
      tonnage: compare(totals, weeks, (t) => t.date, (t) => t.tonnage),
      count: totals.filter((t) => t.date >= from).length
    },
    regWeeks,
    reg,
    weights,
    isEmpty: !data.rides.length && !totals.length && !data.weights.length && !reg.done
  }
}

/* ---------- Nouveau test FTP ---------- */

function FtpSheet({ tests, missing, current, onClose, onDone, onChange }) {
  const [f, setF] = useState({ date: keyOf(new Date()), avg20: '', ftp: String(current) })
  const [error, setError] = useState('')
  async function submit(e) {
    e.preventDefault()
    const ftp = Math.round(Number(String(f.ftp).replace(',', '.')))
    if (!ftp || ftp < 50 || ftp > 600) return setError('Indique ta FTP en watts (entre 50 et 600).')
    try {
      await addFtpTest({ date: f.date, ftp, note: f.avg20 ? `Test 20 min : ${f.avg20} W` : null })
      onDone()
    } catch (err) {
      setError(missing ? 'Exécute d’abord 008_progres_ftp.sql dans Supabase.' : `Échec : ${err.message}`)
    }
  }
  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div className="sheet form-sheet" role="dialog" aria-label="Nouveau test FTP" onClick={(e) => e.stopPropagation()}>
        <form onSubmit={submit}>
          <p className="sheet-title">Nouveau test FTP</p>
          <ul className="group">
            <li className="row row-field">
              <label className="row-label" htmlFor="ftp-20">Moyenne sur 20 min</label>
              <input id="ftp-20" inputMode="numeric" placeholder="facultatif" value={f.avg20}
                onChange={(e) => {
                  const avg = Number(e.target.value)
                  setF({ ...f, avg20: e.target.value, ftp: avg ? String(Math.round(avg * 0.95)) : f.ftp })
                }} />
              <span className="row-value">W</span>
            </li>
            <li className="row row-field">
              <label className="row-label" htmlFor="ftp-v">FTP</label>
              <input id="ftp-v" inputMode="numeric" value={f.ftp} onChange={(e) => setF({ ...f, ftp: e.target.value })} />
              <span className="row-value">W</span>
            </li>
            <li className="row row-field">
              <label className="row-label" htmlFor="ftp-d">Date du test</label>
              <input id="ftp-d" type="date" value={f.date} onChange={(e) => setF({ ...f, date: e.target.value })} />
            </li>
          </ul>
          <p className="group-foot">Test de 20 min sur Zwift : ta FTP vaut 95 % de ta puissance moyenne. La nouvelle FTP règle aussi les zones de tes séances vélo.</p>
          {error && <p className="group-foot is-error">{error}</p>}
          <button className="btn-primary" type="submit">Enregistrer</button>
          <button type="button" className="btn-plain" onClick={onClose}>Annuler</button>
        </form>
        {tests.length > 0 && (
          <>
            <h3 className="group-title">Historique</h3>
            <ul className="group">
              {[...tests].reverse().map((t) => (
                <li key={t.id} className="row">
                  <div className="row-main">
                    <span className="row-label">{t.ftp} W</span>
                    <span className="row-sub">{parseDay(t.date).toLocaleDateString('fr-BE', { day: 'numeric', month: 'long', year: 'numeric' })}{t.note ? ` · ${t.note}` : ''}</span>
                  </div>
                  <button type="button" className="icon-btn small" aria-label={`Supprimer le test du ${shortDate(t.date)}`}
                    onClick={async () => { await removeFtpTest(t.id); onChange() }}>
                    <Icon name="close" size={16} />
                  </button>
                </li>
              ))}
            </ul>
          </>
        )}
      </div>
    </div>
  )
}
