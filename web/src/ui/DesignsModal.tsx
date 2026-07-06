import { useEffect, useState } from 'react'
import { deleteDesign, listDesigns } from '../auth/api'
import { useStore } from '../state/store'
import type { SavedDesign } from '../types'
import { fitView } from '../canvas/CanvasStage'
import { useToasts } from './toast'

export function DesignsModal({ onClose }: { onClose: () => void }) {
  const [designs, setDesigns] = useState<SavedDesign[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const setDesign = useStore((s) => s.setDesign)
  const dirty = useStore((s) => s.dirty)
  const savedId = useStore((s) => s.savedId)
  const push = useToasts((s) => s.push)

  async function refresh() {
    try {
      setDesigns(await listDesigns())
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load designs')
    }
  }

  useEffect(() => {
    refresh()
  }, [])

  function load(d: SavedDesign) {
    if (dirty && !confirm('Load this design? Unsaved changes will be lost.')) return
    setDesign(d.data, d.id)
    onClose()
    requestAnimationFrame(fitView)
    push(`Loaded “${d.name}”`, 'success')
  }

  async function remove(d: SavedDesign) {
    if (!confirm(`Delete “${d.name}”? This cannot be undone.`)) return
    try {
      await deleteDesign(d.id)
      refresh()
    } catch (e) {
      push(e instanceof Error ? e.message : 'Delete failed', 'error')
    }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <header className="modal-head">
          <h2>My designs</h2>
          <button className="btn btn-icon" onClick={onClose}>
            ✕
          </button>
        </header>
        {error && <div className="login-error">{error}</div>}
        {!designs && !error && <p className="hint">Loading…</p>}
        {designs && !designs.length && <p className="hint">No saved designs yet. Hit Save in the top bar.</p>}
        <div className="designs-list">
          {designs?.map((d) => (
            <div key={d.id} className={`design-row ${d.id === savedId ? 'current' : ''}`}>
              <button className="design-load" onClick={() => load(d)}>
                <strong>{d.name}</strong>
                <span>
                  {d.data.frames.length} frames · {d.data.appliances.length} appliances ·{' '}
                  {new Date(String(d.updated_at).includes('T') ? d.updated_at : d.updated_at + 'Z').toLocaleString()}
                  {d.id === savedId ? ' · open now' : ''}
                </span>
              </button>
              <button className="btn btn-icon" title="Delete" onClick={() => remove(d)}>
                🗑
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
