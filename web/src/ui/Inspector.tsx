import { useState } from 'react'
import { APPLIANCES, CORNER_OVENS, fitsFrame, getAppliance } from '../catalog/appliances'
import { checkPlacement } from '../catalog/compat'
import { COUNTER_MATERIALS, FINISHES, counterMaterial, frameSpecByWidth, GROUND_TYPES } from '../catalog/frames'
import { applianceForZone, formatPrice, priceBreakdown, useStore } from '../state/store'
import { formatLen } from '../units'
import { useToasts } from './toast'
import { MAX_FRAME_H, MIN_FRAME_H, RUN_DEPTH, RUN_NAMES, cornerFor, frameBodyH } from '../types'
import { TOP_HEIGHTS } from '../canvas/layout'
import { SizeRow } from './SizeRow'
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
  } else if (selection.kind === 'corner') {
    content = <CornerPanel side={selection.id} />
  } else if (selection.kind === 'counter') {
    content = <CounterPanel />
  } else if (selection.kind === 'ground') {
    content = <GroundPanel />
  } else {
    content = <SummaryPanel />
  }

  return <aside className="inspector">{content}</aside>
}

function SummaryPanel() {
  const design = useStore((s) => s.design)
  const unit = useStore((s) => s.unit)
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
          <dd>{formatLen(design.frames.reduce((s, f) => s + f.width, 0), unit)}</dd>
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
  const unit = useStore((s) => s.unit)
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
          Width <strong>{formatLen(ground.width, unit)}</strong>
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
  const setFrameLowered = useStore((s) => s.setFrameLowered)
  const setFrameWidth = useStore((s) => s.setFrameWidth)
  const setFrameHeight = useStore((s) => s.setFrameHeight)
  const unit = useStore((s) => s.unit)
  const push = useToasts((s) => s.push)
  const spec = frameSpecByWidth.get(frame.width as never)
  const index = design.frames.findIndex((f) => f.id === frame.id)

  return (
    <div className="panel">
      <h2>
        Frame {index + 1}{' '}
        <span className="h-hint">
          {formatLen(frame.width, unit)} {frame.lowered ? 'smoker table' : 'module'} · {RUN_NAMES[frame.run ?? 'back']}
        </span>
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
      <label className="check-row" title="Drops the counter so kamado smokers sit at working height">
        <input
          type="checkbox"
          checked={Boolean(frame.lowered)}
          onChange={(e) => {
            if (!setFrameLowered(frame.id, e.target.checked)) {
              push('Remove the appliances in this frame first — they don’t fit the other height', 'error')
            }
          }}
        />
        <span>Lowered counter (smoker table)</span>
      </label>
      <SizeRow
        label="Width"
        cm={frame.width}
        unit={unit}
        min={20}
        max={200}
        inchesOnly
        onSlide={(v) => setFrameWidth(frame.id, v)}
        onCommit={(v) => setFrameWidth(frame.id, v)}
      />
      <SizeRow
        label="Height"
        cm={frameBodyH(frame)}
        unit={unit}
        min={MIN_FRAME_H}
        max={MAX_FRAME_H}
        inchesOnly
        onSlide={(v) => setFrameHeight(frame.id, v)}
        onCommit={(v) => setFrameHeight(frame.id, v)}
      />
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
  const unit = useStore((s) => s.unit)
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
            const check = checkPlacement(design, frame, t)
            const widthIssue = !fitsFrame(t, frame.width)
            return (
              <button
                key={t.id}
                className="slot-option"
                disabled={!check.ok}
                onClick={() => {
                  placeAppliance(frame.id, t.id)
                  setPicking(false)
                }}
                title={
                  check.ok
                    ? t.description
                    : widthIssue
                      ? `Needs a ${formatLen(t.minFrameWidth, unit)} frame`
                      : check.reason
                }
              >
                <span className="appliance-icon">{t.icon}</span>
                <span className="slot-option-name">{t.shortName}</span>
                <span className="slot-option-price">
                  {check.ok ? formatPrice(t.price) : widthIssue ? `≥${formatLen(t.minFrameWidth, unit)}` : '⚠ conflict'}
                </span>
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

function CounterPanel() {
  const design = useStore((s) => s.design)
  const unit = useStore((s) => s.unit)
  const setCounterMaterial = useStore((s) => s.setCounterMaterial)
  const setAllHeights = useStore((s) => s.setAllHeights)
  const current = counterMaterial(design.counterMaterial)
  // representative height: the most common frame height (or default)
  const heights = design.frames.map((f) => frameBodyH(f))
  const repH = heights.length ? Math.round(heights.reduce((a, b) => a + b, 0) / heights.length) : 88

  return (
    <div className="panel">
      <h2>
        Countertop <span className="h-hint">whole run</span>
      </h2>
      <h3>Material</h3>
      <div className="counter-mats">
        {COUNTER_MATERIALS.map((m) => (
          <button
            key={m.id}
            className={`counter-mat ${current.id === m.id ? 'active' : ''}`}
            onClick={() => setCounterMaterial(m.id)}
            title={`${m.name} · +${formatPrice(m.pricePerM)}/m`}
          >
            <span className="counter-swatch" style={{ background: m.color }} />
            {m.name}
          </button>
        ))}
      </div>
      {design.frames.length > 0 && (
        <>
          <h3>Counter height <span className="h-hint">all frames</span></h3>
          <SizeRow
            label="Height"
            cm={repH}
            unit={unit}
            min={MIN_FRAME_H}
            max={MAX_FRAME_H}
            inchesOnly
            onSlide={(v) => setAllHeights(v)}
            onCommit={(v) => setAllHeights(v)}
          />
          <p className="hint">Sets every frame at once. Select a single frame to fine-tune just that one.</p>
        </>
      )}
    </div>
  )
}

function CornerOvenSlot({ side, current }: { side: 'left' | 'right'; current?: string }) {
  const setCornerAppliance = useStore((s) => s.setCornerAppliance)
  const [picking, setPicking] = useState(false)
  const type = current ? getAppliance(current) : null
  return (
    <section className="slot">
      <h3>Counter oven <span className="h-hint">pizza / taboon</span></h3>
      {type ? (
        <div className="slot-current">
          <span className="appliance-icon">{type.icon}</span>
          <div className="appliance-meta">
            <strong>{type.shortName}</strong>
            <span>{formatPrice(type.price)}</span>
          </div>
          <button className="btn btn-icon" title="Remove" onClick={() => setCornerAppliance(side, null)}>
            ✕
          </button>
        </div>
      ) : (
        <p className="hint">Empty — corners take a counter-level oven.</p>
      )}
      {picking ? (
        <div className="slot-options">
          {CORNER_OVENS.map((t) => (
            <button
              key={t.id}
              className="slot-option"
              onClick={() => {
                setCornerAppliance(side, t.id)
                setPicking(false)
              }}
              title={t.description}
            >
              <span className="appliance-icon">{t.icon}</span>
              <span className="slot-option-name">{t.shortName}</span>
              <span className="slot-option-price">{formatPrice(t.price)}</span>
            </button>
          ))}
          <button className="btn btn-ghost" onClick={() => setPicking(false)}>
            Cancel
          </button>
        </div>
      ) : (
        <button className="btn btn-ghost" onClick={() => setPicking(true)}>
          {type ? 'Swap oven…' : '+ Add oven'}
        </button>
      )}
    </section>
  )
}

function CornerPanel({ side }: { side: 'left' | 'right' }) {
  const design = useStore((s) => s.design)
  const setCornerFinish = useStore((s) => s.setCornerFinish)
  const setCornerLowered = useStore((s) => s.setCornerLowered)
  const setCorner = useStore((s) => s.setCorner)
  const setCornerStyle = useStore((s) => s.setCornerStyle)
  const unit = useStore((s) => s.unit)
  const corner = cornerFor(design, side)

  if (!corner) {
    return (
      <div className="panel">
        <h2>Corner <span className="h-hint">{side} junction</span></h2>
        <p className="hint">This corner has been removed — the wing meets the back run directly.</p>
        <button className="btn btn-ghost" onClick={() => setCorner(side, true)}>
          + Add corner unit
        </button>
      </div>
    )
  }

  return (
    <div className="panel">
      <h2>
        Corner <span className="h-hint">{side} junction · {formatLen(90, unit)} × {formatLen(90, unit)}</span>
      </h2>
      <div className="finish-row">
        {FINISHES.map((f) => (
          <button
            key={f.id}
            className={`finish-swatch ${corner.finish === f.id ? 'active' : ''}`}
            style={{ background: f.swatch }}
            onClick={() => setCornerFinish(side, f.id)}
            title={f.name}
          />
        ))}
      </div>
      <div className="seg-toggle">
        <button className={(corner.style ?? 'diagonal') === 'diagonal' ? 'active' : ''} onClick={() => setCornerStyle(side, 'diagonal')}>
          Diagonal
        </button>
        <button className={corner.style === 'square' ? 'active' : ''} onClick={() => setCornerStyle(side, 'square')}>
          Square
        </button>
      </div>
      <label className="check-row">
        <input type="checkbox" checked={Boolean(corner.lowered)} onChange={(e) => setCornerLowered(side, e.target.checked)} />
        <span>Lowered counter</span>
      </label>
      <CornerOvenSlot side={side} current={corner.top} />
      <dl className="facts">
        <div>
          <dt>{corner.style === 'square' ? 'Square' : 'Diagonal'} junction</dt>
          <dd>{formatPrice(350)}</dd>
        </div>
      </dl>
      <button className="btn btn-danger-ghost" onClick={() => setCorner(side, false)}>
        Remove corner
      </button>
    </div>
  )
}

function AppliancePanel({ placedId }: { placedId: string }) {
  const design = useStore((s) => s.design)
  const removeAppliance = useStore((s) => s.removeAppliance)
  const flipAppliance = useStore((s) => s.flipAppliance)
  const select = useStore((s) => s.select)
  const unit = useStore((s) => s.unit)
  const placed = design.appliances.find((a) => a.id === placedId)!
  const type: ApplianceType = getAppliance(placed.typeId)
  const frameIdx = design.frames.findIndex((f) => f.id === placed.frameId)
  const frame = design.frames[frameIdx]
  // single-door units can flip their hinge side
  const canFlip = /^(door-40|fridge|kegerator|icemaker)/.test(type.paintAs ?? type.id)

  // installed footprint: module width × counter depth, plus height for units
  // that stand above the counter (kamados, ovens, drop-in grills)
  const w = frame?.width ?? type.minFrameWidth
  const h =
    placed.zone === 'top'
      ? TOP_HEIGHTS[type.id] ?? (type.paintAs ? TOP_HEIGHTS[type.paintAs] : undefined)
      : frame
        ? frameBodyH(frame)
        : undefined
  const size = `${formatLen(w, unit)} W × ${formatLen(RUN_DEPTH, unit)} D${h ? ` × ${formatLen(h, unit)} H` : ''}`

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
          <dt>Size</dt>
          <dd>{size}</dd>
        </div>
        <div>
          <dt>Price</dt>
          <dd className="accent">{formatPrice(type.price)}</dd>
        </div>
      </dl>
      {canFlip && (
        <label className="check-row" title="Which side the door is hinged on">
          <input type="checkbox" checked={Boolean(placed.flipped)} onChange={() => flipAppliance(placed.id)} />
          <span>Hinge on the right</span>
        </label>
      )}
      <button className="btn btn-ghost" onClick={() => select({ kind: 'frame', id: placed.frameId })}>
        Edit this frame
      </button>
      <button className="btn btn-danger-ghost" onClick={() => removeAppliance(placed.id)}>
        Remove appliance
      </button>
    </div>
  )
}
