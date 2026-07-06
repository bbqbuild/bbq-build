import type { Design, Frame, FrameFinish, FrameWidth, LayoutShape, PlacedAppliance, Preset, RunId } from '../types'

let seq = 0
const pid = (p: string) => `${p}_${++seq}`

interface FrameDef {
  width: FrameWidth
  top?: string
  base?: string
  run?: RunId
  lowered?: boolean
}

interface DesignOpts {
  layout?: LayoutShape
  island?: boolean
  depth?: number
}

function makeDesign(
  name: string,
  groundType: Design['ground']['type'],
  groundWidth: number,
  finish: FrameFinish,
  defs: FrameDef[],
  opts: DesignOpts = {},
): Design {
  const frames: Frame[] = []
  const appliances: PlacedAppliance[] = []
  for (const def of defs) {
    const frame: Frame = {
      id: pid('f'),
      width: def.width,
      finish,
      ...(def.lowered ? { lowered: true } : {}),
      ...(def.run && def.run !== 'back' ? { run: def.run } : {}),
    }
    frames.push(frame)
    if (def.top) appliances.push({ id: pid('a'), typeId: def.top, frameId: frame.id, zone: 'top' })
    if (def.base) appliances.push({ id: pid('a'), typeId: def.base, frameId: frame.id, zone: 'base' })
  }
  return {
    name,
    ground: { type: groundType, width: groundWidth, depth: opts.depth ?? 320 },
    layout: opts.layout ?? 'straight',
    island: Boolean(opts.island),
    frames,
    appliances,
  }
}

export const PRESETS: Preset[] = [
  {
    id: 'weekend-griller',
    name: 'Weekend Griller',
    tagline: 'The essentials: a serious grill, cold storage and a place to prep.',
    design: makeDesign('Weekend Griller', 'deck', 340, 'graphite', [
      { width: 60, base: 'fridge-60' },
      { width: 90, top: 'grill-90', base: 'doors-60' },
      { width: 40, base: 'drawers-40' },
    ]),
  },
  {
    id: 'l-shape-social',
    name: 'L-Shape Social',
    tagline: 'Cook on the back run, serve from the wing. The corner works for you.',
    design: makeDesign(
      'L-Shape Social',
      'pavers',
      480,
      'graphite',
      [
        { width: 90, top: 'grill-90', base: 'doors-60' },
        { width: 40, top: 'burner-40', base: 'trash-40' },
        { width: 60, top: 'sink-40', base: 'drawers-40' },
        { width: 60, run: 'right', base: 'fridge-60' },
        { width: 60, run: 'right', top: 'icebin-40', base: 'doors-60' },
      ],
      { layout: 'l-right', depth: 420 },
    ),
  },
  {
    id: 'u-shape-bar',
    name: 'U-Shape Bar',
    tagline: 'Wrap-around counters with a smoker wing — the pit-master command centre.',
    design: makeDesign(
      'U-Shape Bar',
      'concrete',
      560,
      'steel',
      [
        { width: 90, top: 'grill-90', base: 'doors-60' },
        { width: 60, top: 'griddle-60', base: 'drawers-40' },
        { width: 60, top: 'sink-40', base: 'trash-40' },
        { width: 80, run: 'left', lowered: true, top: 'egg-xl', base: 'woodstore-40' },
        { width: 60, run: 'left', base: 'fridge-60' },
        { width: 60, run: 'right', base: 'kegerator-60' },
        { width: 40, run: 'right', top: 'icebin-40', base: 'door-40' },
      ],
      { layout: 'u', depth: 480 },
    ),
  },
  {
    id: 'island-entertainer',
    name: 'Island Entertainer',
    tagline: 'L-shaped cook line plus a freestanding island for guests and garnishes.',
    design: makeDesign(
      'Island Entertainer',
      'stone',
      620,
      'stone',
      [
        { width: 90, top: 'santamaria-90', base: 'doors-60' },
        { width: 60, top: 'sink-40', base: 'trash-40' },
        { width: 60, base: 'fridge-60' },
        { width: 60, run: 'right', top: 'pizza-60', base: 'woodstore-40' },
        { width: 40, run: 'right', base: 'drawers-40' },
        { width: 90, run: 'island', top: 'griddle-60', base: 'doors-60' },
        { width: 60, run: 'island', base: 'kegerator-60' },
      ],
      { layout: 'l-right', island: true, depth: 560 },
    ),
  },
  {
    id: 'pizza-corner',
    name: 'Pizza Corner',
    tagline: 'A stone-deck oven, wood storage and cold drinks. Friday nights sorted.',
    design: makeDesign('Pizza Corner', 'pavers', 320, 'teak', [
      { width: 60, top: 'pizza-60', base: 'woodstore-40' },
      { width: 40, base: 'drawers-40' },
      { width: 60, base: 'fridge-60' },
    ]),
  },
  {
    id: 'compact-balcony',
    name: 'Compact Balcony',
    tagline: 'Two frames, zero compromise. For small spaces that still take grilling seriously.',
    design: makeDesign(
      'Compact Balcony',
      'deck',
      220,
      'graphite',
      [
        { width: 80, top: 'grill-80', base: 'doors-60' },
        { width: 60, base: 'fridge-60' },
      ],
      { depth: 200 },
    ),
  },
]
