// True top-down (bird's-eye) plan renderer for the 2D view.
// Plan space maps 1:1 to world-screen: screen-x = plan x, screen-y = plan z.
// Everything is drawn in centimeters after the caller applies the camera.

import type { CornerId, Design, Frame, RunId, Selection } from '../types'
import { CORNER, COUNTER_OVERHANG, RUN_DEPTH, cornerFor, groundDepth } from '../types'
import { getAppliance } from '../catalog/appliances'
import { counterMaterial } from '../catalog/frames'
import { Ctx, dimLine, dimLineV, fillRoundRect, label, roundRectPath } from './draw'
import type { Rect } from './layout'
import type { CounterTop, RunScene, SceneLayout3 } from './scene'
import { formatLen, type Unit } from '../units'
import type { RenderState } from './renderScene'

export interface PlanRect {
  x: number
  z: number
  w: number
  d: number
}

/** Plan footprint of every frame, tagged with its id/run (for hit-test + outline). */
/** Screen x for a horizontal run segment [u, u+w] — mirrors reversed runs (island bar). */
function hx(run: RunScene, u: number, w: number): number {
  return run.reversed ? run.face.origin.x + run.elev.len - u - w : run.face.origin.x + u
}

export function framePlans(scene: SceneLayout3): Array<PlanRect & { id: string; run: RunId; frame: Frame }> {
  const out: Array<PlanRect & { id: string; run: RunId; frame: Frame }> = []
  for (const run of scene.runs) {
    const horizontal = run.face.dir.x !== 0
    for (const fl of run.elev.frames) {
      const r = horizontal
        ? { x: hx(run, fl.body.x, fl.body.w), z: run.plan.z, w: fl.body.w, d: RUN_DEPTH }
        : { x: run.plan.x, z: run.face.origin.z + fl.body.x, w: RUN_DEPTH, d: fl.body.w }
      out.push({ ...r, id: fl.frame.id, run: run.id, frame: fl.frame })
    }
  }
  return out
}

/** Plan footprint of every counter-level appliance (drop-in symbols). */
export function topAppliancePlans(scene: SceneLayout3): Array<PlanRect & { id: string; typeId: string }> {
  const out: Array<PlanRect & { id: string; typeId: string }> = []
  for (const run of scene.runs) {
    const horizontal = run.face.dir.x !== 0
    for (const al of run.elev.appliances) {
      if (al.placed.zone !== 'top') continue
      const u0 = al.rect.x + 1
      const w = Math.max(2, al.rect.w - 2)
      const r = horizontal
        ? { x: hx(run, u0, w), z: run.plan.z + 7, w, d: RUN_DEPTH - 16 }
        : { x: run.plan.x + 7, z: run.face.origin.z + u0, w: RUN_DEPTH - 16, d: w }
      out.push({ ...r, id: al.placed.id, typeId: al.placed.typeId })
    }
  }
  return out
}

/** Base (under-counter) appliance footprints, drawn as dashed outlines. */
export function baseAppliancePlans(scene: SceneLayout3): Array<PlanRect & { id: string; typeId: string }> {
  const out: Array<PlanRect & { id: string; typeId: string }> = []
  for (const run of scene.runs) {
    const horizontal = run.face.dir.x !== 0
    for (const al of run.elev.appliances) {
      if (al.placed.zone !== 'base') continue
      const u0 = al.frame.body.x + 3
      const w = Math.max(2, al.frame.body.w - 6)
      const r = horizontal
        ? { x: hx(run, u0, w), z: run.plan.z + 6, w, d: RUN_DEPTH - 14 }
        : { x: run.plan.x + 6, z: run.face.origin.z + u0, w: RUN_DEPTH - 14, d: w }
      out.push({ ...r, id: al.placed.id, typeId: al.placed.typeId })
    }
  }
  return out
}

/** Corner units → plan origin (x offset), oven anchor and their raw rects. */
export function cornerPlans(scene: SceneLayout3): Array<{ id: CornerId; rects: CounterTop[]; x0: number; ax: number; az: number }> {
  const byId = new Map<CornerId, CounterTop[]>()
  for (const t of scene.counterTops) {
    if (!t.corner) continue
    const arr = byId.get(t.corner) ?? []
    arr.push(t)
    byId.set(t.corner, arr)
  }
  return [...byId.entries()].map(([id, rects]) => {
    // the corner cabinet spans a CORNER×CORNER footprint from x0
    const x0 = Math.min(...rects.map((r) => r.x))
    return { id, rects, x0, ax: x0 + CORNER / 2, az: CORNER / 2 }
  })
}

/**
 * Plan-space outline of a corner unit's counter top, matching the 3D geometry:
 * a pentagon with a 45° cut for 'diagonal', a full square for 'square'.
 * `grow` expands the outer edges by the counter overhang.
 */
export function cornerPoly(
  side: CornerId,
  x0: number,
  style: 'diagonal' | 'square',
  grow: number,
  z0 = 0,
): Array<[number, number]> {
  const CN = CORNER
  if (style === 'square') {
    return [
      [x0 - grow, z0 - grow],
      [x0 + CN + grow, z0 - grow],
      [x0 + CN + grow, z0 + CN + grow],
      [x0 - grow, z0 + CN + grow],
    ]
  }
  const local: Array<[number, number]> =
    side === 'left'
      ? [[0, 0], [CN, 0], [CN, RUN_DEPTH], [RUN_DEPTH, CN], [0, CN]]
      : [[0, 0], [CN, 0], [CN, CN], [CN - RUN_DEPTH, CN], [0, RUN_DEPTH]]
  return local.map(([dx, dz]) => [x0 + dx + (dx > CN / 2 ? grow : -grow), z0 + dz + (dz > CN / 2 ? grow : -grow)])
}

function pointInPoly(pts: Array<[number, number]>, x: number, z: number): boolean {
  let inside = false
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const [xi, zi] = pts[i]
    const [xj, zj] = pts[j]
    if (zi > z !== zj > z && x < ((xj - xi) * (z - zi)) / (zj - zi) + xi) inside = !inside
  }
  return inside
}

export function planBounds(scene: SceneLayout3): Rect {
  const g = scene.ground
  const e = scene.extents
  const x0 = Math.min(g.x, e.x0)
  const x1 = Math.max(g.x + g.w, e.x1)
  const z0 = Math.min(g.z, e.z0)
  const z1 = Math.max(g.z + g.d, e.z1)
  return { x: x0, y: z0, w: x1 - x0, h: z1 - z0 }
}

// ---------- rendering ----------

function background(ctx: Ctx, W: number, H: number) {
  const g = ctx.createLinearGradient(0, 0, 0, H)
  g.addColorStop(0, '#161a20')
  g.addColorStop(1, '#1c2028')
  ctx.fillStyle = g
  ctx.fillRect(0, 0, W, H)
}

function drawGround(ctx: Ctx, s: RenderState) {
  const g = s.scene.ground
  const type = s.design.ground.type
  // slab shadow
  ctx.save()
  ctx.shadowColor = 'rgba(0,0,0,0.5)'
  ctx.shadowBlur = 14
  ctx.shadowOffsetY = 6
  fillRoundRect(ctx, g.x, g.z, g.w, g.d, 4, '#000')
  ctx.restore()

  const fill =
    type === 'deck' ? '#7c552f' : type === 'pavers' ? '#5a5f65' : type === 'stone' ? '#575049' : '#84868a'
  fillRoundRect(ctx, g.x, g.z, g.w, g.d, 4, fill)

  // material texture (top-down)
  ctx.save()
  roundRectPath(ctx, g.x, g.z, g.w, g.d, 4)
  ctx.clip()
  ctx.strokeStyle = 'rgba(0,0,0,0.18)'
  ctx.lineWidth = 0.6
  if (type === 'deck') {
    for (let z = g.z; z < g.z + g.d; z += 14) {
      ctx.beginPath()
      ctx.moveTo(g.x, z)
      ctx.lineTo(g.x + g.w, z)
      ctx.stroke()
    }
  } else if (type === 'pavers') {
    const t = 40
    for (let x = g.x; x < g.x + g.w; x += t) {
      ctx.beginPath()
      ctx.moveTo(x, g.z)
      ctx.lineTo(x, g.z + g.d)
      ctx.stroke()
    }
    for (let z = g.z; z < g.z + g.d; z += t) {
      ctx.beginPath()
      ctx.moveTo(g.x, z)
      ctx.lineTo(g.x + g.w, z)
      ctx.stroke()
    }
  } else if (type === 'concrete') {
    for (let x = g.x + 90; x < g.x + g.w; x += 90) {
      ctx.beginPath()
      ctx.moveTo(x, g.z)
      ctx.lineTo(x, g.z + g.d)
      ctx.stroke()
    }
    for (let z = g.z + 90; z < g.z + g.d; z += 90) {
      ctx.beginPath()
      ctx.moveTo(g.x, z)
      ctx.lineTo(g.x + g.w, z)
      ctx.stroke()
    }
  }
  ctx.restore()

  if (s.selection.kind === 'ground') {
    ctx.strokeStyle = '#f59e0b'
    ctx.lineWidth = 1.4
    roundRectPath(ctx, g.x, g.z, g.w, g.d, 4)
    ctx.stroke()
  }
}

function drawCounters(ctx: Ctx, s: RenderState) {
  const mat = counterMaterial(s.design.counterMaterial)
  const straight = s.scene.counterTops.filter((t) => !t.corner) // corners drawn as shaped polys
  // drop shadow for the whole cabinet mass
  ctx.save()
  ctx.shadowColor = 'rgba(0,0,0,0.45)'
  ctx.shadowBlur = 8
  ctx.shadowOffsetY = 4
  for (const t of straight) {
    ctx.fillStyle = '#000'
    ctx.fillRect(t.x, t.z, t.w, t.d)
  }
  ctx.restore()

  for (const t of straight) {
    const g = ctx.createLinearGradient(t.x, t.z, t.x, t.z + t.d)
    g.addColorStop(0, mat.color)
    g.addColorStop(1, mat.edge)
    ctx.fillStyle = g
    ctx.fillRect(t.x, t.z, t.w, t.d)
    ctx.strokeStyle = 'rgba(255,255,255,0.10)'
    ctx.lineWidth = 0.5
    ctx.strokeRect(t.x + 0.3, t.z + 0.3, t.w - 0.6, t.d - 0.6)
  }

  // corner units: draw the true diagonal (pentagon) / square footprint
  const tracePoly = (pts: Array<[number, number]>) => {
    ctx.beginPath()
    pts.forEach(([x, z], i) => (i === 0 ? ctx.moveTo(x, z) : ctx.lineTo(x, z)))
    ctx.closePath()
  }
  const cornerPolys = cornerPlans(s.scene).map((c) => cornerPoly(c.id, c.x0, cornerFor(s.design, c.id)?.style ?? 'diagonal', COUNTER_OVERHANG))
  const ic = s.scene.islandCorner
  if (ic) cornerPolys.push(cornerPoly('right', ic.x0, ic.style, COUNTER_OVERHANG, ic.z0))
  for (const pts of cornerPolys) {
    ctx.save()
    ctx.shadowColor = 'rgba(0,0,0,0.45)'
    ctx.shadowBlur = 8
    ctx.shadowOffsetY = 4
    ctx.fillStyle = '#000'
    tracePoly(pts)
    ctx.fill()
    ctx.restore()
    const zs = pts.map((p) => p[1])
    const g = ctx.createLinearGradient(0, Math.min(...zs), 0, Math.max(...zs))
    g.addColorStop(0, mat.color)
    g.addColorStop(1, mat.edge)
    ctx.fillStyle = g
    tracePoly(pts)
    ctx.fill()
    ctx.strokeStyle = 'rgba(255,255,255,0.10)'
    ctx.lineWidth = 0.5
    ctx.stroke()
  }
}

/** thin seams between adjacent frames within a run */
function drawFrameSeams(ctx: Ctx, plans: ReturnType<typeof framePlans>) {
  ctx.strokeStyle = 'rgba(0,0,0,0.28)'
  ctx.lineWidth = 0.6
  for (const f of plans) {
    ctx.strokeRect(f.x, f.z, f.w, f.d)
  }
}

function drawTopAppliance(ctx: Ctx, r: PlanRect, typeId: string) {
  const type = (() => {
    try {
      return getAppliance(typeId)
    } catch {
      return null
    }
  })()
  if (!type) return
  const base = type.paintAs ?? type.id
  const cx = r.x + r.w / 2
  const cz = r.z + r.d / 2

  if (type.mount === 'kamado' || type.mount === 'oncounter') {
    // round units (kamado eggs, gozney/taboon ovens) read as circles from above
    const rad = Math.min(r.w, r.d) / 2
    ctx.beginPath()
    ctx.arc(cx, cz, rad, 0, Math.PI * 2)
    ctx.fillStyle = base.startsWith('egg')
      ? '#2f6a3c'
      : base.startsWith('taboon')
        ? '#b06a3c'
        : base.startsWith('gozney')
          ? '#d0d4d8'
          : '#2e3237'
    ctx.fill()
    ctx.strokeStyle = 'rgba(0,0,0,0.4)'
    ctx.lineWidth = 0.8
    ctx.stroke()
    // mouth / vent hint
    ctx.beginPath()
    ctx.arc(cx, cz, rad * 0.5, 0, Math.PI * 2)
    ctx.strokeStyle = 'rgba(255,255,255,0.3)'
    ctx.lineWidth = 0.7
    ctx.stroke()
    return
  }

  roundRectPath(ctx, r.x, r.z, r.w, r.d, 3)
  const ig = ctx.createLinearGradient(0, r.z, 0, r.z + r.d)
  ig.addColorStop(0, '#3a3f45')
  ig.addColorStop(1, '#23272c')
  ctx.fillStyle = ig
  ctx.fill()
  ctx.strokeStyle = 'rgba(255,255,255,0.18)'
  ctx.lineWidth = 0.6
  ctx.stroke()

  if (/^(grill|santamaria|griddle|burner)/.test(base)) {
    ctx.strokeStyle = 'rgba(160,168,176,0.6)'
    ctx.lineWidth = 0.8
    const lines = Math.max(3, Math.floor(r.w / 9))
    for (let i = 1; i < lines; i++) {
      const lx = r.x + (r.w * i) / lines
      ctx.beginPath()
      ctx.moveTo(lx, r.z + 2)
      ctx.lineTo(lx, r.z + r.d - 2)
      ctx.stroke()
    }
  } else if (base.startsWith('sink')) {
    fillRoundRect(ctx, r.x + r.w * 0.18, r.z + r.d * 0.18, r.w * 0.64, r.d * 0.64, 2, '#5a6268')
  } else if (base.startsWith('pizza')) {
    fillRoundRect(ctx, r.x + 2, r.z + 2, r.w - 4, r.d - 4, 4, '#8d949b')
  }
}

function drawCornerOvens(ctx: Ctx, design: Design, corners: ReturnType<typeof cornerPlans>) {
  for (const c of corners) {
    const top = cornerFor(design, c.id)?.top
    if (!top) continue
    const taboon = top.startsWith('taboon')
    const rad = 20
    ctx.beginPath()
    ctx.arc(c.ax, c.az, rad, 0, Math.PI * 2)
    ctx.fillStyle = taboon ? '#b06a3c' : '#d0d4d8'
    ctx.fill()
    ctx.strokeStyle = 'rgba(0,0,0,0.4)'
    ctx.lineWidth = 0.8
    ctx.stroke()
    ctx.beginPath()
    ctx.arc(c.ax, c.az, rad * 0.5, 0, Math.PI * 2)
    ctx.strokeStyle = 'rgba(255,255,255,0.3)'
    ctx.lineWidth = 0.7
    ctx.stroke()
  }
}

function drawSelection(ctx: Ctx, s: RenderState) {
  const sel = s.selection
  ctx.strokeStyle = '#f59e0b'
  ctx.lineWidth = 1.4
  if (sel.kind === 'frame') {
    const f = framePlans(s.scene).find((p) => p.id === sel.id)
    if (f) {
      roundRectPath(ctx, f.x - 0.5, f.z - 0.5, f.w + 1, f.d + 1, 2)
      ctx.stroke()
    }
  } else if (sel.kind === 'appliance') {
    const a = [...topAppliancePlans(s.scene), ...baseAppliancePlans(s.scene)].find((p) => p.id === sel.id)
    if (a) {
      roundRectPath(ctx, a.x - 1, a.z - 1, a.w + 2, a.d + 2, 3)
      ctx.stroke()
    }
  } else if (sel.kind === 'corner') {
    for (const c of cornerPlans(s.scene)) {
      if (c.id !== sel.id) continue
      const style = cornerFor(s.design, c.id)?.style ?? 'diagonal'
      const pts = cornerPoly(c.id, c.x0, style, COUNTER_OVERHANG)
      ctx.beginPath()
      pts.forEach(([x, z], i) => (i === 0 ? ctx.moveTo(x, z) : ctx.lineTo(x, z)))
      ctx.closePath()
      ctx.stroke()
    }
  } else if (sel.kind === 'multi' || sel.kind === 'group') {
    const ids =
      sel.kind === 'multi' ? sel.ids : (s.design.groups?.find((g) => g.id === sel.id)?.frameIds ?? [])
    const plans = framePlans(s.scene)
    for (const id of ids) {
      const f = plans.find((p) => p.id === id)
      if (f) {
        roundRectPath(ctx, f.x - 0.5, f.z - 0.5, f.w + 1, f.d + 1, 2)
        ctx.stroke()
      }
    }
  }
}

function drawDims(ctx: Ctx, s: RenderState) {
  const g = s.scene.ground
  dimLine(ctx, g.x, g.x + g.w, g.z - 12, formatLen(s.design.ground.width, s.unit))
  dimLineV(ctx, g.z, g.z + g.d, g.x - 12, formatLen(groundDepth(s.design.ground), s.unit))
}

function drawGrid(ctx: Ctx, s: RenderState) {
  const step = 30
  const halfW = s.width / 2 / s.camera.zoom
  const halfH = s.height / 2 / s.camera.zoom
  const x0 = Math.floor((s.camera.x - halfW) / step) * step
  const x1 = s.camera.x + halfW
  const y0 = Math.floor((s.camera.y - halfH) / step) * step
  const y1 = s.camera.y + halfH
  ctx.strokeStyle = 'rgba(148,163,184,0.06)'
  ctx.lineWidth = 0.4
  ctx.beginPath()
  for (let x = x0; x <= x1; x += step) {
    ctx.moveTo(x, y0)
    ctx.lineTo(x, y1)
  }
  for (let y = y0; y <= y1; y += step) {
    ctx.moveTo(x0, y)
    ctx.lineTo(x1, y)
  }
  ctx.stroke()
}

export function renderPlan(ctx: Ctx, s: RenderState) {
  const { width: W, height: H, dpr, camera } = s
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  background(ctx, W, H)

  const scale = camera.zoom
  ctx.setTransform(dpr * scale, 0, 0, dpr * scale, dpr * (W / 2 - camera.x * scale), dpr * (H / 2 - camera.y * scale))

  if (s.showGrid) drawGrid(ctx, s)
  drawGround(ctx, s)

  if (!s.design.frames.length && s.scene.cornerCount === 0) {
    label(ctx, 'Add a frame to start building', 0, RUN_DEPTH / 2, 8, 'rgba(148,163,184,0.7)')
    label(ctx, '(top-down plan view)', 0, RUN_DEPTH / 2 + 12, 6, 'rgba(148,163,184,0.4)')
  }

  drawCounters(ctx, s)
  const fplans = framePlans(s.scene)
  drawFrameSeams(ctx, fplans)

  // base units (dashed, under counter) then top units (solid symbols)
  ctx.save()
  ctx.setLineDash([3, 2])
  ctx.strokeStyle = 'rgba(20,24,30,0.55)'
  ctx.lineWidth = 0.6
  for (const b of baseAppliancePlans(s.scene)) ctx.strokeRect(b.x, b.z, b.w, b.d)
  ctx.restore()

  for (const a of topAppliancePlans(s.scene)) drawTopAppliance(ctx, a, a.typeId)
  drawCornerOvens(ctx, s.design, cornerPlans(s.scene))

  // highlight the frame under an in-flight appliance drag
  if (s.activeDropTarget) {
    const f = fplans.find((p) => p.id === s.activeDropTarget)
    if (f) {
      ctx.save()
      ctx.strokeStyle = '#34d399'
      ctx.lineWidth = 1.6
      ctx.setLineDash([4, 2])
      ctx.strokeRect(f.x - 1, f.z - 1, f.w + 2, f.d + 2)
      ctx.restore()
    }
  }

  drawSelection(ctx, s)
  if (s.showDims) drawDims(ctx, s)

  if (s.scene.overflow) {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    ctx.font = '600 12px Inter, system-ui, sans-serif'
    ctx.textAlign = 'center'
    ctx.fillStyle = '#fca5a5'
    ctx.fillText('⚠ The kitchen is larger than the ground platform — enlarge the ground', W / 2, H - 18)
  }
}

// ---------- hit-testing (plan space) ----------

const inRect = (r: PlanRect, x: number, z: number) => x >= r.x && x <= r.x + r.w && z >= r.z && z <= r.z + r.d

export type PlanHit =
  | { kind: 'appliance'; id: string; run: RunId }
  | { kind: 'frame'; id: string; run: RunId }
  | { kind: 'corner'; id: CornerId }
  | { kind: 'ground' }
  | null

export function planHitTest(scene: SceneLayout3, x: number, z: number): PlanHit {
  for (const a of topAppliancePlans(scene)) {
    if (inRect(a, x, z)) {
      const run = scene.runs.find((r) => r.elev.appliances.some((al) => al.placed.id === a.id))
      return { kind: 'appliance', id: a.id, run: run?.id ?? 'back' }
    }
  }
  for (const c of cornerPlans(scene)) {
    if (c.rects.some((r) => inRect(r, x, z))) return { kind: 'corner', id: c.id }
  }
  for (const f of framePlans(scene)) {
    if (inRect(f, x, z)) return { kind: 'frame', id: f.id, run: f.run }
  }
  // base appliances live under the counter footprint; frames cover them, so
  // they're only reachable when no frame body matched (rare) — check anyway
  for (const b of baseAppliancePlans(scene)) {
    if (inRect(b, x, z)) {
      const run = scene.runs.find((r) => r.elev.appliances.some((al) => al.placed.id === b.id))
      return { kind: 'appliance', id: b.id, run: run?.id ?? 'back' }
    }
  }
  const g = scene.ground
  if (inRect({ x: g.x, z: g.z, w: g.w, d: g.d }, x, z)) return { kind: 'ground' }
  return null
}

/**
 * The frame whose counter footprint is under a plan point, for appliance drops.
 * Uses a generous margin (counter overhang + slack) so aiming at the visible
 * counter — not just the cabinet body — lands on the intended frame.
 */
export function frameForDrop(scene: SceneLayout3, x: number, z: number): { id: string; run: RunId } | null {
  const M = COUNTER_OVERHANG + 4
  let best: { id: string; run: RunId; d: number } | null = null
  for (const f of framePlans(scene)) {
    const ex = { x: f.x - M, z: f.z - M, w: f.w + 2 * M, d: f.d + 2 * M }
    if (!inRect(ex, x, z)) continue
    const dd = Math.hypot(x - (f.x + f.w / 2), z - (f.z + f.d / 2))
    if (!best || dd < best.d) best = { id: f.id, run: f.run, d: dd }
  }
  return best ? { id: best.id, run: best.run } : null
}

/** Nearest run + run-local insertion u for a plan point (frame drags / drops). */
export function planRunUnderPointer(scene: SceneLayout3, x: number, z: number): { run: RunScene; u: number } | null {
  let best: { run: RunScene; u: number; d: number } | null = null
  for (const run of scene.runs) {
    const horizontal = run.face.dir.x !== 0
    const len = run.elev.len
    let u: number, perp: number
    if (horizontal) {
      u = x - run.face.origin.x
      const bandCenter = run.plan.z + RUN_DEPTH / 2
      perp = Math.abs(z - bandCenter) - RUN_DEPTH / 2
    } else {
      u = z - run.face.origin.z
      const bandCenter = run.plan.x + RUN_DEPTH / 2
      perp = Math.abs(x - bandCenter) - RUN_DEPTH / 2
    }
    const margin = 50
    if (u < -margin || u > len + margin) continue
    if (perp > margin) continue
    const du = Math.max(0, -u, u - len)
    const d = du + Math.max(0, perp) * 0.6
    if (!best || d < best.d) best = { run, u: Math.max(0, Math.min(len, u)), d }
  }
  return best ? { run: best.run, u: best.u } : null
}
