// « Ta semaine » (v0.32) : grille 7 jours × habitudes, couleur de la catégorie, total à droite.
import { catColor } from './ui'
import { addDays } from './logic'
import { weekGrid } from './week'

const LETTERS = ['L', 'M', 'M', 'J', 'V', 'S', 'D']
const CELL = { done: 'fait', part: 'en partie', miss: 'pas fait', free: 'jour libre', off: 'pas prévu' }
const shortDate = (key) => new Date(`${key}T12:00:00`).toLocaleDateString('fr-BE', { day: 'numeric', month: 'short' }).replace('.', '')

/** Pourcentage de la semaine et de celle d'avant. */
export function weekStats(data, anyDay) {
  const { habits, categories, ctx } = data
  const grid = weekGrid(habits, ctx, anyDay, categories)
  const before = weekGrid(habits, ctx, addDays(grid.start, -7), categories)
  return { grid, before }
}

export function WeekSummary({ grid, before }) {
  const pct = grid.pct == null ? null : Math.round(grid.pct * 100)
  const diff = pct != null && before.pct != null ? pct - Math.round(before.pct * 100) : null
  return (
    <div className="wk-big">
      <strong>{pct == null ? '—' : `${pct} %`}</strong>
      <span>
        {diff == null ? `${grid.done} / ${grid.planned} tenues` : diff === 0 ? 'comme la semaine d’avant' : `${diff > 0 ? '+' : '−'}${Math.abs(diff)} % vs semaine d’avant`}
      </span>
    </div>
  )
}

export function WeekGrid({ grid, categories }) {
  const catById = Object.fromEntries((categories || []).map((c) => [c.id, c]))
  if (!grid.rows.length) return <p className="muted-line">Aucune habitude cette semaine.</p>
  return (
    <div className="wk-wrap">
      <table className="wk-grid">
        <caption className="visually-hidden">Habitudes de la semaine du {shortDate(grid.start)} au {shortDate(grid.end)}</caption>
        <thead>
          <tr>
            <th scope="col"><span className="visually-hidden">Habitude</span></th>
            {grid.days.map((d, i) => <th key={d} scope="col" title={shortDate(d)}>{LETTERS[i]}</th>)}
            <th scope="col"><span className="visually-hidden">Total</span></th>
          </tr>
        </thead>
        <tbody>
          {grid.rows.map((r) => (
            <tr key={r.habit.id} style={{ '--c': catColor(catById[r.habit.category_id]) }}>
              <th scope="row" className="wk-name">{r.habit.name}</th>
              {r.cells.map((c, i) => <td key={i} className={`wk-c is-${c}`} title={`${shortDate(grid.days[i])} : ${CELL[c]}`}><span className="visually-hidden">{CELL[c]}</span></td>)}
              <td className="wk-total">{r.counted ? `${r.done}/${r.planned}` : r.done}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="wk-legend" aria-hidden="true">
        <span><i className="is-done" />fait</span><span><i className="is-part" />en partie</span><span><i className="is-miss" />pas fait</span><span><i className="is-off" />pas prévu</span>
      </div>
    </div>
  )
}

export const weekRange = (grid) => `${shortDate(grid.start)} → ${shortDate(grid.end)}`
