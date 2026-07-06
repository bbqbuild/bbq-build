// Core domain model for bbq.build. All linear units are centimeters.

export type GroundType = 'deck' | 'concrete' | 'pavers' | 'stone'

export interface Ground {
  type: GroundType
  width: number
}

export type FrameWidth = 40 | 60 | 80 | 90

export type FrameFinish = 'graphite' | 'steel' | 'teak' | 'stone'

export interface Frame {
  id: string
  width: FrameWidth
  finish: FrameFinish
}

/** Which vertical zone of a frame an appliance occupies. */
export type Zone = 'top' | 'base'

/** How a top-zone appliance meets the counter. */
export type Mount = 'dropin' | 'oncounter' | 'undercounter'

export interface PlacedAppliance {
  id: string
  typeId: string
  frameId: string
  zone: Zone
}

export interface Design {
  name: string
  ground: Ground
  frames: Frame[]
  appliances: PlacedAppliance[]
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
export const COUNTER_T = 6
export const COUNTER_OVERHANG = 3
export const GROUND_T = 14
export const FRAME_LEG_H = 8
export const FRAME_WALL = 3
