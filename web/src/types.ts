// Core domain model for bbq.build. All linear units are centimeters.

export type GroundType = 'deck' | 'concrete' | 'pavers' | 'stone'

export interface Ground {
  type: GroundType
  width: number
  /** plan depth of the platform (front-to-back), cm */
  depth?: number
}

/** Overall kitchen shape. L/U add perpendicular runs joined by corner units. */
export type LayoutShape = 'straight' | 'l-left' | 'l-right' | 'u'

/** Which counter run a frame belongs to. */
export type RunId = 'back' | 'left' | 'right' | 'island'

export type FrameWidth = 40 | 60 | 80 | 90

export type FrameFinish = 'graphite' | 'steel' | 'teak' | 'stone'

export interface Frame {
  id: string
  width: FrameWidth
  finish: FrameFinish
  /** Lowered smoker table — counter drops so kamado rims land at working height. */
  lowered?: boolean
  /** Which run this frame sits in (default 'back'). */
  run?: RunId
}

/** Which vertical zone of a frame an appliance occupies. */
export type Zone = 'top' | 'base'

/** How a top-zone appliance meets the counter. 'kamado' = nested in a lowered table. */
export type Mount = 'dropin' | 'oncounter' | 'undercounter' | 'kamado'

export interface PlacedAppliance {
  id: string
  typeId: string
  frameId: string
  zone: Zone
}

export interface Design {
  name: string
  ground: Ground
  /** kitchen shape; absent in old saves → 'straight' */
  layout?: LayoutShape
  /** freestanding island row in front of the main counter */
  island?: boolean
  frames: Frame[]
  appliances: PlacedAppliance[]
  /** AI-sourced real products added to this design's catalog. */
  custom?: ApplianceType[]
}

export const RUN_NAMES: Record<RunId, string> = {
  back: 'Back counter',
  left: 'Left wing',
  right: 'Right wing',
  island: 'Island',
}

/** Runs available for a shape (island is orthogonal, controlled by design.island). */
export function runsForLayout(layout: LayoutShape | undefined): RunId[] {
  switch (layout ?? 'straight') {
    case 'l-left':
      return ['back', 'left']
    case 'l-right':
      return ['back', 'right']
    case 'u':
      return ['back', 'left', 'right']
    default:
      return ['back']
  }
}

export interface ApplianceType {
  id: string
  name: string
  shortName: string
  brand: string
  zone: Zone
  mount: Mount
  /** Smallest frame width (cm) this appliance fits into. */
  minFrameWidth: FrameWidth
  price: number
  description: string
  /** Emoji used on catalog cards as a lightweight icon. */
  icon: string
  /** AI-sourced real product (not part of the built-in catalog). */
  custom?: boolean
  /** Built-in typeId whose canvas painter this custom item borrows. */
  paintAs?: string
  /** Product page for custom items. */
  url?: string
}

export interface Preset {
  id: string
  name: string
  tagline: string
  design: Design
}

export interface SavedDesign {
  id: number
  name: string
  data: Design
  updated_at: string
}

export type Selection =
  | { kind: 'none' }
  | { kind: 'ground' }
  | { kind: 'frame'; id: string }
  | { kind: 'appliance'; id: string }

export const FRAME_WIDTHS: FrameWidth[] = [40, 60, 80, 90]

// Shared elevation geometry (cm)
export const FRAME_BODY_H = 82
export const LOWERED_BODY_H = 58
export const COUNTER_T = 6

export function frameBodyH(f: Pick<Frame, 'lowered'>): number {
  return f.lowered ? LOWERED_BODY_H : FRAME_BODY_H
}
export const COUNTER_OVERHANG = 3
export const GROUND_T = 14
export const FRAME_LEG_H = 8
export const FRAME_WALL = 3

// Plan geometry (cm)
export const RUN_DEPTH = 60
export const CORNER = 60
export const ISLAND_AISLE = 110
export const DEFAULT_GROUND_DEPTH = 300

export function groundDepth(g: Ground): number {
  return g.depth ?? DEFAULT_GROUND_DEPTH
}
