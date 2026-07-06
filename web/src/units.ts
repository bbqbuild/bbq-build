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

/**
 * Value for a text input: cm as a plain number, imperial as feet'inches (e.g. 11'10).
 * `inchesOnly` shows plain inches for small dimensions (cabinet widths/heights).
 */
export function lenInputValue(cm: number, unit: Unit, inchesOnly = false): string {
  if (unit === 'cm') return String(Math.round(cm))
  if (inchesOnly) return `${Math.round(cm / 2.54)}"`
  const totalIn = cm / 2.54
  const ft = Math.floor(totalIn / 12)
  const inch = Math.round(totalIn - ft * 12)
  if (inch === 12) return `${ft + 1}'`
  return inch ? `${ft}'${inch}"` : `${ft}'`
}

/**
 * Parse a typed length back to cm. Accepts (cm mode) plain numbers, and
 * (imperial) forms like `72`, `72in`, `6'`, `5'11"`, `5' 11`, `180cm`.
 * Returns null if unparseable.
 */
export function parseLen(text: string, unit: Unit): number | null {
  const t = text.trim().toLowerCase()
  if (!t) return null
  if (t.endsWith('cm')) {
    const n = parseFloat(t)
    return isFinite(n) ? n : null
  }
  if (unit === 'cm' && !/['"’″]|ft|in/.test(t)) {
    const n = parseFloat(t)
    return isFinite(n) ? n : null
  }
  // imperial: feet and inches
  const ftMatch = t.match(/(-?\d+(?:\.\d+)?)\s*(?:'|’|ft|feet|foot)/)
  const inMatch = t.match(/(-?\d+(?:\.\d+)?)\s*(?:"|″|''|in|inch|inches)?\s*$/)
  let inches = 0
  let matched = false
  if (ftMatch) {
    inches += parseFloat(ftMatch[1]) * 12
    matched = true
  }
  if (inMatch && !(ftMatch && ftMatch.index === inMatch.index)) {
    const rest = ftMatch ? t.slice((ftMatch.index ?? 0) + ftMatch[0].length) : t
    const m = rest.match(/(-?\d+(?:\.\d+)?)/)
    if (m) {
      inches += parseFloat(m[1])
      matched = true
    }
  }
  if (!matched) {
    const n = parseFloat(t)
    if (!isFinite(n)) return null
    inches = n
  }
  return inches * 2.54
}
