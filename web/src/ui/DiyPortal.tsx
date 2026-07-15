import { useMemo, useState } from 'react'
import { aiDiyPlan, aiDiyQuestions } from '../auth/api'
import { getAppliance } from '../catalog/appliances'
import { counterMaterial } from '../catalog/frames'
import { formatPrice, useStore } from '../state/store'
import { RUN_DEPTH, frameBodyH, type Design, type DiyProject, type FrameGroup } from '../types'
import { useToasts } from './toast'

/**
 * Compact section descriptor sent to the AI: the group's frames + appliances
 * (with real dims where we have them), counter material and ground.
 */
function sectionOf(design: Design, group: FrameGroup) {
  const frames = group.frameIds
    .map((id) => design.frames.find((f) => f.id === id))
    .filter((f): f is NonNullable<typeof f> => Boolean(f))
  return {
    name: group.name,
    frames: frames.map((f) => ({
      width_cm: f.width,
      depth_cm: RUN_DEPTH,
      body_height_cm: frameBodyH(f),
      lowered_smoker_table: Boolean(f.lowered),
      finish: f.finish,
    })),
    appliances: design.appliances
      .filter((a) => group.frameIds.includes(a.frameId))
      .map((a) => {
        const t = getAppliance(a.typeId)
        return {
          name: t.name,
          brand: t.brand,
          zone: a.zone === 'top' ? 'counter level' : 'under counter',
          mount: t.mount,
          needs_width_cm: t.minFrameWidth,
          ...(t.dims ? { cutout_cm: t.dims } : {}),
          ...(t.url ? { product_url: t.url } : {}),
        }
      }),
    counter_material_current: counterMaterial(design.counterMaterial).name,
    ground: design.ground.type,
    total_run_length_cm: frames.reduce((s, f) => s + f.width, 0),
  }
}

export function DiyPortal({ onExit, initialProjectId }: { onExit: () => void; initialProjectId?: string | null }) {
  const design = useStore((s) => s.design)
  const [openId, setOpenId] = useState<string | null>(initialProjectId ?? null)
  const projects = design.diy ?? []
  const open = projects.find((p) => p.id === openId) ?? null

  return (
    <div className="admin-page diy-page">
      <header className="admin-topbar">
        <div className="logo">
          <img src="/flame.svg" alt="" width={22} height={22} />
          <span>
            bbq<em>.build</em>
          </span>
          <span className="admin-badge diy-badge">DIY</span>
        </div>
        <button className="btn btn-ghost" onClick={onExit}>
          ← Back to the designer
        </button>
      </header>
      <div className="admin-layout">
        <nav className="admin-nav">
          {projects.map((p) => (
            <button key={p.id} className={p.id === openId ? 'active' : ''} onClick={() => setOpenId(p.id)}>
              <span>🛠 {p.name}</span>
              {p.plan && <span className="admin-nav-badge">{progressOf(p)}%</span>}
            </button>
          ))}
          {!projects.length && <p className="hint diy-nav-hint">No projects yet. In the designer, shift-click frames → Group → DIY.</p>}
        </nav>
        <main className="admin-content admin-content-wide">
          {open ? <ProjectView key={open.id} project={open} /> : <p className="hint">Select a project.</p>}
        </main>
      </div>
    </div>
  )
}

function progressOf(p: DiyProject): number {
  if (!p.plan) return 0
  const keys = [...p.plan.materials.map((_, i) => `m${i}`), ...p.plan.steps.map((s) => s.id)]
  if (!keys.length) return 0
  const done = keys.filter((k) => p.done?.[k]).length
  return Math.round((done / keys.length) * 100)
}

function ProjectView({ project }: { project: DiyProject }) {
  const design = useStore((s) => s.design)
  const updateDiyProject = useStore((s) => s.updateDiyProject)
  const removeDiyProject = useStore((s) => s.removeDiyProject)
  const push = useToasts((s) => s.push)
  const [busy, setBusy] = useState(false)
  const [draft, setDraft] = useState<Record<string, string>>(project.answers ?? {})
  const group = design.groups?.find((g) => g.id === project.groupId)
  const section = useMemo(() => (group ? sectionOf(design, group) : null), [design, group])

  async function loadQuestions() {
    if (!section) return
    setBusy(true)
    try {
      const { questions } = await aiDiyQuestions(section)
      updateDiyProject(project.id, { questions })
    } catch (e) {
      push(e instanceof Error ? e.message : 'Could not get questions — sign in to use the DIY planner', 'error')
    } finally {
      setBusy(false)
    }
  }

  async function generate(skip = false) {
    if (!section) return
    setBusy(true)
    try {
      const answers = skip ? {} : draft
      const plan = await aiDiyPlan(section, answers)
      updateDiyProject(project.id, { plan, answers, status: 'ready' })
      push('Your DIY plan is ready', 'success')
    } catch (e) {
      push(e instanceof Error ? e.message : 'Plan generation failed', 'error')
    } finally {
      setBusy(false)
    }
  }

  if (!group) {
    return (
      <>
        <h2>{project.name}</h2>
        <p className="admin-sub">The section for this project was removed from the design.</p>
        <button className="btn btn-danger-ghost" onClick={() => removeDiyProject(project.id)}>
          Delete project
        </button>
      </>
    )
  }

  // ---- phase 1: questions ----
  if (!project.plan) {
    return (
      <>
        <h2>🛠 {project.name}</h2>
        <p className="admin-sub">
          {section!.frames.length} frames · {section!.appliances.map((a) => a.name).join(', ') || 'no appliances yet'}
        </p>
        {!project.questions ? (
          <div className="diy-start">
            <p>
              We’ll draft a complete DIY build plan for this section — everything to buy, every tool, utility rough-ins,
              structure sized to your exact appliances, and step-by-step instructions. First, a few quick questions about
              your setup.
            </p>
            <button className="btn btn-primary" disabled={busy} onClick={loadQuestions}>
              {busy ? 'Thinking…' : 'Start — ask me the questions'}
            </button>
            <button className="btn btn-ghost" disabled={busy} onClick={() => generate(true)}>
              Skip questions — use sensible defaults
            </button>
          </div>
        ) : (
          <div className="diy-questions">
            {project.questions.map((q) => (
              <label key={q.id} className="diy-q">
                <span>{q.q}</span>
                <input
                  className="text-input"
                  placeholder={q.hint ?? ''}
                  value={draft[q.id] ?? ''}
                  onChange={(e) => setDraft((d) => ({ ...d, [q.id]: e.target.value }))}
                />
              </label>
            ))}
            <div className="diy-q-actions">
              <button className="btn btn-primary" disabled={busy} onClick={() => generate(false)}>
                {busy ? 'Building your plan… (can take a minute)' : 'Generate my build plan'}
              </button>
              <button className="btn btn-ghost" disabled={busy} onClick={() => generate(true)}>
                Skip — use defaults
              </button>
            </div>
          </div>
        )}
      </>
    )
  }

  // ---- phase 2: the plan + progress ----
  const plan = project.plan
  const pct = progressOf(project)
  return (
    <>
      <div className="diy-plan-head">
        <div>
          <h2>🛠 {project.name}</h2>
          <p className="admin-sub">{plan.summary}</p>
        </div>
        <div className="diy-progress">
          <strong>{pct}%</strong>
          <span>built</span>
        </div>
      </div>
      <div className="diy-meta">
        <span>⏱ ~{plan.est_days} days</span>
        <span>🎯 {plan.skill_level}</span>
        <span className="accent">💵 ~{formatPrice(Math.round(plan.total_est_cost_usd))}</span>
      </div>

      {plan.structure_notes.length > 0 && (
        <section className="diy-section">
          <h3>🏗 Structure (sized to your appliances)</h3>
          <ul className="diy-notes">
            {plan.structure_notes.map((n, i) => (
              <li key={i}>{n}</li>
            ))}
          </ul>
        </section>
      )}

      {plan.utilities.length > 0 && (
        <section className="diy-section">
          <h3>🔌 Utility rough-ins</h3>
          <ul className="diy-notes">
            {plan.utilities.map((u, i) => (
              <li key={i}>
                <strong>{u.type}:</strong> {u.requirement}
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="diy-section">
        <h3>🪨 Countertop</h3>
        <p className="diy-counter">
          <strong>{plan.counter.recommendation}</strong> · {plan.counter.thickness}
          <br />
          <span>{plan.counter.notes}</span>
        </p>
      </section>

      <section className="diy-section">
        <h3>🛒 Shopping list</h3>
        <Checklist
          projectId={project.id}
          items={plan.materials.map((m, i) => ({
            key: `m${i}`,
            label: `${m.item} — ${m.qty}`,
            sub: m.notes,
            right: formatPrice(Math.round(m.est_cost_usd)),
          }))}
          done={project.done}
        />
      </section>

      <section className="diy-section">
        <h3>🧰 Tools</h3>
        <Checklist
          projectId={project.id}
          items={plan.tools.map((t, i) => ({ key: `t${i}`, label: t.tool, sub: t.optional ? 'optional' : undefined }))}
          done={project.done}
        />
      </section>

      <section className="diy-section">
        <h3>📋 Build steps</h3>
        <Checklist
          projectId={project.id}
          items={plan.steps.map((s, i) => ({
            key: s.id,
            label: `${i + 1}. ${s.title}${s.duration ? ` (${s.duration})` : ''}`,
            sub: s.detail,
          }))}
          done={project.done}
        />
      </section>

      {plan.safety.length > 0 && (
        <section className="diy-section">
          <h3>⚠️ Safety</h3>
          <ul className="diy-notes">
            {plan.safety.map((n, i) => (
              <li key={i}>{n}</li>
            ))}
          </ul>
        </section>
      )}

      <div className="diy-foot">
        <button className="btn btn-ghost" disabled={busy} onClick={() => updateDiyProject(project.id, { plan: undefined, questions: undefined, status: 'questions' })}>
          Regenerate plan…
        </button>
        <button className="btn btn-danger-ghost" onClick={() => removeDiyProject(project.id)}>
          Delete project
        </button>
      </div>
    </>
  )
}

function Checklist({
  projectId,
  items,
  done,
}: {
  projectId: string
  items: { key: string; label: string; sub?: string; right?: string }[]
  done?: Record<string, boolean>
}) {
  const toggle = useStore((s) => s.toggleDiyDone)
  return (
    <ul className="diy-checklist">
      {items.map((i) => (
        <li key={i.key} className={done?.[i.key] ? 'done' : ''}>
          <label>
            <input type="checkbox" checked={Boolean(done?.[i.key])} onChange={() => toggle(projectId, i.key)} />
            <div className="diy-check-main">
              <span>{i.label}</span>
              {i.sub && <em>{i.sub}</em>}
            </div>
            {i.right && <span className="diy-check-right">{i.right}</span>}
          </label>
        </li>
      ))}
    </ul>
  )
}
