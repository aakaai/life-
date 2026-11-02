// Son de fin de repos et écran allumé pendant la séance.
// Sur iPhone, une web app ne peut pas vibrer : on utilise un bip (Web Audio),
// qui doit être « débloqué » par un premier toucher de l'écran.

let ctx = null

export function unlockAudio() {
  try {
    ctx ||= new (window.AudioContext || window.webkitAudioContext)()
    if (ctx.state === 'suspended') ctx.resume()
    // son silencieux : débloque l'audio sur iOS
    const o = ctx.createOscillator()
    const g = ctx.createGain()
    g.gain.value = 0
    o.connect(g).connect(ctx.destination)
    o.start()
    o.stop(ctx.currentTime + 0.01)
  } catch {
    /* pas de son disponible */
  }
}

export function beep({ times = 3, freq = 880 } = {}) {
  if (!ctx) return
  try {
    for (let i = 0; i < times; i++) {
      const t = ctx.currentTime + i * 0.28
      const o = ctx.createOscillator()
      const g = ctx.createGain()
      o.frequency.value = i === times - 1 ? freq * 1.5 : freq
      g.gain.setValueAtTime(0.0001, t)
      g.gain.exponentialRampToValueAtTime(0.4, t + 0.02)
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.2)
      o.connect(g).connect(ctx.destination)
      o.start(t)
      o.stop(t + 0.22)
    }
  } catch {
    /* ignore */
  }
}

// Garde l'écran allumé tant que la séance est ouverte.
export function keepAwake() {
  let lock = null
  let stopped = false
  const request = async () => {
    try {
      if ('wakeLock' in navigator && document.visibilityState === 'visible' && !stopped) {
        lock = await navigator.wakeLock.request('screen')
      }
    } catch {
      /* refusé : pas grave */
    }
  }
  const onVisible = () => document.visibilityState === 'visible' && request()
  request()
  document.addEventListener('visibilitychange', onVisible)
  return () => {
    stopped = true
    document.removeEventListener('visibilitychange', onVisible)
    lock?.release?.()
  }
}
