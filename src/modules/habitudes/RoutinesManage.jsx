// Habitudes › Gérer › Routines (v0.32) : l'ordre des habitudes de chaque routine, l'heure du soir,
// l'ouverture automatique et le guide pour l'app Raccourcis de l'iPhone.
import { useState } from 'react'
import { Link } from 'react-router-dom'
import Icon from '../../components/Icon'
import { HabitsNav, useHabits, catColor, HabitIcon } from './ui'
import { ROUTINES, routineHabits, moveInOrder } from './routine'
import { routineSettings, saveRoutineSettings } from './routine-store'
import { store } from '../../lib/store'

export default function RoutinesManage() {
  const { data, error, reload } = useHabits()
  const [st, setSt] = useState(routineSettings)
  const [busy, setBusy] = useState(false)
  const update = (patch) => { const next = { ...st, ...patch }; setSt(next); saveRoutineSettings(next) }

  const move = async (list, i, d) => {
    const order = moveInOrder(list, i, d)
    if (!order || busy) return
    setBusy(true)
    try {
      await Promise.all(order.map((o) => store.update('habits', o.id, { sort: o.sort })))
      await reload()
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="page food habits">
      <HabitsNav to="/habitudes/gerer" label="Gérer" />
      <h1 className="large-title">Routines</h1>
      <p className="group-foot">Ta routine du matin, ce sont tes habitudes « Matin » ; celle du soir, tes habitudes « Soir » et la séance d’étirements du jour. Les habitudes « à éviter » et celles qui se cochent toutes seules n’y sont pas.</p>
      {error && <p className="group-foot is-error">{error}</p>}
      {!data && !error && <p className="muted-line">Chargement…</p>}
      {data && Object.entries(ROUTINES).map(([which, conf]) => {
        const list = routineHabits(which, data.habits, data.categories)
        const catById = Object.fromEntries(data.categories.map((c) => [c.id, c]))
        return (
          <section key={which} className="rt-manage">
            <div className="rt-manage-head">
              <h2 className="group-title">{conf.label}</h2>
              <Link className="link-btn" to={`/habitudes/routine/${which}`}>Lancer maintenant</Link>
            </div>
            <ul className="group">
              {which === 'soir' && (
                <li className="row rt-row is-fixed">
                  <span className="rt-row-ico" style={{ '--c': 'var(--teal)' }}><Icon name="stretch" size={18} /></span>
                  <span className="row-main"><span className="row-label">Étirements / mobilité du jour</span><span className="row-sub">en premier, quand le planning en prévoit</span></span>
                </li>
              )}
              {list.map((h, i) => (
                <li key={h.id} className="row rt-row">
                  <span className="rt-row-ico" style={{ '--c': catColor(catById[h.category_id]) }}><HabitIcon habit={h} size={18} /></span>
                  <span className="row-main"><span className="row-label">{h.name}</span></span>
                  <button type="button" className="icon-btn small" disabled={i === 0 || busy} onClick={() => move(list, i, -1)} aria-label={`Monter ${h.name}`}><span className="rt-arrow up"><Icon name="chevron" size={16} stroke={2.2} /></span></button>
                  <button type="button" className="icon-btn small" disabled={i === list.length - 1 || busy} onClick={() => move(list, i, 1)} aria-label={`Descendre ${h.name}`}><span className="rt-arrow down"><Icon name="chevron" size={16} stroke={2.2} /></span></button>
                </li>
              ))}
              {!list.length && <li className="row"><span className="row-sub">Aucune habitude « {which === 'matin' ? 'Matin' : 'Soir'} » pour l’instant.</span></li>}
            </ul>
            <label className="rt-toggle">
              <input type="checkbox" checked={st.auto[which]} onChange={(e) => update({ auto: { ...st.auto, [which]: e.target.checked } })} />
              <span>S’ouvre toute seule quand Raccourcis ouvre Life {which === 'matin' ? '(de 4 h à midi)' : `(dès ${st.evening})`}</span>
            </label>
            {which === 'soir' && (
              <label className="rt-time">
                <span>Heure de la routine du soir</span>
                <input type="time" value={st.evening} onChange={(e) => e.target.value && update({ evening: e.target.value })} />
              </label>
            )}
          </section>
        )
      })}

      <section className="rt-guide">
        <h2 className="group-title">Ouvrir Life tout seul (iPhone)</h2>
        <p className="group-foot">Une app ne peut pas s’ouvrir d’elle-même : c’est l’app <strong>Raccourcis</strong> qui le fait. À régler une fois, onglet <strong>Automatisation</strong> › <strong>+</strong> :</p>
        <ol>
          <li><strong>Matin</strong> : choisis <em>Alarme</em> › <em>Est arrêtée</em> (alarme du réveil) › <em>Exécuter immédiatement</em>. Actions : <em>Attendre</em> 600 secondes, puis <em>Ouvrir l’app</em> › Life.</li>
          <li><strong>Soir</strong> : choisis <em>Heure de la journée</em> › {st.evening}, tous les jours › <em>Exécuter immédiatement</em>. Action : <em>Ouvrir l’app</em> › Life.</li>
        </ol>
        <p className="group-foot">Si iOS coupe l’attente de 10 minutes (écran éteint), retire l’action <em>Attendre</em> : Life s’ouvrira dès que tu coupes le réveil. La routine ne s’ouvre qu’une fois par matin et par soir ; ensuite, une carte sur l’accueil permet de la reprendre.</p>
      </section>
    </div>
  )
}
