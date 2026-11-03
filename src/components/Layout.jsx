import { NavLink, Outlet } from 'react-router-dom'
import { MODULES } from '../modules'
import Icon from './Icon'
import NativeBridge from './NativeBridge'

// Navigation : une « île » flottante en bas de l'écran (façon Dynamic Island),
// avec seulement les logos (à la couleur de chaque espace) — sur ordinateur comme sur téléphone,
// tous les espaces tiennent. L'espace ouvert est teinté et affiche son nom (sauf sur téléphone).
const ITEMS = [
  { id: 'home', label: 'Accueil', path: '/', icon: 'home', color: 'var(--text-2)', end: true },
  ...MODULES.map((m) => ({ id: m.id, label: m.label, path: m.path, icon: m.icon, color: m.color })),
  { id: 'reglages', label: 'Réglages', path: '/reglages', icon: 'settings', color: 'var(--text-2)' }
]

export default function Layout() {
  return (
    <div className="shell">
      <main className="content">
        <Outlet />
      </main>
      <NativeBridge />

      <nav className="island" aria-label="Navigation principale">
        {ITEMS.map((it) => (
          <NavLink key={it.id} to={it.path} end={it.end} className="island-btn" style={{ '--c': it.color }} aria-label={it.label} title={it.label}>
            <Icon name={it.icon} size={22} stroke={1.9} />
            <span className="island-label" aria-hidden="true">{it.label}</span>
          </NavLink>
        ))}
      </nav>
    </div>
  )
}
