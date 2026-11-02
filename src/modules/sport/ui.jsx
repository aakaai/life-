// Petits éléments d'interface partagés par les écrans du module Sport.
import { Link } from 'react-router-dom'
import Icon from '../../components/Icon'
import { VARIANTS } from './data'

export const KIND_COLOR = { muscu: 'var(--orange)', velo: 'var(--blue)' }
export const DAY_NAMES = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche']

export function KindIcon({ kind, size = 34 }) {
  return (
    <span className="mod-icon" style={{ '--c': KIND_COLOR[kind], width: size, height: size }}>
      <Icon name={kind === 'muscu' ? 'dumbbell' : 'sport'} size={Math.round(size * 0.58)} stroke={1.9} />
    </span>
  )
}

export function VariantTag({ variant }) {
  const v = VARIANTS[variant]
  if (!v?.label) return null
  return <span className="tag tag-variant">{v.label}</span>
}

export function StatusTag({ status }) {
  if (status === 'done') return <span className="tag tag-live">Faite</span>
  if (status === 'missed') return <span className="tag tag-danger">Ratée</span>
  if (status === 'skipped') return <span className="tag">Sautée</span>
  if (status === 'unplaced') return <span className="tag">Pas casée</span>
  return null
}

export function BackBar({ to = '/sport', label = 'Semaine', children }) {
  return (
    <div className="back-bar">
      <Link to={to} className="back-link">
        <Icon name="back" size={20} stroke={2} />
        {label}
      </Link>
      <div className="back-bar-right">{children}</div>
    </div>
  )
}

export function Stepper({ value, onChange, step = 1, min = 0, max = 999, unit, label }) {
  const clamp = (v) => Math.min(max, Math.max(min, Math.round(v * 100) / 100))
  return (
    <div className="stepper" role="group" aria-label={label}>
      <button type="button" className="stepper-btn" aria-label={`Moins (${label})`} onClick={() => onChange(clamp(value - step))} disabled={value <= min}>
        <Icon name="minus" size={18} stroke={2.2} />
      </button>
      <span className="stepper-value">
        <input
          inputMode="decimal"
          aria-label={label}
          value={value}
          onChange={(e) => {
            const v = Number(e.target.value.replace(',', '.'))
            if (!Number.isNaN(v)) onChange(v)
          }}
          onBlur={() => onChange(clamp(value))}
        />
        {unit && <small>{unit}</small>}
      </span>
      <button type="button" className="stepper-btn" aria-label={`Plus (${label})`} onClick={() => onChange(clamp(value + step))} disabled={value >= max}>
        <Icon name="plus" size={18} stroke={2.2} />
      </button>
    </div>
  )
}

export const fmtDuration = (min) => {
  if (!min) return ''
  const h = Math.floor(min / 60)
  const m = Math.round(min % 60)
  return h ? `${h} h${m ? String(m).padStart(2, '0') : ''}` : `${m} min`
}

export const fmtClock = (sec) => {
  const s = Math.max(0, Math.round(sec))
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}
