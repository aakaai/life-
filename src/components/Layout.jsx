import { NavLink, Outlet, useLocation } from 'react-router-dom'
import { MODULES, MOBILE_PRIMARY } from '../modules'
import Icon from './Icon'
import ModuleIcon from './ModuleIcon'
import NativeBridge from './NativeBridge'

// Ordinateur : barre latérale façon Notion (tous les blocs).
// Téléphone : barre d'onglets translucide façon iOS (Accueil + 3 blocs + Plus).
export default function Layout() {
  const primary = MODULES.filter((m) => MOBILE_PRIMARY.includes(m.id))
  // L'onglet « Plus » reste actif sur les pages qu'il contient.
  const { pathname } = useLocation()
  const morePaths = ['/plus', '/reglages', ...MODULES.filter((m) => !MOBILE_PRIMARY.includes(m.id)).map((m) => m.path)]
  const onMore = morePaths.some((p) => pathname === p || pathname.startsWith(`${p}/`))

  return (
    <div className="shell">
      <aside className="sidebar" aria-label="Navigation principale">
        <div className="workspace">
          <img src={`${import.meta.env.BASE_URL}favicon.svg`} alt="" width="22" height="22" />
          <span>Life</span>
        </div>
        <nav className="side-group">
          <NavLink to="/" end className="side-link">
            <span className="side-glyph"><Icon name="home" size={18} /></span>
            Accueil
          </NavLink>
        </nav>
        <p className="side-heading">Espaces</p>
        <nav className="side-group">
          {MODULES.map((m) => (
            <NavLink key={m.id} to={m.path} className="side-link">
              <ModuleIcon module={m} size={22} />
              {m.label}
            </NavLink>
          ))}
        </nav>
        <nav className="side-group side-bottom">
          <NavLink to="/reglages" className="side-link">
            <span className="side-glyph"><Icon name="settings" size={18} /></span>
            Réglages
          </NavLink>
        </nav>
      </aside>

      <main className="content">
        <Outlet />
      </main>
      <NativeBridge />

      <nav className="tabbar" aria-label="Navigation principale">
        <NavLink to="/" end className="tab">
          <Icon name="home" size={24} />
          <span>Accueil</span>
        </NavLink>
        {primary.map((m) => (
          <NavLink key={m.id} to={m.path} className="tab">
            <Icon name={m.icon} size={24} />
            <span>{m.label}</span>
          </NavLink>
        ))}
        <NavLink to="/plus" className={() => (onMore ? 'tab active' : 'tab')}>
          <Icon name="more" size={24} />
          <span>Plus</span>
        </NavLink>
      </nav>
    </div>
  )
}
