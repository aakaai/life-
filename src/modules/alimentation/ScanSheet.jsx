import { useEffect, useRef, useState } from 'react'
import Icon from '../../components/Icon'

// Scan d'un code-barres avec la caméra arrière. Secours : photo, ou saisie des chiffres.
export default function ScanSheet({ onCode, onClose }) {
  const video = useRef(null)
  const [state, setState] = useState('starting') // starting | live | nocamera
  const [manual, setManual] = useState('')
  const [hint, setHint] = useState('')
  const done = useRef(false)
  const onCodeRef = useRef(onCode)
  onCodeRef.current = onCode

  useEffect(() => {
    let stream = null
    let timer = null
    let busy = false
    let decode = null
    let stopped = false
    const canvas = document.createElement('canvas')
    const ctx = canvas.getContext('2d', { willReadFrequently: true })

    async function start() {
      try {
        decode = (await import('./scanner')).decodeBarcode
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 } },
          audio: false
        })
        if (stopped) return stream.getTracks().forEach((t) => t.stop())
        video.current.srcObject = stream
        await video.current.play()
        setState('live')
        timer = setInterval(tick, 250)
      } catch {
        setState('nocamera')
      }
    }

    async function tick() {
      const v = video.current
      if (busy || done.current || !v || !v.videoWidth) return
      busy = true
      try {
        // on ne lit que la bande centrale de l'image : plus rapide
        const w = v.videoWidth
        const h = Math.round(v.videoHeight * 0.5)
        canvas.width = w
        canvas.height = h
        ctx.drawImage(v, 0, (v.videoHeight - h) / 2, w, h, 0, 0, w, h)
        const code = await decode(ctx.getImageData(0, 0, w, h))
        if (code && !done.current) {
          done.current = true
          onCodeRef.current(code)
        }
      } catch {
        /* image illisible : on réessaie */
      } finally {
        busy = false
      }
    }

    start()
    return () => {
      stopped = true
      clearInterval(timer)
      stream?.getTracks().forEach((t) => t.stop())
    }
  }, [])

  async function onPhoto(e) {
    const file = e.target.files?.[0]
    if (!file) return
    setHint('Lecture de la photo…')
    const { decodeBarcode } = await import('./scanner')
    const code = await decodeBarcode(file).catch(() => null)
    if (code) onCode(code)
    else setHint('Aucun code-barres lu sur la photo. Rapproche-toi et évite les reflets.')
  }

  function submitManual(e) {
    e.preventDefault()
    const code = manual.replace(/\D/g, '')
    if (code.length >= 8) onCode(code)
    else setHint('Un code-barres compte 8 ou 13 chiffres.')
  }

  return (
    <div className="scan">
      <div className="scan-top">
        <button className="link-btn scan-close" onClick={onClose}>
          <Icon name="close" size={22} /> Fermer
        </button>
      </div>
      <div className="scan-view">
        <video ref={video} playsInline muted autoPlay className={state === 'live' ? '' : 'is-hidden'} />
        {state === 'live' && <div className="scan-frame" aria-hidden="true"><span /></div>}
        {state === 'starting' && <p className="scan-msg">Ouverture de la caméra…</p>}
        {state === 'nocamera' && (
          <p className="scan-msg">
            Caméra indisponible. Autorise l’accès à la caméra pour cette app dans les réglages de Safari, ou prends une photo du code-barres.
          </p>
        )}
      </div>
      <div className="scan-bottom">
        <p className="scan-tip">{hint || 'Place le code-barres dans le cadre, bien à plat et éclairé.'}</p>
        <label className="btn-secondary scan-photo">
          <Icon name="camera" size={18} stroke={2} /> Prendre une photo
          <input type="file" accept="image/*" capture="environment" onChange={onPhoto} hidden />
        </label>
        <form className="scan-manual" onSubmit={submitManual}>
          <input
            inputMode="numeric"
            placeholder="ou tape les chiffres du code"
            value={manual}
            onChange={(e) => setManual(e.target.value)}
            aria-label="Code-barres"
          />
          <button className="pill pill-strong" type="submit">OK</button>
        </form>
      </div>
    </div>
  )
}
