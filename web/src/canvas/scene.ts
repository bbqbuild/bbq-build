import type { CornerId, Design, Frame, PlacedAppliance, RunId } from '../types'
import {
  CORNER,
  COUNTER_OVERHANG,
  COUNTER_T,
  GROUND_T,
  ISLAND_AISLE,
  RUN_DEPTH,
  cornerFor,
  frameBodyH,
  groundDepth,
  runsForLayout,
} from '../types'
import { applianceWidth, getAppliance } from '../catalog/appliances'
import { TOP_HEIGHTS } from './layout'
import { project, type FaceBasis, type PlanPoint } from './projection'
import type { Rect } from './layout'

/** Height of the elevation strip we render per run (ground → above tallest unit). */
export const ELEV_TOP = 170

// ---------- run-local elevation layout (u along the run, y as in world: 0 ground, negative up) ----------

export interface RunFrameLayout {
  frame: Frame
  index: number
  /** run-local: x is u-offset from run start */
  body: Rect
  opening: Rect
  counterTopY: number
}

export interface RunApplianceLayout {
  placed: PlacedAppliance
  frame: RunFrameLayout
  rect: Rect
}

export interface RunElevation {
  frames: RunFrameLayout[]
  counters: Rect[]
  appliances: RunApplianceLayout[]
  len: number
}

export function computeRunElevation(frames: Frame[], appliances: PlacedAppliance[]): RunElevation {
  const fls: RunFrameLayout[] = []
  let u = 0
  frames.forEach((frame, index) => {
    const bodyH = frameBodyH(frame)
    const body: Rect = { x: u, y: -bodyH, w: frame.width, h: bodyH }
    fls.push({
      frame,
      index,
      body,
      opening: { x: body.x + 3, y: body.y + 3, w: body.w - 6, h: body.h - 12 },
      counterTopY: -bodyH - COUNTER_T,
    })
    u += frame.width
  })

  const counters: Rect[] = []
  for (const fl of fls) {
    const last = counters[counters.length - 1]
    if (last && Math.abs(last.y - fl.counterTopY) < 0.01 && Math.abs(last.x + last.w - COUNTER_OVERHANG - fl.body.x) < 0.01) {
      last.w += fl.body.w
    } else {
      counters.push({ x: fl.body.x - COUNTER_OVERHANG, y: fl.counterTopY, w: fl.body.w + COUNTER_OVERHANG * 2, h: COUNTER_T })
    }
  }

  const als: RunApplianceLayout[] = []
  for (const placed of appliances) {
    const fl = fls.find((f) => f.frame.id === placed.frameId)
    if (!fl) continue
    const type = getAppliance(placed.typeId)
    // real appliances keep their cutout width centred in the frame; a wider
    // frame becomes counter margin rather than stretching the unit
    const aw = applianceWidth(type, fl.body.w)
    const off = (fl.body.w - aw) / 2
    if (placed.zone === 'base') {
      als.push({ placed, frame: fl, rect: { x: fl.body.x + off + 3, y: fl.opening.y, w: aw - 6, h: fl.opening.h } })
    } else {
      const h = TOP_HEIGHTS[type.id] ?? (type.paintAs ? TOP_HEIGHTS[type.paintAs] : undefined) ?? 20
      const margin = type.mount === 'oncounter' ? 6 : type.mount === 'kamado' ? 8 : 2
      als.push({ placed, frame: fl, rect: { x: fl.body.x + off + margin, y: fl.counterTopY - h, w: aw - margin * 2, h } })
    }
  }

  return { frames: fls, counters, appliances: als, len: u }
}

// ---------- plan scene ----------

export interface RunScene {
  id: RunId
  frames: Frame[]
  elev: RunElevation
  face: FaceBasis
  /** plan rect of the frame bodies (for top faces / occlusion) */
  plan: { x: number; z: number; w: number; d: number }
  /** depth used to sort painter's algorithm (bigger = nearer) */
  depth: number
  /** left wing renders with mirrored depth so it recedes outward */
  mirror: boolean
  /** island bar reverses its u-axis in 3D (appliances face the cook); the plan
   *  view mirrors to match so both agree on which end a unit sits */
  reversed?: boolean
  /** near end-cap face (side runs & straight ends), if it faces the viewer */
  endCap?: { face: FaceBasis; frame: Frame | null }
}

export interface CounterTop {
  runId: RunId
  /** plan rect */
  x: number
  z: number
  w: number
  d: number
  /** counter surface height above ground */
  y: number
  mirror?: boolean
  /** set when this top belongs to a corner unit (plan view selection) */
  corner?: CornerId
}

export interface SceneLayout3 {
  runs: RunScene[]
  counterTops: CounterTop[]
  ground: { x: number; z: number; w: number; d: number }
  cornerCount: number
  overflow: boolean
  /** projected world-screen bounding box for zoom-to-fit */
  bounds: Rect
  /** plan extents of the kitchen */
  extents: { x0: number; x1: number; z0: number; z1: number }
}

export function runFrames(design: Design, run: RunId): Frame[] {
  return design.frames.filter((f) => (f.run ?? 'back') === run)
}

export function computeScene(design: Design): SceneLayout3 {
  const layout = design.layout ?? 'straight'
  const activeRuns = runsForLayout(layout)
  const hasL = activeRuns.includes('left')
  const hasR = activeRuns.includes('right')
  const hasIsland = Boolean(design.island)

  const backFrames = runFrames(design, 'back')
  const leftFrames = runFrames(design, 'left')
  const rightFrames = runFrames(design, 'right')
  const islandFrames = runFrames(design, 'island')

  const wBack = backFrames.reduce((s, f) => s + f.width, 0)
  const lenL = hasL ? leftFrames.reduce((s, f) => s + f.width, 0) : 0
  const lenR = hasR ? rightFrames.reduce((s, f) => s + f.width, 0) : 0
  const wIsland = hasIsland ? islandFrames.reduce((s, f) => s + f.width, 0) : 0

  const totalW = (hasL ? CORNER : 0) + Math.max(wBack, 40) + (hasR ? CORNER : 0)
  const x0 = -totalW / 2
  const x1 = totalW / 2
  const backStart = x0 + (hasL ? CORNER : 0)

  const runs: RunScene[] = []
  const counterTops: CounterTop[] = []

  const backElev = computeRunElevation(backFrames, design.appliances)
  runs.push({
    id: 'back',
    frames: backFrames,
    elev: backElev,
    face: { origin: { x: backStart, z: RUN_DEPTH }, dir: { x: 1, z: 0 }, len: Math.max(backElev.len, 1), top: ELEV_TOP },
    plan: { x: backStart, z: 0, w: Math.max(backElev.len, 1), d: RUN_DEPTH },
    depth: RUN_DEPTH,
    mirror: false,
  })

  // counter top segments follow per-frame heights
  const pushTops = (
    runId: RunId,
    elev: RunElevation,
    toPlan: (u0: number, u1: number) => { x: number; z: number; w: number; d: number },
  ) => {
    for (const fl of elev.frames) {
      const y = -fl.counterTopY // surface height above ground
      const prev = counterTops[counterTops.length - 1]
      const seg = toPlan(fl.body.x, fl.body.x + fl.body.w)
      if (
        prev &&
        prev.runId === runId &&
        Math.abs(prev.y - y) < 0.01 &&
        Math.abs(prev.x + prev.w - seg.x) < 0.01 &&
        Math.abs(prev.z - seg.z) < 0.01 &&
        seg.d === prev.d
      ) {
        prev.w += seg.w
      } else if (prev && prev.runId === runId && Math.abs(prev.y - y) < 0.01 && Math.abs(prev.z + prev.d - seg.z) < 0.01 && seg.w === prev.w) {
        prev.d += seg.d
      } else {
        counterTops.push({ runId, ...seg, y })
      }
    }
  }

  pushTops('back', backElev, (u0, u1) => ({ x: backStart + u0, z: 0, w: u1 - u0, d: RUN_DEPTH + COUNTER_OVERHANG }))

  // corner tops — honor per-corner config (removal + lowered height)
  let cornerCount = 0
  const leftCorner = cornerFor(design, 'left')
  const rightCorner = cornerFor(design, 'right')
  if (hasL && leftCorner) {
    cornerCount++
    const y = leftCorner.lowered ? 64 : 88
    counterTops.push({ runId: 'back', x: x0, z: 0, w: CORNER, d: RUN_DEPTH + COUNTER_OVERHANG, y, mirror: true, corner: 'left' })
    counterTops.push({ runId: 'back', x: x0, z: RUN_DEPTH, w: RUN_DEPTH, d: CORNER - RUN_DEPTH, y, mirror: true, corner: 'left' })
  }
  if (hasR && rightCorner) {
    cornerCount++
    const y = rightCorner.lowered ? 64 : 88
    counterTops.push({ runId: 'back', x: x1 - CORNER, z: 0, w: CORNER, d: RUN_DEPTH + COUNTER_OVERHANG, y, corner: 'right' })
    counterTops.push({ runId: 'back', x: x1 - RUN_DEPTH, z: RUN_DEPTH, w: RUN_DEPTH, d: CORNER - RUN_DEPTH, y, corner: 'right' })
  }

  const leftZ0 = hasL && leftCorner ? CORNER : RUN_DEPTH
  const rightZ0 = hasR && rightCorner ? CORNER : RUN_DEPTH
  if (hasL) {
    const elev = computeRunElevation(leftFrames, design.appliances)
    runs.push({
      id: 'left',
      frames: leftFrames,
      elev,
      face: { origin: { x: x0 + RUN_DEPTH, z: leftZ0 }, dir: { x: 0, z: 1 }, len: Math.max(elev.len, 1), top: ELEV_TOP },
      plan: { x: x0, z: leftZ0, w: RUN_DEPTH, d: Math.max(elev.len, 1) },
      depth: leftZ0 + Math.max(elev.len, 1),
      mirror: true,
      endCap:
        elev.frames.length > 0
          ? {
              face: {
                origin: { x: x0, z: leftZ0 + elev.len },
                dir: { x: 1, z: 0 },
                len: RUN_DEPTH,
                top: ELEV_TOP,
              },
              frame: leftFrames[leftFrames.length - 1],
            }
          : undefined,
    })
    pushTops('left', elev, (u0, u1) => ({
      x: x0,
      z: leftZ0 + u0,
      w: RUN_DEPTH + COUNTER_OVERHANG,
      d: u1 - u0,
    }))
    for (const t of counterTops) if (t.runId === 'left') t.mirror = true
  }

  if (hasR) {
    const elev = computeRunElevation(rightFrames, design.appliances)
    runs.push({
      id: 'right',
      frames: rightFrames,
      elev,
      face: { origin: { x: x1 - RUN_DEPTH, z: rightZ0 }, dir: { x: 0, z: 1 }, len: Math.max(elev.len, 1), top: ELEV_TOP },
      plan: { x: x1 - RUN_DEPTH, z: rightZ0, w: RUN_DEPTH, d: Math.max(elev.len, 1) },
      depth: rightZ0 + Math.max(elev.len, 1),
      mirror: false,
      endCap:
        elev.frames.length > 0
          ? {
              face: {
                origin: { x: x1 - RUN_DEPTH, z: rightZ0 + elev.len },
                dir: { x: 1, z: 0 },
                len: RUN_DEPTH,
                top: ELEV_TOP,
              },
              frame: rightFrames[rightFrames.length - 1],
            }
          : undefined,
    })
    pushTops('right', elev, (u0, u1) => ({
      x: x1 - RUN_DEPTH - COUNTER_OVERHANG,
      z: rightZ0 + u0,
      w: RUN_DEPTH + COUNTER_OVERHANG,
      d: u1 - u0,
    }))
  }

  let islandZ0 = 0
  if (hasIsland) {
    const elev = computeRunElevation(islandFrames, design.appliances)
    const wingEnd = Math.max(hasL ? leftZ0 + lenL : 0, hasR ? rightZ0 + lenR : 0, RUN_DEPTH)
    islandZ0 = design.islandPos?.z ?? wingEnd + ISLAND_AISLE
    const ix0 = (design.islandPos?.x ?? 0) - Math.max(elev.len, 40) / 2
    runs.push({
      id: 'island',
      frames: islandFrames,
      elev,
      face: {
        origin: { x: ix0, z: islandZ0 + RUN_DEPTH },
        dir: { x: 1, z: 0 },
        len: Math.max(elev.len, 1),
        top: ELEV_TOP,
      },
      plan: { x: ix0, z: islandZ0, w: Math.max(elev.len, 1), d: RUN_DEPTH },
      depth: islandZ0 + RUN_DEPTH,
      mirror: false,
      reversed: Boolean(design.islandBar),
    })
    pushTops('island', elev, (u0, u1) => ({
      x: ix0 + u0,
      z: islandZ0 - COUNTER_OVERHANG,
      w: u1 - u0,
      d: RUN_DEPTH + COUNTER_OVERHANG * 2,
    }))
  }

  // plan extents of built things
  const wingMax = Math.max(hasL ? (leftCorner ? CORNER : RUN_DEPTH) + lenL : 0, hasR ? (rightCorner ? CORNER : RUN_DEPTH) + lenR : 0)
  const z1 = Math.max(RUN_DEPTH, wingMax, hasIsland ? islandZ0 + RUN_DEPTH : 0)
  const islandCx = design.islandPos?.x ?? 0
  const extents = {
    x0: Math.min(x0, hasIsland ? islandCx - wIsland / 2 : x0),
    x1: Math.max(x1, hasIsland ? islandCx + wIsland / 2 : x1),
    z0: 0,
    z1,
  }

  const gw = design.ground.width
  const gd = groundDepth(design.ground)
  const ground = { x: -gw / 2, z: -15, w: gw, d: gd }
  const overflow = extents.x1 - extents.x0 > gw || z1 > gd - 15

  // projected bounds for fit: corners of ground + tall points
  const pts = [
    project(ground.x, ground.z, -GROUND_T),
    project(ground.x + ground.w, ground.z, 0),
    project(ground.x, ground.z + ground.d, 0),
    project(ground.x + ground.w, ground.z + ground.d, 0),
    project(extents.x0, extents.z0, ELEV_TOP - 30),
    project(extents.x1, extents.z1, ELEV_TOP - 30),
  ]
  const bx0 = Math.min(...pts.map((p) => p.x))
  const bx1 = Math.max(...pts.map((p) => p.x))
  const by0 = Math.min(...pts.map((p) => p.y))
  const by1 = Math.max(...pts.map((p) => p.y))
  const bounds: Rect = { x: bx0, y: by0, w: bx1 - bx0, h: by1 - by0 + GROUND_T }

  return { runs, counterTops, ground, cornerCount, overflow, bounds, extents }
}
