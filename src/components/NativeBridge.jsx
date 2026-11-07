import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { isNative, habitReminders } from '../lib/native'
import { applyPendingActions, scheduleReminderSync } from '../modules/habitudes/native-sync'
import { routineToOpen } from '../modules/habitudes/routine-store'
import { loadHabits } from '../modules/habitudes/api'
import { todaySessions } from '../modules/sport/api'

// App iPhone uniquement : au lancement et à chaque retour dans l'app,
// applique les « Fait » touchés dans les notifications (ou ouvre le bon jour de l'agenda)
// et reprogramme les rappels. v0.32 : ouvre la routine du matin / du soir si c'est le moment.
export default function NativeBridge() {
  const navigate = useNavigate()
  useEffect(() => {
    if (!isNative) return
    let alive = true
    const handle = async () => {
      try {
        const target = await applyPendingActions()
        if (target && alive) navigate(target.path, { state: target.state })
        // v0.32 : Raccourcis ouvre Life le matin / le soir → la routine s'affiche (une fois par créneau)
        else if (alive) {
          const path = await routineToOpen({ loadHabits, todaySessions, path: window.location.hash })
          if (path && alive) navigate(path)
        }
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
