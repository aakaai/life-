import { useCallback, useEffect, useState } from 'react'
import { store, currentUserId } from './store'

// Profil de l'utilisateur (une seule ligne, id = id du compte).
export function useProfile() {
  const [profile, setProfile] = useState(null)
  const [error, setError] = useState(null)

  const load = useCallback(async () => {
    try {
      const id = await currentUserId()
      if (!id) return
      setProfile((await store.get('profiles', id)) || { id, first_name: '' })
    } catch (e) {
      setError(e.message)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  async function save(patch) {
    const next = { ...profile, ...patch }
    const saved = await store.upsert('profiles', next)
    setProfile(saved)
    return saved
  }

  return { profile, save, error }
}
