import { useState } from 'react'
import { login, signup } from './api'

export function Login({ onLogin }: { onLogin: () => void }) {
  const [mode, setMode] = useState<'login' | 'signup'>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    setNotice(null)
    try {
      if (mode === 'signup') {
        const { needsConfirmation } = await signup(email, password)
        if (needsConfirmation) {
          setNotice('Check your inbox to confirm your email, then sign in.')
          setMode('login')
          return
        }
      } else {
        await login(email, password)
      }
      onLogin()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
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
        <div className="auth-tabs">
          <button type="button" className={mode === 'login' ? 'active' : ''} onClick={() => { setMode('login'); setError(null) }}>
            Sign in
          </button>
          <button type="button" className={mode === 'signup' ? 'active' : ''} onClick={() => { setMode('signup'); setError(null) }}>
            Create account
          </button>
        </div>
        <label>
          <span>Email</span>
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="username" required autoFocus />
        </label>
        <label>
          <span>Password</span>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
            placeholder={mode === 'signup' ? 'At least 6 characters' : '••••••••••'}
            minLength={6}
            required
          />
        </label>
        {notice && <div className="login-notice">{notice}</div>}
        {error && <div className="login-error">{error}</div>}
        <button className="btn btn-primary" type="submit" disabled={busy}>
          {busy ? 'Firing up…' : mode === 'signup' ? 'Create account' : 'Start building'}
        </button>
        <p className="login-hint">
          {mode === 'login' ? 'New here? ' : 'Already have an account? '}
          <button type="button" className="link-btn" onClick={() => { setMode(mode === 'login' ? 'signup' : 'login'); setError(null) }}>
            {mode === 'login' ? 'Create an account' : 'Sign in'}
          </button>
        </p>
      </form>
    </div>
  )
}
