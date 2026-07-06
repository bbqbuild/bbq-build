import type { Design, Frame } from '../types'
import { applianceById, fitsFrame, getAppliance } from './appliances'
import type { ApplianceType } from '../types'

/** Appliances that dump serious heat downward into the frame body. */
const HEAT_TOP = new Set(['grill-90', 'grill-80', 'griddle-60', 'burner-40', 'santamaria-90'])
/** Refrigeration that must not sit under a heat source. */
const COLD_BASE = new Set(['fridge-60', 'kegerator-60', 'icemaker-60'])
/** Base units that leave the cavity open enough for sink plumbing. */
const SINK_SAFE_BASE = new Set(['doors-60', 'door-40', 'trash-40'])

/**
 * Why a top+base pairing inside one frame is not allowed, or null if fine.
 * Called with whichever of the pair is already placed and the candidate.
 */
export function pairConflict(top: ApplianceType | null, base: ApplianceType | null): string | null {
  if (!top || !base) return null
  if (HEAT_TOP.has(top.id) && COLD_BASE.has(base.id)) {
    return `${top.shortName} runs hot — refrigeration (${base.shortName}) can't sit directly below it`
  }
  if (HEAT_TOP.has(top.id) && base.id === 'woodstore-40') {
    return `Open firewood storage under the ${top.shortName} is a fire hazard`
  }
  if (top.id === 'sink-40' && !SINK_SAFE_BASE.has(base.id)) {
    return 'The sink needs an open cabinet below for plumbing — pair it with doors or a trash pull-out'
  }
  return null
}

export interface PlacementCheck {
  ok: boolean
  reason?: string
}

/** Base units that fit a lowered smoker table's open shelf. */
const LOWERED_BASE_OK = new Set(['woodstore-40', 'drawers-40'])

/** Full validation for placing `type` into `frame`, considering the other zone's occupant. */
export function checkPlacement(design: Design, frame: Frame, type: ApplianceType): PlacementCheck {
  if (!fitsFrame(type, frame.width)) {
    return { ok: false, reason: `Needs a ${type.minFrameWidth} cm frame` }
  }
  if (type.mount === 'kamado' && !frame.lowered) {
    return { ok: false, reason: `${type.shortName} needs a lowered smoker table — toggle "Lowered counter" on the frame` }
  }
  if (type.mount !== 'kamado' && type.zone === 'top' && frame.lowered) {
    return { ok: false, reason: 'Lowered smoker tables only take kamado smokers on top' }
  }
  if (frame.lowered && type.zone === 'base' && !LOWERED_BASE_OK.has(type.id)) {
    return { ok: false, reason: 'A lowered table has an open base — only firewood storage or drawers fit' }
  }
  const otherZone = type.zone === 'top' ? 'base' : 'top'
  const occupant = design.appliances.find((a) => a.frameId === frame.id && a.zone === otherZone)
  if (occupant) {
    const other = applianceById.get(occupant.typeId) ?? getAppliance(occupant.typeId)
    const top = type.zone === 'top' ? type : other
    const base = type.zone === 'base' ? type : other
    const conflict = pairConflict(top, base)
    if (conflict) return { ok: false, reason: conflict }
  }
  return { ok: true }
}
