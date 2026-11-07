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

// Rappels d'habitudes (notifications locales de l'app iPhone)
const HabitReminders = registerPlugin('HabitReminders')

export const habitReminders = {
  // items : [{ id, habitId, date, at: 'AAAA-MM-JJTHH:MM', title, body }]
  sync: (items) => safe(() => HabitReminders.sync({ items })),
  takePending: async () => (await safe(() => HabitReminders.takePending()))?.actions || [],
  permission: () => safe(() => HabitReminders.permission()),
  // v0.32 : vibration « réussite » (app iPhone réinstallée depuis Xcode ; sinon rien), vibreur du navigateur ailleurs
  haptic: () => {
    if (isNative) return safe(() => HabitReminders.haptic())
    try { navigator.vibrate?.([30, 60, 30]) } catch { /* pas de vibreur */ }
    return null
  },
  onAction: (cb) => {
    if (!isNative) return () => {}
    const handle = HabitReminders.addListener('habitAction', cb)
    return () => handle.then((h) => h.remove()).catch(() => {})
  }
}
