import { Link } from 'react-router-dom'
import { MODULES } from '../modules'
import { useProfile } from '../lib/profile'
import { greeting, longDate } from '../lib/dates'
import Calendar from '../modules/agenda/Calendar'

// Accueil : le calendrier, puis les blocs du jour de chaque espace (registre src/modules.js).
// On passe d'un espace à l'autre avec l'île en bas de l'écran (Layout.jsx).
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

      <Calendar />

      {MODULES.filter((m) => m.homeWidget).sort((a, b) => (a.homeOrder ?? 10) - (b.homeOrder ?? 10)).map((m) => {
        const Widget = m.homeWidget
        return <Widget key={m.id} />
      })}

      {profile && !name && (
        <p className="hint">
          Ajoute ton prénom dans les <Link to="/reglages">réglages</Link> pour personnaliser l’accueil.
        </p>
      )}
    </div>
  )
}
