import { useState } from 'react'
import { login, oauth, signup } from './api'

export function Login({ onLogin, onBack, reason }: { onLogin: () => void; onBack?: () => void; reason?: string }) {
  const [mode, setMode] = useState<'login' | 'signup'>(reason ? 'signup' : 'login')
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

  async function startOAuth(provider: 'google' | 'apple') {
    setError(null)
    setNotice(null)
    try {
      await oauth(provider)
    } catch (err) {
      const msg = err instanceof Error ? err.message : ''
      // provider not configured yet → guide to email instead of showing a raw error
      if (/not enabled|unsupported provider|provider is not/i.test(msg)) {
        setNotice(`${provider === 'google' ? 'Google' : 'Apple'} sign-in is coming soon — create your account with email below for now.`)
        setMode('signup')
      } else {
        setError(msg || 'Sign-in failed')
      }
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

        {reason && <div className="login-reason">{reason}</div>}

        <div className="oauth-row">
          <button type="button" className="btn oauth-btn" onClick={() => startOAuth('google')}>
            <GoogleIcon /> Continue with Google
          </button>
          <button type="button" className="btn oauth-btn" onClick={() => startOAuth('apple')}>
            <AppleIcon /> Continue with Apple
          </button>
        </div>
        <div className="oauth-divider"><span>or with email</span></div>

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
        {onBack && (
          <button type="button" className="link-btn login-back" onClick={onBack}>
            ← Keep looking around
          </button>
        )}
      </form>
    </div>
  )
}

function GoogleIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden>
      <path fill="#EA4335" d="M12 10.2v3.9h5.5c-.24 1.4-1.65 4.1-5.5 4.1-3.3 0-6-2.7-6-6.1s2.7-6.1 6-6.1c1.9 0 3.1.8 3.8 1.5l2.6-2.5C16.9 2.9 14.7 2 12 2 6.9 2 2.8 6.1 2.8 11.2S6.9 20.4 12 20.4c5.9 0 9.8-4.1 9.8-9.9 0-.7-.1-1.2-.2-1.7H12z" />
    </svg>
  )
}
function AppleIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M16.4 12.7c0-2.3 1.9-3.4 2-3.5-1.1-1.6-2.8-1.8-3.4-1.8-1.4-.1-2.8.8-3.5.8-.7 0-1.8-.8-3-.8-1.5 0-3 .9-3.8 2.3-1.6 2.8-.4 7 1.2 9.3.8 1.1 1.7 2.4 2.9 2.3 1.2 0 1.6-.7 3-.7s1.8.7 3 .7c1.2 0 2-1.1 2.8-2.2.9-1.3 1.2-2.5 1.3-2.6-.1 0-2.5-.9-2.5-3.8zM14.3 5.6c.6-.8 1-1.9.9-3-.9 0-2 .6-2.7 1.4-.6.7-1.1 1.8-.9 2.9 1 .1 2-.5 2.7-1.3z" />
    </svg>
  )
}
