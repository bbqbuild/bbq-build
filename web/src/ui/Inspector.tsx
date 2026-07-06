import { useState } from 'react'
import { APPLIANCES, fitsFrame, getAppliance } from '../catalog/appliances'
import { FINISHES, frameSpecByWidth, GROUND_TYPES } from '../catalog/frames'
import { applianceForZone, formatPrice, priceBreakdown, useStore } from '../state/store'
import type { ApplianceType, Frame, Zone } from '../types'

export function Inspector() {
  const selection = useStore((s) => s.selection)
  const design = useStore((s) => s.design)

  let content: React.ReactNode
  if (selection.kind === 'frame') {
    const frame = design.frames.find((f) => f.id === selection.id)
    content = frame ? <FramePanel frame={frame} /> : <SummaryPanel />
  } else if (selection.kind === 'appliance') {
    const placed = design.appliances.find((a) => a.id === selection.id)
    content = placed ? <AppliancePanel placedId={placed.id} /> : <SummaryPanel />
  } else if (selection.kind === 'ground') {
    content = <GroundPanel />
  } else {
    content = <SummaryPanel />
  }

  return <aside className="inspector">{content}</aside>
}

function SummaryPanel() {
  const design = useStore((s) => s.design)
  const { total } = priceBreakdown(design)
  const clearAll = useStore((s) => s.clearAll)
  return (
    <div className="panel">
      <h2>Your kitchen</h2>
      <dl className="facts">
        <div>
          <dt>Frames</dt>
          <dd>{design.frames.length}</dd>
        </div>
        <div>
          <dt>Appliances</dt>
          <dd>{design.appliances.length}</dd>
        </div>
        <div>
          <dt>Run length</dt>
          <dd>{design.frames.reduce((s, f) => s + f.width, 0)} cm</dd>
        </div>
        <div>
          <dt>Estimate</dt>
          <dd className="accent">{formatPrice(total)}</dd>
        </div>
      </dl>
      <p className="hint">
        Click a frame in the canvas to kit it out, drag frames to reorder, or drag appliances straight from the
        catalog onto a frame.
      </p>
      {design.frames.length > 0 && (
        <button className="btn btn-danger-ghost" onClick={() => confirm('Remove all frames and appliances?') && clearAll()}>
          Clear kitchen
        </button>
      )}
    </div>
  )
}

function GroundPanel() {
  const ground = useStore((s) => s.design.ground)
  const setGround = useStore((s) => s.setGround)
  const spec = GROUND_TYPES.find((g) => g.id === ground.type)!
  return (
    <div className="panel">
      <h2>Ground</h2>
      <div className="ground-types">
        {GROUND_TYPES.map((g) => (
          <button
            key={g.id}
            className={`ground-chip ${ground.type === g.id ? 'active' : ''}`}
            onClick={() => setGround({ type: g.id })}
          >
            <span className={`swatch swatch-${g.id}`} />
            {g.name}
          </button>
        ))}
      </div>
      <label className="slider-row">
        <span>
          Width <strong>{ground.width} cm</strong>
        </span>
        <input
          type="range"
          min={100}
          max={1000}
          step={10}
          value={ground.width}
          onChange={(e) => setGround({ width: Number(e.target.value) })}
        />
      </label>
      <dl className="facts">
        <div>
          <dt>Material</dt>
          <dd>{spec.name}</dd>
        </div>
        <div>
          <dt>Cost</dt>
          <dd className="accent">{formatPrice(Math.round((spec.pricePerM * ground.width) / 100))}</dd>
        </div>
      </dl>
    </div>
  )
}

function FramePanel({ frame }: { frame: Frame }) {
  const design = useStore((s) => s.design)
  const removeFrame = useStore((s) => s.removeFrame)
  const setFrameFinish = useStore((s) => s.setFrameFinish)
  const spec = frameSpecByWidth.get(frame.width)
  const index = design.frames.findIndex((f) => f.id === frame.id)

  return (
    <div className="panel">
      <h2>
        Frame {index + 1} <span className="h-hint">{frame.width} cm module</span>
      </h2>
      <div className="finish-row">
        {FINISHES.map((f) => (
          <button
            key={f.id}
            className={`finish-swatch ${frame.finish === f.id ? 'active' : ''}`}
            style={{ background: f.swatch }}
            onClick={() => setFrameFinish(frame.id, f.id)}
            title={f.name}
          />
        ))}
      </div>
      <SlotEditor frame={frame} zone="top" title="Counter level" />
      <SlotEditor frame={frame} zone="base" title="Under counter" />
      <dl className="facts">
        <div>
          <dt>Module</dt>
          <dd>{spec ? formatPrice(spec.price) : '—'}</dd>
        </div>
      </dl>
      <button className="btn btn-danger-ghost" onClick={() => removeFrame(frame.id)}>
        Remove frame
      </button>
    </div>
  )
}

function SlotEditor({ frame, zone, title }: { frame: Frame; zone: Zone; title: string }) {
  const design = useStore((s) => s.design)
  const placeAppliance = useStore((s) => s.placeAppliance)
  const removeAppliance = useStore((s) => s.removeAppliance)
  const [picking, setPicking] = useState(false)

  const placed = applianceForZone(design, frame.id, zone)
  const current = placed ? getAppliance(placed.typeId) : null
  const options = APPLIANCES.filter((a) => a.zone === zone)

  return (
    <section className="slot">
      <h3>{title}</h3>
      {current && placed ? (
        <div className="slot-current">
          <span className="appliance-icon">{current.icon}</span>
          <div className="appliance-meta">
            <strong>{current.shortName}</strong>
            <span>{formatPrice(current.price)}</span>
          </div>
          <button className="btn btn-icon" title="Remove" onClick={() => removeAppliance(placed.id)}>
            ✕
          </button>
        </div>
      ) : (
        <p className="hint">Empty slot.</p>
      )}
      {picking ? (
        <div className="slot-options">
          {options.map((t) => {
            const fits = fitsFrame(t, frame.width)
            return (
              <button
                key={t.id}
                className="slot-option"
                disabled={!fits}
                onClick={() => {
                  placeAppliance(frame.id, t.id)
                  setPicking(false)
                }}
                title={fits ? t.description : `Needs a ${t.minFrameWidth} cm frame`}
              >
                <span className="appliance-icon">{t.icon}</span>
                <span className="slot-option-name">{t.shortName}</span>
                <span className="slot-option-price">{fits ? formatPrice(t.price) : `≥${t.minFrameWidth} cm`}</span>
              </button>
            )
          })}
          <button className="btn btn-ghost" onClick={() => setPicking(false)}>
            Cancel
          </button>
        </div>
      ) : (
        <button className="btn btn-ghost" onClick={() => setPicking(true)}>
          {current ? 'Swap appliance…' : '+ Add appliance'}
        </button>
      )}
    </section>
  )
}

function AppliancePanel({ placedId }: { placedId: string }) {
  const design = useStore((s) => s.design)
  const removeAppliance = useStore((s) => s.removeAppliance)
  const select = useStore((s) => s.select)
  const placed = design.appliances.find((a) => a.id === placedId)!
  const type: ApplianceType = getAppliance(placed.typeId)
  const frameIdx = design.frames.findIndex((f) => f.id === placed.frameId)

  return (
    <div className="panel">
      <h2>
        {type.icon} {type.shortName}
      </h2>
      <p className="appliance-desc">{type.description}</p>
      <dl className="facts">
        <div>
          <dt>Model</dt>
          <dd>{type.name}</dd>
        </div>
        <div>
          <dt>Brand</dt>
          <dd>{type.brand}</dd>
        </div>
        <div>
          <dt>Position</dt>
          <dd>
            Frame {frameIdx + 1} · {placed.zone === 'top' ? 'counter' : 'under counter'}
          </dd>
        </div>
        <div>
          <dt>Price</dt>
          <dd className="accent">{formatPrice(type.price)}</dd>
        </div>
      </dl>
      <button className="btn btn-ghost" onClick={() => select({ kind: 'frame', id: placed.frameId })}>
        Edit this frame
      </button>
      <button className="btn btn-danger-ghost" onClick={() => removeAppliance(placed.id)}>
        Remove appliance
      </button>
    </div>
  )
}
