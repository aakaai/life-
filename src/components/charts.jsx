// Petits graphiques SVG faits maison (aucune bibliothèque) :
//   - ColumnChart : une colonne par période (ex. heures de vélo par semaine),
//     avec en option une « piste » derrière (ex. séances prévues).
//   - LineChart : une ou deux courbes dans le temps (ex. puissance et FTP).
// Règles : traits fins, grille discrète, info-bulle au survol / au clavier,
// et un tableau « Données » sous chaque graphique (rien n'est lisible qu'au survol).
import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react'
import { parseDay } from '../modules/sport/planner'
import { niceTicks } from './niceTicks'

export { niceTicks }

const fmtDay = new Intl.DateTimeFormat('fr-BE', { day: 'numeric', month: 'short' })
export const shortDate = (key) => fmtDay.format(parseDay(key)).replace('.', '')
export const nf = (v, d = 0) => (Number(v) || 0).toLocaleString('fr-BE', { maximumFractionDigits: d })

function useWidth() {
  const ref = useRef(null)
  const [w, setW] = useState(0)
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    setW(el.clientWidth)
    const ro = new ResizeObserver(([e]) => setW(Math.round(e.contentRect.width)))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])
  return [ref, w]
}

const tickLabel = (v) => (Math.abs(v) >= 10000 ? `${nf(v / 1000)} k` : nf(v, v % 1 ? 1 : 0))
const approxTextW = (s) => String(s).length * 6.6

function Tooltip({ x, width, children }) {
  const ref = useRef(null)
  const [w, setW] = useState(140)
  useLayoutEffect(() => {
    if (ref.current) setW(ref.current.offsetWidth)
  })
  // à côté du curseur (à droite, ou à gauche s'il n'y a pas la place)
  const left = x + 14 + w <= width ? x + 14 : Math.max(0, x - 14 - w)
  return (
    <div ref={ref} className="chart-tip" style={{ left }} role="status">
      {children}
    </div>
  )
}

// Navigation au clavier : flèches gauche/droite.
function useKeys(n, active, setActive) {
  return {
    tabIndex: 0,
    onFocus: () => active == null && setActive(n - 1),
    onBlur: () => setActive(null),
    onKeyDown: (e) => {
      if (e.key === 'ArrowLeft') setActive(Math.max(0, (active ?? n) - 1))
      else if (e.key === 'ArrowRight') setActive(Math.min(n - 1, (active ?? -1) + 1))
      else return
      e.preventDefault()
    }
  }
}

/**
 * Colonnes.
 * data : [{ key, label, value, track?, tip?: ReactNode }]
 */
export function ColumnChart({ data, color = 'var(--c-1)', height = 170, format = tickLabel, ariaLabel, labelMax = true }) {
  const [ref, width] = useWidth()
  const [active, setActive] = useState(null)
  const keys = useKeys(data.length, active, setActive)
  const max = Math.max(1, ...data.map((d) => Math.max(d.value || 0, d.track || 0)))
  const ticks = niceTicks(0, max, 3)
  const top = ticks[ticks.length - 1]
  const padL = Math.max(...ticks.map((t) => approxTextW(tickLabel(t)))) + 10
  const padT = 18
  const padB = 24
  const plotW = Math.max(10, width - padL - 4)
  const plotH = height - padT - padB
  const band = plotW / Math.max(1, data.length)
  const barW = Math.min(24, Math.max(4, band * 0.62))
  const y = (v) => padT + plotH - (v / top) * plotH
  const every = Math.max(1, Math.ceil((data.length * 46) / plotW))
  const maxIdx = data.reduce((m, d, i) => ((d.value || 0) > (data[m]?.value || 0) ? i : m), 0)

  return (
    <div className="chart" ref={ref}>
      {width > 0 && (
        <svg width={width} height={height} role="img" aria-label={ariaLabel} {...keys}>
          {ticks.map((t) => (
            <g key={t}>
              <line x1={padL} x2={width} y1={y(t)} y2={y(t)} className={t === 0 ? 'chart-base' : 'chart-gridline'} />
              <text x={padL - 8} y={y(t)} dy="0.32em" textAnchor="end" className="chart-axis">{tickLabel(t)}</text>
            </g>
          ))}
          {data.map((d, i) => {
            const cx = padL + band * i + band / 2
            const x = cx - barW / 2
            const h = Math.max(0, y(0) - y(d.value || 0))
            const th = d.track ? Math.max(0, y(0) - y(d.track)) : 0
            return (
              <g key={d.key} opacity={active != null && active !== i ? 0.55 : 1}>
                {th > 0 && <path d={colPath(x, y(0), barW, th)} className="chart-track" style={{ '--c': color }} />}
                {h > 0 && <path d={colPath(x, y(0), barW, h)} fill={color} />}
                {labelMax && i === maxIdx && d.value > 0 && (
                  <text x={cx} y={y(Math.max(d.value, d.track || 0)) - 6} textAnchor="middle" className="chart-label">{format(d.value)}</text>
                )}
                {(i % every === (data.length - 1) % every) && (
                  <text x={cx} y={height - 6} textAnchor="middle" className="chart-axis">{d.label}</text>
                )}
                <rect
                  x={padL + band * i} y={padT} width={band} height={plotH} fill="transparent"
                  onPointerEnter={() => setActive(i)} onPointerLeave={() => setActive(null)}
                  onClick={() => setActive(i)}
                />
              </g>
            )
          })}
        </svg>
      )}
      {active != null && data[active] && (
        <Tooltip x={padL + band * active + band / 2} width={width}>
          {data[active].tip || <><strong>{format(data[active].value)}</strong><span>{data[active].label}</span></>}
        </Tooltip>
      )}
    </div>
  )
}

// Colonne : coins arrondis (4 px) en haut, carrée sur la ligne de base.
function colPath(x, base, w, h) {
  const r = Math.min(4, h, w / 2)
  return `M${x},${base}V${base - h + r}Q${x},${base - h} ${x + r},${base - h}H${x + w - r}Q${x + w},${base - h} ${x + w},${base - h + r}V${base}Z`
}

/**
 * Courbes dans le temps.
 * series : [{ name, color, points: [{ date: 'AAAA-MM-JJ', value, tip? }], step?, muted? }]
 * La première série est la principale (aire légère, valeur au bout).
 */
export function LineChart({ series, height = 190, format = tickLabel, ariaLabel, zero = false, from, to }) {
  const [ref, width] = useWidth()
  const [active, setActive] = useState(null)
  const gid = useId().replace(/:/g, '')
  const all = series.flatMap((s) => s.points)
  const t = (k) => parseDay(k).getTime()
  const dates = [...new Set(series.filter((s) => !s.step).flatMap((s) => s.points.map((p) => p.date)))].sort()
  const keys = useKeys(dates.length, active, setActive)
  useEffect(() => setActive(null), [dates.length])

  let x0 = from ? t(from) : Math.min(...all.map((p) => t(p.date)))
  let x1 = to ? t(to) : Math.max(...all.map((p) => t(p.date)))
  if (x1 - x0 < 6 * 86400000) {
    x0 -= 3 * 86400000
    x1 += 3 * 86400000
  }
  const values = all.map((p) => p.value)
  let lo = Math.min(...values)
  let hi = Math.max(...values)
  const pad = Math.max((hi - lo) * 0.12, Math.abs(hi) * 0.04, 1)
  lo = zero ? 0 : lo - pad
  hi += pad
  const ticks = niceTicks(lo, hi, 3)
  const yLo = ticks[0]
  const yHi = ticks[ticks.length - 1]
  const padL = Math.max(...ticks.map((v) => approxTextW(tickLabel(v)))) + 10
  const main = series[0]
  const last = main.points[main.points.length - 1]
  const padR = last ? Math.min(56, approxTextW(format(last.value)) + 14) : 8
  const padT = 12
  const padB = 24
  const plotW = Math.max(10, width - padL - padR)
  const plotH = height - padT - padB
  const X = (k) => padL + ((t(k) - x0) / Math.max(1, x1 - x0)) * plotW
  const Y = (v) => padT + plotH - ((v - yLo) / Math.max(1e-9, yHi - yLo)) * plotH
  const nLabels = Math.max(2, Math.min(6, Math.floor(plotW / 78)))
  const xTicks = Array.from({ length: nLabels }, (_, i) => x0 + ((x1 - x0) * i) / (nLabels - 1))
  const toKey = (ms) => {
    const d = new Date(ms)
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  }
  const endKey = toKey(x1)

  const valueAt = (s, date) => {
    if (!s.step) return s.points.find((p) => p.date === date)
    let v = null
    for (const p of s.points) if (p.date <= date) v = p
    return v || s.points[0]
  }

  function pathOf(s) {
    const pts = [...s.points].sort((a, b) => (a.date < b.date ? -1 : 1))
    if (!pts.length) return ''
    if (s.step) {
      let d = `M${X(pts[0].date) < padL ? padL : X(pts[0].date)},${Y(pts[0].value)}`
      for (let i = 1; i < pts.length; i++) d += `H${X(pts[i].date)}V${Y(pts[i].value)}`
      return d + `H${X(endKey)}`
    }
    return pts.map((p, i) => `${i ? 'L' : 'M'}${X(p.date)},${Y(p.value)}`).join('')
  }

  function onMove(e) {
    if (!dates.length) return
    const box = e.currentTarget.getBoundingClientRect()
    const px = e.clientX - box.left
    let best = 0
    dates.forEach((d, i) => {
      if (Math.abs(X(d) - px) < Math.abs(X(dates[best]) - px)) best = i
    })
    setActive(best)
  }

  const activeDate = active != null ? dates[active] : null
  const single = series.filter((s) => !s.step).length === 1 && !series.some((s) => s.step)

  return (
    <div className="chart" ref={ref}>
      {series.length > 1 && (
        <div className="chart-legend">
          {series.map((s) => (
            <span key={s.name}><i style={{ background: s.color }} />{s.name}</span>
          ))}
        </div>
      )}
      {width > 0 && (
        <svg
          width={width} height={height} role="img" aria-label={ariaLabel} {...keys}
          onPointerMove={onMove} onPointerDown={onMove} onPointerLeave={() => setActive(null)}
        >
          <defs>
            <linearGradient id={`g${gid}`} x1="0" x2="0" y1="0" y2="1">
              <stop offset="0" stopColor={main.color} stopOpacity="0.14" />
              <stop offset="1" stopColor={main.color} stopOpacity="0.02" />
            </linearGradient>
          </defs>
          {ticks.map((v) => (
            <g key={v}>
              <line x1={padL} x2={width - padR + 6} y1={Y(v)} y2={Y(v)} className={v === yLo ? 'chart-base' : 'chart-gridline'} />
              <text x={padL - 8} y={Y(v)} dy="0.32em" textAnchor="end" className="chart-axis">{tickLabel(v)}</text>
            </g>
          ))}
          {xTicks.map((ms, i) => (
            <text key={ms} x={padL + (plotW * i) / (nLabels - 1)} y={height - 6} className="chart-axis"
              textAnchor={i === 0 ? 'start' : i === nLabels - 1 ? 'end' : 'middle'}>
              {shortDate(toKey(ms))}
            </text>
          ))}
          {single && main.points.length > 1 && (
            <path d={`${pathOf(main)}V${Y(yLo)}H${X(main.points[0].date)}Z`} fill={`url(#g${gid})`} />
          )}
          {[...series].reverse().map((s) => (
            <path key={s.name} d={pathOf(s)} fill="none" stroke={s.color} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
          ))}
          {activeDate && <line x1={X(activeDate)} x2={X(activeDate)} y1={padT} y2={padT + plotH} className="chart-cross" />}
          {series.filter((s) => !s.step).map((s) =>
            s.points
              .filter((p) => s.points.length <= 24 || p === s.points[s.points.length - 1] || p.date === activeDate)
              .map((p) => (
                <circle key={s.name + p.date} cx={X(p.date)} cy={Y(p.value)} r={p.date === activeDate ? 5 : 4}
                  fill={s.color} className="chart-dot" />
              ))
          )}
          {last && (
            <text x={X(last.date) + 9} y={Y(last.value)} dy="0.32em" className="chart-label">{format(last.value)}</text>
          )}
        </svg>
      )}
      {activeDate && (
        <Tooltip x={X(activeDate)} width={width}>
          {series.map((s) => {
            const p = valueAt(s, activeDate)
            if (!p) return null
            return (
              <div key={s.name} className="chart-tip-row">
                {series.length > 1 && <i style={{ background: s.color }} />}
                <strong>{format(p.value)}</strong>
                <span>{series.length > 1 ? s.name : ''}</span>
              </div>
            )
          })}
          <span>{shortDate(activeDate)}</span>
          {valueAt(main, activeDate)?.tip && <span>{valueAt(main, activeDate).tip}</span>}
        </Tooltip>
      )}
    </div>
  )
}

// Carte de graphique : titre, chiffre clé, graphique, puis le tableau des données.
export function ChartCard({ title, sub, value, actions, children, table, empty }) {
  return (
    <section className="chart-card">
      <header className="chart-head">
        <div>
          <h3>{title}</h3>
          {sub && <p>{sub}</p>}
        </div>
        {value != null && <strong className="chart-value">{value}</strong>}
      </header>
      {actions}
      {empty ? <p className="chart-empty">{empty}</p> : children}
      {!empty && table && table.rows.length > 0 && (
        <details className="chart-data">
          <summary>Données</summary>
          <div className="chart-table-wrap">
            <table>
              <thead><tr>{table.head.map((h) => <th key={h}>{h}</th>)}</tr></thead>
              <tbody>
                {table.rows.map((r, i) => (
                  <tr key={i}>{r.map((c, j) => <td key={j}>{c}</td>)}</tr>
                ))}
              </tbody>
            </table>
          </div>
        </details>
      )}
    </section>
  )
}
