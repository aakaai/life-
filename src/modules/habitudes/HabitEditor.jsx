import { useEffect, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { store } from '../../lib/store'
import { BackBar } from '../sport/ui'
import { KINDS, FREQUENCIES, MOMENTS, AUTO_SOURCES, todayKey, addDays, makeContext, streak, rate } from './logic'
import { saveHabit, archiveHabit, removeHabit, saveCategory } from './api'
import { SUGGESTIONS } from './suggestions'
import { fmt, longDay } from './ui'

const EMPTY = {
  name: '', emoji: '', kind: 'check', target: '', unit: '', step: '', frequency: 'daily', times: 3, day_of_month: 1,
  moment: 'day', category_id: '', reminder_time: '', auto: '', archived: false
}

// Créer ou modifier une habitude.
export default function HabitEditor() {
  const { id } = useParams()
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const today = todayKey()
  const [h, setH] = useState(null)
  const [categories, setCategories] = useState([])
  const [stats, setStats] = useState(null)
  const [newCat, setNewCat] = useState('')
  const [error, setError] = useState('')
  const [sure, setSure] = useState(false)

  useEffect(() => {
    ;(async () => {
      const cats = await store.list('habit_categories', { orderBy: 'sort' }).catch(() => [])
      setCategories(cats)
      if (id) {
        const row = await store.get('habits', id)
        if (!row) return setError('Habitude introuvable.')
        setH({ ...EMPTY, ...Object.fromEntries(Object.entries(row).map(([k, v]) => [k, v ?? ''])) })
        const [logs, pauses] = await Promise.all([store.list('habit_logs', { where: { habit_id: id } }), store.list('habit_pauses')])
        const ctx = makeContext({ logs, pauses, today })
        setStats({ streak: streak(row, ctx), rate30: rate(row, addDays(today, -29), today, ctx), all: rate(row, row.start_date, today, ctx) })
      } else {
        const idea = SUGGESTIONS.find((s) => s.name === params.get('idee'))
        setH({ ...EMPTY, ...(idea || {}), start_date: today, category_id: cats[0]?.id || '' })
      }
    })()
  }, [id])

  if (error) return <Page><p className="group-foot is-error">{error}</p></Page>
  if (!h) return <Page><p className="muted-line">Chargement…</p></Page>

  const set = (patch) => setH((x) => ({ ...x, ...patch }))
  const freqs = h.kind === 'avoid' ? ['daily', 'challenge'] : Object.keys(FREQUENCIES)

  async function submit(e) {
    e.preventDefault()
    if (!h.name.trim()) return setError('Donne un nom à l’habitude.')
    if (h.kind === 'quantity' && !(Number(String(h.target).replace(',', '.')) > 0)) return setError('Indique un objectif (ex. 2 pour 2 L).')
    let category_id = h.category_id
    if (category_id === '__new') {
      if (!newCat.trim()) return setError('Donne un nom à la nouvelle catégorie.')
      category_id = (await saveCategory({ name: newCat, color: ['blue', 'green', 'orange', 'purple', 'pink', 'red'][categories.length % 6], sort: categories.length })).id
    }
    const num = (v) => Number(String(v).replace(',', '.'))
    try {
      await saveHabit({ ...h, category_id, target: num(h.target), step: num(h.step) || (h.kind === 'quantity' ? 1 : null) })
      navigate(-1)
    } catch (err) {
      setError(/relation|does not exist|schema cache/i.test(err.message) ? 'Exécute d’abord 009_habitudes.sql dans Supabase.' : err.message)
    }
  }

  return (
    <Page>
      <form onSubmit={submit}>
        <h1 className="large-title">{id ? h.name || 'Habitude' : 'Nouvelle habitude'}</h1>

        {stats && (
          <div className="stats">
            <div className="stat"><span>Série</span><strong>{stats.streak.current} {stats.streak.unit}</strong></div>
            <div className="stat"><span>Record</span><strong>{stats.streak.best} {stats.streak.unit}</strong></div>
            <div className="stat"><span>30 derniers jours</span><strong>{stats.rate30.total ? `${Math.round((stats.rate30.done / stats.rate30.total) * 100)} %` : '—'}</strong></div>
          </div>
        )}

        <ul className="group">
          <li className="row row-field"><label className="row-label" htmlFor="hn">Nom</label><input id="hn" autoFocus={!id} placeholder="Méditer, boire de l’eau…" value={h.name} onChange={(e) => set({ name: e.target.value })} /></li>
          <li className="row row-field"><label className="row-label" htmlFor="he">Emoji</label><input id="he" placeholder="facultatif" maxLength={4} value={h.emoji} onChange={(e) => set({ emoji: e.target.value })} /></li>
        </ul>

        <h2 className="group-title">Type</h2>
        <div className="segmented wide" role="radiogroup" aria-label="Type">
          {Object.entries(KINDS).map(([k, v]) => (
            <button key={k} type="button" role="radio" aria-checked={h.kind === k} className={h.kind === k ? 'is-on' : ''}
              onClick={() => set({ kind: k, frequency: k === 'avoid' && !['daily', 'challenge'].includes(h.frequency) ? 'daily' : h.frequency, auto: k === 'check' ? h.auto : '' })}>
              {v.label}
            </button>
          ))}
        </div>
        <p className="group-foot">{KINDS[h.kind].hint}</p>
        {h.kind === 'quantity' && (
          <ul className="group">
            <li className="row row-field"><label className="row-label" htmlFor="ht">Objectif par jour</label><input id="ht" inputMode="decimal" placeholder="2" value={String(h.target).replace('.', ',')} onChange={(e) => set({ target: e.target.value })} /></li>
            <li className="row row-field"><label className="row-label" htmlFor="hu">Unité</label><input id="hu" placeholder="L, min, pages…" value={h.unit} onChange={(e) => set({ unit: e.target.value })} /></li>
            <li className="row row-field"><label className="row-label" htmlFor="hs">Bouton « + »</label><input id="hs" inputMode="decimal" placeholder="1" value={String(h.step).replace('.', ',')} onChange={(e) => set({ step: e.target.value })} /></li>
          </ul>
        )}

        <h2 className="group-title">Rythme</h2>
        <ul className="group">
          <li className="row row-field">
            <label className="row-label" htmlFor="hf">Quand</label>
            <select id="hf" value={h.frequency} onChange={(e) => set({ frequency: e.target.value })} disabled={!!id && h.frequency === 'challenge'}>
              {freqs.map((k) => <option key={k} value={k}>{FREQUENCIES[k].label}</option>)}
            </select>
          </li>
          {['weekly', 'monthly'].includes(h.frequency) && (
            <li className="row row-field"><label className="row-label" htmlFor="hx">Combien de fois</label><input id="hx" inputMode="numeric" value={h.times} onChange={(e) => set({ times: e.target.value })} /><span className="row-value">{h.frequency === 'weekly' ? 'par semaine' : 'par mois'}</span></li>
          )}
          {h.frequency === 'monthly_task' && (
            <li className="row row-field"><label className="row-label" htmlFor="hd">À partir du</label><input id="hd" inputMode="numeric" value={h.day_of_month} onChange={(e) => set({ day_of_month: e.target.value })} /><span className="row-value">du mois</span></li>
          )}
          <li className="row row-field"><label className="row-label" htmlFor="h0">{h.frequency === 'challenge' ? 'Début du défi' : 'À partir du'}</label><input id="h0" type="date" value={h.start_date} onChange={(e) => set({ start_date: e.target.value })} /></li>
        </ul>
        <p className="group-foot">
          {h.frequency === 'challenge'
            ? `30 jours, jusqu’au ${longDay(addDays(h.start_date, 29))}, puis le défi passe dans « Terminées ».`
            : h.frequency === 'weekly' ? 'La série compte les semaines réussies.'
              : h.frequency === 'monthly' ? 'La série compte les mois réussis.'
                : h.frequency === 'monthly_task' ? 'Elle apparaît à partir de ce jour et reste jusqu’à ce que tu la fasses (ou la fin du mois).'
                  : 'Un jour raté par semaine est couvert par un joker.'}
        </p>

        <h2 className="group-title">Moment et catégorie</h2>
        <div className="segmented wide" role="radiogroup" aria-label="Moment">
          {MOMENTS.map(([k, l]) => (
            <button key={k} type="button" role="radio" aria-checked={h.moment === k} className={h.moment === k ? 'is-on' : ''} onClick={() => set({ moment: k })}>{l}</button>
          ))}
        </div>
        <ul className="group" style={{ marginTop: 10 }}>
          <li className="row row-field">
            <label className="row-label" htmlFor="hc">Catégorie</label>
            <select id="hc" value={h.category_id} onChange={(e) => set({ category_id: e.target.value })}>
              <option value="">Aucune</option>
              {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              <option value="__new">Nouvelle catégorie…</option>
            </select>
          </li>
          {h.category_id === '__new' && (
            <li className="row row-field"><label className="row-label" htmlFor="hcn">Nom</label><input id="hcn" autoFocus placeholder="Santé, Études…" value={newCat} onChange={(e) => setNewCat(e.target.value)} /></li>
          )}
          <li className="row row-field">
            <label className="row-label" htmlFor="hr">Rappel</label>
            <input id="hr" type="time" value={h.reminder_time} onChange={(e) => set({ reminder_time: e.target.value })} />
          </li>
        </ul>
        <p className="group-foot">Le rappel sera envoyé par l’app iPhone (prochaine mise à jour), seulement si l’habitude n’est pas encore cochée.</p>

        {h.kind === 'check' && (
          <>
            <h2 className="group-title">Coche automatique</h2>
            <ul className="group">
              <li className="row row-field">
                <label className="row-label" htmlFor="ha">Depuis</label>
                <select id="ha" value={h.auto} onChange={(e) => set({ auto: e.target.value })}>
                  <option value="">Non, je coche moi-même</option>
                  {Object.entries(AUTO_SOURCES).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                </select>
              </li>
            </ul>
            {h.auto && <p className="group-foot">{AUTO_SOURCES[h.auto].hint} Tu peux toujours la cocher à la main.</p>}
          </>
        )}

        {error && <p className="group-foot is-error">{error}</p>}
        <button className="btn-primary" type="submit">{id ? 'Enregistrer' : 'Créer l’habitude'}</button>
        {id && (
          <>
            <button type="button" className="btn-plain" onClick={async () => { await archiveHabit(id, !h.archived); navigate('/habitudes/gerer') }}>
              {h.archived ? 'Réactiver' : 'Archiver (garder l’historique)'}
            </button>
            <button type="button" className="btn-plain danger" onClick={async () => { if (!sure) return setSure(true); await removeHabit(id); navigate('/habitudes/gerer') }}>
              {sure ? 'Confirmer : supprimer avec tout son historique' : 'Supprimer'}
            </button>
          </>
        )}
        {stats && stats.all.total > 0 && (
          <p className="version">Depuis le {longDay(h.start_date)} : {fmt(stats.all.done, 0)} réussites sur {stats.all.total}.</p>
        )}
      </form>
    </Page>
  )
}

function Page({ children }) {
  return (
    <div className="page settings habits">
      <BackBar to="/habitudes/gerer" label="Habitudes" />
      {children}
    </div>
  )
}
