import { useRef } from 'react'
import { NavLink } from 'react-router-dom'

export const euro = (v, { sign = false } = {}) => {
  const n = Number(v) || 0
  const s = Math.abs(n).toLocaleString('fr-BE', { minimumFractionDigits: n % 1 ? 2 : 0, maximumFractionDigits: 2 })
  return `${sign ? (n < 0 ? '− ' : '+ ') : n < 0 ? '− ' : ''}${s} €`
}

const TABS = [
  ['/budget', 'Mois', true],
  ['/budget/operations', 'Opérations'],
  ['/budget/comptes', 'Comptes'],
  ['/budget/abonnements', 'Abonnements']
]

export function BudgetNav() {
  return (
    <nav className="food-nav" aria-label="Budget">
      {TABS.map(([to, label, end]) => <NavLink key={to} to={to} end={end} className="food-tab">{label}</NavLink>)}
    </nav>
  )
}

// Appui long (0,5 s) ou clic simple.
export function useLongPress(onLong, onClick) {
  const timer = useRef(null)
  const fired = useRef(false)
  const start = () => {
    fired.current = false
    timer.current = setTimeout(() => {
      fired.current = true
      onLong()
    }, 500)
  }
  const stop = () => clearTimeout(timer.current)
  return {
    onPointerDown: start,
    onPointerUp: stop,
    onPointerLeave: stop,
    onPointerCancel: stop,
    onContextMenu: (e) => e.preventDefault(),
    onClick: () => {
      if (!fired.current) onClick()
    }
  }
}

export const fmtMonth = (mk) => {
  const [y, m] = mk.split('-').map(Number)
  const s = new Intl.DateTimeFormat('fr-BE', { month: 'long', year: 'numeric' }).format(new Date(y, m - 1, 1))
  return s.charAt(0).toUpperCase() + s.slice(1)
}
