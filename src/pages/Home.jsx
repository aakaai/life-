import { Link } from 'react-router-dom'
import { useProfile } from '../lib/profile'
import { greeting, longDate } from '../lib/dates'
import Calendar from '../modules/agenda/Calendar'
import TodayList from '../modules/accueil/TodayList'
import NextMeal from '../modules/accueil/NextMeal'

// Accueil (version A, 3 nov.) : à gauche ce qu'il y a à faire aujourd'hui puis le prochain repas,
// à droite le calendrier du jour, en bas le calendrier semaine / mois.
// Sur téléphone : dans cet ordre, les uns sous les autres.
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

      <div className="home-grid">
        <div className="home-left">
          <TodayList />
          <NextMeal />
        </div>
        <div className="home-right home-card">
          <Calendar variant="day" />
        </div>
      </div>

      <Calendar />

      {profile && !name && (
        <p className="hint">
          Ajoute ton prénom dans les <Link to="/reglages">réglages</Link> pour personnaliser l’accueil.
        </p>
      )}
    </div>
  )
}
