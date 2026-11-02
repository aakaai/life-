import { useEffect, useState } from 'react'
import Icon from '../../components/Icon'
import { loadSettings, saveSettings, listSources, addSource, removeSource, syncCalendars } from './api'
import { DEFAULT_SETTINGS } from './data'
import { BackBar, DAY_NAMES } from './ui'
import { isCloud } from '../../lib/supabase'

// Réglages du module Sport : FTP, haltères, disponibilités, mots-clés, agendas.
export default function SportSettings() {
  const [s, setS] = useState(null)
  const [sources, setSources] = useState([])
  const [status, setStatus] = useState('')
  const [newSrc, setNewSrc] = useState({ name: 'Google', url: '' })
  const [srcStatus, setSrcStatus] = useState('')

  useEffect(() => {
    loadSettings().then((x) =>
      setS({
        ...x,
        keywordsText: Object.fromEntries(Object.entries(x.keywords).map(([k, v]) => [k, v.join(', ')]))
      })
    )
    listSources().then(setSources)
  }, [])

  if (!s) return <div className="page"><BackBar /><p className="muted-line">Chargement…</p></div>

  const set = (patch) => setS((x) => ({ ...x, ...patch }))
  const setDay = (i, win) => {
    const availability = s.availability.map((d, j) => (j === i ? win : d))
    set({ availability })
  }

  async function onSave(e) {
    e.preventDefault()
    setStatus('')
    try {
      const keywords = Object.fromEntries(
        Object.entries(s.keywordsText).map(([k, v]) => [k, v.split(',').map((w) => w.trim()).filter(Boolean)])
      )
      await saveSettings({
        ftp: Number(s.ftp) || 210,
        handle_kg: Number(s.handle_kg) || 0,
        plates_total_kg: Number(s.plates_total_kg) || 0,
        plate_step_kg: Number(s.plate_step_kg) || 1,
        availability: s.availability,
        keywords,
        rest_sound: s.rest_sound
      })
      setStatus('Enregistré. Ta semaine sera recalculée en revenant sur le planning.')
    } catch (err) {
      setStatus(`Échec : ${err.message}`)
    }
  }

  async function onAddSource(e) {
    e.preventDefault()
    setSrcStatus('')
    const url = newSrc.url.trim()
    if (!/^(https|webcal):\/\//i.test(url)) return setSrcStatus('L’adresse doit commencer par https:// (ou webcal://).')
    try {
      await addSource(newSrc.name.trim() || 'Agenda', url)
      setNewSrc({ name: 'Google', url: '' })
      setSources(await listSources())
      if (isCloud) {
        setSrcStatus('Agenda ajouté. Lecture en cours…')
        const res = await syncCalendars({ force: true })
        const failed = res?.report?.filter((r) => r.error) || []
        setSrcStatus(failed.length ? failed.map((f) => `${f.name} : ${f.error}`).join(' · ') : 'Agenda ajouté et lu.')
        setSources(await listSources())
      } else setSrcStatus('Agenda ajouté (il sera lu une fois l’app reliée à Supabase).')
    } catch (err) {
      setSrcStatus(err.message)
    }
  }

  async function onRemove(id) {
    await removeSource(id)
    setSources(await listSources())
  }

  return (
    <div className="page settings">
      <BackBar />
      <h1 className="large-title">Réglages sport</h1>

      <form onSubmit={onSave}>
        <h2 className="group-title">Vélo</h2>
        <ul className="group">
          <li className="row row-field">
            <label className="row-label" htmlFor="ftp">FTP</label>
            <input id="ftp" inputMode="numeric" value={s.ftp} onChange={(e) => set({ ftp: e.target.value })} />
            <span className="row-value">W</span>
          </li>
        </ul>
        <p className="group-foot">Toutes les puissances des séances sont calculées à partir de ta FTP. Mets-la à jour après chaque test.</p>

        <h2 className="group-title">Haltères</h2>
        <ul className="group">
          <li className="row row-field">
            <label className="row-label" htmlFor="handle">Barre d’haltère vide</label>
            <input id="handle" inputMode="decimal" value={s.handle_kg} onChange={(e) => set({ handle_kg: e.target.value })} />
            <span className="row-value">kg</span>
          </li>
          <li className="row row-field">
            <label className="row-label" htmlFor="plates">Total des disques</label>
            <input id="plates" inputMode="decimal" value={s.plates_total_kg} onChange={(e) => set({ plates_total_kg: e.target.value })} />
            <span className="row-value">kg</span>
          </li>
          <li className="row row-field">
            <label className="row-label" htmlFor="step">Plus petit disque</label>
            <input id="step" inputMode="decimal" value={s.plate_step_kg} onChange={(e) => set({ plate_step_kg: e.target.value })} />
            <span className="row-value">kg</span>
          </li>
        </ul>
        <p className="group-foot">
          Charge max par haltère : {Number(s.handle_kg) + Math.floor(Number(s.plates_total_kg) / 2)} kg à deux haltères,{' '}
          {Number(s.handle_kg) + Number(s.plates_total_kg)} kg avec un seul.
        </p>

        <h2 className="group-title">Quand tu peux t’entraîner</h2>
        <ul className="group">
          {DAY_NAMES.map((name, i) => {
            const win = s.availability[i]?.[0]
            return (
              <li key={i} className="row avail-row">
                <label className="switch">
                  <input
                    type="checkbox"
                    checked={!!win}
                    onChange={(e) => setDay(i, e.target.checked ? [DEFAULT_SETTINGS.availability[i][0] || { from: '18:00', to: '21:00' }] : [])}
                  />
                  <span aria-hidden="true" />
                  <span className="row-label">{name}</span>
                </label>
                {win ? (
                  <span className="avail-times">
                    <input type="time" aria-label={`${name} début`} value={win.from} onChange={(e) => setDay(i, [{ ...win, from: e.target.value }])} />
                    <span>–</span>
                    <input type="time" aria-label={`${name} fin`} value={win.to} onChange={(e) => setDay(i, [{ ...win, to: e.target.value }])} />
                  </span>
                ) : (
                  <span className="row-value">Repos</span>
                )}
              </li>
            )
          })}
        </ul>
        <p className="group-foot">La semaine ne place des séances que dans ces créneaux, avec 15 minutes de marge autour de tes événements.</p>

        <h2 className="group-title">Mots-clés dans ton agenda</h2>
        <ul className="group">
          {[
            ['escalade', 'Escalade'],
            ['examen', 'Examen'],
            ['voyage', 'Voyage']
          ].map(([k, label]) => (
            <li key={k} className="row row-field">
              <label className="row-label" htmlFor={`kw-${k}`}>{label}</label>
              <input id={`kw-${k}`} value={s.keywordsText[k] || ''} onChange={(e) => set({ keywordsText: { ...s.keywordsText, [k]: e.target.value } })} />
            </li>
          ))}
        </ul>
        <p className="group-foot">
          Séparés par des virgules. Escalade : pas de haut du corps la veille, Haut B allégée. Examen : séances express, pas de vélo
          intense. Voyage : poids du corps, pas de vélo.
        </p>

        <h2 className="group-title">Séance</h2>
        <ul className="group">
          <li className="row">
            <label className="switch">
              <input type="checkbox" checked={s.rest_sound !== false} onChange={(e) => set({ rest_sound: e.target.checked })} />
              <span aria-hidden="true" />
              <span className="row-label">Bip à la fin du repos</span>
            </label>
          </li>
        </ul>

        <button className="btn-primary" type="submit">Enregistrer</button>
        {status && <p className="group-foot" role="status">{status}</p>}
      </form>

      <h2 className="group-title">Agendas reliés</h2>
      {sources.length > 0 && (
        <ul className="group">
          {sources.map((src) => (
            <li key={src.id} className="row">
              <Icon name="calendar" size={18} />
              <span className="row-label">
                {src.name}
                {src.last_error && <span className="row-sub is-error">{src.last_error}</span>}
              </span>
              <button className="row-action is-danger" onClick={() => onRemove(src.id)}>Retirer</button>
            </li>
          ))}
        </ul>
      )}
      <form onSubmit={onAddSource}>
        <ul className="group">
          <li className="row row-field">
            <label className="row-label" htmlFor="src-name">Nom</label>
            <input id="src-name" value={newSrc.name} onChange={(e) => setNewSrc({ ...newSrc, name: e.target.value })} />
          </li>
          <li className="row row-field">
            <label className="row-label" htmlFor="src-url">Adresse iCal</label>
            <input
              id="src-url"
              type="url"
              autoComplete="off"
              autoCapitalize="off"
              spellCheck="false"
              placeholder="https://calendar.google.com/…/basic.ics"
              value={newSrc.url}
              onChange={(e) => setNewSrc({ ...newSrc, url: e.target.value })}
            />
          </li>
          <li>
            <button className="row row-action" type="submit" disabled={!newSrc.url.trim()}>Ajouter l’agenda</button>
          </li>
        </ul>
      </form>
      <p className={/échou|doit|Erreur|répondu/.test(srcStatus) ? 'group-foot is-error' : 'group-foot'}>
        {srcStatus ||
          'Google Agenda sur ordinateur › Paramètres › ton agenda › « Adresse secrète au format iCal ». Garde-la pour toi : elle donne accès à ton agenda. L’app ne lit que les dates et les titres pour organiser ta semaine.'}
      </p>
    </div>
  )
}
