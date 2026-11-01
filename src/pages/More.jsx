import { Link } from 'react-router-dom'
import { MODULES, MOBILE_PRIMARY } from '../modules'
import Icon from '../components/Icon'
import ModuleIcon from '../components/ModuleIcon'

// « Plus » sur téléphone : liste groupée façon iOS.
export default function More() {
  const others = MODULES.filter((m) => !MOBILE_PRIMARY.includes(m.id))
  return (
    <div className="page">
      <h1 className="large-title">Plus</h1>
      <h2 className="group-title">Espaces</h2>
      <ul className="group">
        {others.map((m) => (
          <li key={m.id}>
            <Link to={m.path} className="row">
              <ModuleIcon module={m} size={30} />
              <span className="row-label">{m.label}</span>
              <span className="row-chevron"><Icon name="chevron" size={16} stroke={2} /></span>
            </Link>
          </li>
        ))}
      </ul>
      <ul className="group">
        <li>
          <Link to="/reglages" className="row">
            <span className="mod-icon" style={{ '--c': 'var(--gray)', width: 30, height: 30 }}>
              <Icon name="settings" size={18} stroke={1.9} />
            </span>
            <span className="row-label">Réglages</span>
            <span className="row-chevron"><Icon name="chevron" size={16} stroke={2} /></span>
          </Link>
        </li>
      </ul>
    </div>
  )
}
