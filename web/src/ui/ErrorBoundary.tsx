import { Component, type ReactNode } from 'react'

interface State {
  error: Error | null
}

/** Catches render errors so one bad item can't leave the user with a blank page. */
export class ErrorBoundary extends Component<{ children: ReactNode }, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error) {
    console.error('App render error:', error)
  }

  render() {
    if (!this.state.error) return this.props.children
    return (
      <div className="crash">
        <div className="crash-card">
          <h1>🔧 Something went wrong</h1>
          <p>The designer hit an unexpected error. Your saved designs are safe.</p>
          <pre className="crash-detail">{this.state.error.message}</pre>
          <div className="crash-actions">
            <button className="btn btn-primary" onClick={() => location.reload()}>
              Reload
            </button>
            <button
              className="btn btn-ghost"
              onClick={() => {
                // clear a possibly-corrupt in-progress session, then reload home
                try {
                  localStorage.removeItem('bbq_builder_session')
                } catch {
                  /* ignore */
                }
                location.href = '/'
              }}
            >
              Start fresh
            </button>
          </div>
        </div>
      </div>
    )
  }
}
