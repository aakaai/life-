import { Link } from 'react-router-dom'
import { useProfile } from '../lib/profile'
import { greeting, longDate } from '../lib/dates'
import Calendar from '../modules/agenda/Calendar'
import TodayList from '../modules/accueil/TodayList'
import NextMeal from '../modules/accueil/NextMeal'
import HomeHabits from '../modules/accueil/HomeHabits'
import Kot from '../modules/accueil/Kot'

// Accueil (version A, 3 nov. ; v0.30.2) : à gauche les tâches du jour, les habitudes en cases, puis le prochain repas,
// à droite le calendrier du jour, en bas le calendrier semaine / mois.
// Sur téléphone : dans cet ordre, les uns sous les autres.
// v0.31 : « Retour au kot » en haut de la colonne de gauche (petite ligne en semaine, bloc à cocher le dimanche).
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
          <Kot />
          <TodayList />
          <HomeHabits />
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
