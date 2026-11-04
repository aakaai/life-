// Réglages › Widget iPhone : créer / remplacer / supprimer la clé privée du widget « Ma journée ».
// La clé n'est montrée qu'une fois (seule son empreinte est enregistrée).
import { useEffect, useState } from 'react'
import { widgetStatus, createKey, removeKey, enablePublishing } from './api'

const fmt = new Intl.DateTimeFormat('fr-BE', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })

export default function WidgetSettings() {
  const [st, setSt] = useState(null)
  const [key, setKey] = useState('')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState('')
  const [sure, setSure] = useState(false)
  const refresh = () => widgetStatus().then(setSt).catch((e) => setSt({ available: true, error: e.message }))
  useEffect(() => {
    refresh()
  }, [])
  if (!st?.available) return null

  async function create() {
    setBusy(true)
    setMsg('')
    try {
      enablePublishing()
      setKey(await createKey())
      setSure(false)
      refresh()
    } catch (e) {
      setMsg(`Échec : ${e.message}`)
    } finally {
      setBusy(false)
    }
  }
  async function copy() {
    try {
      await navigator.clipboard.writeText(key)
      setMsg('Clé copiée. Colle-la dans le widget : appui long › Modifier le widget › Clé.')
    } catch {
      setMsg('Copie impossible : sélectionne la clé et copie-la à la main.')
    }
  }

  return (
    <>
      <h2 className="group-title">Widget iPhone</h2>
      {st.missingTable ? (
        <p className="group-foot is-error">Lance d’abord le script 015_widget.sql dans Supabase, puis reviens ici.</p>
      ) : (
        <>
          <ul className="group">
            <li className="row">
              <span className="row-label">Clé du widget</span>
              <span className="row-value">{st.hasKey ? `active · mise à jour ${fmt.format(new Date(st.updatedAt))}` : 'aucune'}</span>
            </li>
            {key && (
              <li className="row row-field widget-key">
                <input readOnly value={key} onFocus={(e) => e.target.select()} aria-label="Clé du widget" />
                <button type="button" className="pill pill-small pill-strong" onClick={copy}>Copier</button>
              </li>
            )}
            <li>
              <button className="row row-action" disabled={busy} onClick={() => (st.hasKey && !sure ? setSure(true) : create())}>
                {busy ? 'Création…' : st.hasKey ? (sure ? 'Confirmer : l’ancienne clé ne marchera plus' : 'Créer une nouvelle clé') : 'Créer la clé du widget'}
              </button>
            </li>
            {st.hasKey && (
              <li>
                <button className="row row-action is-danger" disabled={busy} onClick={async () => { await removeKey(); setKey(''); refresh() }}>
                  Supprimer la clé (désactive le widget)
                </button>
              </li>
            )}
          </ul>
          <p className="group-foot">
            {key
              ? 'Copie cette clé maintenant : elle ne sera plus affichée. Sur l’iPhone : appui long sur le widget « Ma journée » › Modifier le widget › colle-la dans « Clé ».'
              : 'Le widget « Ma journée » (grand, 4×4) lit ta journée avec cette clé privée et coche tâches et habitudes. Garde-la pour toi, comme tes liens d’agenda.'}
          </p>
          {msg && <p className="group-foot" role="status">{msg}</p>}
        </>
      )}
    </>
  )
}
