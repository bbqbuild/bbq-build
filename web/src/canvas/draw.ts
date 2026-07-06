// Low-level canvas drawing helpers. All functions draw in world units (cm);
// the caller has already applied the camera transform.

export type Ctx = CanvasRenderingContext2D

export function roundRectPath(ctx: Ctx, x: number, y: number, w: number, h: number, r: number | number[]) {
  const radii = Array.isArray(r) ? r : [r, r, r, r]
  const [tl, tr, br, bl] = radii.map((v) => Math.max(0, Math.min(v, w / 2, h / 2)))
  ctx.beginPath()
  ctx.moveTo(x + tl, y)
  ctx.lineTo(x + w - tr, y)
  ctx.arcTo(x + w, y, x + w, y + tr, tr)
  ctx.lineTo(x + w, y + h - br)
  ctx.arcTo(x + w, y + h, x + w - br, y + h, br)
  ctx.lineTo(x + bl, y + h)
  ctx.arcTo(x, y + h, x, y + h - bl, bl)
  ctx.lineTo(x, y + tl)
  ctx.arcTo(x, y, x + tl, y, tl)
  ctx.closePath()
}

export function fillRoundRect(ctx: Ctx, x: number, y: number, w: number, h: number, r: number | number[], fill: string | CanvasGradient) {
  roundRectPath(ctx, x, y, w, h, r)
  ctx.fillStyle = fill
  ctx.fill()
}

export function strokeRoundRect(ctx: Ctx, x: number, y: number, w: number, h: number, r: number | number[], stroke: string, width = 1) {
  roundRectPath(ctx, x, y, w, h, r)
  ctx.strokeStyle = stroke
  ctx.lineWidth = width
  ctx.stroke()
}

/** Vertical brushed-stainless gradient. */
export function steel(ctx: Ctx, y0: number, y1: number, bright = 1): CanvasGradient {
  const g = ctx.createLinearGradient(0, y0, 0, y1)
  const c = (l: number) => `hsl(210 8% ${Math.min(92, l * bright)}%)`
  g.addColorStop(0, c(78))
  g.addColorStop(0.12, c(88))
  g.addColorStop(0.35, c(70))
  g.addColorStop(0.55, c(62))
  g.addColorStop(0.8, c(74))
  g.addColorStop(1, c(58))
  return g
}

/** Dark powder-coated metal gradient. */
export function graphite(ctx: Ctx, y0: number, y1: number): CanvasGradient {
  const g = ctx.createLinearGradient(0, y0, 0, y1)
  g.addColorStop(0, '#4a5058')
  g.addColorStop(0.15, '#565d66')
  g.addColorStop(0.5, '#3a4046')
  g.addColorStop(1, '#2e3338')
  return g
}

/** Fine vertical brushing lines over a metal surface. */
export function brushLines(ctx: Ctx, x: number, y: number, w: number, h: number, alpha = 0.05) {
  ctx.save()
  ctx.globalAlpha = alpha
  ctx.strokeStyle = '#ffffff'
  ctx.lineWidth = 0.4
  for (let i = x + 2; i < x + w - 1; i += 2.7) {
    ctx.beginPath()
    ctx.moveTo(i, y + 1)
    ctx.lineTo(i, y + h - 1)
    ctx.stroke()
  }
  ctx.restore()
}

/** A metal bar handle. */
export function barHandle(ctx: Ctx, x: number, y: number, w: number, thickness = 2.2) {
  const g = ctx.createLinearGradient(0, y - thickness, 0, y + thickness)
  g.addColorStop(0, '#e8ebee')
  g.addColorStop(0.5, '#9aa1a8')
  g.addColorStop(1, '#5c6369')
  fillRoundRect(ctx, x, y - thickness / 2, w, thickness, thickness / 2, g)
  // standoffs
  ctx.fillStyle = '#6a7178'
  ctx.fillRect(x + 2, y + thickness / 2, 1.6, 1.8)
  ctx.fillRect(x + w - 3.6, y + thickness / 2, 1.6, 1.8)
}

/** Vertical handle for doors/fridges. */
export function vHandle(ctx: Ctx, x: number, y: number, h: number, thickness = 2.2) {
  const g = ctx.createLinearGradient(x - thickness, 0, x + thickness, 0)
  g.addColorStop(0, '#e8ebee')
  g.addColorStop(0.5, '#9aa1a8')
  g.addColorStop(1, '#5c6369')
  fillRoundRect(ctx, x - thickness / 2, y, thickness, h, thickness / 2, g)
}

/** A control knob with a position tick. */
export function knob(ctx: Ctx, cx: number, cy: number, r: number, angle = -Math.PI / 3) {
  const g = ctx.createRadialGradient(cx - r * 0.3, cy - r * 0.4, r * 0.2, cx, cy, r)
  g.addColorStop(0, '#f2f4f6')
  g.addColorStop(0.6, '#aab1b8')
  g.addColorStop(1, '#565d64')
  ctx.beginPath()
  ctx.arc(cx, cy, r, 0, Math.PI * 2)
  ctx.fillStyle = g
  ctx.fill()
  ctx.strokeStyle = 'rgba(0,0,0,0.35)'
  ctx.lineWidth = 0.5
  ctx.stroke()
  ctx.beginPath()
  ctx.moveTo(cx, cy)
  ctx.lineTo(cx + Math.cos(angle) * r * 0.75, cy + Math.sin(angle) * r * 0.75)
  ctx.strokeStyle = '#2b2f33'
  ctx.lineWidth = 0.9
  ctx.stroke()
}

/** Round analog thermometer. */
export function gauge(ctx: Ctx, cx: number, cy: number, r: number) {
  ctx.beginPath()
  ctx.arc(cx, cy, r, 0, Math.PI * 2)
  ctx.fillStyle = '#dfe3e7'
  ctx.fill()
  ctx.strokeStyle = '#4a5158'
  ctx.lineWidth = 0.8
  ctx.stroke()
  ctx.beginPath()
  ctx.arc(cx, cy, r * 0.72, 0, Math.PI * 2)
  ctx.fillStyle = '#f6f7f8'
  ctx.fill()
  ctx.beginPath()
  ctx.moveTo(cx, cy)
  ctx.lineTo(cx + r * 0.5, cy - r * 0.35)
  ctx.strokeStyle = '#c2410c'
  ctx.lineWidth = 0.7
  ctx.stroke()
}

/** Ventilation slots. */
export function vents(ctx: Ctx, x: number, y: number, w: number, rows: number, gap = 2.2) {
  ctx.fillStyle = 'rgba(0,0,0,0.35)'
  for (let i = 0; i < rows; i++) {
    fillRoundRect(ctx, x, y + i * gap, w, 1, 0.5, 'rgba(0,0,0,0.35)')
  }
}

export function label(ctx: Ctx, text: string, x: number, y: number, size = 6, color = '#9aa7b5', align: CanvasTextAlign = 'center') {
  ctx.font = `500 ${size}px Inter, system-ui, sans-serif`
  ctx.fillStyle = color
  ctx.textAlign = align
  ctx.textBaseline = 'middle'
  ctx.fillText(text, x, y)
}

/** Blueprint-style dimension line with end ticks and centered label. */
export function dimLine(ctx: Ctx, x1: number, x2: number, y: number, text: string, color = 'rgba(148,163,184,0.85)') {
  ctx.save()
  ctx.strokeStyle = color
  ctx.lineWidth = 0.5
  ctx.beginPath()
  ctx.moveTo(x1, y)
  ctx.lineTo(x2, y)
  ctx.moveTo(x1, y - 3)
  ctx.lineTo(x1, y + 3)
  ctx.moveTo(x2, y - 3)
  ctx.lineTo(x2, y + 3)
  ctx.stroke()
  const cx = (x1 + x2) / 2
  ctx.font = `500 5.5px Inter, system-ui, sans-serif`
  const tw = ctx.measureText(text).width
  ctx.fillStyle = '#151920'
  ctx.fillRect(cx - tw / 2 - 2, y - 4, tw + 4, 8)
  label(ctx, text, cx, y + 0.5, 5.5, color)
  ctx.restore()
}

/** Vertical dimension line. */
export function dimLineV(ctx: Ctx, y1: number, y2: number, x: number, text: string, color = 'rgba(148,163,184,0.85)') {
  ctx.save()
  ctx.strokeStyle = color
  ctx.lineWidth = 0.5
  ctx.beginPath()
  ctx.moveTo(x, y1)
  ctx.lineTo(x, y2)
  ctx.moveTo(x - 3, y1)
  ctx.lineTo(x + 3, y1)
  ctx.moveTo(x - 3, y2)
  ctx.lineTo(x + 3, y2)
  ctx.stroke()
  const cy = (y1 + y2) / 2
  ctx.translate(x, cy)
  ctx.rotate(-Math.PI / 2)
  ctx.font = `500 5.5px Inter, system-ui, sans-serif`
  const tw = ctx.measureText(text).width
  ctx.fillStyle = '#151920'
  ctx.fillRect(-tw / 2 - 2, -4, tw + 4, 8)
  label(ctx, text, 0, 0.5, 5.5, color)
  ctx.restore()
}
