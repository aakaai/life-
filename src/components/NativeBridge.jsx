import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { isNative, habitReminders } from '../lib/native'
import { applyPendingActions, scheduleReminderSync } from '../modules/habitudes/native-sync'

// App iPhone uniquement : au lancement et à chaque retour dans l'app,
// applique les « Fait » touchés dans les notifications et reprogramme les rappels.
export default function NativeBridge() {
  const navigate = useNavigate()
  useEffect(() => {
    if (!isNative) return
    let alive = true
    const handle = async () => {
      try {
        if ((await applyPendingActions()) && alive) navigate('/habitudes')
      } catch {
        /* réseau indisponible : on réessaiera au prochain retour */
      }
      scheduleReminderSync()
    }
    handle()
    const off = habitReminders.onAction(handle)
    const onVisible = () => document.visibilityState === 'visible' && handle()
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      alive = false
      off()
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [navigate])
  return null
}
