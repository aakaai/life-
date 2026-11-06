// Éléments d'interface partagés du module Habitudes.
import { useCallback, useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import Icon from '../../components/Icon'
import { loadHabits, setLog } from './api'
import { scheduleReminderSync } from './native-sync'
import { makeContext, streak, progressLabel, challengeDay, FREQUENCIES, addDays, mondayOf, dayScore, habitCell } from './logic'

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

// v0.30 : plus d'onglets, la page Habitudes regroupe tout ; les autres pages ont un retour.
export function HabitsNav({ to = '/habitudes', label = 'Habitudes' }) {
  return (
    <div className="back-bar">
      <Link to={to} className="back-link"><Icon name="back" size={20} stroke={2} />{label}</Link>
    </div>
  )
}

/* ---------- Icône d'une habitude (devinée d'après le nom, sinon son emoji) ---------- */

const HABIT_ICONS = [
  [/eau|boire|hydrat/, 'drop'], [/lire|lecture|livre/, 'book'], [/r[eé]vis|[eé]tudi|cours|devoir/, 'ecole'],
  [/[eé]tirement|mobilit|yoga|souplesse/, 'stretch'], [/s[eé]ance|sport|muscu|v[eé]lo|gym|courir|course|run/, 'dumbbell'],
  [/pes[eé]e|poids/, 'scale'], [/prot[eé]ine|calorie|manger|repas|fruit|l[eé]gume|cuisine/, 'alimentation'],
  [/lever|r[eé]veil|matin/, 'sun'], [/coucher|dormir|sommeil|nuit/, 'moon'], [/cr[eé]atine|vitamine|m[eé]dic|compl[eé]ment|pilule/, 'pill'],
  [/[eé]cran|t[eé]l[eé]phone|r[eé]seau|insta|tiktok|portable/, 'phone'], [/m[eé]dit|respir|calme/, 'brain'],
  [/march|pas\b|promen|balade/, 'walk'], [/sucre|snack|alcool|cigarette|fast/, 'flame'], [/ranger|m[eé]nage|lessive|vaisselle/, 'taches'],
  [/journal|[eé]crire|gratitude/, 'book'], [/plante|jardin|nature/, 'leaf']
]
export function habitIcon(h) {
  const name = String(h?.name || '').toLowerCase()
  for (const [re, key] of HABIT_ICONS) if (re.test(name)) return { icon: key }
  if (h?.auto === 'sport_session') return { icon: 'dumbbell' }
  if (h?.auto === 'protein' || h?.auto === 'kcal') return { icon: 'alimentation' }
  if (h?.auto === 'weigh_in') return { icon: 'scale' }
  if (h?.auto === 'stretch') return { icon: 'stretch' }
  if (h?.emoji) return { emoji: h.emoji }
  return { icon: 'habitudes' }
}
export function HabitIcon({ habit, size = 19 }) {
  const ic = habitIcon(habit)
  return ic.emoji ? <span className="habit-emoji" style={{ fontSize: size - 2 }} aria-hidden="true">{ic.emoji}</span> : <Icon name={ic.icon} size={size} stroke={1.8} />
}

/* ---------- Appui long (doigt ou souris) : ouvre la fiche, sinon un simple toucher ---------- */

export function useLongPress(onLong, onTap, ms = 450) {
  const t = useRef(null)
  const fired = useRef(false)
  const start = useRef(null)
  const clear = () => {
    clearTimeout(t.current)
    t.current = null
  }
  return {
    onPointerDown: (e) => {
      if (e.button != null && e.button !== 0) return
      fired.current = false
      start.current = { x: e.clientX, y: e.clientY }
      clear()
      t.current = setTimeout(() => {
        fired.current = true
        onLong()
      }, ms)
    },
    onPointerMove: (e) => {
      if (start.current && Math.hypot(e.clientX - start.current.x, e.clientY - start.current.y) > 10) clear()
    },
    onPointerUp: clear,
    onPointerLeave: clear,
    onPointerCancel: clear,
    onContextMenu: (e) => {
      e.preventDefault()
      if (!fired.current) {
        clear()
        fired.current = true
        onLong()
      }
    },
    onClick: (e) => {
      if (fired.current) {
        fired.current = false
        e.preventDefault()
        return
      }
      onTap()
    }
  }
}

/* ---------- Petit calendrier (toutes les habitudes, ou une seule) ---------- */

const ROW_LABELS = ['L', '', 'M', '', 'V', '', '']
export function Heatmap({ habits, habit = null, ctx, today, weeks = 53, color = 'var(--pink)', onPick }) {
  const scroller = useRef(null)
  const last = mondayOf(today)
  const cols = []
  for (let w = addDays(last, -(weeks - 1) * 7); w <= last; w = addDays(w, 7)) {
    cols.push(Array.from({ length: 7 }, (_, i) => {
      const date = addDays(w, i)
      if (date > today) return { date, cls: 'hm-cell is-none', label: '' }
      let level = 0
      let kind = 'score'
      if (habit) {
        const c = habitCell(habit, date, ctx)
        kind = c.status
        level = c.level
      } else {
        const sc = dayScore(habits, date, ctx)
        if (!sc) return { date, cls: 'hm-cell is-none', label: longDay(date) }
        level = sc.score
      }
      if (kind === 'none') return { date, cls: 'hm-cell is-none', label: longDay(date) }
      if (kind === 'paused') return { date, cls: 'hm-cell is-paused', label: `${longDay(date)} : en pause` }
      const step = level <= 0 ? 0 : Math.min(4, Math.ceil(level * 4))
      return { date, cls: `hm-cell l${step}${kind === 'joker' ? ' is-joker' : ''}`, label: longDay(date) }
    }))
  }
  useEffect(() => {
    const end = () => {
      if (scroller.current) scroller.current.scrollLeft = scroller.current.scrollWidth
    }
    end()
    window.addEventListener('resize', end)
    return () => window.removeEventListener('resize', end)
  }, [weeks, today, habit?.id])
  return (
    <div className="hm-scroll" ref={scroller} style={{ '--c': color }}>
      <div className="hm">
        <div className="hm-body">
          <div className="hm-rows" aria-hidden="true">{ROW_LABELS.map((l, i) => <span key={i}>{l}</span>)}</div>
          {cols.map((w, i) => (
            <div key={i} className="hm-week">
              {w.map((c) => (
                <button key={c.date} type="button" className={c.cls} title={c.label} aria-label={c.label || undefined}
                  disabled={!onPick || c.cls.includes('is-none')} onClick={() => onPick?.(c.date)} />
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
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
