// Accueil · « Retour au kot » (v0.31).
// Du lundi au samedi : une petite ligne « À prendre dimanche · N » (toucher ou + = la liste).
// Le dimanche : un bloc en haut de l'accueil pour tout cocher avant le bus (caché si la liste est vide).
// Rappel iPhone le dimanche à 12:00 s'il reste des choses ; tout est effacé le lundi.
import { useCallback, useEffect, useRef, useState } from 'react'
import Icon from '../../components/Icon'
import { longDate } from '../../lib/dates'
import { CheckCircle } from '../taches/ui'
import { isSunday, REMINDER_HOUR } from './kot-logic'
import { loadKot, addKot, setKotDone, removeKot, missingKotTable } from './kot'

function useKot() {
  const [state, setState] = useState({ data: null, missing: false })
  const reload = useCallback(() => {
    loadKot().then((data) => setState({ data, missing: false })).catch((e) => {
      if (missingKotTable(e)) setState({ data: { sunday: null, items: [] }, missing: true })
      else setState((s) => ({ ...s, data: s.data || { sunday: null, items: [] } }))
    })
  }, [])
  useEffect(() => {
    reload()
    const onVis = () => document.visibilityState === 'visible' && reload()
    window.addEventListener('life:kot', reload)
    document.addEventListener('visibilitychange', onVis)
    return () => { window.removeEventListener('life:kot', reload); document.removeEventListener('visibilitychange', onVis) }
  }, [reload])
  return { ...state, reload }
}

const sundayDate = (key) => { const [y, m, d] = key.split('-').map(Number); return new Date(y, m - 1, d) }

export default function Kot() {
  const { data, missing } = useKot()
  const [open, setOpen] = useState(false)
  if (!data) return null
  const sunday = isSunday()
  const items = data.items
  const left = items.filter((x) => !x.done).length
  const sheet = open && <KotSheet data={data} missing={missing} onClose={() => setOpen(false)} />

  if (sunday) {
    if (missing || !items.length) return sheet || null
    return (
      <>
        <section className="home-card kot-card" aria-labelledby="kot-title">
          <div className="home-card-head">
            <span className="kot-ico" aria-hidden="true"><Icon name="bag" size={17} stroke={1.9} /></span>
            <h2 id="kot-title" className="home-card-title">Retour au kot</h2>
            <span className="kot-count">{left ? `${items.length - left} / ${items.length}` : 'Tout est prêt ✓'}</span>
          </div>
          <div className="kot-bar" aria-hidden="true"><i style={{ width: `${((items.length - left) / items.length) * 100}%` }} /></div>
          <ul className="kot-list">
            {items.map((it) => (
              <li key={it.id} className={it.done ? 'is-done' : ''}>
                <CheckCircle done={it.done} color="var(--brown)" label={`${it.title} : ${it.done ? 'pris' : 'à prendre'}`} onClick={() => setKotDone(it, !it.done)} />
                <button type="button" className="kot-name" onClick={() => setKotDone(it, !it.done)}>{it.title}</button>
              </li>
            ))}
          </ul>
          <button type="button" className="kot-add" onClick={() => setOpen(true)}>+ Ajouter</button>
        </section>
        {sheet}
      </>
    )
  }

  return (
    <>
      <div className="kot-line">
        <button type="button" className="kot-line-main" onClick={() => setOpen(true)} aria-label={`À prendre dimanche : ${items.length} chose${items.length > 1 ? 's' : ''}. Voir la liste`}>
          <span className="kot-ico" aria-hidden="true"><Icon name="bag" size={17} stroke={1.9} /></span>
          <strong>À prendre dimanche</strong>
          {items.length > 0 && <span className="kot-n">· {items.length}</span>}
        </button>
        <button type="button" className="kot-plus" onClick={() => setOpen(true)} aria-label="Ajouter une chose à prendre dimanche"><Icon name="plus" size={17} stroke={2} /></button>
      </div>
      {sheet}
    </>
  )
}

function KotSheet({ data, missing, onClose }) {
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  const input = useRef(null)
  const sunday = isSunday()
  const when = data.sunday
    ? sunday ? `Aujourd’hui${new Date().getHours() < REMINDER_HOUR ? ` · rappel à ${REMINDER_HOUR}:00` : ''}` : `${longDate(sundayDate(data.sunday))} · rappel à ${REMINDER_HOUR}:00`
    : ''

  const submit = async (e) => {
    e.preventDefault()
    const t = text.trim()
    if (!t || busy || missing) return
    setBusy(true)
    try {
      await addKot(t, data.sunday)
      setText('')
    } finally {
      setBusy(false)
      input.current?.focus()
    }
  }

  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <form className="sheet kot-sheet" role="dialog" aria-label="À prendre dimanche" onClick={(e) => e.stopPropagation()} onSubmit={submit}>
        <h2 className="sheet-title">À prendre dimanche</h2>
        {when && <p className="sheet-text">{when}</p>}
        {missing ? (
          <p className="sheet-text">Pour enregistrer ta liste, lance d’abord le script <code>020_retour_kot.sql</code> dans Supabase.</p>
        ) : (
          <>
            {data.items.length === 0 && <p className="kot-empty">Rien pour l’instant. Note ici ce que tu ne dois pas oublier dimanche.</p>}
            <ul className="kot-sheet-list">
              {data.items.map((it) => (
                <li key={it.id} className={it.done ? 'is-done' : ''}>
                  <span className="kot-dot" aria-hidden="true" />
                  <span className="kot-sheet-name">{it.title}</span>
                  <button type="button" className="kot-x" onClick={() => removeKot(it.id)} aria-label={`Retirer ${it.title}`}><Icon name="close" size={16} stroke={2} /></button>
                </li>
              ))}
            </ul>
            <div className="kot-input">
              <input ref={input} autoFocus value={text} onChange={(e) => setText(e.target.value)} placeholder="Ajouter quelque chose…" aria-label="Chose à prendre" enterKeyHint="done" maxLength={120} />
              <button type="submit" className="btn-primary" disabled={!text.trim() || busy}>Ajouter</button>
            </div>
          </>
        )}
        <button type="button" className="btn-secondary kot-close" onClick={onClose}>Fermer</button>
      </form>
    </div>
  )
}
