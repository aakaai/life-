// Fonctions de l'app iPhone native (Capacitor). Sur le site web, tout ceci ne fait rien.
//   - isNative : vrai seulement dans l'app installée depuis Xcode
//   - restActivity : chrono de repos dans l'île dynamique / sur l'écran verrouillé
import { Capacitor, registerPlugin } from '@capacitor/core'

export const isNative = Capacitor.isNativePlatform()

const RestActivity = registerPlugin('RestActivity')

async function safe(fn) {
  if (!isNative) return null
  try {
    return await fn()
  } catch (e) {
    console.warn('Life (iPhone) :', e?.message || e)
    return null
  }
}

export const restActivity = {
  // { title, endsAt (ms), total (s), next, detail }
  show: (opts) => safe(() => RestActivity.show(opts)),
  hide: () => safe(() => RestActivity.hide()),
  status: () => safe(() => RestActivity.status())
}
