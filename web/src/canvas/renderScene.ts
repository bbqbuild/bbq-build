import type { Design, FrameFinish, Selection } from '../types'
import { COUNTER_T, FRAME_BODY_H } from '../types'
import { getAppliance } from '../catalog/appliances'
import { PAINTERS } from './applianceArt'
import { Ctx, brushLines, dimLine, dimLineV, fillRoundRect, graphite, label, roundRectPath, steel, strokeRoundRect } from './draw'
import type { ApplianceLayout, FrameLayout, Rect, SceneLayout } from './layout'

export interface Camera {
  /** world coords (cm) at the viewport centre */
  x: number
  y: number
  /** pixels per cm */
  zoom: number
}

export interface RenderState {
  design: Design
  layout: SceneLayout
  selection: Selection
  hoveredFrameId: string | null
  hoveredApplianceId: string | null
  /** frame ids that can accept the appliance currently dragged from the catalog */
  dropTargets: Set<string> | null
  activeDropTarget: string | null
  /** live frame-reorder drag: frame follows the pointer */
  frameDrag: { frameId: string; worldX: number } | null
  showDims: boolean
  showGrid: boolean
  time: number
  camera: Camera
  width: number
  height: number
  dpr: number
}

const ACCENT = '#f59e0b'

export function renderScene(ctx: Ctx, s: RenderState) {
  const { width: W, height: H, dpr, camera } = s
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  drawBackground(ctx, W, H)

  // world transform
  const scale = camera.zoom
  ctx.setTransform(dpr * scale, 0, 0, dpr * scale, dpr * (W / 2 - camera.x * scale), dpr * (H / 2 - camera.y * scale))

  if (s.showGrid) drawGrid(ctx, s)

  drawSceneShadow(ctx, s.layout)
  drawGround(ctx, s)

  if (!s.design.frames.length) {
    drawEmptyHint(ctx, s)
  }

  // frames (bodies + base appliances), skipping the dragged frame so it can be drawn on top
  const draggedId = s.frameDrag?.frameId ?? null
  for (const fl of s.layout.frames) {
    if (fl.frame.id === draggedId) continue
    drawFrame(ctx, s, fl, 0)
  }

  if (s.layout.counter) drawCounter(ctx, s.layout.counter)

  for (const al of s.layout.appliances) {
    if (al.frame.frame.id === draggedId) continue
    drawAppliance(ctx, s, al, 0)
  }

  // dragged frame rendered last, floating at the pointer
  if (draggedId) {
    const fl = s.layout.frames.find((f) => f.frame.id === draggedId)
    if (fl) {
      const dx = s.frameDrag!.worldX - (fl.body.x + fl.body.w / 2)
      ctx.save()
      ctx.globalAlpha = 0.88
      drawFrame(ctx, s, fl, dx)
      // its own counter chunk
      const c: Rect = { x: fl.body.x + dx - 1.5, y: -FRAME_BODY_H - COUNTER_T, w: fl.body.w + 3, h: COUNTER_T }
      drawCounter(ctx, c)
      for (const al of s.layout.appliances.filter((a) => a.frame.frame.id === draggedId)) {
        drawAppliance(ctx, s, al, dx)
      }
      ctx.restore()
    }
  }

  drawSmoke(ctx, s)
  drawOverlays(ctx, s)
  if (s.showDims) drawDimensions(ctx, s)

  // warning if frames overflow the ground
  if (s.layout.overflow) {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    ctx.font = '600 12px Inter, system-ui, sans-serif'
    ctx.textAlign = 'center'
    ctx.fillStyle = '#fca5a5'
    ctx.fillText('⚠ Frames are wider than the ground platform — widen the ground', W / 2, H - 18)
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
  // soft radial spotlight in the centre
  const r = ctx.createRadialGradient(W / 2, H * 0.45, 40, W / 2, H * 0.45, Math.max(W, H) * 0.7)
  r.addColorStop(0, 'rgba(255,244,224,0.05)')
  r.addColorStop(1, 'rgba(0,0,0,0)')
  ctx.fillStyle = r
  ctx.fillRect(0, 0, W, H)
}

function drawGrid(ctx: Ctx, s: RenderState) {
  const step = 20 // cm
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

function drawSceneShadow(ctx: Ctx, layout: SceneLayout) {
  const g = layout.ground
  const cy = g.y + g.h + 6
  const grad = ctx.createRadialGradient(0, cy, 1, 0, cy, g.w * 0.62)
  grad.addColorStop(0, 'rgba(0,0,0,0.5)')
  grad.addColorStop(1, 'rgba(0,0,0,0)')
  ctx.save()
  ctx.translate(0, cy)
  ctx.scale(1, 0.08)
  ctx.translate(0, -cy)
  ctx.fillStyle = grad
  ctx.beginPath()
  ctx.arc(0, cy, g.w * 0.62, 0, Math.PI * 2)
  ctx.fill()
  ctx.restore()
}

// ---------- ground ----------

function drawGround(ctx: Ctx, s: RenderState) {
  const g = s.layout.ground
  const type = s.design.ground.type
  const selected = s.selection.kind === 'ground'

  if (type === 'deck') {
    // stacked plank faces
    const plankH = g.h / 2
    for (let i = 0; i < 2; i++) {
      const y = g.y + i * plankH
      const grad = ctx.createLinearGradient(0, y, 0, y + plankH)
      grad.addColorStop(0, i === 0 ? '#8a5f3c' : '#77502f')
      grad.addColorStop(1, i === 0 ? '#6d4a2c' : '#5d3f26')
      fillRoundRect(ctx, g.x, y, g.w, plankH - 0.8, 0.8, grad)
      // board joints
      ctx.strokeStyle = 'rgba(0,0,0,0.35)'
      ctx.lineWidth = 0.5
      const seg = 60
      for (let x = g.x + seg / 2 + i * seg * 0.5; x < g.x + g.w; x += seg) {
        ctx.beginPath()
        ctx.moveTo(x, y + 1)
        ctx.lineTo(x, y + plankH - 2)
        ctx.stroke()
      }
    }
  } else if (type === 'concrete') {
    const grad = ctx.createLinearGradient(0, g.y, 0, g.y + g.h)
    grad.addColorStop(0, '#9b9d9e')
    grad.addColorStop(1, '#7c7e80')
    fillRoundRect(ctx, g.x, g.y, g.w, g.h, 1, grad)
    ctx.strokeStyle = 'rgba(0,0,0,0.18)'
    ctx.lineWidth = 0.5
    for (let x = g.x + 90; x < g.x + g.w; x += 90) {
      ctx.beginPath()
      ctx.moveTo(x, g.y + 1)
      ctx.lineTo(x, g.y + g.h - 1)
      ctx.stroke()
    }
  } else if (type === 'pavers') {
    fillRoundRect(ctx, g.x, g.y, g.w, g.h, 1, '#5a5e63')
    const tile = 40
    for (let i = 0; i < 2; i++) {
      const y = g.y + (i * g.h) / 2
      for (let x = g.x + ((i % 2) * tile) / 2; x < g.x + g.w; x += tile) {
        const w = Math.min(tile - 2, g.x + g.w - x - 1)
        if (w > 2) fillRoundRect(ctx, x + 1, y + 1, w, g.h / 2 - 2, 0.8, i % 2 ? '#75797f' : '#7d8187')
      }
    }
  } else {
    // natural stone
    fillRoundRect(ctx, g.x, g.y, g.w, g.h, 1, '#57534e')
    let x = g.x + 2
    let flip = false
    while (x < g.x + g.w - 3) {
      const w = flip ? 34 : 24
      const ww = Math.min(w, g.x + g.w - x - 2)
      fillRoundRect(ctx, x, g.y + 1.5, ww, g.h - 3, 2.5, flip ? '#6f6a63' : '#7d766d')
      x += ww + 2.5
      flip = !flip
    }
  }

  // top edge highlight
  ctx.strokeStyle = 'rgba(255,255,255,0.22)'
  ctx.lineWidth = 0.6
  ctx.beginPath()
  ctx.moveTo(g.x, g.y + 0.3)
  ctx.lineTo(g.x + g.w, g.y + 0.3)
  ctx.stroke()

  if (selected) {
    strokeRoundRect(ctx, g.x - 1.5, g.y - 1.5, g.w + 3, g.h + 3, 2, ACCENT, 1.2)
  }
}

// ---------- frames ----------

function finishFill(ctx: Ctx, finish: FrameFinish, y0: number, y1: number): string | CanvasGradient {
  switch (finish) {
    case 'steel':
      return steel(ctx, y0, y1)
    case 'graphite':
      return graphite(ctx, y0, y1)
    case 'teak': {
      const g = ctx.createLinearGradient(0, y0, 0, y1)
      g.addColorStop(0, '#a5754b')
      g.addColorStop(0.5, '#8f6138')
      g.addColorStop(1, '#7a5230')
      return g
    }
    case 'stone': {
      const g = ctx.createLinearGradient(0, y0, 0, y1)
      g.addColorStop(0, '#7a766f')
      g.addColorStop(1, '#5f5b55')
      return g
    }
  }
}

function drawFrame(ctx: Ctx, s: RenderState, fl: FrameLayout, dx: number) {
  const b = { ...fl.body, x: fl.body.x + dx }
  const o = { ...fl.opening, x: fl.opening.x + dx }
  const finish = fl.frame.finish

  // body
  fillRoundRect(ctx, b.x, b.y, b.w, b.h, [0, 0, 1.5, 1.5], finishFill(ctx, finish, b.y, b.y + b.h))
  if (finish === 'steel') brushLines(ctx, b.x, b.y, b.w, b.h, 0.04)
  if (finish === 'teak') {
    // horizontal slats
    ctx.strokeStyle = 'rgba(40,24,10,0.4)'
    ctx.lineWidth = 0.6
    for (let y = b.y + 8; y < b.y + b.h - 4; y += 8) {
      ctx.beginPath()
      ctx.moveTo(b.x + 1, y)
      ctx.lineTo(b.x + b.w - 1, y)
      ctx.stroke()
    }
  }
  if (finish === 'stone') {
    ctx.strokeStyle = 'rgba(25,22,18,0.35)'
    ctx.lineWidth = 0.6
    for (let i = 0; i < 3; i++) {
      const y = b.y + ((i + 1) * b.h) / 4
      ctx.beginPath()
      ctx.moveTo(b.x + 1, y)
      ctx.lineTo(b.x + b.w - 1, y)
      ctx.stroke()
    }
    for (let i = 0; i < 4; i++) {
      const y0 = b.y + (i * b.h) / 4
      const x = b.x + b.w * (0.3 + 0.4 * ((i * 13) % 2))
      ctx.beginPath()
      ctx.moveTo(x, y0 + 1)
      ctx.lineTo(x, y0 + b.h / 4 - 1)
      ctx.stroke()
    }
  }

  // inner opening (cavity)
  const cav = ctx.createLinearGradient(0, o.y, 0, o.y + o.h)
  cav.addColorStop(0, '#0c0e11')
  cav.addColorStop(1, '#191d22')
  fillRoundRect(ctx, o.x, o.y, o.w, o.h, 1, cav)
  // cavity inner shadow
  ctx.strokeStyle = 'rgba(0,0,0,0.5)'
  strokeRoundRect(ctx, o.x + 0.4, o.y + 0.4, o.w - 0.8, o.h - 0.8, 1, 'rgba(0,0,0,0.5)', 0.8)

  // toe kick shadow line
  ctx.strokeStyle = 'rgba(0,0,0,0.3)'
  ctx.lineWidth = 0.5
  ctx.beginPath()
  ctx.moveTo(b.x + 1, b.y + b.h - 0.6)
  ctx.lineTo(b.x + b.w - 1, b.y + b.h - 0.6)
  ctx.stroke()

  // seam between adjacent frames
  ctx.strokeStyle = 'rgba(0,0,0,0.4)'
  ctx.lineWidth = 0.5
  ctx.beginPath()
  ctx.moveTo(b.x + 0.3, b.y + 1)
  ctx.lineTo(b.x + 0.3, b.y + b.h - 1)
  ctx.stroke()

  // empty base slot hint
  const hasBase = s.design.appliances.some((a) => a.frameId === fl.frame.id && a.zone === 'base')
  if (!hasBase) {
    ctx.save()
    ctx.setLineDash([2.5, 2.5])
    strokeRoundRect(ctx, o.x + 2, o.y + 2, o.w - 4, o.h - 4, 1, 'rgba(148,163,184,0.28)', 0.7)
    ctx.restore()
    label(ctx, '+', o.x + o.w / 2, o.y + o.h / 2, 10, 'rgba(148,163,184,0.4)')
  }
}

// ---------- counter ----------

function drawCounter(ctx: Ctx, c: Rect) {
  const g = ctx.createLinearGradient(0, c.y, 0, c.y + c.h)
  g.addColorStop(0, '#e6e1d6')
  g.addColorStop(0.25, '#d9d3c6')
  g.addColorStop(1, '#b3ac9c')
  fillRoundRect(ctx, c.x, c.y, c.w, c.h, 1.2, g)
  // polished top highlight
  ctx.strokeStyle = 'rgba(255,255,255,0.65)'
  ctx.lineWidth = 0.7
  ctx.beginPath()
  ctx.moveTo(c.x + 0.6, c.y + 0.5)
  ctx.lineTo(c.x + c.w - 0.6, c.y + 0.5)
  ctx.stroke()
  // drip edge
  ctx.strokeStyle = 'rgba(0,0,0,0.25)'
  ctx.lineWidth = 0.5
  ctx.beginPath()
  ctx.moveTo(c.x + 0.6, c.y + c.h - 0.5)
  ctx.lineTo(c.x + c.w - 0.6, c.y + c.h - 0.5)
  ctx.stroke()
}

// ---------- appliances ----------

function drawAppliance(ctx: Ctx, s: RenderState, al: ApplianceLayout, dx: number) {
  const painter = PAINTERS[al.placed.typeId]
  if (!painter) return
  const r = { ...al.rect, x: al.rect.x + dx }
  const counterY = -FRAME_BODY_H - COUNTER_T
  painter(ctx, r, { counterY, counterH: COUNTER_T, time: s.time })
}

// ---------- smoke ----------

function drawSmoke(ctx: Ctx, s: RenderState) {
  const grills = s.layout.appliances.filter((a) => a.placed.typeId.startsWith('grill-'))
  for (const g of grills) {
    if (s.frameDrag && g.frame.frame.id === s.frameDrag.frameId) continue
    const originX = g.rect.x + g.rect.w * 0.72
    const originY = g.rect.y + 1
    for (let k = 0; k < 4; k++) {
      const t = (s.time * 0.1 + k / 4 + g.rect.x * 0.001) % 1
      const y = originY - t * 46
      const x = originX + Math.sin(t * 5 + k * 2.1) * (3 + t * 7)
      const alpha = (1 - t) * 0.09
      const rad = 2.5 + t * 6
      ctx.beginPath()
      ctx.arc(x, y, rad, 0, Math.PI * 2)
      ctx.fillStyle = `rgba(220,225,232,${alpha.toFixed(3)})`
      ctx.fill()
    }
  }
}

// ---------- overlays ----------

function frameFullRect(fl: FrameLayout): Rect {
  return { x: fl.body.x - 1, y: fl.body.y - COUNTER_T - 1, w: fl.body.w + 2, h: fl.body.h + COUNTER_T + 2 }
}

function drawOverlays(ctx: Ctx, s: RenderState) {
  // hover
  if (s.hoveredFrameId && (s.selection.kind !== 'frame' || s.selection.id !== s.hoveredFrameId) && !s.dropTargets) {
    const fl = s.layout.frames.find((f) => f.frame.id === s.hoveredFrameId)
    if (fl && fl.frame.id !== s.frameDrag?.frameId) {
      const r = frameFullRect(fl)
      strokeRoundRect(ctx, r.x, r.y, r.w, r.h, 2, 'rgba(245,158,11,0.4)', 0.8)
    }
  }

  // selection
  if (s.selection.kind === 'frame') {
    const fl = s.layout.frames.find((f) => f.frame.id === (s.selection as { id: string }).id)
    if (fl) {
      const r = frameFullRect(fl)
      ctx.save()
      ctx.shadowColor = 'rgba(245,158,11,0.55)'
      ctx.shadowBlur = 10
      strokeRoundRect(ctx, r.x, r.y, r.w, r.h, 2, ACCENT, 1.3)
      ctx.restore()
    }
  } else if (s.selection.kind === 'appliance') {
    const al = s.layout.appliances.find((a) => a.placed.id === (s.selection as { id: string }).id)
    if (al) {
      ctx.save()
      ctx.shadowColor = 'rgba(245,158,11,0.55)'
      ctx.shadowBlur = 8
      strokeRoundRect(ctx, al.rect.x - 1.2, al.rect.y - 1.2, al.rect.w + 2.4, al.rect.h + 2.4, 2, ACCENT, 1.2)
      ctx.restore()
    }
  }

  // hovered appliance
  if (s.hoveredApplianceId && !s.dropTargets) {
    const al = s.layout.appliances.find((a) => a.placed.id === s.hoveredApplianceId)
    if (al && !(s.selection.kind === 'appliance' && s.selection.id === s.hoveredApplianceId)) {
      strokeRoundRect(ctx, al.rect.x - 1, al.rect.y - 1, al.rect.w + 2, al.rect.h + 2, 2, 'rgba(245,158,11,0.4)', 0.8)
    }
  }

  // drag-from-catalog drop targets
  if (s.dropTargets) {
    const pulse = 0.55 + 0.3 * Math.sin(s.time * 5)
    for (const fl of s.layout.frames) {
      const ok = s.dropTargets.has(fl.frame.id)
      const r = frameFullRect(fl)
      if (!ok) {
        ctx.fillStyle = 'rgba(10,12,15,0.45)'
        roundRectPath(ctx, r.x, r.y, r.w, r.h, 2)
        ctx.fill()
        continue
      }
      ctx.save()
      if (fl.frame.id === s.activeDropTarget) {
        ctx.fillStyle = `rgba(245,158,11,0.16)`
        roundRectPath(ctx, r.x, r.y, r.w, r.h, 2)
        ctx.fill()
        ctx.shadowColor = 'rgba(245,158,11,0.7)'
        ctx.shadowBlur = 12
        strokeRoundRect(ctx, r.x, r.y, r.w, r.h, 2, ACCENT, 1.5)
      } else {
        ctx.setLineDash([4, 3])
        strokeRoundRect(ctx, r.x, r.y, r.w, r.h, 2, `rgba(245,158,11,${pulse.toFixed(2)})`, 1)
      }
      ctx.restore()
    }
  }

  // frame reorder insertion marker
  if (s.frameDrag) {
    const fl = s.layout.frames.find((f) => f.frame.id === s.frameDrag!.frameId)
    if (fl) {
      // marker at insertion position
      let x = -s.layout.rowWidth / 2
      for (const other of s.layout.frames) {
        if (other.frame.id === fl.frame.id) continue
        if (s.frameDrag.worldX > other.body.x + other.body.w / 2) x = other.body.x + other.body.w
      }
      ctx.strokeStyle = ACCENT
      ctx.lineWidth = 1.4
      ctx.setLineDash([3, 3])
      ctx.beginPath()
      ctx.moveTo(x, -FRAME_BODY_H - COUNTER_T - 12)
      ctx.lineTo(x, 6)
      ctx.stroke()
      ctx.setLineDash([])
    }
  }
}

function drawEmptyHint(ctx: Ctx, s: RenderState) {
  const w = 90
  const r: Rect = { x: -w / 2, y: -FRAME_BODY_H, w, h: FRAME_BODY_H }
  ctx.save()
  ctx.setLineDash([5, 4])
  strokeRoundRect(ctx, r.x, r.y, r.w, r.h, 2, 'rgba(148,163,184,0.35)', 1)
  ctx.restore()
  label(ctx, 'Add a frame to start building', 0, r.y + r.h / 2 - 6, 7, 'rgba(148,163,184,0.7)')
  label(ctx, '(or pick a preset)', 0, r.y + r.h / 2 + 6, 6, 'rgba(148,163,184,0.45)')
}

function drawDimensions(ctx: Ctx, s: RenderState) {
  const g = s.layout.ground
  dimLine(ctx, g.x, g.x + g.w, g.y + g.h + 12, `${s.design.ground.width} cm`)
  if (s.layout.rowWidth && !s.frameDrag) {
    const x0 = -s.layout.rowWidth / 2
    const y = -FRAME_BODY_H - COUNTER_T - 10 - topClearance(s)
    // one dimension line with a tick at every frame boundary, PAX style
    ctx.save()
    ctx.strokeStyle = 'rgba(148,163,184,0.85)'
    ctx.lineWidth = 0.5
    ctx.beginPath()
    ctx.moveTo(x0, y)
    ctx.lineTo(x0 + s.layout.rowWidth, y)
    let tick = x0
    for (const fl of s.layout.frames) {
      ctx.moveTo(tick, y - 3)
      ctx.lineTo(tick, y + 3)
      tick += fl.frame.width
    }
    ctx.moveTo(tick, y - 3)
    ctx.lineTo(tick, y + 3)
    ctx.stroke()
    ctx.restore()
    for (const fl of s.layout.frames) {
      label(ctx, `${fl.frame.width}`, fl.body.x + fl.body.w / 2, y - 4.5, 5, 'rgba(148,163,184,0.8)')
    }
    if (s.layout.frames.length > 1) {
      label(ctx, `${s.layout.rowWidth} cm total`, 0, y - 12, 5.5, 'rgba(148,163,184,0.6)')
    }
    const right = Math.max(g.x + g.w, s.layout.rowWidth / 2)
    dimLineV(ctx, -FRAME_BODY_H - COUNTER_T, 0, right + 12, `${FRAME_BODY_H + COUNTER_T} cm`)
  }
}

function topClearance(s: RenderState): number {
  const tops = s.layout.appliances.filter((a) => a.placed.zone === 'top')
  return tops.length ? Math.max(...tops.map((a) => a.rect.h)) : 0
}
