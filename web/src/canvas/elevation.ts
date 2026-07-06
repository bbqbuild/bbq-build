// Renders one run's elevation (frames, counters, appliances, overlays) into an
// offscreen canvas in run-local coordinates: u along the run (px = u·S),
// y as in world (0 = ground, negative up; py = (y + ELEV_TOP)·S).

import type { FrameFinish, RunId, Selection } from '../types'
import { COUNTER_T } from '../types'
import { getAppliance } from '../catalog/appliances'
import { PAINTERS } from './applianceArt'
import { Ctx, brushLines, fillRoundRect, label, roundRectPath, steel, graphite, strokeRoundRect } from './draw'
import { formatLenBare, type Unit } from '../units'
import type { Rect } from './layout'
import { ELEV_TOP, type RunApplianceLayout, type RunElevation, type RunFrameLayout } from './scene'

const ACCENT = '#f59e0b'

export interface ElevationState {
  runId: RunId
  elev: RunElevation
  selection: Selection
  hoveredFrameId: string | null
  hoveredApplianceId: string | null
  dropTargets: Set<string> | null
  activeDropTarget: string | null
  /** frame being drag-reordered (rendered ghosted) */
  dragFrameId: string | null
  /** insertion marker u (run-local) when this run is the drag target */
  insertionU: number | null
  showDims: boolean
  unit: Unit
  time: number
}

export function renderElevation(ctx: Ctx, s: ElevationState, pxPerCm: number) {
  ctx.setTransform(pxPerCm, 0, 0, pxPerCm, 0, ELEV_TOP * pxPerCm)
  ctx.clearRect(0, -ELEV_TOP, s.elev.len + 2, ELEV_TOP + 2)

  for (const fl of s.elev.frames) {
    ctx.save()
    if (fl.frame.id === s.dragFrameId) ctx.globalAlpha = 0.35
    drawFrame(ctx, s, fl)
    ctx.restore()
  }
  for (const c of s.elev.counters) drawCounter(ctx, c)
  for (const al of s.elev.appliances) {
    ctx.save()
    if (al.frame.frame.id === s.dragFrameId) ctx.globalAlpha = 0.35
    drawAppliance(ctx, s, al)
    ctx.restore()
  }
  drawOverlays(ctx, s)
  if (s.showDims && s.elev.frames.length) drawRunDims(ctx, s)
  if (s.insertionU !== null) {
    ctx.strokeStyle = ACCENT
    ctx.lineWidth = 1.6
    ctx.setLineDash([3, 3])
    ctx.beginPath()
    ctx.moveTo(s.insertionU, -ELEV_TOP + 30)
    ctx.lineTo(s.insertionU, 4)
    ctx.stroke()
    ctx.setLineDash([])
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

/** Blank finished front — used for corner units and run end caps. */
export function drawBlankFront(ctx: Ctx, finish: FrameFinish, r: Rect) {
  fillRoundRect(ctx, r.x, r.y, r.w, r.h, [0, 0, 1.5, 1.5], finishFill(ctx, finish, r.y, r.y + r.h))
  if (finish === 'steel') brushLines(ctx, r.x, r.y, r.w, r.h, 0.04)
  ctx.strokeStyle = 'rgba(0,0,0,0.35)'
  strokeRoundRect(ctx, r.x + 0.3, r.y + 0.3, r.w - 0.6, r.h - 0.6, 1, 'rgba(0,0,0,0.35)', 0.5)
}

function drawFrame(ctx: Ctx, s: ElevationState, fl: RunFrameLayout) {
  const b = fl.body
  const o = fl.opening
  const finish = fl.frame.finish

  fillRoundRect(ctx, b.x, b.y, b.w, b.h, [0, 0, 1.5, 1.5], finishFill(ctx, finish, b.y, b.y + b.h))
  if (finish === 'steel') brushLines(ctx, b.x, b.y, b.w, b.h, 0.04)
  if (finish === 'teak') {
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
  }

  // cavity
  const cav = ctx.createLinearGradient(0, o.y, 0, o.y + o.h)
  cav.addColorStop(0, '#0c0e11')
  cav.addColorStop(1, '#191d22')
  fillRoundRect(ctx, o.x, o.y, o.w, o.h, 1, cav)
  strokeRoundRect(ctx, o.x + 0.4, o.y + 0.4, o.w - 0.8, o.h - 0.8, 1, 'rgba(0,0,0,0.5)', 0.8)

  // toe kick + seam
  ctx.strokeStyle = 'rgba(0,0,0,0.3)'
  ctx.lineWidth = 0.5
  ctx.beginPath()
  ctx.moveTo(b.x + 1, b.y + b.h - 0.6)
  ctx.lineTo(b.x + b.w - 1, b.y + b.h - 0.6)
  ctx.stroke()
  ctx.strokeStyle = 'rgba(0,0,0,0.4)'
  ctx.beginPath()
  ctx.moveTo(b.x + 0.3, b.y + 1)
  ctx.lineTo(b.x + 0.3, b.y + b.h - 1)
  ctx.stroke()

  const hasBase = s.elev.appliances.some((a) => a.frame.frame.id === fl.frame.id && a.placed.zone === 'base')
  if (!hasBase) {
    ctx.save()
    ctx.setLineDash([2.5, 2.5])
    strokeRoundRect(ctx, o.x + 2, o.y + 2, o.w - 4, o.h - 4, 1, 'rgba(148,163,184,0.28)', 0.7)
    ctx.restore()
    label(ctx, '+', o.x + o.w / 2, o.y + o.h / 2, 10, 'rgba(148,163,184,0.4)')
  }
}

function drawCounter(ctx: Ctx, c: Rect) {
  const g = ctx.createLinearGradient(0, c.y, 0, c.y + c.h)
  g.addColorStop(0, '#e6e1d6')
  g.addColorStop(0.25, '#d9d3c6')
  g.addColorStop(1, '#b3ac9c')
  fillRoundRect(ctx, c.x, c.y, c.w, c.h, 1.2, g)
  ctx.strokeStyle = 'rgba(255,255,255,0.65)'
  ctx.lineWidth = 0.7
  ctx.beginPath()
  ctx.moveTo(c.x + 0.6, c.y + 0.5)
  ctx.lineTo(c.x + c.w - 0.6, c.y + 0.5)
  ctx.stroke()
  ctx.strokeStyle = 'rgba(0,0,0,0.25)'
  ctx.lineWidth = 0.5
  ctx.beginPath()
  ctx.moveTo(c.x + 0.6, c.y + c.h - 0.5)
  ctx.lineTo(c.x + c.w - 0.6, c.y + c.h - 0.5)
  ctx.stroke()
}

function drawAppliance(ctx: Ctx, s: ElevationState, al: RunApplianceLayout) {
  let painter = PAINTERS[al.placed.typeId]
  if (!painter) {
    try {
      const paintAs = getAppliance(al.placed.typeId).paintAs
      if (paintAs) painter = PAINTERS[paintAs]
    } catch {
      return
    }
  }
  if (!painter) return
  painter(ctx, al.rect, { counterY: al.frame.counterTopY, counterH: COUNTER_T, time: s.time })
}

// ---------- overlays ----------

function frameFullRect(fl: RunFrameLayout): Rect {
  return { x: fl.body.x - 1, y: fl.counterTopY - 1, w: fl.body.w + 2, h: fl.body.h + COUNTER_T + 2 }
}

function drawOverlays(ctx: Ctx, s: ElevationState) {
  if (s.hoveredFrameId && !s.dropTargets) {
    const fl = s.elev.frames.find((f) => f.frame.id === s.hoveredFrameId)
    if (fl && !(s.selection.kind === 'frame' && s.selection.id === fl.frame.id) && fl.frame.id !== s.dragFrameId) {
      const r = frameFullRect(fl)
      strokeRoundRect(ctx, r.x, r.y, r.w, r.h, 2, 'rgba(245,158,11,0.4)', 0.8)
    }
  }

  if (s.selection.kind === 'frame') {
    const fl = s.elev.frames.find((f) => f.frame.id === (s.selection as { id: string }).id)
    if (fl) {
      const r = frameFullRect(fl)
      ctx.save()
      ctx.shadowColor = 'rgba(245,158,11,0.55)'
      ctx.shadowBlur = 10
      strokeRoundRect(ctx, r.x, r.y, r.w, r.h, 2, ACCENT, 1.3)
      ctx.restore()
    }
  } else if (s.selection.kind === 'appliance') {
    const al = s.elev.appliances.find((a) => a.placed.id === (s.selection as { id: string }).id)
    if (al) {
      ctx.save()
      ctx.shadowColor = 'rgba(245,158,11,0.55)'
      ctx.shadowBlur = 8
      strokeRoundRect(ctx, al.rect.x - 1.2, al.rect.y - 1.2, al.rect.w + 2.4, al.rect.h + 2.4, 2, ACCENT, 1.2)
      ctx.restore()
    }
  }

  if (s.hoveredApplianceId && !s.dropTargets) {
    const al = s.elev.appliances.find((a) => a.placed.id === s.hoveredApplianceId)
    if (al && !(s.selection.kind === 'appliance' && s.selection.id === s.hoveredApplianceId)) {
      strokeRoundRect(ctx, al.rect.x - 1, al.rect.y - 1, al.rect.w + 2, al.rect.h + 2, 2, 'rgba(245,158,11,0.4)', 0.8)
    }
  }

  if (s.dropTargets) {
    const pulse = 0.55 + 0.3 * Math.sin(s.time * 5)
    for (const fl of s.elev.frames) {
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
        ctx.fillStyle = 'rgba(245,158,11,0.16)'
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
}

function drawRunDims(ctx: Ctx, s: ElevationState) {
  const tops = s.elev.appliances.filter((a) => a.placed.zone === 'top').map((a) => a.rect.y)
  const y = Math.min(-88, ...tops) - 9
  ctx.strokeStyle = 'rgba(148,163,184,0.85)'
  ctx.lineWidth = 0.5
  ctx.beginPath()
  ctx.moveTo(0, y)
  ctx.lineTo(s.elev.len, y)
  let tick = 0
  for (const fl of s.elev.frames) {
    ctx.moveTo(tick, y - 3)
    ctx.lineTo(tick, y + 3)
    tick += fl.frame.width
  }
  ctx.moveTo(tick, y - 3)
  ctx.lineTo(tick, y + 3)
  ctx.stroke()
  for (const fl of s.elev.frames) {
    label(ctx, formatLenBare(fl.frame.width, s.unit), fl.body.x + fl.body.w / 2, y - 4.5, 5, 'rgba(148,163,184,0.8)')
  }
}
