// Éléments d'interface du module Alimentation.

export const fmt = (v, d = 0) => (Number(v) || 0).toLocaleString('fr-BE', { maximumFractionDigits: d })

// Anneaux façon Apple : calories (extérieur) et protéines (intérieur) ;
// avec `carbsTarget`, un 3e anneau jaune pour les glucides (planning).
export function Rings({ kcal, kcalTarget, protein, proteinTarget, carbs, carbsTarget, size = 128 }) {
  const three = carbsTarget != null
  const rings = three
    ? [
        { r: 55, v: kcal / (kcalTarget || 1), c: 'var(--green)' },
        { r: 41, v: protein / (proteinTarget || 1), c: 'var(--blue)' },
        { r: 27, v: carbs / (carbsTarget || 1), c: 'var(--yellow)' }
      ]
    : [
        { r: 54, v: kcal / (kcalTarget || 1), c: 'var(--green)' },
        { r: 38, v: protein / (proteinTarget || 1), c: 'var(--blue)' }
      ]
  const sw = three ? 12 : 13
  return (
    <svg width={size} height={size} viewBox="0 0 128 128" className="rings" aria-hidden="true">
      {rings.map(({ r, v, c }) => {
        const C = 2 * Math.PI * r
        const ratio = Math.min(1, Math.max(0, v))
        return (
          <g key={r}>
            <circle cx="64" cy="64" r={r} fill="none" stroke={c} strokeOpacity="0.16" strokeWidth={sw} />
            <circle
              cx="64" cy="64" r={r} fill="none" stroke={c} strokeWidth={sw} strokeLinecap="round"
              strokeDasharray={C} strokeDashoffset={C * (1 - ratio)} transform="rotate(-90 64 64)"
              style={{ transition: 'stroke-dashoffset .5s ease' }}
            />
          </g>
        )
      })}
    </svg>
  )
}

export function MacroBar({ label, value, target, color, unit = 'g' }) {
  const ratio = Math.min(1, (value || 0) / (target || 1))
  return (
    <div className="macro">
      <div className="macro-top">
        <span>{label}</span>
        <span><strong>{fmt(value)}</strong> / {fmt(target)} {unit}</span>
      </div>
      <div className="macro-bar"><span style={{ width: `${ratio * 100}%`, background: color }} /></div>
    </div>
  )
}

export function per100Line(item) {
  return `${fmt(item.kcal)} kcal · ${fmt(item.protein, 1)} g prot. · ${fmt(item.carbs, 1)} g gluc. · ${fmt(item.fat, 1)} g lip. pour 100 g`
}

// Onglets du module (façon Notion).
import { NavLink } from 'react-router-dom'

const TABS = [
  ['/alimentation', 'Aujourd’hui', true],
  ['/alimentation/planning', 'Planning'],
  ['/alimentation/recettes', 'Recettes'],
  ['/alimentation/courses', 'Courses'],
  ['/alimentation/poids', 'Poids']
]

export function FoodNav() {
  return (
    <nav className="food-nav" aria-label="Alimentation">
      {TABS.map(([to, label, end]) => (
        <NavLink key={to} to={to} end={end} className="food-tab">{label}</NavLink>
      ))}
    </nav>
  )
}

export const euro = (v) => `${(Number(v) || 0).toLocaleString('fr-BE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`
