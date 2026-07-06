import { useState } from 'react'
import { fitView } from '../canvas/CanvasStage'
import { camera, zoomStep } from '../canvas/camera'
import { formatPrice, priceBreakdown, useStore } from '../state/store'
import { getEmail } from '../auth/api'

interface Props {
  onSave: () => void
  onOpenPresets: () => void
  onOpenSpec: () => void
  onOpenDesigns: () => void
  onOpenValidate: () => void
  onNew: () => void
  onLogout: () => void
  saving: boolean
}

export function TopBar({ onSave, onOpenPresets, onOpenSpec, onOpenDesigns, onOpenValidate, onNew, onLogout, saving }: Props) {
  const design = useStore((s) => s.design)
  const dirty = useStore((s) => s.dirty)
  const setName = useStore((s) => s.setName)
  const undo = useStore((s) => s.undo)
  const redo = useStore((s) => s.redo)
  const canUndo = useStore((s) => s.history.length > 0)
  const canRedo = useStore((s) => s.future.length > 0)
  const showDims = useStore((s) => s.showDims)
  const showGrid = useStore((s) => s.showGrid)
  const toggleDims = useStore((s) => s.toggleDims)
  const toggleGrid = useStore((s) => s.toggleGrid)
  const unit = useStore((s) => s.unit)
  const toggleUnit = useStore((s) => s.toggleUnit)
  const chatOpen = useStore((s) => s.chatOpen)
  const toggleChat = useStore((s) => s.toggleChat)
  const [menuOpen, setMenuOpen] = useState(false)
  const [nameDraft, setNameDraft] = useState<string | null>(null)

  const { total } = priceBreakdown(design)

  function zoom(f: number) {
    const wrap = document.querySelector('.canvas-wrap') as HTMLElement | null
    if (wrap) zoomStep(f, wrap.clientWidth, wrap.clientHeight)
  }

  return (
    <header className="topbar">
      <div className="topbar-left">
        <div className="logo" title="bbq.build">
          <img src="/flame.svg" alt="" width={22} height={22} />
          <span>
            bbq<em>.build</em>
          </span>
        </div>
        <input
          className="design-name"
          value={nameDraft ?? design.name}
          onChange={(e) => setNameDraft(e.target.value)}
          onFocus={() => setNameDraft(design.name)}
          onBlur={() => {
            if (nameDraft !== null && nameDraft.trim() && nameDraft !== design.name) setName(nameDraft.trim())
            setNameDraft(null)
          }}
          onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
          spellCheck={false}
          aria-label="Design name"
        />
        {dirty && <span className="dirty-dot" title="Unsaved changes" />}
      </div>

      <div className="topbar-center">
        <div className="btn-group">
          <button className="btn btn-icon" onClick={undo} disabled={!canUndo} title="Undo (Ctrl+Z)">
            ↩
          </button>
          <button className="btn btn-icon" onClick={redo} disabled={!canRedo} title="Redo (Ctrl+Shift+Z)">
            ↪
          </button>
        </div>
        <div className="btn-group">
          <button className={`btn btn-icon ${showGrid ? 'active' : ''}`} onClick={toggleGrid} title="Toggle grid (G)">
            ▦
          </button>
          <button className={`btn btn-icon ${showDims ? 'active' : ''}`} onClick={toggleDims} title="Toggle dimensions (D)">
            ⟷
          </button>
          <button className="btn btn-icon unit-toggle" onClick={toggleUnit} title="Switch units (U)">
            {unit === 'cm' ? 'cm' : 'ft·in'}
          </button>
        </div>
        <div className="btn-group">
          <button className="btn btn-icon" onClick={() => zoom(1.25)} title="Zoom in (+)">
            +
          </button>
          <button className="btn btn-icon" onClick={() => zoom(0.8)} title="Zoom out (−)">
            −
          </button>
          <button className="btn btn-icon" onClick={fitView} title="Fit to view (F)">
            ⤢
          </button>
        </div>
      </div>

      <div className="topbar-right">
        <button
          className={`btn btn-ghost ${chatOpen ? 'active-ghost' : ''}`}
          onClick={toggleChat}
          title="AI assistant chat"
        >
          ✨ Assistant
        </button>
        <button className="btn btn-ghost" onClick={onOpenValidate} title="AI feasibility review of your build">
          🛡 AI Check
        </button>
        <button className="btn btn-ghost" onClick={onOpenPresets}>
          Presets
        </button>
        <button className="btn btn-ghost" onClick={onOpenSpec} title="Bill of materials">
          Spec · <strong>{formatPrice(total)}</strong>
        </button>
        <button className="btn btn-primary" onClick={onSave} disabled={saving} title="Save (Ctrl+S)">
          {saving ? 'Saving…' : dirty ? 'Save' : 'Saved ✓'}
        </button>
        <div className="user-menu">
          <button className="btn btn-icon avatar" onClick={() => setMenuOpen((o) => !o)} title={getEmail() ?? ''}>
            {(getEmail() ?? 'S')[0].toUpperCase()}
          </button>
          {menuOpen && (
            <div className="menu" onMouseLeave={() => setMenuOpen(false)}>
              <div className="menu-email">{getEmail()}</div>
              <button onClick={() => { setMenuOpen(false); onNew() }}>New design</button>
              <button onClick={() => { setMenuOpen(false); onOpenDesigns() }}>My designs…</button>
              <hr />
              <button onClick={onLogout}>Sign out</button>
            </div>
          )}
        </div>
      </div>
    </header>
  )
}

export { camera }
