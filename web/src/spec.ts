import { formatPrice, priceBreakdown } from './state/store'
import type { Design } from './types'
import { formatLen, type Unit } from './units'

/** Plain-text spec — used for the mailto body in Get Quotes, and as the "facts" the AI render must match. */
export function specAsText(design: Design, unit: Unit) {
  const { lines, total } = priceBreakdown(design, unit)
  const rows = lines.map((l) => `- ${l.label} (${l.detail}) x${l.qty} — ${formatPrice(l.total)}`)
  return [
    `Outdoor kitchen spec — ${design.name}`,
    `${design.frames.length} frames · ${formatLen(design.frames.reduce((s, f) => s + f.width, 0), unit)} run`,
    '',
    ...rows,
    '',
    `Estimated total: ${formatPrice(total)}`,
    '',
    'Designed on bbq.build',
  ].join('\n')
}
