import { useState } from 'react'
import { login } from './api'

export function Login({ onLogin }: { onLogin: () => void }) {
  const [email, setEmail] = useState('sagirodin@gmail.com')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      await login(email.trim(), password)
      onLogin()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="login-page">
      <div className="login-hero">
        <div className="login-flames" aria-hidden>
          <img src="/flame.svg" alt="" width={72} height={72} />
        </div>
        <h1>
          bbq<span className="accent">.build</span>
        </h1>
        <p className="tagline">Design your dream outdoor kitchen.</p>
      </div>
      <form className="login-card" onSubmit={submit}>
        <label>
          <span>Email</span>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="username"
            required
          />
        </label>
        <label>
          <span>Password</span>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
            placeholder="••••••••••"
            autoFocus
            required
          />
        </label>
        {error && <div className="login-error">{error}</div>}
        <button className="btn btn-primary" type="submit" disabled={busy}>
          {busy ? 'Firing up…' : 'Start building'}
        </button>
        <p className="login-hint">Private beta — invited builders only.</p>
      </form>
    </div>
  )
}
