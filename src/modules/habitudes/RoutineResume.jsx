// Accueil · carte « Routine du matin / du soir » (v0.32) : pendant le créneau de la routine, s'il reste
// des habitudes, un bouton pour la commencer ou la reprendre. Disparaît quand tout est fait.
import { Link } from 'react-router-dom'
import Icon from '../../components/Icon'
import { ROUTINES, routineWindow, stepsLeft } from './routine'
import { routineSettings } from './routine-store'
import { useRoutine } from './RoutineView'
import { kindInfo } from '../sport/data'

const nameOf = (s) => (s.type === 'session' ? String(s.session.label || kindInfo(s.session.kind).short).split(' — ')[0] : s.habit.name)

export default function RoutineResume() {
  const which = routineWindow(new Date(), routineSettings().evening)
  if (!which) return null
  return <Card which={which} />
}

function Card({ which }) {
  const { steps } = useRoutine(which)
  if (!steps?.length) return null
  const left = stepsLeft(steps)
  const todo = steps.filter((s) => !s.done && !(s.type === 'session' && s.skipped))
  if (!todo.length) return null
  const done = steps.length - todo.length
  const rest = todo.map(nameOf)
  return (
    <section className="home-card rt-card" aria-label={ROUTINES[which].label}>
      <span className="rt-card-ico" aria-hidden="true"><Icon name={which === 'matin' ? 'sun' : 'moon'} size={20} stroke={1.9} /></span>
      <div className="rt-card-main">
        <strong>{ROUTINES[which].label}</strong>
        <small>{done} / {steps.length} · il reste {rest.slice(0, 2).join(', ')}{rest.length > 2 ? ` +${rest.length - 2}` : ''}</small>
      </div>
      <Link className="rt-card-go" to={`/habitudes/routine/${which}`}>{done || left < todo.length ? 'Reprendre' : 'Commencer'}</Link>
    </section>
  )
}
