// Éléments d'interface partagés du module Habitudes.
import { useCallback, useEffect, useState } from 'react'
import { NavLink } from 'react-router-dom'
import Icon from '../../components/Icon'
import { loadHabits, setLog } from './api'
import { scheduleReminderSync } from './native-sync'
import { makeContext, streak, progressLabel, challengeDay, FREQUENCIES } from './logic'

export const fmt = (v, d = 1) => (Number(v) || 0).toLocaleString('fr-BE', { maximumFractionDigits: d })
export const catColor = (cat) => (cat ? `var(--${cat.color || 'gray'})` : 'var(--pink)')
const fmtDay = new Intl.DateTimeFormat('fr-BE', { weekday: 'long', day: 'numeric', month: 'long' })
const fmtShort = new Intl.DateTimeFormat('fr-BE', { day: 'numeric', month: 'short' })
export const longDay = (key) => {
  const [y, m, d] = key.split('-').map(Number)
  return fmtDay.format(new Date(y, m - 1, d))
}
export const shortDay = (key) => {
  const [y, m, d] = key.split('-').map(Number)
  return fmtShort.format(new Date(y, m - 1, d)).replace('.', '')
}

const TABS = [
  ['/habitudes', 'Aujourd’hui', true],
  ['/habitudes/calendrier', 'Calendrier'],
  ['/habitudes/bilans', 'Bilans'],
  ['/habitudes/gerer', 'Gérer']
]

export function HabitsNav() {
  return (
    <nav className="food-nav" aria-label="Habitudes">
      {TABS.map(([to, label, end]) => <NavLink key={to} to={to} end={end} className="food-tab">{label}</NavLink>)}
    </nav>
  )
}

/**
 * Données du module + mise à jour immédiate quand on coche (sans tout recharger).
 */
export function useHabits(options) {
  const [data, setData] = useState(null)
  const [error, setError] = useState('')
  const load = useCallback(async () => {
    try {
      setData(await loadHabits(options))
      setError('')
    } catch (e) {
      setError(/relation|does not exist|schema cache/i.test(e.message)
        ? 'Les tables des habitudes n’existent pas encore : exécute 009_habitudes.sql dans Supabase.'
        : e.message)
    }
  }, [])
  useEffect(() => {
    load()
  }, [load])

  const log = useCallback(async (habit, date, value) => {
    setData((d) => {
      if (!d) return d
      const logs = d.logs.filter((l) => !(l.habit_id === habit.id && l.date === date))
      if (value) logs.push({ habit_id: habit.id, date, value })
      return { ...d, logs, ctx: makeContext({ logs, pauses: d.pauses, auto: d.auto, today: d.today }) }
    })
    try {
      await setLog(habit, date, value)
      scheduleReminderSync()
    } catch (e) {
      setError(e.message)
      load()
    }
  }, [load])

  return { data, error, reload: load, log }
}

/* ---------- Ligne d'habitude (liste du jour, accueil) ---------- */

export function HabitRow({ item, date, cat, ctx, onLog, onOpen }) {
  const h = item.habit
  const color = catColor(cat)
  const st = streak(h, ctx)
  const auto = h.auto && item.auto === true && !(item.value > 0)
  const done = item.status === 'done' || (item.progress && item.doneToday)
  const target = Number(h.target) || 1

  function toggle() {
    if (item.paused) return
    if (h.kind === 'quantity') return onOpen?.(item)
    if (h.kind === 'avoid') return onLog(h, date, item.value > 0 ? 0 : 1)
    if (auto) return
    onLog(h, date, item.value > 0 ? 0 : 1)
  }

  const sub = []
  if (cat) sub.push(cat.name)
  if (item.progress) sub.push(progressLabel(item))
  if (h.frequency === 'challenge') {
    const c = challengeDay(h, date)
    sub.push(`Défi : jour ${c.n} / ${c.total}`)
  }
  if (st.current > 1) sub.push(`🔥 ${st.current} ${st.unit}`)
  if (auto) sub.push('coché automatiquement')
  if (item.paused) sub.push('en pause')

  const ratio = h.kind === 'quantity' ? Math.min(1, (item.value || 0) / target) : done ? 1 : 0
  const avoidSlip = h.kind === 'avoid' && item.value > 0
  const label =
    h.kind === 'avoid'
      ? avoidSlip ? `${h.name} : écart noté, toucher pour annuler` : `${h.name} : tenu, toucher pour noter un écart`
      : h.kind === 'quantity'
        ? `${h.name} : ${fmt(item.value)} sur ${fmt(target)} ${h.unit || ''}`
        : `${h.name} : ${done ? 'fait' : 'à faire'}`

  return (
    <div className={`habit-row${item.paused ? ' is-paused' : ''}${done && !avoidSlip ? ' is-done' : ''}`}>
      <button
        type="button"
        className={`habit-check${avoidSlip ? ' is-slip' : ''}`}
        style={{ '--c': color }}
        onClick={toggle}
        aria-label={label}
        aria-pressed={h.kind === 'check' ? done : undefined}
        disabled={item.paused || auto}
      >
        <svg viewBox="0 0 36 36" aria-hidden="true">
          <circle cx="18" cy="18" r="15" className="habit-check-track" />
          {ratio > 0 && !avoidSlip && (
            <circle cx="18" cy="18" r="15" className="habit-check-fill" strokeDasharray={94.25} strokeDashoffset={94.25 * (1 - ratio)} transform="rotate(-90 18 18)" />
          )}
        </svg>
        {avoidSlip ? <Icon name="close" size={16} stroke={2.4} /> : done ? <Icon name="check" size={17} stroke={2.6} /> : null}
      </button>
      <button type="button" className="habit-main" onClick={() => onOpen?.(item)}>
        <span className="habit-name">{h.emoji ? `${h.emoji} ` : ''}{h.name}</span>
        {sub.length > 0 && <span className="habit-sub">{sub.join(' · ')}</span>}
      </button>
      {h.kind === 'quantity' && !item.paused && (
        <div className="habit-qty">
          <span>{fmt(item.value)}<small> / {fmt(target)} {h.unit}</small></span>
          <button type="button" className="habit-plus" aria-label={`Ajouter ${fmt(h.step || 1)} ${h.unit || ''} à ${h.name}`}
            onClick={() => onLog(h, date, Math.round(((item.value || 0) + (Number(h.step) || 1)) * 100) / 100)}>
            <Icon name="plus" size={16} stroke={2.4} />
          </button>
        </div>
      )}
      {h.kind === 'avoid' && <span className={`habit-avoid${avoidSlip ? ' is-slip' : ''}`}>{avoidSlip ? 'Écart' : 'Tenu'}</span>}
    </div>
  )
}

export const freqLabel = (h) => {
  if (h.frequency === 'weekly') return `${h.times} fois par semaine`
  if (h.frequency === 'monthly') return `${h.times} fois par mois`
  if (h.frequency === 'monthly_task') return `Tâche du mois (le ${h.day_of_month})`
  return FREQUENCIES[h.frequency]?.label || ''
}
