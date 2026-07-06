import { useEffect, useRef } from 'react'
import { PRESETS } from '../catalog/presets'
import { computeLayout } from '../canvas/layout'
import { renderScene } from '../canvas/renderScene'
import { formatPrice, priceBreakdown, useStore } from '../state/store'
import type { Design, Preset } from '../types'
import { fitView } from '../canvas/CanvasStage'
import { useToasts } from './toast'

function PresetThumb({ design }: { design: Design }) {
  const ref = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    const canvas = ref.current!
    const ctx = canvas.getContext('2d')!
    const dpr = window.devicePixelRatio || 1
    const W = 280
    const H = 150
    canvas.width = W * dpr
    canvas.height = H * dpr
    canvas.style.width = `${W}px`
    canvas.style.height = `${H}px`
    const layout = computeLayout(design)
    const pad = 1.2
    const zoom = Math.min(W / (layout.bounds.w * pad), H / (layout.bounds.h * pad * 1.35))
    renderScene(ctx, {
      design,
      layout,
      selection: { kind: 'none' },
      hoveredFrameId: null,
      hoveredApplianceId: null,
      dropTargets: null,
      activeDropTarget: null,
      frameDrag: null,
      showDims: false,
      showGrid: false,
      time: 0.4,
      camera: { x: layout.bounds.x + layout.bounds.w / 2, y: layout.bounds.y + layout.bounds.h / 2, zoom },
      width: W,
      height: H,
      dpr,
    })
  }, [design])
  return <canvas ref={ref} className="preset-thumb" />
}

export function PresetsModal({ onClose }: { onClose: () => void }) {
  const setDesign = useStore((s) => s.setDesign)
  const dirty = useStore((s) => s.dirty)
  const push = useToasts((s) => s.push)

  function apply(preset: Preset) {
    if (dirty && !confirm('Replace your current design with this preset? Unsaved changes will be lost.')) return
    setDesign({ ...preset.design, name: preset.name })
    useStore.setState({ dirty: true, savedId: null })
    onClose()
    requestAnimationFrame(fitView)
    push(`Loaded “${preset.name}” — make it yours`, 'success')
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal modal-wide" onClick={(e) => e.stopPropagation()}>
        <header className="modal-head">
          <h2>Start from a preset</h2>
          <button className="btn btn-icon" onClick={onClose}>
            ✕
          </button>
        </header>
        <div className="preset-grid">
          {PRESETS.map((p) => {
            const { total } = priceBreakdown(p.design)
            return (
              <button key={p.id} className="preset-card" onClick={() => apply(p)}>
                <PresetThumb design={p.design} />
                <div className="preset-info">
                  <strong>{p.name}</strong>
                  <p>{p.tagline}</p>
                  <span className="preset-price">
                    {p.design.frames.length} frames · {formatPrice(total)}
                  </span>
                </div>
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}
