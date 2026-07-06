export type Unit = 'cm' | 'imperial'

const FRACTIONS = ['', '¼', '½', '¾']

/** Inches rounded to the nearest quarter, e.g. 35¼ */
function inches(v: number): string {
  const quarters = Math.round(v * 4)
  const whole = Math.floor(quarters / 4)
  const frac = quarters % 4
  return frac ? `${whole}${FRACTIONS[frac]}` : `${whole}`
}

/**
 * Format a length stored in cm for display.
 * Imperial: under 3 ft shows inches (23⅝″-style, quarter precision),
 * 3 ft and over shows feet+inches (11′10″).
 */
export function formatLen(cm: number, unit: Unit): string {
  if (unit === 'cm') return `${cm} cm`
  const totalIn = cm / 2.54
  if (totalIn < 36) return `${inches(totalIn)}″`
  const ft = Math.floor(totalIn / 12)
  const rem = Math.round(totalIn - ft * 12)
  if (rem === 12) return `${ft + 1}′`
  return rem === 0 ? `${ft}′` : `${ft}′${rem}″`
}

/** Compact form for tight canvas labels: cm shows a bare number. */
export function formatLenBare(cm: number, unit: Unit): string {
  return unit === 'cm' ? String(cm) : formatLen(cm, unit)
}
