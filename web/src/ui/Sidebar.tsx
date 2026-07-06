import { useState } from 'react'
import { APPLIANCES, fitsFrame } from '../catalog/appliances'
import { toApplianceType, type AiProduct } from '../catalog/aiProducts'
import { checkPlacement } from '../catalog/compat'
import { FINISHES, FRAME_SPECS, GROUND_TYPES } from '../catalog/frames'
import { aiSearchAppliances } from '../auth/api'
import { groundDepth, type LayoutShape } from '../types'
import { formatPrice, useStore } from '../state/store'
import { formatLen } from '../units'
import { SizeRow } from './SizeRow'
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

const LAYOUTS: { id: LayoutShape; name: string; glyph: string }[] = [
  { id: 'straight', name: 'Straight', glyph: '▬' },
  { id: 'l-left', name: 'L left', glyph: '⌐' },
  { id: 'l-right', name: 'L right', glyph: '¬' },
  { id: 'u', name: 'U shape', glyph: '⊓' },
]

function BuildTab() {
  const ground = useStore((s) => s.design.ground)
  const frames = useStore((s) => s.design.frames)
  const layout = useStore((s) => s.design.layout ?? 'straight')
  const island = useStore((s) => Boolean(s.design.island))
  const setGround = useStore((s) => s.setGround)
  const setLayout = useStore((s) => s.setLayout)
  const setIsland = useStore((s) => s.setIsland)
  const addFrame = useStore((s) => s.addFrame)
  const setAllFinishes = useStore((s) => s.setAllFinishes)
  const setDragging = useStore((s) => s.setDragging)
  const unit = useStore((s) => s.unit)
  const [width, setWidth] = useState(ground.width)
  const [depth, setDepth] = useState(groundDepth(ground))

  return (
    <div className="sidebar-body">
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
            onClick={() => addFrame(80, undefined, true)}
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

      <CollapsibleSection title="Base & layout" storageKey="bbq_ground_open">
        <h4 className="sub-h">Shape</h4>
        <div className="layout-row">
          {LAYOUTS.map((l) => (
            <button
              key={l.id}
              className={`layout-chip ${layout === l.id ? 'active' : ''}`}
              onClick={() => setLayout(l.id)}
              title={l.name}
            >
              <span className="layout-glyph">{l.glyph}</span>
              {l.name}
            </button>
          ))}
        </div>
        <label className="check-row" title="A freestanding island counter in front of the main run">
          <input type="checkbox" checked={island} onChange={(e) => setIsland(e.target.checked)} />
          <span>Island in front</span>
        </label>

        <h4 className="sub-h">Ground</h4>
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
      </CollapsibleSection>
    </div>
  )
}

function CollapsibleSection({ title, storageKey, children }: { title: string; storageKey: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(() => localStorage.getItem(storageKey) === 'open')
  return (
    <section className="collapsible">
      <button
        className="collapsible-head"
        onClick={() => {
          const next = !open
          setOpen(next)
          localStorage.setItem(storageKey, next ? 'open' : 'closed')
        }}
      >
        <span className={`chevron ${open ? 'open' : ''}`}>▸</span>
        {title}
      </button>
      {open && <div className="collapsible-body">{children}</div>}
    </section>
  )
}


function AppliancesTab() {
  const setDragging = useStore((s) => s.setDragging)
  const selection = useStore((s) => s.selection)
  const design = useStore((s) => s.design)
  const placeAppliance = useStore((s) => s.placeAppliance)
  const unit = useStore((s) => s.unit)
  const push = useToasts((s) => s.push)

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

  const all = [...APPLIANCES, ...(design.custom ?? [])]
  const groups: { title: string; hint: string; items: ApplianceType[] }[] = [
    {
      title: 'Counter level',
      hint: 'Drop-in and on-counter units',
      items: all.filter((a) => a.zone === 'top'),
    },
    {
      title: 'Under counter',
      hint: 'Slides into the frame body',
      items: all.filter((a) => a.zone === 'base'),
    },
  ]

  return (
    <div className="sidebar-body">
      {selectedFrame ? (
        <p className="hint hint-active">
          Placing into the selected <strong>{formatLen(selectedFrame.width, unit)}</strong> frame. Greyed items don't fit.
        </p>
      ) : (
        <p className="hint">Drag onto a frame in the canvas, or select a frame first and click to place.</p>
      )}
      <AiProductSearch />
      {groups.map((g) => (
        <section key={g.title}>
          <h3>
            {g.title} <span className="h-hint">{g.hint}</span>
          </h3>
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
                </div>
              )
            })}
          </div>
        </section>
      ))}
    </div>
  )
}

function AiProductSearch() {
  const [query, setQuery] = useState('')
  const [busy, setBusy] = useState(false)
  const [results, setResults] = useState<AiProduct[] | null>(null)
  const addCustomAppliance = useStore((s) => s.addCustomAppliance)
  const design = useStore((s) => s.design)
  const push = useToasts((s) => s.push)

  async function search(e: React.FormEvent) {
    e.preventDefault()
    if (!query.trim() || busy) return
    setBusy(true)
    setResults(null)
    try {
      const { items } = await aiSearchAppliances(query.trim())
      setResults(items)
      if (!items.length) push('No products found — try a different search', 'info')
    } catch (err) {
      push(err instanceof Error ? err.message : 'Search failed', 'error')
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
    push(`${t.name} added to your catalog`, 'success')
  }

  return (
    <section className="ai-search">
      <h3>
        ✨ Real products <span className="h-hint">powered by Gemini</span>
      </h3>
      <form className="ai-search-row" onSubmit={search}>
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="e.g. Napoleon built-in grill"
          disabled={busy}
        />
        <button className="btn" type="submit" disabled={busy || !query.trim()}>
          {busy ? '…' : 'Find'}
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
    </section>
  )
}

export type { FrameWidth }
