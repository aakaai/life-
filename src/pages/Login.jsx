import { useState } from 'react'
import { useAuth } from '../lib/auth'

export default function Login() {
  const { signIn } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  async function onSubmit(e) {
    e.preventDefault()
    setError('')
    setBusy(true)
    try {
      await signIn(email.trim(), password)
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="login">
      <div className="login-box">
        <img src={`${import.meta.env.BASE_URL}favicon.svg`} alt="" width="64" height="64" className="login-logo" />
        <h1 className="large-title">Life</h1>
        <p className="login-sub">Connecte-toi pour retrouver tes espaces sur tous tes appareils.</p>
        <form onSubmit={onSubmit}>
          <ul className="group">
            <li className="row row-field">
              <input type="email" required autoComplete="email" placeholder="E-mail" aria-label="E-mail"
                value={email} onChange={(e) => setEmail(e.target.value)} />
            </li>
            <li className="row row-field">
              <input type="password" required autoComplete="current-password" placeholder="Mot de passe"
                aria-label="Mot de passe" value={password} onChange={(e) => setPassword(e.target.value)} />
            </li>
          </ul>
          {error && <p className="group-foot is-error" role="alert">{error}</p>}
          <button className="btn-primary" type="submit" disabled={busy}>
            {busy ? 'Connexion…' : 'Se connecter'}
          </button>
        </form>
      </div>
    </div>
  )
}
