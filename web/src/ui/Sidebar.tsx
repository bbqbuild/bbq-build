import { useState } from 'react'
import { APPLIANCES, fitsFrame } from '../catalog/appliances'
import { FINISHES, FRAME_SPECS, GROUND_TYPES } from '../catalog/frames'
import { formatPrice, useStore } from '../state/store'
import { useToasts } from './toast'
import type { ApplianceType, FrameWidth } from '../types'

type Tab = 'build' | 'appliances'

export function Sidebar() {
  const [tab, setTab] = useState<Tab>('build')
  return (
    <aside className="sidebar">
      <nav className="tabs">
        <button className={tab === 'build' ? 'active' : ''} onClick={() => setTab('build')}>
          Structure
        </button>
        <button className={tab === 'appliances' ? 'active' : ''} onClick={() => setTab('appliances')}>
          Appliances
        </button>
      </nav>
      {tab === 'build' ? <BuildTab /> : <AppliancesTab />}
    </aside>
  )
}

function BuildTab() {
  const ground = useStore((s) => s.design.ground)
  const frames = useStore((s) => s.design.frames)
  const setGround = useStore((s) => s.setGround)
  const addFrame = useStore((s) => s.addFrame)
  const setAllFinishes = useStore((s) => s.setAllFinishes)
  const setDragging = useStore((s) => s.setDragging)
  const [width, setWidth] = useState(ground.width)

  return (
    <div className="sidebar-body">
      <section>
        <h3>Ground</h3>
        <div className="ground-types">
          {GROUND_TYPES.map((g) => (
            <button
              key={g.id}
              className={`ground-chip ground-${g.id} ${ground.type === g.id ? 'active' : ''}`}
              onClick={() => setGround({ type: g.id })}
              title={`${g.name} — ${formatPrice(g.pricePerM)}/m`}
            >
              <span className={`swatch swatch-${g.id}`} />
              {g.name}
            </button>
          ))}
        </div>
        <label className="slider-row">
          <span>
            Width <strong>{width} cm</strong>
          </span>
          <input
            type="range"
            min={100}
            max={1000}
            step={10}
            value={width}
            onChange={(e) => setWidth(Number(e.target.value))}
            onPointerUp={() => setGround({ width })}
            onKeyUp={(e) => (e.key === 'ArrowLeft' || e.key === 'ArrowRight') && setGround({ width })}
          />
        </label>
      </section>

      <section>
        <h3>Frames</h3>
        <p className="hint">Click to add, or drag onto the canvas to choose the position.</p>
        <div className="frame-cards">
          {FRAME_SPECS.map((f) => (
            <div
              key={f.width}
              className="frame-card"
              draggable
              onDragStart={(e) => {
                setDragging({ kind: 'frame', width: f.width })
                e.dataTransfer.effectAllowed = 'copy'
                e.dataTransfer.setData('text/plain', `frame:${f.width}`)
              }}
              onDragEnd={() => setDragging(null)}
              onClick={() => addFrame(f.width)}
              role="button"
              title={`Add ${f.name}`}
            >
              <div className="frame-card-visual">
                <div className="frame-card-box" style={{ width: `${f.width * 0.55}px` }} />
              </div>
              <div className="frame-card-meta">
                <strong>{f.width} cm</strong>
                <span>{formatPrice(f.price)}</span>
              </div>
            </div>
          ))}
        </div>
      </section>

      {frames.length > 0 && (
        <section>
          <h3>Finish (all frames)</h3>
          <div className="finish-row">
            {FINISHES.map((f) => (
              <button
                key={f.id}
                className={`finish-swatch ${frames.every((fr) => fr.finish === f.id) ? 'active' : ''}`}
                style={{ background: f.swatch }}
                onClick={() => setAllFinishes(f.id)}
                title={f.name}
              />
            ))}
          </div>
        </section>
      )}
    </div>
  )
}

function AppliancesTab() {
  const setDragging = useStore((s) => s.setDragging)
  const selection = useStore((s) => s.selection)
  const design = useStore((s) => s.design)
  const placeAppliance = useStore((s) => s.placeAppliance)
  const push = useToasts((s) => s.push)

  const selectedFrame =
    selection.kind === 'frame'
      ? design.frames.find((f) => f.id === selection.id)
      : selection.kind === 'appliance'
        ? design.frames.find((f) => f.id === design.appliances.find((a) => a.id === selection.id)?.frameId)
        : undefined

  function clickPlace(t: ApplianceType) {
    if (selectedFrame) {
      if (!fitsFrame(t, selectedFrame.width)) {
        push(`${t.shortName} needs a ${t.minFrameWidth} cm frame — the selected frame is ${selectedFrame.width} cm`, 'error')
        return
      }
      placeAppliance(selectedFrame.id, t.id)
      return
    }
    // no frame selected → drop into the first frame that fits and has the zone free
    const target =
      design.frames.find(
        (f) => fitsFrame(t, f.width) && !design.appliances.some((a) => a.frameId === f.id && a.zone === t.zone),
      ) ?? design.frames.find((f) => fitsFrame(t, f.width))
    if (!target) {
      push(design.frames.length ? `No frame is wide enough for the ${t.shortName} (needs ${t.minFrameWidth} cm)` : 'Add a frame first', 'error')
      return
    }
    placeAppliance(target.id, t.id)
  }

  const groups: { title: string; hint: string; items: ApplianceType[] }[] = [
    {
      title: 'Counter level',
      hint: 'Drop-in and on-counter units',
      items: APPLIANCES.filter((a) => a.zone === 'top'),
    },
    {
      title: 'Under counter',
      hint: 'Slides into the frame body',
      items: APPLIANCES.filter((a) => a.zone === 'base'),
    },
  ]

  return (
    <div className="sidebar-body">
      {selectedFrame ? (
        <p className="hint hint-active">
          Placing into the selected <strong>{selectedFrame.width} cm</strong> frame. Greyed items don't fit.
        </p>
      ) : (
        <p className="hint">Drag onto a frame in the canvas, or select a frame first and click to place.</p>
      )}
      {groups.map((g) => (
        <section key={g.title}>
          <h3>
            {g.title} <span className="h-hint">{g.hint}</span>
          </h3>
          <div className="appliance-cards">
            {g.items.map((t) => {
              const disabled = selectedFrame ? !fitsFrame(t, selectedFrame.width) : false
              return (
                <div
                  key={t.id}
                  className={`appliance-card ${disabled ? 'disabled' : ''}`}
                  draggable
                  onDragStart={(e) => {
                    setDragging({ kind: 'appliance', typeId: t.id })
                    e.dataTransfer.effectAllowed = 'copy'
                    e.dataTransfer.setData('text/plain', `appliance:${t.id}`)
                  }}
                  onDragEnd={() => setDragging(null)}
                  onClick={() => clickPlace(t)}
                  role="button"
                  title={t.description}
                >
                  <span className="appliance-icon">{t.icon}</span>
                  <div className="appliance-meta">
                    <strong>{t.shortName}</strong>
                    <span>
                      {t.brand} · min {t.minFrameWidth} cm
                    </span>
                  </div>
                  <span className="appliance-price">{formatPrice(t.price)}</span>
                </div>
              )
            })}
          </div>
        </section>
      ))}
    </div>
  )
}

export type { FrameWidth }
