import { useEffect, useState } from 'react'
import { deleteDesign, getEmail, listDesigns } from '../auth/api'
import type { SavedDesign } from '../types'
import { DesignThumb } from './DesignThumb'
import { formatPrice, priceBreakdown } from '../state/store'
import { useToasts } from './toast'

interface Props {
  onOpen: (d: SavedDesign) => void
  onNew: () => void
  onLogout: () => void
  isAdmin?: boolean
  onOpenAdmin?: () => void
}

/** Post-login dashboard: your designs as cards, plus "new design". */
export function HomeScreen({ onOpen, onNew, onLogout, isAdmin, onOpenAdmin }: Props) {
  const [designs, setDesigns] = useState<SavedDesign[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const push = useToasts((s) => s.push)

  async function refresh() {
    try {
      setDesigns(await listDesigns())
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load your designs')
    }
  }
  useEffect(() => {
    refresh()
  }, [])

  async function remove(e: React.MouseEvent, d: SavedDesign) {
    e.stopPropagation()
    if (!confirm(`Delete “${d.name}”? This cannot be undone.`)) return
    try {
      await deleteDesign(d.id)
      setDesigns((ds) => (ds ?? []).filter((x) => x.id !== d.id))
    } catch (err) {
      push(err instanceof Error ? err.message : 'Delete failed', 'error')
    }
  }

  return (
    <div className="home">
      <header className="home-top">
        <div className="logo">
          <img src="/flame.svg" alt="" width={24} height={24} />
          <span>
            bbq<em>.build</em>
          </span>
        </div>
        <div className="home-user">
          {isAdmin && onOpenAdmin && (
            <button className="btn btn-ghost" onClick={onOpenAdmin}>
              ⚙ Admin
            </button>
          )}
          <span className="home-email">{getEmail()}</span>
          <button className="btn btn-ghost" onClick={onLogout}>
            Sign out
          </button>
        </div>
      </header>

      <main className="home-body">
        <div className="home-head">
          <h1>Your kitchens</h1>
          <p>Pick up where you left off, or start a fresh build.</p>
        </div>

        {error && <div className="login-error">{error}</div>}

        <div className="home-grid">
          <button className="home-card home-new" onClick={onNew}>
            <div className="home-new-plus">+</div>
            <strong>New design</strong>
            <span>Start from scratch or a preset</span>
          </button>

          {designs?.map((d) => {
            const { total } = priceBreakdown(d.data)
            return (
              <div key={d.id} className="home-card" onClick={() => onOpen(d)} role="button">
                <div className="home-thumb">
                  <DesignThumb design={d.data} width={300} height={170} />
                  <button className="home-del" title="Delete" onClick={(e) => remove(e, d)}>
                    🗑
                  </button>
                </div>
                <div className="home-card-info">
                  <strong>{d.name}</strong>
                  <span className="home-card-meta">
                    {d.data.frames.length} frames · {formatPrice(total)}
                  </span>
                  <span className="home-card-date">
                    Edited {new Date(String(d.updated_at).includes('T') ? d.updated_at : d.updated_at + 'Z').toLocaleDateString()}
                  </span>
                </div>
              </div>
            )
          })}

          {designs && designs.length === 0 && (
            <div className="home-empty">You don't have any saved designs yet — hit “New design” to begin.</div>
          )}
          {!designs && !error && <div className="home-empty">Loading your designs…</div>}
        </div>
      </main>
    </div>
  )
}
