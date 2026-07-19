import { useEffect, useRef, useState } from 'react'
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

/** Preset gallery for the left dock — click a card to choose how to use it. */
export function PresetsPanel() {
  const setDesign = useStore((s) => s.setDesign)
  const addStructure = useStore((s) => s.addStructure)
  const empty = useStore((s) => s.design.frames.length === 0)
  const push = useToasts((s) => s.push)
  const [choosing, setChoosing] = useState<Preset | null>(null)

  function replace(preset: Preset) {
    setDesign({ ...preset.design, name: preset.name })
    useStore.setState({ dirty: true, savedId: null })
    requestAnimationFrame(fitView)
    push(`Loaded “${preset.name}” — make it yours`, 'success')
  }

  function addToCanvas(preset: Preset) {
    addStructure(preset.design, preset.name)
    requestAnimationFrame(fitView)
    push(`“${preset.name}” added as its own structure — click it to move or edit`, 'success')
  }

  function pick(preset: Preset) {
    // nothing built yet → no choice to make, just load it
    if (empty) replace(preset)
    else setChoosing(preset)
  }

  return (
    <>
      <p className="hint">Load a ready-made kitchen, then tweak everything.</p>
      <div className="preset-list">
        {PRESETS.map((p) => {
          const { total } = priceBreakdown(p.design)
          return (
            <button key={p.id} className="preset-card" onClick={() => pick(p)}>
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
      {choosing && (
        <div className="modal-backdrop" onClick={() => setChoosing(null)}>
          <div className="modal preset-choice" onClick={(e) => e.stopPropagation()}>
            <header className="modal-head">
              <h2>Use “{choosing.name}”</h2>
              <button className="btn btn-icon" onClick={() => setChoosing(null)}>
                ✕
              </button>
            </header>
            <p className="hint">You already have a kitchen on the canvas — what should this preset do?</p>
            <div className="choice-list">
              <button
                className="choice-card"
                onClick={() => {
                  setChoosing(null)
                  addToCanvas(choosing)
                }}
              >
                <span className="choice-icon">⊞</span>
                <span>
                  <strong>Add to this canvas</strong>
                  <small>Keep your kitchen and place the preset beside it as its own structure.</small>
                </span>
              </button>
              <button
                className="choice-card"
                onClick={() => {
                  setChoosing(null)
                  replace(choosing)
                }}
              >
                <span className="choice-icon">⇄</span>
                <span>
                  <strong>Replace current kitchen</strong>
                  <small>Clear the canvas and start from this preset instead.</small>
                </span>
              </button>
              <button
                className="choice-card"
                onClick={() => {
                  const p = choosing
                  setChoosing(null)
                  window.dispatchEvent(new CustomEvent('bbq:preset-new', { detail: { preset: p } }))
                }}
              >
                <span className="choice-icon">✧</span>
                <span>
                  <strong>Start a new design</strong>
                  <small>Keep this design saved and open the preset as a fresh design.</small>
                </span>
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
