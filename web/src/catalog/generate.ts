// Appliance-first kitchen generator: given the appliances a user wants, a
// layout shape, and (optionally) the space they have, lay out frames sized to
// each unit's cutout and distribute them across the runs. The result is a
// starting point the user then adjusts by hand.

import type { Design, Frame, LayoutShape, PlacedAppliance, RunId } from '../types'
import { CORNER, COUNTER_OVERHANG, ISLAND_AISLE, RUN_DEPTH } from '../types'
import { getAppliance } from './appliances'
import { pairConflict } from './compat'

export interface GenerateOpts {
  /** flat list of chosen appliance typeIds (repeats allowed for quantity) */
  appliances: string[]
  layout: LayoutShape
  island: boolean
  /** available area in cm; when omitted the platform is sized to the build */
  spaceWidth?: number
  spaceDepth?: number
  name?: string
  groundType?: Design['ground']['type']
}

let seq = 0
const gid = (p: string) => `gen_${p}_${(seq += 1)}`

const COOK = /^(grill|santamaria|egg|primo|pizza|gozney|taboon)/
const PREP = /^(griddle|burner|sink)/
const COLD = /^(fridge|kegerator|icemaker|icebin)/
const LOWERED_BASE_OK = new Set(['woodstore-40', 'drawers-40'])

interface FrameDef {
  width: number
  top?: string
  base?: string
  run: RunId
  lowered?: boolean
}

const cat = (id: string): 'cook' | 'prep' | 'cold' | 'storage' =>
  COOK.test(id) ? 'cook' : PREP.test(id) ? 'prep' : COLD.test(id) ? 'cold' : 'storage'

/** Order tops so the cook line comes first, then prep, then everything else. */
const topRank = (id: string) => (COOK.test(id) ? 0 : PREP.test(id) ? 1 : 2)

export function generateKitchen(opts: GenerateOpts): Design {
  const tops: string[] = []
  const bases: string[] = []
  for (const id of opts.appliances) {
    let type
    try {
      type = getAppliance(id)
    } catch {
      continue
    }
    ;(type.zone === 'top' ? tops : bases).push(id)
  }
  tops.sort((a, b) => topRank(a) - topRank(b))

  const basePool = [...bases]
  const takeBase = (pred: (id: string) => boolean): string | undefined => {
    const i = basePool.findIndex(pred)
    if (i < 0) return undefined
    return basePool.splice(i, 1)[0]
  }

  const defs: FrameDef[] = []

  // 1) every top appliance gets a frame sized to its cutout, paired with a
  //    compatible base where one is available.
  for (const topId of tops) {
    const top = getAppliance(topId)
    const lowered = top.mount === 'kamado'
    const width = top.minFrameWidth
    const canPair = (baseId: string) => {
      const base = getAppliance(baseId)
      if (base.minFrameWidth > width) return false
      if (lowered) return LOWERED_BASE_OK.has(base.id)
      return pairConflict(top, base) === null
    }
    // prefer storage under a cook/sink top; fall back to anything compatible
    const baseId =
      takeBase((id) => canPair(id) && cat(id) === 'storage') ?? takeBase((id) => canPair(id))
    defs.push({ width, top: topId, base: baseId, run: 'back', lowered })
  }

  // 2) leftover base units get their own frames (blank counter above).
  for (const baseId of basePool) {
    const base = getAppliance(baseId)
    defs.push({ width: base.minFrameWidth, base: baseId, run: 'back' })
  }

  if (!defs.length) {
    // nothing chosen — a single empty prep frame to start from
    defs.push({ width: 90, run: 'back' })
  }

  // 3) distribute across runs. Cook line stays on the back; cold + storage move
  //    to the wings; the island takes a social unit (or a bare bar counter).
  const layout = opts.layout
  const wingsFor = (): { cold: RunId | null; storage: RunId | null } => {
    switch (layout) {
      case 'l-right':
        return { cold: 'right', storage: 'right' }
      case 'l-left':
        return { cold: 'left', storage: 'left' }
      case 'u':
        return { cold: 'right', storage: 'left' }
      default:
        return { cold: null, storage: null }
    }
  }
  const wings = wingsFor()

  const catOf = (d: FrameDef) => cat(d.top ?? d.base ?? '')
  for (const d of defs) {
    const c = catOf(d)
    if (c === 'cold' && wings.cold) d.run = wings.cold
    else if (c === 'storage' && wings.storage) d.run = wings.storage
  }

  // island: pull one social/prep unit onto it, else give it a bar counter
  if (opts.island) {
    const social = defs.find((d) => d.run === 'back' && /^(griddle|sink|icebin|kegerator)/.test(d.top ?? d.base ?? ''))
    if (social) social.run = 'island'
    else defs.push({ width: 90, run: 'island' })
  }

  // keep the back run from being empty (can happen with only cold/storage picks)
  if (!defs.some((d) => d.run === 'back')) {
    const first = defs.find((d) => d.run !== 'island') ?? defs[0]
    if (first) first.run = 'back'
  }

  // build frames + appliances
  const frames: Frame[] = []
  const appliances: PlacedAppliance[] = []
  for (const d of defs) {
    const frame: Frame = {
      id: gid('f'),
      width: d.width,
      finish: 'graphite',
      ...(d.lowered ? { lowered: true } : {}),
      ...(d.run !== 'back' ? { run: d.run } : {}),
    }
    frames.push(frame)
    if (d.top) appliances.push({ id: gid('a'), typeId: d.top, frameId: frame.id, zone: 'top' })
    if (d.base) appliances.push({ id: gid('a'), typeId: d.base, frameId: frame.id, zone: 'base' })
  }

  // size the platform to hold the build (or honour the user's space)
  const runWidth = (run: RunId) => frames.filter((f) => (f.run ?? 'back') === run).reduce((s, f) => s + f.width, 0)
  const hasL = layout === 'l-left' || layout === 'u'
  const hasR = layout === 'l-right' || layout === 'u'
  const backW = runWidth('back') + (hasL ? CORNER : 0) + (hasR ? CORNER : 0)
  const longestWing = Math.max(hasL ? runWidth('left') : 0, hasR ? runWidth('right') : 0)
  const islandLen = opts.island ? runWidth('island') : 0

  const fitW = Math.max(backW, islandLen) + COUNTER_OVERHANG * 2 + 60
  const fitD = RUN_DEPTH + longestWing + (opts.island ? ISLAND_AISLE + RUN_DEPTH : 40) + 80

  const width = Math.max(opts.spaceWidth ?? 0, fitW, 300)
  const depth = Math.max(opts.spaceDepth ?? 0, fitD, 260)

  return {
    name: opts.name?.trim() || 'My outdoor kitchen',
    ground: { type: opts.groundType ?? 'concrete', width: Math.round(width), depth: Math.round(depth) },
    layout,
    island: opts.island,
    frames,
    appliances,
  }
}
