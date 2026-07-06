import type { Design, Frame, PlacedAppliance } from '../types'
import { COUNTER_OVERHANG, COUNTER_T, FRAME_BODY_H, GROUND_T } from '../types'
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
}

export interface ApplianceLayout {
  placed: PlacedAppliance
  frame: FrameLayout
  /** primary drawn rect (above counter for top zone, inside opening for base) */
  rect: Rect
}

export interface SceneLayout {
  ground: Rect
  counter: Rect | null
  frames: FrameLayout[]
  appliances: ApplianceLayout[]
  rowWidth: number
  /** true when the frame row is wider than the ground platform */
  overflow: boolean
  /** world-space bounding box of everything, for zoom-to-fit */
  bounds: Rect
}

export const FRAME_GAP = 0 // frames pack tight, PAX style

// Visible heights above the counter for drop-in / on-counter units
export const TOP_HEIGHTS: Record<string, number> = {
  'grill-90': 32,
  'grill-80': 30,
  'griddle-60': 14,
  'burner-40': 10,
  'sink-40': 12,
  'icebin-40': 8,
  'pizza-60': 46,
}

export function computeLayout(design: Design): SceneLayout {
  const rowWidth = design.frames.reduce((s, f) => s + f.width, 0)
  const groundW = design.ground.width
  const ground: Rect = { x: -groundW / 2, y: 0, w: groundW, h: GROUND_T }

  const frames: FrameLayout[] = []
  let cursor = -rowWidth / 2
  design.frames.forEach((frame, index) => {
    const body: Rect = { x: cursor, y: -FRAME_BODY_H, w: frame.width, h: FRAME_BODY_H }
    const opening: Rect = {
      x: body.x + 3,
      y: body.y + 3,
      w: body.w - 6,
      h: body.h - 3 - 9, // wall top, taller kick at the bottom
    }
    frames.push({ frame, index, body, opening })
    cursor += frame.width + FRAME_GAP
  })

  const counter: Rect | null = rowWidth
    ? {
        x: -rowWidth / 2 - COUNTER_OVERHANG,
        y: -FRAME_BODY_H - COUNTER_T,
        w: rowWidth + COUNTER_OVERHANG * 2,
        h: COUNTER_T,
      }
    : null

  const appliances: ApplianceLayout[] = []
  for (const placed of design.appliances) {
    const fl = frames.find((f) => f.frame.id === placed.frameId)
    if (!fl) continue
    const type = getAppliance(placed.typeId)
    if (placed.zone === 'base') {
      appliances.push({ placed, frame: fl, rect: { ...fl.opening } })
    } else {
      const counterTop = -FRAME_BODY_H - COUNTER_T
      const h = TOP_HEIGHTS[type.id] ?? 20
      const margin = type.mount === 'oncounter' ? 6 : 2
      appliances.push({
        placed,
        frame: fl,
        rect: { x: fl.body.x + margin, y: counterTop - h, w: fl.body.w - margin * 2, h },
      })
    }
  }

  const tallest = Math.max(0, ...appliances.filter((a) => a.placed.zone === 'top').map((a) => a.rect.h))
  const top = -FRAME_BODY_H - COUNTER_T - Math.max(tallest, 20)
  const width = Math.max(groundW, rowWidth + COUNTER_OVERHANG * 2)
  const bounds: Rect = { x: -width / 2, y: top, w: width, h: GROUND_T - top }

  return { ground, counter, frames, appliances, rowWidth, overflow: rowWidth > groundW, bounds }
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
