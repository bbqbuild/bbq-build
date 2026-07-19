import { useState } from 'react'
import { APPLIANCES, APPLIANCE_CATEGORIES, applianceCategory, fitsFrame } from '../catalog/appliances'
import { toApplianceType, type AiProduct } from '../catalog/aiProducts'
import { checkPlacement } from '../catalog/compat'
import { FINISHES, FRAME_SPECS, GROUND_TYPES } from '../catalog/frames'
import { aiSearchAppliances, aiScanUrl, importAppliance } from '../auth/api'
import { groundDepth, runsForLayout, type RunId } from '../types'
import { formatPrice, useStore } from '../state/store'
import { formatLen } from '../units'
import { SizeRow } from './SizeRow'
import { PresetsPanel } from './PresetsPanel'
import { SubSection } from './SubSection'
import { useToasts } from './toast'
import type { ApplianceType, FrameWidth } from '../types'

type Topic = 'ground' | 'presets' | 'frames' | 'appliances'

const TOPICS: { id: Topic; icon: string; label: string; title: string }[] = [
  { id: 'ground', icon: '▦', label: 'Ground', title: 'Ground & extras' },
  { id: 'presets', icon: '✦', label: 'Presets', title: 'Start from a preset' },
  { id: 'frames', icon: '▣', label: 'Frames', title: 'Frames & corners' },
  { id: 'appliances', icon: '🔥', label: 'Appliances', title: 'Appliances' },
]

/**
 * Figma-style left dock: a narrow rail of build topics; clicking one opens its
 * options panel beside the rail (clicking again collapses it).
 */
export function LeftDock() {
  const [open, setOpen] = useState<Topic | null>(() => {
    const v = localStorage.getItem('bbq_dock_left')
    if (v === 'none') return null
    return TOPICS.some((t) => t.id === v) ? (v as Topic) : 'frames'
  })

  const toggle = (t: Topic) => {
    const next = open === t ? null : t
    setOpen(next)
    localStorage.setItem('bbq_dock_left', next ?? 'none')
  }

  const active = TOPICS.find((t) => t.id === open)

  return (
    <>
      <nav className="dock-rail dock-rail-left" aria-label="Build topics">
        {TOPICS.map((t) => (
          <button
            key={t.id}
            className={`rail-btn ${open === t.id ? 'active' : ''}`}
            onClick={() => toggle(t.id)}
            title={t.title}
          >
            <span className="rail-icon">{t.icon}</span>
            <span className="rail-label">{t.label}</span>
          </button>
        ))}
      </nav>
      {active && (
        <section className="dock-panel dock-panel-left">
          <header className="dock-panel-head">
            <h2>{active.title}</h2>
            <button className="btn btn-icon" onClick={() => toggle(active.id)} title="Collapse panel">
              ✕
            </button>
          </header>
          <div className="dock-panel-body">
            {open === 'ground' && <GroundOptions />}
            {open === 'presets' && <PresetsPanel />}
            {open === 'frames' && <FramesOptions />}
            {open === 'appliances' && <AppliancesOptions />}
          </div>
        </section>
      )}
    </>
  )
}

function RunPills() {
  const design = useStore((s) => s.design)
  const activeRun = useStore((s) => s.activeRun)
  const setActiveRun = useStore((s) => s.setActiveRun)
  const runs = runsForLayout(design.layout)
  const available: RunId[] = [
    ...runs,
    ...(design.island ? (['island'] as RunId[]) : []),
    ...(design.island && design.islandCorner ? (['island-wing'] as RunId[]) : []),
  ]
  const label: Record<string, string> = { back: 'Main', left: 'Left', right: 'Right', island: 'Island', 'island-wing': 'Isl. wing' }
  return (
    <div className="run-pills">
      {available.map((r) => (
        <button key={r} className={`run-pill ${activeRun === r ? 'active' : ''}`} onClick={() => setActiveRun(r)}>
          {label[r]}
        </button>
      ))}
    </div>
  )
}

function GroundOptions() {
  const ground = useStore((s) => s.design.ground)
  const island = useStore((s) => Boolean(s.design.island))
  const islandCorner = useStore((s) => Boolean(s.design.islandCorner))
  const addIslandCorner = useStore((s) => s.addIslandCorner)
  const removeIslandCorner = useStore((s) => s.removeIslandCorner)
  const setActiveRunAction = useStore((s) => s.setActiveRun)
  const pergola = useStore((s) => Boolean(s.design.pergola))
  const setPergola = useStore((s) => s.setPergola)
  const islandBar = useStore((s) => Boolean(s.design.islandBar))
  const setIslandBar = useStore((s) => s.setIslandBar)
  const setGround = useStore((s) => s.setGround)
  const setIsland = useStore((s) => s.setIsland)
  const fitGroundToKitchen = useStore((s) => s.fitGroundToKitchen)
  const hasFrames = useStore((s) => s.design.frames.length > 0)
  const unit = useStore((s) => s.unit)
  const push = useToasts((s) => s.push)
  const [width, setWidth] = useState(ground.width)
  const [depth, setDepth] = useState(groundDepth(ground))

  return (
    <>
      <SubSection id="ground_surface" title="Surface" icon="▦" defaultOpen>
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
      </SubSection>

      <SubSection id="ground_size" title="Size" icon="⤢" defaultOpen>
        <SizeRow
          label="Width"
          cm={width}
          unit={unit}
          min={100}
          max={1000}
          onSlide={(v) => setWidth(v)}
          onCommit={(v) => {
            setWidth(v)
            setGround({ width: v })
          }}
        />
        <SizeRow
          label="Depth"
          cm={depth}
          unit={unit}
          min={120}
          max={1000}
          onSlide={(v) => setDepth(v)}
          onCommit={(v) => {
            setDepth(v)
            setGround({ depth: v })
          }}
        />
        <button
          className="btn btn-ghost"
          disabled={!hasFrames}
          title="Shrink the platform to the smallest size that holds everything you've built"
          onClick={() => {
            fitGroundToKitchen()
            const g = useStore.getState().design.ground
            setWidth(g.width)
            setDepth(groundDepth(g))
            push('Ground fitted to your kitchen', 'success')
          }}
        >
          ⇱ Fit ground to kitchen
        </button>
      </SubSection>

      <SubSection id="ground_extras" title="Extras" icon="✚" hint="island · pergola" defaultOpen>
        <label className="check-row" title="A freestanding island counter in front of the main run">
          <input type="checkbox" checked={island} onChange={(e) => setIsland(e.target.checked)} />
          <span>Island in front</span>
        </label>
        {island && (
          <label className="check-row" title="Counter overhangs one side with bar stools; appliances face the cook">
            <input type="checkbox" checked={islandBar} onChange={(e) => setIslandBar(e.target.checked)} />
            <span>Bar seating on island</span>
          </label>
        )}
        <label className="check-row" title="A slatted pergola over the kitchen">
          <input type="checkbox" checked={pergola} onChange={(e) => setPergola(e.target.checked)} />
          <span>Pergola overhead</span>
        </label>
        {island && (
          <div className="island-corner-row">
            {islandCorner ? (
              <button className="btn btn-ghost btn-sm" onClick={removeIslandCorner}>
                Remove island corner
              </button>
            ) : (
              <button
                className="btn btn-ghost btn-sm"
                onClick={() => {
                  addIslandCorner('diagonal')
                  setActiveRunAction('island-wing')
                  push('Island corner added — new frames flow into the island wing', 'success')
                }}
              >
                + Add island corner (L-shape)
              </button>
            )}
          </div>
        )}
      </SubSection>
    </>
  )
}

function FramesOptions() {
  const frames = useStore((s) => s.design.frames)
  const island = useStore((s) => Boolean(s.design.island))
  const activeRun = useStore((s) => s.activeRun)
  const layout = useStore((s) => s.design.layout ?? 'straight')
  const addFrame = useStore((s) => s.addFrame)
  const addCornerUnit = useStore((s) => s.addCornerUnit)
  const setAllFinishes = useStore((s) => s.setAllFinishes)
  const setDragging = useStore((s) => s.setDragging)
  const unit = useStore((s) => s.unit)
  const push = useToasts((s) => s.push)

  const cornersFull = layout === 'u'
  const runLabel = { back: 'main run', left: 'left wing', right: 'right wing', island: 'island', 'island-wing': 'island wing' }[activeRun]

  const addCorner = (style: 'diagonal' | 'square') => {
    const wing = addCornerUnit(style)
    if (!wing) push('Both corners are already in place — remove one to change it', 'info')
    else push(`Corner added — new frames go to the ${wing} wing`, 'success')
  }

  return (
    <>
      <SubSection id="frames_modules" title="Frames" icon="▣" hint={`adding to ${runLabel}`} defaultOpen>
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
              onClick={() => addFrame(f.width, undefined, false, activeRun)}
              role="button"
              title={`Add ${f.name}`}
            >
              <div className="frame-card-visual">
                <div className="frame-card-box" style={{ width: `${f.width * 0.55}px` }} />
              </div>
              <div className="frame-card-meta">
                <strong>{formatLen(f.width, unit)}</strong>
                <span>{formatPrice(f.price)}</span>
              </div>
            </div>
          ))}
          <div
            className="frame-card frame-card-smoker"
            draggable
            onDragStart={(e) => {
              setDragging({ kind: 'frame', width: 80, lowered: true })
              e.dataTransfer.effectAllowed = 'copy'
              e.dataTransfer.setData('text/plain', 'frame:80:lowered')
            }}
            onDragEnd={() => setDragging(null)}
            onClick={() => addFrame(80, undefined, true, activeRun)}
            role="button"
            title="Lowered table for kamado smokers (Big Green Egg, Primo)"
          >
            <div className="frame-card-visual">
              <div className="frame-card-box frame-card-box-low" style={{ width: `${80 * 0.55}px` }} />
            </div>
            <div className="frame-card-meta">
              <strong>Smoker {formatLen(80, unit)}</strong>
              <span>{formatPrice(340)}</span>
            </div>
          </div>
          <div
            className="frame-card frame-card-custom"
            onClick={() => addFrame(70, undefined, false, activeRun)}
            role="button"
            title="Add a frame, then set any width & height in the inspector"
          >
            <div className="frame-card-visual">
              <div className="frame-card-box frame-card-box-custom">✎</div>
            </div>
            <div className="frame-card-meta">
              <strong>Custom</strong>
              <span>any size</span>
            </div>
          </div>
        </div>
      </SubSection>

      <SubSection id="frames_corners" title="Corners" icon="◲" hint="turn the counter 90°" defaultOpen>
        <p className="hint">Add a corner to start a wing. New frames then flow into that wing.</p>
        <div className="corner-cards">
          <button className="corner-card" onClick={() => addCorner('diagonal')} disabled={cornersFull}>
            <span className="corner-glyph corner-diag" />
            Diagonal
          </button>
          <button className="corner-card" onClick={() => addCorner('square')} disabled={cornersFull}>
            <span className="corner-glyph corner-square" />
            Square
          </button>
        </div>
        {(layout !== 'straight' || island) && (
          <div className="run-switch">
            <span>New frames go to:</span>
            <RunPills />
          </div>
        )}
      </SubSection>

      {frames.length > 0 && (
        <SubSection id="frames_finish" title="Finish" icon="🎨" hint="all frames" defaultOpen>
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
        </SubSection>
      )}
    </>
  )
}

function AppliancesOptions() {
  const setDragging = useStore((s) => s.setDragging)
  const selection = useStore((s) => s.selection)
  const design = useStore((s) => s.design)
  const placeAppliance = useStore((s) => s.placeAppliance)
  const removeCustomAppliance = useStore((s) => s.removeCustomAppliance)
  const sharedCatalog = useStore((s) => s.sharedCatalog)
  const unit = useStore((s) => s.unit)
  const push = useToasts((s) => s.push)
  const ownIds = new Set((design.custom ?? []).map((c) => c.id))

  const selectedFrame =
    selection.kind === 'frame'
      ? design.frames.find((f) => f.id === selection.id)
      : selection.kind === 'appliance'
        ? design.frames.find((f) => f.id === design.appliances.find((a) => a.id === selection.id)?.frameId)
        : undefined

  function clickPlace(t: ApplianceType) {
    if (selectedFrame) {
      const check = checkPlacement(design, selectedFrame, t)
      if (!check.ok) {
        push(
          !fitsFrame(t, selectedFrame.width)
            ? `${t.shortName} needs a ${formatLen(t.minFrameWidth, unit)} frame — the selected frame is ${formatLen(selectedFrame.width, unit)}`
            : check.reason ?? 'This appliance can’t go there',
          'error',
        )
        return
      }
      placeAppliance(selectedFrame.id, t.id)
      return
    }
    // no frame selected → first valid frame with the zone free, else any valid frame
    const valid = design.frames.filter((f) => checkPlacement(design, f, t).ok)
    const target =
      valid.find((f) => !design.appliances.some((a) => a.frameId === f.id && a.zone === t.zone)) ?? valid[0]
    if (!target) {
      push(
        design.frames.length
          ? `No frame can take the ${t.shortName} right now (needs ${formatLen(t.minFrameWidth, unit)} and a compatible neighbour)`
          : 'Add a frame first',
        'error',
      )
      return
    }
    placeAppliance(target.id, t.id)
  }

  // imported items first (this design's + everyone's shared catalog, deduped),
  // so a freshly added product tops its group
  const importedById = new Map<string, ApplianceType>()
  for (const a of [...(design.custom ?? []), ...sharedCatalog]) if (!importedById.has(a.id)) importedById.set(a.id, a)
  const all = [...importedById.values(), ...APPLIANCES]
  const groups = APPLIANCE_CATEGORIES.map((c) => ({
    ...c,
    items: all.filter((a) => applianceCategory(a) === c.id),
  })).filter((g) => g.items.length > 0)

  return (
    <>
      {selectedFrame ? (
        <p className="hint hint-active">
          Placing into the selected <strong>{formatLen(selectedFrame.width, unit)}</strong> frame. Greyed items don't fit.
        </p>
      ) : (
        <p className="hint">Drag onto a frame in the canvas, or select a frame first and click to place.</p>
      )}
      <SubSection id="appl_search" title="Real products" icon="✨" hint="powered by Gemini">
        <AiProductSearch />
      </SubSection>
      {groups.map((g) => (
        <SubSection key={g.id} id={`appl_${g.id}`} title={g.name} icon={g.icon} count={g.items.length} defaultOpen={g.id === 'grills'}>
          <div className="appliance-cards">
            {g.items.map((t) => {
              const check = selectedFrame ? checkPlacement(design, selectedFrame, t) : { ok: true }
              return (
                <div
                  key={t.id}
                  className={`appliance-card ${check.ok ? '' : 'disabled'}`}
                  draggable
                  onDragStart={(e) => {
                    setDragging({ kind: 'appliance', typeId: t.id })
                    e.dataTransfer.effectAllowed = 'copy'
                    e.dataTransfer.setData('text/plain', `appliance:${t.id}`)
                  }}
                  onDragEnd={() => setDragging(null)}
                  onClick={() => clickPlace(t)}
                  role="button"
                  title={check.ok ? t.description : check.reason}
                >
                  <span className="appliance-icon">{t.icon}</span>
                  <div className="appliance-meta">
                    <strong>{t.shortName}</strong>
                    <span>
                      {t.brand} · min {formatLen(t.minFrameWidth, unit)}
                    </span>
                  </div>
                  <span className="appliance-price">{formatPrice(t.price)}</span>
                  {ownIds.has(t.id) && (
                    <button
                      className="appliance-remove"
                      title="Remove from your list (stays in the bbq.build catalog)"
                      onClick={(e) => {
                        e.stopPropagation()
                        removeCustomAppliance(t.id)
                      }}
                    >
                      ✕
                    </button>
                  )}
                </div>
              )
            })}
          </div>
        </SubSection>
      ))}
    </>
  )
}

const BRANDS = ['VEVOR', 'Napoleon', 'Blaze']

function AiProductSearch() {
  const [query, setQuery] = useState('')
  const [url, setUrl] = useState('')
  const [busy, setBusy] = useState(false)
  const [results, setResults] = useState<AiProduct[] | null>(null)
  const addCustomAppliance = useStore((s) => s.addCustomAppliance)
  const design = useStore((s) => s.design)
  const push = useToasts((s) => s.push)

  async function runSearch(q: string) {
    if (!q.trim() || busy) return
    setBusy(true)
    setResults(null)
    try {
      const { items } = await aiSearchAppliances(q.trim())
      setResults(items)
      if (!items.length) push('No products found — try a different search', 'info')
    } catch (err) {
      push(err instanceof Error ? err.message : 'Search failed', 'error')
    } finally {
      setBusy(false)
    }
  }

  async function search(e: React.FormEvent) {
    e.preventDefault()
    runSearch(query)
  }

  async function scanUrl(e: React.FormEvent) {
    e.preventDefault()
    if (!url.trim() || busy) return
    setBusy(true)
    try {
      const { item } = await aiScanUrl(url.trim())
      add(item)
      setUrl('')
    } catch (err) {
      push(err instanceof Error ? err.message : 'Could not read that URL', 'error')
    } finally {
      setBusy(false)
    }
  }

  function add(p: AiProduct) {
    const t = toApplianceType(p)
    if (typeof t === 'string') {
      push(t, 'error')
      return
    }
    addCustomAppliance(t)
    // submit to the shared catalog for admin vetting (or auto-approved if admin)
    importAppliance(t).then((r) => {
      push(
        r?.status === 'approved'
          ? `${t.name} added to the catalog`
          : `${t.name} added — submitted to bbq.build for review`,
        'success',
      )
    })
  }

  return (
    <div className="ai-search">
      <div className="brand-row">
        {BRANDS.map((b) => (
          <button key={b} className="brand-chip" disabled={busy} onClick={() => runSearch(`${b} outdoor kitchen built-in appliances`)}>
            {b}
          </button>
        ))}
      </div>
      <form className="ai-search-row" onSubmit={search}>
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search any brand or product…"
          disabled={busy}
        />
        <button className="btn" type="submit" disabled={busy || !query.trim()}>
          {busy ? '…' : 'Find'}
        </button>
      </form>
      <form className="ai-search-row" onSubmit={scanUrl}>
        <input
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="…or paste a product URL"
          disabled={busy}
        />
        <button className="btn" type="submit" disabled={busy || !url.trim()} title="Scan a product page and add it">
          {busy ? '…' : 'Scan'}
        </button>
      </form>
      {busy && <p className="hint">Searching the real world…</p>}
      {results && results.length > 0 && (
        <div className="appliance-cards">
          {results.map((p, i) => {
            const added = (design.custom ?? []).some((c) => c.name === `${p.brand} ${p.model}`)
            return (
              <div key={i} className="appliance-card ai-result" title={p.blurb}>
                <div className="appliance-meta">
                  <strong>
                    {p.brand} {p.model}
                  </strong>
                  <span>
                    {p.category} · {Math.round(p.width_cm)} cm · ${Math.round(p.price_usd).toLocaleString()}
                    {p.url && (
                      <>
                        {' · '}
                        <a href={p.url} target="_blank" rel="noreferrer">
                          view
                        </a>
                      </>
                    )}
                  </span>
                </div>
                <button className="btn btn-icon" onClick={() => add(p)} disabled={added} title="Add to catalog">
                  {added ? '✓' : '+'}
                </button>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

export type { FrameWidth }
