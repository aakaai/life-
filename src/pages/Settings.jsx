import { useEffect, useState } from 'react'
import { useAuth } from '../lib/auth'
import { useProfile } from '../lib/profile'
import { store, storageMode } from '../lib/store'
import { ALL_TABLES } from '../modules'
import { dayKey } from '../lib/dates'

// Réglages : listes groupées façon iOS.
export default function Settings() {
  const { user, signOut } = useAuth()
  const { profile, save, error } = useProfile()
  const [name, setName] = useState('')
  const [status, setStatus] = useState('')

  useEffect(() => {
    if (profile) setName(profile.first_name || '')
  }, [profile])

  async function onSave(e) {
    e.preventDefault()
    setStatus('')
    try {
      await save({ first_name: name.trim() })
      setStatus('Profil enregistré.')
    } catch (err) {
      setStatus(`Échec de l’enregistrement : ${err.message}`)
    }
  }

  // Sauvegarde complète de toutes les tables dans un fichier JSON.
  async function onExport() {
    const dump = { exported_at: new Date().toISOString(), tables: {} }
    for (const t of ALL_TABLES) dump.tables[t] = await store.list(t)
    const blob = new Blob([JSON.stringify(dump, null, 2)], { type: 'application/json' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `life-export-${dayKey(new Date())}.json`
    a.click()
    URL.revokeObjectURL(a.href)
  }

  return (
    <div className="page settings">
      <h1 className="large-title">Réglages</h1>

      <h2 className="group-title">Profil</h2>
      <form onSubmit={onSave}>
        <ul className="group">
          <li className="row row-field">
            <label htmlFor="first-name" className="row-label">Prénom</label>
            <input
              id="first-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoComplete="given-name"
              placeholder="Ton prénom"
            />
          </li>
          <li>
            <button className="row row-action" type="submit" disabled={!profile}>
              Enregistrer le profil
            </button>
          </li>
        </ul>
      </form>
      {status && <p className="group-foot" role="status">{status}</p>}
      {error && <p className="group-foot is-error">{error}</p>}

      <h2 className="group-title">Données</h2>
      <ul className="group">
        <li className="row">
          <span className="row-label">Stockage</span>
          <span className="row-value">
            {storageMode === 'cloud' ? 'Synchronisé' : 'Sur cet appareil'}
          </span>
        </li>
        <li>
          <button className="row row-action" onClick={onExport}>
            Exporter mes données
          </button>
        </li>
      </ul>
      <p className="group-foot">
        {storageMode === 'cloud'
          ? `Tes données sont synchronisées avec ton compte${user?.email ? ` ${user.email}` : ''} : les mêmes sur ton téléphone et ton ordi.`
          : 'Mode local : les données restent dans ce navigateur. Configure Supabase (voir le guide) pour les retrouver partout.'}
      </p>

      {storageMode === 'cloud' && (
        <ul className="group">
          <li>
            <button className="row row-action is-danger" onClick={signOut}>
              Se déconnecter
            </button>
          </li>
        </ul>
      )}

      <p className="version">Life · version {__APP_VERSION__}</p>
    </div>
  )
}
