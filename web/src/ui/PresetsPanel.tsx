import { useEffect, useRef } from 'react'
import { PRESETS } from '../catalog/presets'
import { computeScene, renderScene } from '../canvas/renderScene'
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
    const W = 252
    const H = 135
    canvas.width = W * dpr
    canvas.height = H * dpr
    canvas.style.width = `${W}px`
    canvas.style.height = `${H}px`
    const scene = computeScene(design)
    const pad = 1.15
    const zoom = Math.min(W / (scene.bounds.w * pad), H / (scene.bounds.h * pad))
    renderScene(ctx, {
      design,
      scene,
      selection: { kind: 'none' },
      hoveredFrameId: null,
      hoveredApplianceId: null,
      dropTargets: null,
      activeDropTarget: null,
      frameDrag: null,
      showDims: false,
      showGrid: false,
      unit: 'cm',
      time: 0.4,
      camera: { x: scene.bounds.x + scene.bounds.w / 2, y: scene.bounds.y + scene.bounds.h / 2, zoom },
      width: W,
      height: H,
      dpr,
      thumbnail: true,
    })
  }, [design])
  return <canvas ref={ref} className="preset-thumb" />
}

/** Preset gallery for the left dock — click a card to load it into the builder. */
export function PresetsPanel() {
  const setDesign = useStore((s) => s.setDesign)
  const dirty = useStore((s) => s.dirty)
  const push = useToasts((s) => s.push)

  function apply(preset: Preset) {
    if (dirty && !confirm('Replace your current design with this preset? Unsaved changes will be lost.')) return
    setDesign({ ...preset.design, name: preset.name })
    useStore.setState({ dirty: true, savedId: null })
    requestAnimationFrame(fitView)
    push(`Loaded “${preset.name}” — make it yours`, 'success')
  }

  return (
    <>
      <p className="hint">Load a ready-made kitchen, then tweak everything.</p>
      <div className="preset-list">
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
    </>
  )
}
