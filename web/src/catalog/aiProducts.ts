import type { ApplianceType, FrameWidth, Mount, Zone } from '../types'
import { FRAME_WIDTHS } from '../types'

/** A real product found by the AI search. */
export interface AiProduct {
  brand: string
  model: string
  category: string
  width_cm: number
  /** cutout height / depth in cm, when the source listed them */
  height_cm?: number
  depth_cm?: number
  price_usd: number
  url?: string
  blurb: string
}

interface CategorySpec {
  paintAs: string
  zone: Zone
  mount: Mount
  icon: string
}

const CATEGORY_MAP: Record<string, CategorySpec> = {
  grill: { paintAs: 'grill-90', zone: 'top', mount: 'dropin', icon: '🔥' },
  santamaria: { paintAs: 'santamaria-90', zone: 'top', mount: 'dropin', icon: '🥩' },
  kamado: { paintAs: 'egg-xl', zone: 'top', mount: 'kamado', icon: '🥚' },
  griddle: { paintAs: 'griddle-60', zone: 'top', mount: 'dropin', icon: '🍳' },
  burner: { paintAs: 'burner-40', zone: 'top', mount: 'dropin', icon: '🫕' },
  sink: { paintAs: 'sink-40', zone: 'top', mount: 'dropin', icon: '🚰' },
  icebin: { paintAs: 'icebin-40', zone: 'top', mount: 'dropin', icon: '🧊' },
  pizza: { paintAs: 'pizza-60', zone: 'top', mount: 'oncounter', icon: '🍕' },
  fridge: { paintAs: 'fridge-60', zone: 'base', mount: 'undercounter', icon: '🥶' },
  kegerator: { paintAs: 'kegerator-60', zone: 'base', mount: 'undercounter', icon: '🍺' },
  icemaker: { paintAs: 'icemaker-60', zone: 'base', mount: 'undercounter', icon: '❄️' },
  drawers: { paintAs: 'drawers-40', zone: 'base', mount: 'undercounter', icon: '🗄️' },
  doors: { paintAs: 'doors-60', zone: 'base', mount: 'undercounter', icon: '🚪' },
  trash: { paintAs: 'trash-40', zone: 'base', mount: 'undercounter', icon: '🗑️' },
  woodstore: { paintAs: 'woodstore-40', zone: 'base', mount: 'undercounter', icon: '🪵' },
}

function slug(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40)
}

/** Smallest standard frame width the product fits into, or null if oversize. */
export function frameWidthFor(widthCm: number): FrameWidth | null {
  for (const w of FRAME_WIDTHS) if (widthCm <= w) return w
  return null
}

/**
 * Frame width an appliance needs: the smallest standard size that fits, or —
 * for oversize units (wider than 90 cm) — its own width rounded up to 5 cm,
 * which becomes a custom frame when the item is dropped onto the canvas.
 */
function neededWidth(widthCm: number): number {
  return frameWidthFor(widthCm) ?? Math.max(90, Math.ceil(widthCm / 5) * 5)
}

/** Convert an AI search result into a placeable catalog item, or an error string. */
export function toApplianceType(p: AiProduct): ApplianceType | string {
  const spec = CATEGORY_MAP[p.category]
  if (!spec) return `Unsupported category "${p.category}"`
  const minFrameWidth = neededWidth(p.width_cm)
  const dims =
    p.height_cm || p.depth_cm
      ? { w: Math.round(p.width_cm), h: Math.round(p.height_cm ?? 0), d: Math.round(p.depth_cm ?? 0) }
      : undefined
  return {
    id: `ai-${slug(`${p.brand}-${p.model}`)}`,
    name: `${p.brand} ${p.model}`,
    shortName: p.model.length > 18 ? `${p.model.slice(0, 17)}…` : p.model,
    brand: p.brand,
    zone: spec.zone,
    mount: spec.mount,
    minFrameWidth,
    price: Math.round(p.price_usd),
    description: p.blurb,
    icon: spec.icon,
    custom: true,
    paintAs: spec.paintAs,
    url: p.url,
    ...(dims ? { dims } : {}),
  }
}
