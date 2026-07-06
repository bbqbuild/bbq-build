// Scene compositor: projects each run's offscreen elevation into the oblique
// view, draws ground + counter tops + plan symbols + smoke + dimensions.

import type { Design, RunId, Selection } from '../types'
import { COUNTER_T, FRAME_BODY_H, GROUND_T, RUN_DEPTH, frameBodyH, groundDepth } from '../types'
import { getAppliance } from '../catalog/appliances'
import { Ctx, dimLine, fillRoundRect, label, roundRectPath, strokeRoundRect } from './draw'
import { renderElevation, drawBlankFront, type ElevationState } from './elevation'
import type { Rect } from './layout'
import { KX, KZ, faceTransform, project } from './projection'
import { ELEV_TOP, computeScene, type CounterTop, type RunScene, type SceneLayout3 } from './scene'
import { formatLen, type Unit } from '../units'

export interface Camera {
  x: number
  y: number
  zoom: number
}

export interface FrameDragState {
  frameId: string
  /** run currently under the pointer */
  runId: RunId
  /** run-local insertion u */
  u: number
}

export interface RenderState {
  design: Design
  scene: SceneLayout3
  selection: Selection
  hoveredFrameId: string | null
  hoveredApplianceId: string | null
  dropTargets: Set<string> | null
  activeDropTarget: string | null
  frameDrag: FrameDragState | null
  showDims: boolean
  showGrid: boolean
  unit: Unit
  time: number
  camera: Camera
  width: number
  height: number
  dpr: number
}

const SMOKY_TYPES = /^(grill-|santamaria-|egg-|primo-)/

// offscreen elevation canvases, cached per run
const offscreens = new Map<RunId, HTMLCanvasElement>()

function offscreenFor(id: RunId, wPx: number, hPx: number): HTMLCanvasElement {
  let c = offscreens.get(id)
  if (!c) {
    c = document.createElement('canvas')
    offscreens.set(id, c)
  }
  if (c.width !== wPx || c.height !== hPx) {
    c.width = wPx
    c.height = hPx
  }
  return c
}

export function renderScene(ctx: Ctx, s: RenderState) {
  const { width: W, height: H, dpr, camera } = s
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  drawBackground(ctx, W, H)

  // world transform (world-screen cm → device px)
  const scale = camera.zoom
  ctx.setTransform(dpr * scale, 0, 0, dpr * scale, dpr * (W / 2 - camera.x * scale), dpr * (H / 2 - camera.y * scale))

  if (s.showGrid) drawGrid(ctx, s)
  drawGround(ctx, s)

  if (!s.design.frames.length) drawEmptyHint(ctx, s)

  const pxPerCm = Math.min(8, Math.max(2.5, camera.zoom * dpr))
  const runs = [...s.scene.runs].sort((a, b) => a.depth - b.depth)
  for (const run of runs) {
    drawRun(ctx, s, run, pxPerCm)
  }

  drawSmoke(ctx, s)
  if (s.showDims) drawGroundDims(ctx, s)

  if (s.scene.overflow) {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    ctx.font = '600 12px Inter, system-ui, sans-serif'
    ctx.textAlign = 'center'
    ctx.fillStyle = '#fca5a5'
    ctx.fillText('⚠ The kitchen is larger than the ground platform — enlarge the ground', W / 2, H - 18)
  }
}

// ---------- background ----------

function drawBackground(ctx: Ctx, W: number, H: number) {
  const g = ctx.createLinearGradient(0, 0, 0, H)
  g.addColorStop(0, '#171a20')
  g.addColorStop(0.55, '#1b1f26')
  g.addColorStop(1, '#20242c')
  ctx.fillStyle = g
  ctx.fillRect(0, 0, W, H)
  const r = ctx.createRadialGradient(W / 2, H * 0.45, 40, W / 2, H * 0.45, Math.max(W, H) * 0.7)
  r.addColorStop(0, 'rgba(255,244,224,0.05)')
  r.addColorStop(1, 'rgba(0,0,0,0)')
  ctx.fillStyle = r
  ctx.fillRect(0, 0, W, H)
}

function drawGrid(ctx: Ctx, s: RenderState) {
  const step = 20
  const halfW = s.width / 2 / s.camera.zoom
  const halfH = s.height / 2 / s.camera.zoom
  const x0 = Math.floor((s.camera.x - halfW) / step) * step
  const x1 = s.camera.x + halfW
  const y0 = Math.floor((s.camera.y - halfH) / step) * step
  const y1 = s.camera.y + halfH
  ctx.strokeStyle = 'rgba(148,163,184,0.07)'
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

// ---------- ground ----------

/** Apply the plan transform: plan (x,z) at height y → world-screen. */
function planTransform(ctx: Ctx, y: number, mirror = false) {
  ctx.transform(1, 0, mirror ? -KX : KX, KZ, 0, -y)
}

function drawGround(ctx: Ctx, s: RenderState) {
  const g = s.scene.ground
  const type = s.design.ground.type
  const selected = s.selection.kind === 'ground'

  // soft shadow under the slab
  const front = project(g.x + g.w / 2, g.z + g.d, -GROUND_T)
  const grad = ctx.createRadialGradient(front.x, front.y + 4, 1, front.x, front.y + 4, g.w * 0.6)
  grad.addColorStop(0, 'rgba(0,0,0,0.4)')
  grad.addColorStop(1, 'rgba(0,0,0,0)')
  ctx.save()
  ctx.translate(front.x, front.y + 6)
  ctx.scale(1, 0.1)
  ctx.fillStyle = grad
  ctx.beginPath()
  ctx.arc(0, 0, g.w * 0.62, 0, Math.PI * 2)
  ctx.fill()
  ctx.restore()

  // top surface (plan space)
  ctx.save()
  planTransform(ctx, 0)
  if (type === 'deck') {
    ctx.fillStyle = '#7c552f'
    ctx.fillRect(g.x, g.z, g.w, g.d)
    // planks along x
    for (let z = g.z; z < g.z + g.d; z += 14) {
      const shade = 0.9 + 0.12 * Math.sin(z * 12.9898)
      ctx.fillStyle = `rgb(${Math.round(134 * shade)}, ${Math.round(92 * shade)}, ${Math.round(58 * shade)})`
      ctx.fillRect(g.x, z, g.w, Math.min(12.6, g.z + g.d - z))
      // butt joints
      ctx.fillStyle = 'rgba(0,0,0,0.25)'
      const off = (Math.floor(z / 14) % 2) * 45
      for (let x = g.x + 30 + off; x < g.x + g.w; x += 90) ctx.fillRect(x, z, 1, 12.6)
    }
  } else if (type === 'concrete') {
    const cg = ctx.createLinearGradient(g.x, g.z, g.x, g.z + g.d)
    cg.addColorStop(0, '#8f9192')
    cg.addColorStop(1, '#7c7e80')
    ctx.fillStyle = cg
    ctx.fillRect(g.x, g.z, g.w, g.d)
    ctx.strokeStyle = 'rgba(0,0,0,0.15)'
    ctx.lineWidth = 0.8
    for (let x = g.x + 90; x < g.x + g.w; x += 90) {
      ctx.beginPath()
      ctx.moveTo(x, g.z + 1)
      ctx.lineTo(x, g.z + g.d - 1)
      ctx.stroke()
    }
    for (let z = g.z + 90; z < g.z + g.d; z += 90) {
      ctx.beginPath()
      ctx.moveTo(g.x + 1, z)
      ctx.lineTo(g.x + g.w - 1, z)
      ctx.stroke()
    }
  } else if (type === 'pavers') {
    ctx.fillStyle = '#54585d'
    ctx.fillRect(g.x, g.z, g.w, g.d)
    const tile = 40
    let rowIdx = 0
    for (let z = g.z; z < g.z + g.d; z += tile, rowIdx++) {
      for (let x = g.x + ((rowIdx % 2) * tile) / 2 - tile / 2; x < g.x + g.w; x += tile) {
        const w = Math.min(tile - 2, g.x + g.w - x - 1)
        const d = Math.min(tile - 2, g.z + g.d - z - 1)
        if (w > 2 && d > 2 && x >= g.x) fillRoundRect(ctx, x + 1, z + 1, w, d, 1, rowIdx % 2 ? '#75797f' : '#7d8187')
      }
    }
  } else {
    ctx.fillStyle = '#4f4b46'
    ctx.fillRect(g.x, g.z, g.w, g.d)
    let z = g.z + 2
    let flip = false
    while (z < g.z + g.d - 4) {
      let x = g.x + 2 + (flip ? 14 : 0)
      const dRow = 26 + (flip ? 8 : 0)
      while (x < g.x + g.w - 3) {
        const w = flip ? 36 : 28
        const ww = Math.min(w, g.x + g.w - x - 2)
        const dd = Math.min(dRow, g.z + g.d - z - 2)
        if (ww > 4 && dd > 4) fillRoundRect(ctx, x, z, ww, dd, 3, flip ? '#6f6a63' : '#7d766d')
        x += ww + 3
        flip = !flip
      }
      z += dRow + 3
    }
  }
  ctx.restore()

  // front face (1:1)
  const fz = g.z + g.d
  const p0 = project(g.x, fz, 0)
  const faceG = ctx.createLinearGradient(0, p0.y, 0, p0.y + GROUND_T)
  if (type === 'deck') {
    faceG.addColorStop(0, '#6d4a2c')
    faceG.addColorStop(1, '#4a3220')
  } else if (type === 'concrete') {
    faceG.addColorStop(0, '#6f7173')
    faceG.addColorStop(1, '#55575a')
  } else if (type === 'pavers') {
    faceG.addColorStop(0, '#54585d')
    faceG.addColorStop(1, '#3c4045')
  } else {
    faceG.addColorStop(0, '#57534e')
    faceG.addColorStop(1, '#3d3a36')
  }
  ctx.fillStyle = faceG
  ctx.fillRect(p0.x, p0.y, g.w, GROUND_T)
  ctx.strokeStyle = 'rgba(255,255,255,0.18)'
  ctx.lineWidth = 0.6
  ctx.beginPath()
  ctx.moveTo(p0.x, p0.y + 0.3)
  ctx.lineTo(p0.x + g.w, p0.y + 0.3)
  ctx.stroke()

  // right side face (sheared)
  ctx.save()
  ctx.beginPath()
  const r0 = project(g.x + g.w, g.z, 0)
  const r1 = project(g.x + g.w, fz, 0)
  ctx.moveTo(r0.x, r0.y)
  ctx.lineTo(r1.x, r1.y)
  ctx.lineTo(r1.x, r1.y + GROUND_T)
  ctx.lineTo(r0.x, r0.y + GROUND_T)
  ctx.closePath()
  ctx.fillStyle = 'rgba(0,0,0,0.38)'
  ctx.fill()
  ctx.restore()

  if (selected) {
    ctx.save()
    ctx.beginPath()
    const c0 = project(g.x, g.z, 0)
    const c1 = project(g.x + g.w, g.z, 0)
    const c2 = project(g.x + g.w, fz, 0)
    const c3 = project(g.x, fz, 0)
    ctx.moveTo(c0.x, c0.y)
    ctx.lineTo(c1.x, c1.y)
    ctx.lineTo(c2.x, c2.y)
    ctx.lineTo(c3.x, c3.y)
    ctx.closePath()
    ctx.strokeStyle = '#f59e0b'
    ctx.lineWidth = 1.4
    ctx.stroke()
    ctx.restore()
  }
}

// ---------- runs ----------

function drawRun(ctx: Ctx, s: RenderState, run: RunScene, pxPerCm: number) {
  // 1) elevation face
  if (run.frames.length) {
    const wPx = Math.ceil(run.elev.len * pxPerCm) + 2
    const hPx = Math.ceil(ELEV_TOP * pxPerCm) + 2
    const off = offscreenFor(run.id, wPx, hPx)
    const octx = off.getContext('2d')!
    const es: ElevationState = {
      runId: run.id,
      elev: run.elev,
      selection: s.selection,
      hoveredFrameId: s.hoveredFrameId,
      hoveredApplianceId: s.hoveredApplianceId,
      dropTargets: s.dropTargets,
      activeDropTarget: s.activeDropTarget,
      dragFrameId: s.frameDrag?.frameId ?? null,
      insertionU: s.frameDrag && s.frameDrag.runId === run.id ? s.frameDrag.u : null,
      showDims: s.showDims,
      unit: s.unit,
      time: s.time,
    }
    renderElevation(octx, es, pxPerCm)
    const t = faceTransform(run.face, run.mirror)
    ctx.save()
    ctx.transform(t.a, t.b, t.c, t.d, t.e, t.f)
    ctx.scale(1 / pxPerCm, 1 / pxPerCm)
    ctx.drawImage(off, 0, 0)
    ctx.restore()
  }

  // 2) end cap (side runs) — front-facing blank cabinet side
  if (run.endCap && run.frames.length) {
    const lastFrame = run.endCap.frame
    const t = faceTransform(run.endCap.face, run.mirror)
    ctx.save()
    ctx.transform(t.a, t.b, t.c, t.d, t.e, t.f)
    const h = lastFrame ? frameBodyH(lastFrame) : FRAME_BODY_H
    drawBlankFront(ctx, lastFrame?.finish ?? 'graphite', { x: 0, y: ELEV_TOP - h, w: RUN_DEPTH, h })
    // counter edge on the cap
    const cg = ctx.createLinearGradient(0, ELEV_TOP - h - COUNTER_T, 0, ELEV_TOP - h)
    cg.addColorStop(0, '#e0dbd0')
    cg.addColorStop(1, '#b3ac9c')
    fillRoundRect(ctx, -3, ELEV_TOP - h - COUNTER_T, RUN_DEPTH + 3, COUNTER_T, 1, cg)
    ctx.restore()
  }

  // 3) counter top faces for this run
  for (const top of s.scene.counterTops.filter((t) => t.runId === run.id)) {
    drawCounterTop(ctx, s, top)
  }
}

function drawCounterTop(ctx: Ctx, s: RenderState, top: CounterTop) {
  ctx.save()
  planTransform(ctx, top.y, top.mirror)
  const g = ctx.createLinearGradient(0, top.z, 0, top.z + top.d)
  g.addColorStop(0, '#cfc9bb')
  g.addColorStop(1, '#e8e3d8')
  ctx.fillStyle = g
  ctx.fillRect(top.x, top.z, top.w, top.d)
  ctx.strokeStyle = 'rgba(90,80,60,0.25)'
  ctx.lineWidth = 0.5
  ctx.strokeRect(top.x + 0.25, top.z + 0.25, top.w - 0.5, top.d - 0.5)

  // plan symbols for the counter-level appliances of this run
  const run = s.scene.runs.find((r) => r.id === top.runId)
  if (run) {
    for (const al of run.elev.appliances) {
      if (al.placed.zone !== 'top') continue
      const surfaceY = -al.frame.counterTopY
      if (Math.abs(surfaceY - top.y) > 0.01) continue
      // run-local u → plan within this top rect
      const horizontal = run.face.dir.x !== 0
      const u0 = al.rect.x + 1
      const u1 = al.rect.x + al.rect.w - 1
      let px: number, pz: number, pw: number, pd: number
      if (horizontal) {
        px = run.face.origin.x + u0
        pw = u1 - u0
        pz = run.plan.z + 7
        pd = RUN_DEPTH - 16
      } else {
        pz = run.face.origin.z + u0
        pd = u1 - u0
        px = run.plan.x + 7
        pw = RUN_DEPTH - 16
      }
      if (px < top.x || px + pw > top.x + top.w + 1 || pz < top.z - 1 || pz + pd > top.z + top.d + 1) {
        // symbol may live on a different segment; clamp lightly
      }
      const type = (() => {
        try {
          return getAppliance(al.placed.typeId)
        } catch {
          return null
        }
      })()
      if (!type) continue
      const base = type.paintAs ?? type.id
      if (type.mount === 'kamado') {
        const cx = px + pw / 2
        const cz = pz + pd / 2
        const r = Math.min(pw, pd) / 2
        ctx.beginPath()
        ctx.arc(cx, cz, r, 0, Math.PI * 2)
        ctx.fillStyle = base.startsWith('egg') ? '#2f6a3c' : '#2e3237'
        ctx.fill()
        ctx.beginPath()
        ctx.arc(cx, cz, r * 0.55, 0, Math.PI * 2)
        ctx.strokeStyle = 'rgba(255,255,255,0.25)'
        ctx.lineWidth = 1
        ctx.stroke()
        continue
      }
      // generic drop-in inset
      roundRectPath(ctx, px, pz, pw, pd, 3)
      const ig = ctx.createLinearGradient(0, pz, 0, pz + pd)
      ig.addColorStop(0, '#23272c')
      ig.addColorStop(1, '#3a3f45')
      ctx.fillStyle = ig
      ctx.fill()
      ctx.strokeStyle = 'rgba(255,255,255,0.2)'
      ctx.lineWidth = 0.6
      ctx.stroke()
      if (/^(grill|santamaria|griddle|burner)/.test(base)) {
        ctx.strokeStyle = 'rgba(150,158,166,0.55)'
        ctx.lineWidth = 0.8
        const lines = Math.max(3, Math.floor(pw / 9))
        for (let i = 1; i < lines; i++) {
          const lx = px + (pw * i) / lines
          ctx.beginPath()
          ctx.moveTo(lx, pz + 2)
          ctx.lineTo(lx, pz + pd - 2)
          ctx.stroke()
        }
      } else if (base.startsWith('sink')) {
        fillRoundRect(ctx, px + pw * 0.2, pz + pd * 0.2, pw * 0.6, pd * 0.6, 2, '#5a6268')
      } else if (base.startsWith('pizza')) {
        fillRoundRect(ctx, px + 2, pz + 2, pw - 4, pd - 4, 4, '#8d949b')
      }
    }
  }
  ctx.restore()
}

// ---------- smoke ----------

function drawSmoke(ctx: Ctx, s: RenderState) {
  for (const run of s.scene.runs) {
    const t = faceTransform(run.face, run.mirror)
    for (const al of run.elev.appliances) {
      if (!SMOKY_TYPES.test(al.placed.typeId) && !SMOKY_TYPES.test((() => {
        try {
          return getAppliance(al.placed.typeId).paintAs ?? ''
        } catch {
          return ''
        }
      })())) continue
      if (s.frameDrag?.frameId === al.frame.frame.id) continue
      const u = al.rect.x + al.rect.w * 0.72
      const yDown = al.rect.y + ELEV_TOP + 1
      const ox = t.e + u * t.a
      const oy = t.f + u * t.b + yDown
      for (let k = 0; k < 4; k++) {
        const tt = (s.time * 0.1 + k / 4 + u * 0.001) % 1
        const y = oy - tt * 46
        const x = ox + Math.sin(tt * 5 + k * 2.1) * (3 + tt * 7)
        const alpha = (1 - tt) * 0.09
        ctx.beginPath()
        ctx.arc(x, y, 2.5 + tt * 6, 0, Math.PI * 2)
        ctx.fillStyle = `rgba(220,225,232,${alpha.toFixed(3)})`
        ctx.fill()
      }
    }
  }
}

// ---------- hints & dims ----------

function drawEmptyHint(ctx: Ctx, s: RenderState) {
  const w = 90
  const p = project(-w / 2, RUN_DEPTH, 0)
  const r: Rect = { x: p.x, y: p.y - FRAME_BODY_H, w, h: FRAME_BODY_H }
  ctx.save()
  ctx.setLineDash([5, 4])
  strokeRoundRect(ctx, r.x, r.y, r.w, r.h, 2, 'rgba(148,163,184,0.35)', 1)
  ctx.restore()
  label(ctx, 'Add a frame to start building', r.x + w / 2, r.y + r.h / 2 - 6, 7, 'rgba(148,163,184,0.7)')
  label(ctx, '(or ask the assistant)', r.x + w / 2, r.y + r.h / 2 + 6, 6, 'rgba(148,163,184,0.45)')
}

function drawGroundDims(ctx: Ctx, s: RenderState) {
  const g = s.scene.ground
  const front = project(g.x, g.z + g.d, -GROUND_T)
  dimLine(ctx, front.x, front.x + g.w, front.y + GROUND_T + 12, formatLen(s.design.ground.width, s.unit))
  // depth dim along the right edge (sheared)
  const d0 = project(g.x + g.w + 14, g.z, 0)
  const d1 = project(g.x + g.w + 14, g.z + g.d, 0)
  ctx.save()
  ctx.strokeStyle = 'rgba(148,163,184,0.7)'
  ctx.lineWidth = 0.5
  ctx.beginPath()
  ctx.moveTo(d0.x, d0.y)
  ctx.lineTo(d1.x, d1.y)
  ctx.stroke()
  label(
    ctx,
    formatLen(groundDepth(s.design.ground), s.unit),
    (d0.x + d1.x) / 2 + 10,
    (d0.y + d1.y) / 2,
    5.5,
    'rgba(148,163,184,0.75)',
    'left',
  )
  ctx.restore()
}

// re-export for CanvasStage & thumbnails
export { computeScene }
export type { SceneLayout3 }
