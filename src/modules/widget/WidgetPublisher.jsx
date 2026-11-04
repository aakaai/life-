// Garde le widget iPhone à jour : publie le résumé de la journée à l'ouverture, au retour dans l'app,
// après un changement (évènement « life:changed », regroupé sur 4 s) et toutes les 15 minutes.
// Ne fait rien tant qu'aucune clé de widget n'a été créée.
import { useEffect } from 'react'
import { publishFeed } from './api'

export default function WidgetPublisher() {
  useEffect(() => {
    let timer = null
    let last = 0
    const soon = (delay = 4000) => {
      clearTimeout(timer)
      timer = setTimeout(() => {
        last = Date.now()
        publishFeed()
      }, delay)
    }
    const onVisible = () => document.visibilityState === 'visible' && Date.now() - last > 60000 && soon(1500)
    soon(3000)
    const onChange = () => soon()
    window.addEventListener('life:changed', onChange)
    document.addEventListener('visibilitychange', onVisible)
    const every = setInterval(() => soon(0), 15 * 60 * 1000)
    return () => {
      clearTimeout(timer)
      clearInterval(every)
      window.removeEventListener('life:changed', onChange)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [])
  return null
}
