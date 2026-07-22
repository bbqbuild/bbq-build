import { useEffect, useMemo, useState } from 'react'
import { aiValidate, type ValidationReport } from '../auth/api'
import { catalogSummary } from '../catalog/appliances'
import { analyzeBuild } from '../catalog/analyze'
import { specAsText } from '../spec'
import { formatPrice, priceBreakdown, useStore } from '../state/store'
import { formatLen } from '../units'
import { Inspector } from './Inspector'
import { useRenderState } from './renderState'
import { useToasts } from './toast'

type Tab = 'selection' | 'spec' | 'render' | 'quotes' | 'diy' | 'quality'

const TABS: { id: Tab; icon: string; label: string; title: string }[] = [
  { id: 'selection', icon: '✏️', label: 'Edit', title: 'Edit selection' },
  { id: 'spec', icon: '🧾', label: 'Spec', title: 'Spec sheet & price' },
  { id: 'render', icon: '📷', label: 'Render', title: 'AI photos & video' },
  { id: 'quotes', icon: '📨', label: 'Quotes', title: 'Get Quotes' },
  { id: 'diy', icon: '🛠', label: 'DIY', title: 'DIY build projects' },
  { id: 'quality', icon: '🛡', label: 'Quality', title: 'Quality Check' },
]

const TITLES: Record<Tab, string> = {
  selection: 'Edit',
  spec: 'Spec',
  render: 'AI Render',
  quotes: 'Get Quotes',
  diy: 'DIY',
  quality: 'Quality Check',
}

/**
 * Figma-style right dock: everything about the *result* — the spec sheet,
 * quotes, DIY projects and the quality check — plus the selection inspector.
 * A rail on the far right; the active panel opens beside it.
 */
export function RightDock() {
  const [open, setOpen] = useState<Tab | null>(() => {
    const v = localStorage.getItem('bbq_dock_right')
    if (v === 'none') return null
    return TABS.some((t) => t.id === v) ? (v as Tab) : 'selection'
  })
  const selection = useStore((s) => s.selection)
  const design = useStore((s) => s.design)
  const { total } = priceBreakdown(design)

  // selecting something on the canvas pulls the dock to the Edit panel,
  // mirroring how the old always-on inspector behaved
  useEffect(() => {
    if (selection.kind !== 'none') setOpen('selection')
  }, [selection])

  const toggle = (t: Tab) => {
    const next = open === t ? null : t
    setOpen(next)
    localStorage.setItem('bbq_dock_right', next ?? 'none')
  }

  return (
    <>
      {open && (
        <section className="dock-panel dock-panel-right">
          <header className="dock-panel-head">
            <h2>{TITLES[open]}</h2>
            <button className="btn btn-icon" onClick={() => toggle(open)} title="Collapse panel">
              ✕
            </button>
          </header>
          <div className="dock-panel-body">
            {open === 'selection' && <Inspector />}
            {open === 'spec' && <SpecPanel />}
            {open === 'render' && <RenderPanel />}
            {open === 'quotes' && <QuotesPanel />}
            {open === 'diy' && <DiyPanel />}
            {open === 'quality' && <QualityPanel />}
          </div>
        </section>
      )}
      <nav className="dock-rail dock-rail-right" aria-label="Results">
        {TABS.map((t) => (
          <button
            key={t.id}
            className={`rail-btn ${open === t.id ? 'active' : ''}`}
            onClick={() => toggle(t.id)}
            title={t.title}
          >
            <span className="rail-icon">{t.icon}</span>
            <span className="rail-label">{t.label}</span>
            {t.id === 'spec' && <span className="rail-badge">{formatPrice(total)}</span>}
          </button>
        ))}
      </nav>
    </>
  )
}

function SpecPanel() {
  const design = useStore((s) => s.design)
  const unit = useStore((s) => s.unit)
  const { lines, total } = priceBreakdown(design, unit)

  function exportJson() {
    const spec = {
      generator: 'bbq.build v2',
      exportedAt: new Date().toISOString(),
      design,
      billOfMaterials: lines,
      totalUsd: total,
    }
    const blob = new Blob([JSON.stringify(spec, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${design.name.replace(/\s+/g, '-').toLowerCase() || 'kitchen'}-spec.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <>
      <p className="hint">
        {design.name} · {design.frames.length} frames ·{' '}
        {formatLen(design.frames.reduce((s, f) => s + f.width, 0), unit)} run
      </p>
      <div className="spec-lines">
        {lines.map((l, i) => (
          <div className="spec-line" key={i}>
            <div className="spec-line-what">
              <strong>{l.label}</strong>
              <span>{l.detail}</span>
            </div>
            <div className="spec-line-price">
              {l.qty > 1 && <span>{l.qty} × {formatPrice(l.unit)}</span>}
              <strong>{formatPrice(l.total)}</strong>
            </div>
          </div>
        ))}
        {!lines.length && <p className="hint">Nothing here yet — add frames and appliances.</p>}
      </div>
      <div className="spec-total">
        <span>Estimated total</span>
        <strong className="accent">{formatPrice(total)}</strong>
      </div>
      <button className="btn btn-ghost" onClick={exportJson}>
        ⬇ Export spec (JSON)
      </button>
    </>
  )
}

/**
 * AI photos: screenshots the real 3D model from a few fixed angles, then asks Gemini
 * to turn each into a photorealistic photo of the SAME kitchen (image-to-image, not a
 * from-scratch generation, so layout/appliances stay accurate).
 *
 * AI video: records a scripted camera orbit of the real 3D model client-side (canvas
 * captureStream + MediaRecorder) — an exact walkthrough of what was actually built,
 * with no per-clip generation cost or wait.
 *
 * Generation/recording state lives in `useRenderState` (a standalone store, not local
 * state) so closing this panel or switching to another dock tab mid-run doesn't lose
 * progress or the finished result — reopening shows exactly where things left off, with
 * a Regenerate option rather than the plain "Generate" button reappearing.
 */
function RenderPanel() {
  const design = useStore((s) => s.design)
  const { photos, generating, photoError, videoUrl, videoPct, videoError, generatePhotos, recordVideo } = useRenderState()

  const empty = design.frames.length === 0
  const fileBase = (design.name || 'kitchen').replace(/\s+/g, '-').toLowerCase()

  return (
    <>
      <section>
        <h3>AI photos</h3>
        <p className="hint">
          Turns your exact 3D model into a few photorealistic shots — same layout, same appliances, same finish.
        </p>
        <button className="btn btn-primary" onClick={generatePhotos} disabled={empty || generating}>
          {generating ? 'Rendering…' : photos ? '🔄 Regenerate photos' : '📷 Generate photos'}
        </button>
        {photoError && <div className="login-error">{photoError}</div>}
        {photos && (
          <div className="render-gallery">
            {photos.map((p, i) => (
              <figure className="render-shot" key={i}>
                {!p.done ? (
                  <div className="render-shot-loading">
                    <img src={p.raw} alt={p.view} />
                    <div className="chat-typing">
                      <span />
                      <span />
                      <span />
                    </div>
                  </div>
                ) : (
                  <img src={p.image ?? p.raw} alt={p.view} />
                )}
                <figcaption>
                  <span>{p.view}</span>
                  {p.image && (
                    <a className="btn btn-sm btn-ghost" href={p.image} download={`${fileBase}-${i + 1}.png`}>
                      ⬇
                    </a>
                  )}
                </figcaption>
              </figure>
            ))}
          </div>
        )}
      </section>
      <section>
        <h3>AI video</h3>
        <p className="hint">
          Records a smooth camera flythrough of your real 3D model — an exact walkthrough of what you built, ready in
          seconds.
        </p>
        <button className="btn btn-primary" onClick={recordVideo} disabled={empty || videoPct !== null}>
          {videoPct !== null ? `Recording… ${videoPct}%` : videoUrl ? '🔄 Re-record flythrough' : '🎬 Record flythrough'}
        </button>
        {videoError && <div className="login-error">{videoError}</div>}
        {videoUrl && (
          <div className="render-video">
            {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
            <video src={videoUrl} controls loop />
            <a className="btn btn-ghost" href={videoUrl} download={`${fileBase}-flythrough.webm`}>
              ⬇ Download video
            </a>
          </div>
        )}
      </section>
    </>
  )
}

function QuotesPanel() {
  const design = useStore((s) => s.design)
  const unit = useStore((s) => s.unit)
  const { total } = priceBreakdown(design, unit)

  const mailto = () => {
    const subject = encodeURIComponent(`Quote request — ${design.name}`)
    const body = encodeURIComponent(
      `Hi,\n\nI'd like a quote for this outdoor kitchen:\n\n${specAsText(design, unit)}\n`,
    )
    window.location.href = `mailto:?subject=${subject}&body=${body}`
  }

  return (
    <>
      <div className="spec-total">
        <span>Your estimate</span>
        <strong className="accent">{formatPrice(total)}</strong>
      </div>
      <p className="hint">
        That's the parts estimate — a local outdoor-kitchen builder can quote the real build, delivery and
        installation from your spec.
      </p>
      <button className="btn btn-primary" onClick={mailto} disabled={!design.frames.length} title="Opens your email app with the full spec pasted in">
        📨 Email this spec to a builder
      </button>
      <p className="hint">
        We're onboarding local builders now — soon you'll pick shops here and get quotes back without leaving
        bbq.build.
      </p>
    </>
  )
}

function DiyPanel() {
  const design = useStore((s) => s.design)
  const createGroup = useStore((s) => s.createGroup)
  const startDiyProject = useStore((s) => s.startDiyProject)
  const select = useStore((s) => s.select)
  const push = useToasts((s) => s.push)
  const groups = design.groups ?? []
  const projects = design.diy ?? []

  const openProject = (projectId: string) =>
    window.dispatchEvent(new CustomEvent('bbq:diy', { detail: { projectId } }))

  const start = (groupId: string) => {
    const id = startDiyProject(groupId)
    if (id) openProject(id)
  }

  const diyWholeKitchen = () => {
    const id = createGroup('Whole kitchen', design.frames.map((f) => f.id))
    if (!id) return
    const pid = startDiyProject(id)
    if (pid) openProject(pid)
    else push('Could not start the project — try again', 'error')
  }

  const groupsWithoutProject = groups.filter((g) => !projects.some((p) => p.groupId === g.id))

  return (
    <>
      <p className="hint">
        Build it yourself: get a full plan — materials, tools, utilities and IKEA-style steps — for a section of
        your kitchen, and track the build.
      </p>
      {projects.length > 0 && (
        <section>
          <h3>Your projects</h3>
          <ul className="group-list">
            {projects.map((p) => (
              <li key={p.id}>
                <button className="group-list-name" onClick={() => openProject(p.id)}>
                  🛠 {p.name} <span>{p.status === 'ready' ? '· plan ready' : '· setting up'}</span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}
      {groupsWithoutProject.length > 0 && (
        <section>
          <h3>Sections without a project</h3>
          <ul className="group-list">
            {groupsWithoutProject.map((g) => (
              <li key={g.id}>
                <button className="group-list-name" onClick={() => select({ kind: 'group', id: g.id })}>
                  ⛶ {g.name} <span>({g.frameIds.length})</span>
                </button>
                <button className="btn btn-sm btn-ghost" onClick={() => start(g.id)}>
                  Start
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}
      {/* regrouping frames that already belong to a group would steal them from it
          (and orphan its DIY project), so only offer this before any grouping */}
      {design.frames.length > 0 && groups.length === 0 && (
        <button className="btn btn-primary" onClick={diyWholeKitchen}>
          🛠 DIY the whole kitchen
        </button>
      )}
      <p className="hint">
        Want just a part of it? Shift-click frames on the canvas to select a section, group it, then start a DIY
        project for that section.
      </p>
    </>
  )
}

const SEV_ICON = { error: '⛔', warning: '⚠️', info: 'ℹ️' } as const

function QualityPanel() {
  const [report, setReport] = useState<ValidationReport | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [running, setRunning] = useState(false)
  const design = useStore((s) => s.design)
  const push = useToasts((s) => s.push)
  // instant, deterministic checks that recompute as the design changes
  const quickFixes = useMemo(() => analyzeBuild(design), [design])

  function run() {
    const d = useStore.getState().design
    setRunning(true)
    setError(null)
    setReport(null)
    aiValidate(d, catalogSummary(d.custom ?? []))
      .then(setReport)
      .catch((e) => setError(e instanceof Error ? e.message : 'Validation failed'))
      .finally(() => setRunning(false))
  }

  return (
    <>
      {quickFixes.length > 0 ? (
        <div className="quickfixes">
          <h3>Quick fixes</h3>
          <ul>
            {quickFixes.map((q) => (
              <li key={q.id} className={`sev-${q.severity}`}>
                <div className="quickfix-text">
                  <strong>
                    {SEV_ICON[q.severity]} {q.title}
                  </strong>
                  <span>{q.detail}</span>
                </div>
                {q.fix && (
                  <button
                    className="btn btn-primary btn-sm"
                    onClick={() => {
                      q.fix!.run()
                      push(q.fix!.label, 'success')
                    }}
                  >
                    {q.fix.label}
                  </button>
                )}
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <p className="hint">✓ No instant issues found — run the AI check for a deep review.</p>
      )}

      <button className="btn btn-primary" onClick={run} disabled={running || !design.frames.length}>
        {running ? 'Reviewing…' : report ? '🛡 Re-run AI check' : '🛡 Run AI check'}
      </button>

      {running && (
        <div className="validate-loading">
          <div className="chat-typing">
            <span />
            <span />
            <span />
          </div>
          <p className="hint">Gemini is reviewing clearances, utilities and workflow…</p>
        </div>
      )}
      {error && <div className="login-error">{error}</div>}
      {report && (
        <div className="validate-report">
          <div className="validate-header">
            <div className={`validate-score ${report.feasible ? 'good' : 'bad'}`}>
              <strong>{Math.round(report.score)}</strong>
              <span>/100</span>
            </div>
            <div>
              <div className={`validate-verdict ${report.feasible ? 'good' : 'bad'}`}>
                {report.feasible ? '✓ Buildable' : '✕ Not buildable yet'}
              </div>
              <p className="validate-summary">{report.summary}</p>
            </div>
          </div>
          {report.issues?.length > 0 && (
            <ul className="validate-issues">
              {report.issues.map((i, k) => (
                <li key={k} className={`sev-${i.severity}`}>
                  <span>{SEV_ICON[i.severity] ?? 'ℹ️'}</span> {i.message}
                </li>
              ))}
            </ul>
          )}
          {report.suggestions?.length > 0 && (
            <>
              <h3>Suggestions</h3>
              <ul className="validate-suggestions">
                {report.suggestions.map((s, k) => (
                  <li key={k}>{s}</li>
                ))}
              </ul>
            </>
          )}
        </div>
      )}
    </>
  )
}
