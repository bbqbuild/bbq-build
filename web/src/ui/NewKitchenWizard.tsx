import { useMemo, useState } from 'react'
import { APPLIANCES } from '../catalog/appliances'
import { generateKitchen } from '../catalog/generate'
import { useStore } from '../state/store'
import type { Design, LayoutShape } from '../types'
import { formatPrice } from '../state/store'
import { SizeRow } from './SizeRow'

type Counts = Record<string, number>

// which catalog groups appear on the appliance step, in order
const GROUPS: { label: string; hint: string; match: (id: string) => boolean }[] = [
  { label: 'Cooking', hint: 'grills, smokers, ovens', match: (id) => /^(grill|santamaria|egg|primo|pizza|gozney|taboon|griddle|burner)/.test(id) },
  { label: 'Sink & prep', hint: 'wash and prep', match: (id) => /^sink/.test(id) },
  { label: 'Cold storage', hint: 'fridge, keg, ice', match: (id) => /^(fridge|kegerator|icemaker|icebin)/.test(id) },
  { label: 'Storage', hint: 'doors, drawers, bins', match: (id) => /^(doors|door|drawers|trash|woodstore)/.test(id) },
]

const LAYOUTS: { id: LayoutShape; label: string; blurb: string }[] = [
  { id: 'straight', label: 'Straight', blurb: 'One run along a wall' },
  { id: 'l-right', label: 'L-shape', blurb: 'A run plus a wing' },
  { id: 'u', label: 'U-shape', blurb: 'Wrap-around, three sides' },
]

function LayoutDiagram({ id, island }: { id: LayoutShape; island: boolean }) {
  // simple top-down schematic
  const bar = (x: number, y: number, w: number, h: number, key: string) => (
    <rect key={key} x={x} y={y} width={w} height={h} rx={2} fill="#c9c3b4" stroke="#8b8574" strokeWidth={0.8} />
  )
  const parts = [] as JSX.Element[]
  // back run (top)
  parts.push(bar(10, 8, 80, 12, 'back'))
  if (id === 'l-right' || id === 'u') parts.push(bar(78, 8, 12, 46, 'r'))
  if (id === 'l-left' || id === 'u') parts.push(bar(10, 8, 12, 46, 'l'))
  if (island) parts.push(bar(28, 62, 44, 12, 'isl'))
  return (
    <svg viewBox="0 0 100 80" className="wiz-diagram" aria-hidden>
      {parts}
    </svg>
  )
}

export function NewKitchenWizard({
  onDone,
  onSkip,
  onCancel,
}: {
  onDone: (d: Design) => void
  onSkip: () => void
  onCancel?: () => void
}) {
  const unit = useStore((s) => s.unit)
  const [step, setStep] = useState(0)
  const [counts, setCounts] = useState<Counts>({})
  const [sizeMe, setSizeMe] = useState(true)
  const [width, setWidth] = useState(490) // cm (~16 ft)
  const [depth, setDepth] = useState(360)
  const [layout, setLayout] = useState<LayoutShape>('straight')
  const [island, setIsland] = useState(false)

  const chosen = useMemo(() => Object.entries(counts).filter(([, n]) => n > 0), [counts])
  const totalCount = chosen.reduce((s, [, n]) => s + n, 0)
  const flatList = useMemo(() => chosen.flatMap(([id, n]) => Array(n).fill(id) as string[]), [chosen])
  const estPrice = useMemo(
    () => flatList.reduce((s, id) => s + (APPLIANCES.find((a) => a.id === id)?.price ?? 0), 0),
    [flatList],
  )

  const inc = (id: string, d: number) =>
    setCounts((c) => ({ ...c, [id]: Math.max(0, Math.min(6, (c[id] ?? 0) + d)) }))

  // recommend a layout once, based on how much they picked
  const recommend = () => {
    if (totalCount >= 7) return 'u' as const
    if (totalCount >= 4) return 'l-right' as const
    return 'straight' as const
  }

  const goLayoutStep = () => {
    setLayout(recommend())
    setStep(2)
  }

  const finish = () => {
    const design = generateKitchen({
      appliances: flatList,
      layout,
      island,
      spaceWidth: sizeMe ? undefined : width,
      spaceDepth: sizeMe ? undefined : depth,
    })
    onDone(design)
  }

  return (
    <div className="modal-backdrop wiz-backdrop">
      <div className="modal wiz" onClick={(e) => e.stopPropagation()}>
        <header className="wiz-head">
          <div className="wiz-steps">
            {['Appliances', 'Space', 'Layout'].map((s, i) => (
              <span key={s} className={`wiz-step ${i === step ? 'on' : ''} ${i < step ? 'done' : ''}`}>
                {i + 1}. {s}
              </span>
            ))}
          </div>
          <div className="wiz-head-actions">
            <button className="btn btn-ghost btn-sm" onClick={onSkip}>
              Start from scratch
            </button>
            {onCancel && (
              <button
                className="btn btn-icon"
                title="Cancel"
                onClick={() => {
                  if (totalCount === 0 || confirm('Discard this new kitchen and go back?')) onCancel()
                }}
              >
                ✕
              </button>
            )}
          </div>
        </header>

        {step === 0 && (
          <div className="wiz-body">
            <h2>What do you want to cook with?</h2>
            <p className="wiz-sub">Pick the appliances first — we’ll size the cabinetry to their real cutouts.</p>
            {GROUPS.map((g) => {
              const items = APPLIANCES.filter((a) => g.match(a.id))
              if (!items.length) return null
              return (
                <div key={g.label} className="wiz-group">
                  <div className="wiz-group-head">
                    <strong>{g.label}</strong>
                    <span>{g.hint}</span>
                  </div>
                  <div className="wiz-grid">
                    {items.map((a) => {
                      const n = counts[a.id] ?? 0
                      return (
                        <div key={a.id} className={`wiz-card ${n > 0 ? 'picked' : ''}`}>
                          <button className="wiz-card-main" onClick={() => inc(a.id, 1)}>
                            <span className="wiz-ico">{a.icon}</span>
                            <span className="wiz-name">{a.shortName}</span>
                            <span className="wiz-price">{formatPrice(a.price)}</span>
                          </button>
                          {n > 0 && (
                            <div className="wiz-qty">
                              <button onClick={() => inc(a.id, -1)}>−</button>
                              <span>{n}</span>
                              <button onClick={() => inc(a.id, 1)}>+</button>
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {step === 1 && (
          <div className="wiz-body">
            <h2>How much space do you have?</h2>
            <p className="wiz-sub">Give the footprint of the area, or let us size the platform for your build.</p>
            <label className="check-row">
              <input type="checkbox" checked={sizeMe} onChange={(e) => setSizeMe(e.target.checked)} />
              <span>I’m not sure yet — size it for me</span>
            </label>
            <div className={sizeMe ? 'wiz-dim disabled' : 'wiz-dim'}>
              <SizeRow label="Area width" cm={width} unit={unit} min={200} max={1200} onSlide={setWidth} onCommit={setWidth} />
              <SizeRow label="Area depth" cm={depth} unit={unit} min={150} max={900} onSlide={setDepth} onCommit={setDepth} />
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="wiz-body">
            <h2>Pick a layout</h2>
            <p className="wiz-sub">A starting shape — you can reshape it freely afterwards.</p>
            <div className="wiz-layouts">
              {LAYOUTS.map((l) => (
                <button
                  key={l.id}
                  className={`wiz-layout ${layout === l.id ? 'on' : ''}`}
                  onClick={() => setLayout(l.id)}
                >
                  <LayoutDiagram id={l.id} island={island} />
                  <strong>{l.label}</strong>
                  <span>{l.blurb}</span>
                  {layout === l.id && recommend() === l.id && <em className="wiz-rec">Recommended</em>}
                </button>
              ))}
            </div>
            <label className="check-row wiz-island">
              <input type="checkbox" checked={island} onChange={(e) => setIsland(e.target.checked)} />
              <span>Add a freestanding island (bar seating / prep)</span>
            </label>
          </div>
        )}

        <footer className="wiz-foot">
          <div className="wiz-summary">
            {totalCount > 0 ? (
              <>
                {totalCount} appliance{totalCount > 1 ? 's' : ''} · ~{formatPrice(estPrice)}
              </>
            ) : (
              'No appliances yet'
            )}
          </div>
          <div className="wiz-nav">
            {step > 0 && (
              <button className="btn btn-ghost" onClick={() => setStep((s) => s - 1)}>
                Back
              </button>
            )}
            {step === 0 && (
              <button className="btn btn-primary" disabled={totalCount === 0} onClick={() => setStep(1)}>
                Next
              </button>
            )}
            {step === 1 && (
              <button className="btn btn-primary" onClick={goLayoutStep}>
                Next
              </button>
            )}
            {step === 2 && (
              <button className="btn btn-primary" onClick={finish}>
                Generate my kitchen
              </button>
            )}
          </div>
        </footer>
      </div>
    </div>
  )
}
