// « Journée complète » (v0.32) : l'anneau brille un instant quand la dernière habitude du jour est cochée.
import { useEffect, useRef, useState } from 'react'
import { habitReminders } from '../../lib/native'

/**
 * Vrai pendant ~1,6 s quand `complete` passe de faux à vrai (pas au chargement de la page,
 * pas quand on change de jour) ; déclenche aussi une petite vibration.
 */
export function useCelebrate(complete, ready, key = '') {
  const prev = useRef({ key: null, complete: null })
  const [burst, setBurst] = useState(false)
  useEffect(() => {
    if (!ready) return
    const before = prev.current
    prev.current = { key, complete }
    if (before.key !== key || before.complete !== false || !complete) return
    setBurst(true)
    habitReminders.haptic()
    const t = setTimeout(() => setBurst(false), 1600)
    return () => clearTimeout(t)
  }, [complete, ready, key])
  return burst
}
