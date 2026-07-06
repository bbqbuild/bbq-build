import type { Design, Frame, FrameFinish, FrameWidth, PlacedAppliance, Preset } from '../types'

let seq = 0
const pid = (p: string) => `${p}_${++seq}`

interface FrameDef {
  width: FrameWidth
  top?: string
  base?: string
}

function makeDesign(
  name: string,
  groundType: Design['ground']['type'],
  groundWidth: number,
  finish: FrameFinish,
  defs: FrameDef[],
): Design {
  const frames: Frame[] = []
  const appliances: PlacedAppliance[] = []
  for (const def of defs) {
    const frame: Frame = { id: pid('f'), width: def.width, finish }
    frames.push(frame)
    if (def.top) appliances.push({ id: pid('a'), typeId: def.top, frameId: frame.id, zone: 'top' })
    if (def.base) appliances.push({ id: pid('a'), typeId: def.base, frameId: frame.id, zone: 'base' })
  }
  return { name, ground: { type: groundType, width: groundWidth }, frames, appliances }
}

export const PRESETS: Preset[] = [
  {
    id: 'weekend-griller',
    name: 'Weekend Griller',
    tagline: 'The essentials: a serious grill, cold storage and a place to prep.',
    design: makeDesign('Weekend Griller', 'deck', 320, 'graphite', [
      { width: 60, base: 'fridge-60' },
      { width: 90, top: 'grill-90', base: 'doors-60' },
      { width: 40, base: 'drawers-40' },
    ]),
  },
  {
    id: 'chefs-island',
    name: "Chef's Island",
    tagline: 'Grill, griddle and a full wet station. Restaurant flow in the backyard.',
    design: makeDesign("Chef's Island", 'concrete', 480, 'steel', [
      { width: 40, top: 'sink-40', base: 'trash-40' },
      { width: 90, top: 'grill-90', base: 'doors-60' },
      { width: 60, top: 'griddle-60', base: 'drawers-40' },
      { width: 60, base: 'fridge-60' },
      { width: 40, top: 'burner-40', base: 'door-40' },
    ]),
  },
  {
    id: 'pizza-corner',
    name: 'Pizza Corner',
    tagline: 'A stone-deck oven, wood storage and cold drinks. Friday nights sorted.',
    design: makeDesign('Pizza Corner', 'pavers', 300, 'teak', [
      { width: 60, top: 'pizza-60', base: 'woodstore-40' },
      { width: 40, base: 'drawers-40' },
      { width: 60, base: 'fridge-60' },
    ]),
  },
  {
    id: 'ultimate-entertainer',
    name: 'Ultimate Entertainer',
    tagline: 'Every toy we sell: beer on tap, clear ice, two hot stations and a pizza oven.',
    design: makeDesign('Ultimate Entertainer', 'stone', 640, 'stone', [
      { width: 60, base: 'kegerator-60' },
      { width: 40, top: 'icebin-40', base: 'door-40' },
      { width: 90, top: 'grill-90', base: 'doors-60' },
      { width: 60, top: 'griddle-60', base: 'drawers-40' },
      { width: 40, top: 'sink-40', base: 'trash-40' },
      { width: 60, top: 'pizza-60', base: 'icemaker-60' },
    ]),
  },
  {
    id: 'compact-balcony',
    name: 'Compact Balcony',
    tagline: 'Two frames, zero compromise. For small spaces that still take grilling seriously.',
    design: makeDesign('Compact Balcony', 'deck', 200, 'graphite', [
      { width: 80, top: 'grill-80', base: 'doors-60' },
      { width: 60, base: 'fridge-60' },
    ]),
  },
]
