import type { Design, Frame, PlacedAppliance } from '../types'
import { COUNTER_OVERHANG, COUNTER_T, FRAME_BODY_H, GROUND_T, frameBodyH } from '../types'
import { getAppliance } from '../catalog/appliances'

/**
 * World space is in centimeters, y grows downward.
 * y = 0 is the top surface of the ground platform; frames stand on it,
 * the ground slab extends below it, appliances above it (negative y).
 */
export interface Rect {
  x: number
  y: number
  w: number
  h: number
}

export interface FrameLayout {
  frame: Frame
  index: number
  /** frame body, from ground to counter underside */
  body: Rect
  /** inner opening for base appliances */
  opening: Rect
  /** y of this frame's counter top surface */
  counterTopY: number
}

export interface ApplianceLayout {
  placed: PlacedAppliance
  frame: FrameLayout
  /** primary drawn rect (above counter for top zone, inside opening for base) */
  rect: Rect
}

export interface SceneLayout {
  ground: Rect
  /** counter slabs — one per run of consecutive same-height frames */
  counters: Rect[]
  frames: FrameLayout[]
  appliances: ApplianceLayout[]
  rowWidth: number
  /** true when the frame row is wider than the ground platform */
  overflow: boolean
  /** world-space bounding box of everything, for zoom-to-fit */
  bounds: Rect
}

export const FRAME_GAP = 0 // frames pack tight, PAX style

// Visible heights above the (frame's own) counter for top-zone units
export const TOP_HEIGHTS: Record<string, number> = {
  'grill-90': 32,
  'grill-80': 30,
  'santamaria-90': 48,
  'griddle-60': 14,
  'burner-40': 10,
  'sink-40': 12,
  'icebin-40': 8,
  'pizza-60': 46,
  'gozney-dome': 40,
  'taboon-90': 44,
  'egg-xl': 58,
  'primo-xl': 44,
}

export function computeLayout(design: Design): SceneLayout {
  const rowWidth = design.frames.reduce((s, f) => s + f.width, 0)
  const groundW = design.ground.width
  const ground: Rect = { x: -groundW / 2, y: 0, w: groundW, h: GROUND_T }

  const frames: FrameLayout[] = []
  let cursor = -rowWidth / 2
  design.frames.forEach((frame, index) => {
    const bodyH = frameBodyH(frame)
    const body: Rect = { x: cursor, y: -bodyH, w: frame.width, h: bodyH }
    const opening: Rect = {
      x: body.x + 3,
      y: body.y + 3,
      w: body.w - 6,
      h: body.h - 3 - 9, // wall top, taller kick at the bottom
    }
    frames.push({ frame, index, body, opening, counterTopY: -bodyH - COUNTER_T })
    cursor += frame.width + FRAME_GAP
  })

  // counter slabs: consecutive frames sharing a height form one slab
  const counters: Rect[] = []
  for (const fl of frames) {
    const last = counters[counters.length - 1]
    const y = fl.counterTopY
    if (last && Math.abs(last.y - y) < 0.01 && Math.abs(last.x + last.w - COUNTER_OVERHANG - fl.body.x) < 0.01) {
      last.w += fl.body.w
    } else {
      counters.push({ x: fl.body.x - COUNTER_OVERHANG, y, w: fl.body.w + COUNTER_OVERHANG * 2, h: COUNTER_T })
    }
  }

  const appliances: ApplianceLayout[] = []
  for (const placed of design.appliances) {
    const fl = frames.find((f) => f.frame.id === placed.frameId)
    if (!fl) continue
    const type = getAppliance(placed.typeId)
    if (placed.zone === 'base') {
      appliances.push({ placed, frame: fl, rect: { ...fl.opening } })
    } else {
      const h = TOP_HEIGHTS[type.id] ?? (type.paintAs ? TOP_HEIGHTS[type.paintAs] : undefined) ?? 20
      const margin = type.mount === 'oncounter' ? 6 : type.mount === 'kamado' ? 8 : 2
      appliances.push({
        placed,
        frame: fl,
        rect: { x: fl.body.x + margin, y: fl.counterTopY - h, w: fl.body.w - margin * 2, h },
      })
    }
  }

  const highest = Math.min(
    -FRAME_BODY_H - COUNTER_T,
    ...appliances.filter((a) => a.placed.zone === 'top').map((a) => a.rect.y),
  )
  const top = highest - 20
  const width = Math.max(groundW, rowWidth + COUNTER_OVERHANG * 2)
  const bounds: Rect = { x: -width / 2, y: top, w: width, h: GROUND_T - top }

  return { ground, counters, frames, appliances, rowWidth, overflow: rowWidth > groundW, bounds }
}

export function rectContains(r: Rect, x: number, y: number): boolean {
  return x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h
}

/** Insertion index for a frame dropped/dragged at world x. */
export function insertionIndex(layout: SceneLayout, worldX: number): number {
  for (const fl of layout.frames) {
    if (worldX < fl.body.x + fl.body.w / 2) return fl.index
  }
  return layout.frames.length
}
