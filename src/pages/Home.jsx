import { Link } from 'react-router-dom'
import { MODULES } from '../modules'
import { useProfile } from '../lib/profile'
import { greeting, longDate } from '../lib/dates'
import ModuleIcon from '../components/ModuleIcon'

// Accueil : un bloc par espace de vie, à la manière des widgets iOS
// et des galeries Notion. Les blocs viennent du registre src/modules.js.
export default function Home() {
  const now = new Date()
  const { profile } = useProfile()
  const name = profile?.first_name?.trim()

  return (
    <div className="page home">
      <header className="home-head">
        <p className="home-date">{longDate(now)}</p>
        <h1 className="large-title">
          {greeting(now)}
          {name ? `, ${name}` : ''}
        </h1>
      </header>

      {MODULES.filter((m) => m.homeWidget).sort((a, b) => (a.homeOrder ?? 10) - (b.homeOrder ?? 10)).map((m) => {
        const Widget = m.homeWidget
        return <Widget key={m.id} />
      })}

      <section aria-labelledby="spaces-title">
        <h2 id="spaces-title" className="group-title">Mes espaces</h2>
        <ul className="tiles">
          {MODULES.map((m) => (
            <li key={m.id}>
              <Link to={m.path} className="tile" style={{ '--c': m.color }}>
                <ModuleIcon module={m} size={40} />
                <span className="tile-name">{m.label}</span>
                <span className="tile-summary">{m.summary}</span>
                <span className={m.component ? 'tag tag-live' : 'tag'}>
                  {m.component ? 'Ouvert' : 'À venir'}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      {profile && !name && (
        <p className="hint">
          Ajoute ton prénom dans les <Link to="/reglages">réglages</Link> pour personnaliser l’accueil.
        </p>
      )}
    </div>
  )
}
