import type { Rect } from './layout'
import {
  Ctx,
  barHandle,
  brushLines,
  fillRoundRect,
  gauge,
  graphite,
  knob,
  roundRectPath,
  steel,
  strokeRoundRect,
  vHandle,
  vents,
} from './draw'

export interface ArtOpts {
  /** y of the counter top surface (world cm), for drop-in fascia strips */
  counterY: number
  counterH: number
  time: number
}

type Painter = (ctx: Ctx, r: Rect, o: ArtOpts) => void

/** Fascia strip replacing the counter front under a drop-in unit. */
function fascia(ctx: Ctx, r: Rect, o: ArtOpts, knobs: number) {
  const y = o.counterY
  const h = o.counterH
  fillRoundRect(ctx, r.x, y, r.w, h, 0.8, steel(ctx, y, y + h))
  brushLines(ctx, r.x, y, r.w, h)
  ctx.strokeStyle = 'rgba(0,0,0,0.25)'
  ctx.lineWidth = 0.4
  strokeRoundRect(ctx, r.x, y, r.w, h, 0.8, 'rgba(0,0,0,0.25)', 0.4)
  if (knobs > 0) {
    const cy = y + h / 2
    const span = Math.min(r.w - 12, knobs * 9)
    const start = r.x + r.w / 2 - span / 2 + span / knobs / 2
    for (let i = 0; i < knobs; i++) {
      knob(ctx, start + (span / knobs) * i, cy, Math.min(2.3, h * 0.32), -Math.PI / 3 + i * 0.5)
    }
  }
}

const grill: Painter = (ctx, r, o) => {
  // hood
  const hoodH = r.h * 0.78
  const g = steel(ctx, r.y, r.y + hoodH)
  fillRoundRect(ctx, r.x, r.y, r.w, hoodH, [6, 6, 1.5, 1.5], g)
  brushLines(ctx, r.x, r.y, r.w, hoodH)
  // hood seam
  ctx.strokeStyle = 'rgba(0,0,0,0.28)'
  ctx.lineWidth = 0.5
  ctx.beginPath()
  ctx.moveTo(r.x + 1, r.y + hoodH * 0.62)
  ctx.lineTo(r.x + r.w - 1, r.y + hoodH * 0.62)
  ctx.stroke()
  // handle
  barHandle(ctx, r.x + r.w * 0.12, r.y + hoodH * 0.42, r.w * 0.76, 2.4)
  // gauge
  gauge(ctx, r.x + r.w / 2, r.y + hoodH * 0.8, 3.2)
  // base band between hood and counter
  const bandY = r.y + hoodH
  fillRoundRect(ctx, r.x + 1, bandY, r.w - 2, r.h - hoodH, 0.5, steel(ctx, bandY, r.y + r.h, 0.82))
  fascia(ctx, r, o, r.w >= 85 ? 4 : 3)
  strokeRoundRect(ctx, r.x, r.y, r.w, hoodH, [6, 6, 1.5, 1.5], 'rgba(0,0,0,0.3)', 0.5)
}

const santamaria: Painter = (ctx, r, o) => {
  const boxH = r.h * 0.26 // open firebox above the counter
  const boxY = r.y + r.h - boxH
  const inset = 4

  // side posts
  const postG = graphite(ctx, r.y, r.y + r.h)
  fillRoundRect(ctx, r.x + inset, r.y + 2, 2.6, r.h - 2, 0.8, postG)
  fillRoundRect(ctx, r.x + r.w - inset - 2.6, r.y + 2, 2.6, r.h - 2, 0.8, postG)
  // crossbar
  fillRoundRect(ctx, r.x + inset - 1, r.y + 2, r.w - inset * 2 + 2, 2.4, 1, postG)

  // crank wheel on the right post
  const wx = r.x + r.w - inset - 1.3
  const wy = r.y + r.h * 0.32
  ctx.strokeStyle = '#8d949b'
  ctx.lineWidth = 1.1
  ctx.beginPath()
  ctx.arc(wx, wy, 4.4, 0, Math.PI * 2)
  ctx.stroke()
  for (let i = 0; i < 3; i++) {
    const a = (i * Math.PI * 2) / 3 + 0.5
    ctx.beginPath()
    ctx.moveTo(wx, wy)
    ctx.lineTo(wx + Math.cos(a) * 4.4, wy + Math.sin(a) * 4.4)
    ctx.stroke()
  }
  ctx.beginPath()
  ctx.arc(wx, wy, 1.2, 0, Math.PI * 2)
  ctx.fillStyle = '#c8cdd2'
  ctx.fill()

  // grate suspended on chains
  const grateY = r.y + r.h * 0.52
  ctx.strokeStyle = 'rgba(160,166,172,0.9)'
  ctx.lineWidth = 0.6
  for (const fx of [0.22, 0.5, 0.78]) {
    const cx = r.x + r.w * fx
    ctx.setLineDash([1.1, 1])
    ctx.beginPath()
    ctx.moveTo(cx, r.y + 4.4)
    ctx.lineTo(cx, grateY)
    ctx.stroke()
    ctx.setLineDash([])
  }
  const grate = ctx.createLinearGradient(0, grateY, 0, grateY + 2.6)
  grate.addColorStop(0, '#5a6067')
  grate.addColorStop(1, '#33383d')
  fillRoundRect(ctx, r.x + inset + 4, grateY, r.w - inset * 2 - 8, 2.6, 0.8, grate)
  ctx.strokeStyle = '#22262a'
  ctx.lineWidth = 0.4
  for (let x = r.x + inset + 6; x < r.x + r.w - inset - 6; x += 3.2) {
    ctx.beginPath()
    ctx.moveTo(x, grateY + 0.4)
    ctx.lineTo(x, grateY + 2.2)
    ctx.stroke()
  }

  // firebox with live coals
  fillRoundRect(ctx, r.x + 1.5, boxY, r.w - 3, boxH, [1.5, 1.5, 0.5, 0.5], steel(ctx, boxY, boxY + boxH, 0.8))
  brushLines(ctx, r.x + 1.5, boxY, r.w - 3, boxH)
  const coalY = boxY + boxH * 0.45
  const flicker = 0.8 + 0.2 * Math.sin(o.time * 5.1) * Math.sin(o.time * 1.7)
  const coals = ctx.createLinearGradient(0, coalY, 0, boxY + boxH - 1.5)
  coals.addColorStop(0, `rgba(255,170,60,${0.95 * flicker})`)
  coals.addColorStop(1, `rgba(180,40,10,${0.85 * flicker})`)
  fillRoundRect(ctx, r.x + 5, coalY, r.w - 10, boxH - (coalY - boxY) - 1.5, 1, coals)
  ctx.fillStyle = `rgba(30,12,6,0.55)`
  for (let i = 0; i < Math.floor(r.w / 9); i++) {
    const cx = r.x + 7 + i * 9 + ((i * 5) % 4)
    ctx.beginPath()
    ctx.arc(cx, coalY + 1.6 + ((i * 3) % 2), 1.5, 0, Math.PI * 2)
    ctx.fill()
  }

  fascia(ctx, r, o, 0)
}

const griddle: Painter = (ctx, r, o) => {
  // low rim with dark cooking plate
  const rimY = r.y + r.h * 0.45
  fillRoundRect(ctx, r.x, rimY, r.w, r.h - (rimY - r.y), [2, 2, 1, 1], steel(ctx, rimY, r.y + r.h))
  brushLines(ctx, r.x, rimY, r.w, r.h - (rimY - r.y))
  // plate seen edge-on
  const plate = ctx.createLinearGradient(0, r.y, 0, rimY + 2)
  plate.addColorStop(0, '#3a3f45')
  plate.addColorStop(1, '#17191c')
  fillRoundRect(ctx, r.x + 3, r.y, r.w - 6, rimY - r.y + 2, [1.5, 1.5, 0, 0], plate)
  // splash guard
  ctx.strokeStyle = 'rgba(220,228,235,0.8)'
  ctx.lineWidth = 0.8
  ctx.beginPath()
  ctx.moveTo(r.x + 3, r.y + 0.5)
  ctx.lineTo(r.x + r.w - 3, r.y + 0.5)
  ctx.stroke()
  fascia(ctx, r, o, 2)
}

const burner: Painter = (ctx, r, o) => {
  // two round grates from the front: low box with lid
  fillRoundRect(ctx, r.x, r.y + r.h * 0.35, r.w, r.h * 0.65, [2, 2, 1, 1], steel(ctx, r.y, r.y + r.h))
  brushLines(ctx, r.x, r.y + r.h * 0.35, r.w, r.h * 0.65)
  // lid propped open
  const lid = steel(ctx, r.y - 2, r.y + r.h * 0.4, 1.1)
  ctx.save()
  ctx.translate(r.x, r.y + r.h * 0.35)
  ctx.rotate(-0.18)
  fillRoundRect(ctx, 0, -3, r.w, 3, [2, 2, 0, 0], lid)
  ctx.restore()
  // grate hints
  ctx.strokeStyle = '#22262a'
  ctx.lineWidth = 0.7
  for (const fx of [0.3, 0.7]) {
    ctx.beginPath()
    ctx.moveTo(r.x + r.w * fx - 4, r.y + r.h * 0.35 + 1.2)
    ctx.lineTo(r.x + r.w * fx + 4, r.y + r.h * 0.35 + 1.2)
    ctx.stroke()
  }
  fascia(ctx, r, o, 2)
}

const sink: Painter = (ctx, r, o) => {
  // basin rim
  const rimH = 3
  const rimY = r.y + r.h - rimH
  fillRoundRect(ctx, r.x, rimY, r.w, rimH, 1, steel(ctx, rimY, rimY + rimH))
  // gooseneck faucet
  const fx = r.x + r.w * 0.68
  const baseY = rimY
  const topY = r.y + 2
  ctx.strokeStyle = '#b7bec5'
  ctx.lineCap = 'round'
  ctx.lineWidth = 2
  ctx.beginPath()
  ctx.moveTo(fx, baseY)
  ctx.lineTo(fx, topY + 4)
  ctx.arc(fx - 4.5, topY + 4, 4.5, 0, -Math.PI / 2, true)
  ctx.lineTo(fx - 10, topY - 0.5)
  ctx.stroke()
  // spout drop
  ctx.lineWidth = 1.4
  ctx.beginPath()
  ctx.moveTo(fx - 10, topY - 0.5)
  ctx.lineTo(fx - 10, topY + 2.5)
  ctx.stroke()
  ctx.lineCap = 'butt'
  // tap lever
  ctx.strokeStyle = '#d5dade'
  ctx.lineWidth = 1.2
  ctx.beginPath()
  ctx.moveTo(fx + 1, baseY - 6)
  ctx.lineTo(fx + 4.5, baseY - 8)
  ctx.stroke()
  // faucet base
  fillRoundRect(ctx, fx - 1.8, baseY - 1.5, 3.6, 1.5, 0.8, '#8f969d')
  fascia(ctx, r, o, 0)
}

const icebin: Painter = (ctx, r, o) => {
  const rimH = 3.2
  const rimY = r.y + r.h - rimH
  fillRoundRect(ctx, r.x, rimY, r.w, rimH, 1, steel(ctx, rimY, rimY + rimH))
  // ice pile
  ctx.fillStyle = 'rgba(207,232,247,0.95)'
  for (let i = 0; i < Math.floor(r.w / 5); i++) {
    const cx = r.x + 4 + i * 5 + ((i * 7) % 3)
    const cy = rimY - 1.4 - ((i * 5) % 3)
    ctx.save()
    ctx.translate(cx, cy)
    ctx.rotate(((i * 37) % 60) / 60 - 0.5)
    fillRoundRect(ctx, -1.8, -1.8, 3.6, 3.6, 0.8, 'rgba(213,236,250,0.95)')
    ctx.restore()
  }
  // bottle
  ctx.fillStyle = '#2e5d3a'
  fillRoundRect(ctx, r.x + r.w * 0.72, rimY - 8, 2.6, 8, [1, 1, 0, 0], '#2e5d3a')
  fillRoundRect(ctx, r.x + r.w * 0.72 + 0.75, rimY - 11, 1.1, 3.5, 0.5, '#2e5d3a')
  fascia(ctx, r, o, 0)
}

const pizza: Painter = (ctx, r, o) => {
  const bodyY = r.y + 6
  const bodyH = r.h - 6
  // stainless dome-ish body
  fillRoundRect(ctx, r.x, bodyY, r.w, bodyH, [10, 10, 1.5, 1.5], steel(ctx, bodyY, bodyY + bodyH))
  brushLines(ctx, r.x, bodyY, r.w, bodyH)
  // chimney
  const chX = r.x + r.w * 0.72
  fillRoundRect(ctx, chX, r.y - 1, 4.5, 8, 0.8, steel(ctx, r.y - 1, r.y + 7, 0.9))
  fillRoundRect(ctx, chX - 1, r.y - 3, 6.5, 2.4, 0.8, '#5b6167')
  // mouth with fire glow
  const mw = r.w * 0.52
  const mh = bodyH * 0.46
  const mx = r.x + r.w / 2 - mw / 2
  const my = bodyY + bodyH - mh - 3
  roundRectPath(ctx, mx, my, mw, mh, [mh * 0.9, mh * 0.9, 1, 1])
  const glow = ctx.createRadialGradient(mx + mw / 2, my + mh, 1, mx + mw / 2, my + mh, mh * 1.15)
  const flicker = 0.85 + 0.15 * Math.sin(o.time * 6.3) * Math.sin(o.time * 2.1)
  glow.addColorStop(0, `rgba(255,196,86,${0.95 * flicker})`)
  glow.addColorStop(0.55, `rgba(234,88,12,${0.8 * flicker})`)
  glow.addColorStop(1, '#1a120c')
  ctx.fillStyle = glow
  ctx.fill()
  // stone deck lip
  fillRoundRect(ctx, mx - 2, bodyY + bodyH - 3.2, mw + 4, 2.2, 0.8, '#c9c2b4')
  // legs
  ctx.fillStyle = '#454b52'
  ctx.fillRect(r.x + 3, bodyY + bodyH, 2.5, o.counterY - (bodyY + bodyH) < 0 ? 0 : 0)
}

const kamado = (style: 'egg' | 'primo'): Painter => (ctx, r, o) => {
  const cx = r.x + r.w / 2
  const sink = 5 // nested into the table cutout
  const bottom = o.counterY + sink
  const rx = Math.min(r.w * 0.36, style === 'egg' ? 26 : 30) * (style === 'primo' ? 1.15 : 1)
  const ry = (bottom - r.y) / 2
  const cy = r.y + ry

  // ceramic body
  const grad = ctx.createRadialGradient(cx - rx * 0.35, cy - ry * 0.4, rx * 0.2, cx, cy, Math.max(rx, ry) * 1.15)
  if (style === 'egg') {
    grad.addColorStop(0, '#5d9a67')
    grad.addColorStop(0.55, '#2f6a3c')
    grad.addColorStop(1, '#173a20')
  } else {
    grad.addColorStop(0, '#5b5f66')
    grad.addColorStop(0.55, '#2e3237')
    grad.addColorStop(1, '#101315')
  }
  ctx.beginPath()
  ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2)
  ctx.fillStyle = grad
  ctx.fill()
  ctx.strokeStyle = 'rgba(0,0,0,0.35)'
  ctx.lineWidth = 0.6
  ctx.stroke()

  // lid seam with hinge
  const seamY = cy - ry * 0.12
  const seamHalf = rx * Math.sqrt(1 - ((seamY - cy) / ry) ** 2)
  ctx.strokeStyle = 'rgba(0,0,0,0.5)'
  ctx.lineWidth = 0.8
  ctx.beginPath()
  ctx.moveTo(cx - seamHalf, seamY)
  ctx.lineTo(cx + seamHalf, seamY)
  ctx.stroke()
  // metal band + hinge block
  ctx.strokeStyle = '#9aa1a8'
  ctx.lineWidth = 1.4
  ctx.beginPath()
  ctx.moveTo(cx - seamHalf - 1, seamY - 1.2)
  ctx.lineTo(cx + seamHalf + 1, seamY - 1.2)
  ctx.stroke()
  fillRoundRect(ctx, cx + seamHalf - 1.5, seamY - 4, 4, 7, 1, '#7c838a')

  // chimney cap
  fillRoundRect(ctx, cx - 3, r.y - 1.5, 6, 4, 1.2, '#8d949b')
  fillRoundRect(ctx, cx - 1.8, r.y + 2.5, 3.6, 2, 0.6, '#5b6167')

  // thermometer + handle
  gauge(ctx, cx, seamY - ry * 0.4, 2.4)
  barHandle(ctx, cx - rx * 0.35, seamY - 3.6, rx * 0.7, 1.8)

  // bottom vent door
  fillRoundRect(ctx, cx - 4, bottom - 7, 8, 3.4, 0.8, 'rgba(0,0,0,0.45)')
  ctx.strokeStyle = 'rgba(180,186,192,0.5)'
  strokeRoundRect(ctx, cx - 4, bottom - 7, 8, 3.4, 0.8, 'rgba(180,186,192,0.5)', 0.5)
}

const fridgeish = (badge: 'fridge' | 'keg' | 'ice'): Painter => (ctx, r, o) => {
  // stainless door with inset panel
  fillRoundRect(ctx, r.x, r.y, r.w, r.h, 1.5, steel(ctx, r.y, r.y + r.h, 0.95))
  brushLines(ctx, r.x, r.y, r.w, r.h)
  strokeRoundRect(ctx, r.x, r.y, r.w, r.h, 1.5, 'rgba(0,0,0,0.3)', 0.5)
  strokeRoundRect(ctx, r.x + 2.5, r.y + 2.5, r.w - 5, r.h - 5, 1, 'rgba(0,0,0,0.18)', 0.5)
  vHandle(ctx, r.x + r.w - 5, r.y + r.h * 0.18, r.h * 0.5)
  vents(ctx, r.x + 4, r.y + r.h - 6, r.w - 8, 2, 2.4)
  const cx = r.x + r.w * 0.38
  const cy = r.y + r.h * 0.34
  if (badge === 'fridge') {
    // digital temp display
    fillRoundRect(ctx, cx - 6, cy - 3, 12, 6, 1, '#101418')
    ctx.font = '600 4px Inter, system-ui, sans-serif'
    ctx.fillStyle = '#38bdf8'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText('4°', cx, cy + 0.2)
  } else if (badge === 'keg') {
    // tap handle silhouette
    ctx.strokeStyle = '#31363b'
    ctx.lineWidth = 1.6
    ctx.beginPath()
    ctx.moveTo(cx, cy + 4)
    ctx.lineTo(cx, cy - 2)
    ctx.stroke()
    fillRoundRect(ctx, cx - 1.6, cy - 7, 3.2, 6, 1.4, '#7c4a21')
    fillRoundRect(ctx, cx - 5, cy + 4, 10, 1.6, 0.8, '#31363b')
  } else {
    // ice cube badge
    fillRoundRect(ctx, cx - 4, cy - 4, 8, 8, 1.5, 'rgba(190,225,244,0.9)')
    ctx.strokeStyle = 'rgba(90,140,170,0.8)'
    ctx.lineWidth = 0.6
    strokeRoundRect(ctx, cx - 4, cy - 4, 8, 8, 1.5, 'rgba(90,140,170,0.8)', 0.6)
  }
}

const drawers: Painter = (ctx, r) => {
  const n = 3
  const gap = 1.2
  const dh = (r.h - gap * (n - 1)) / n
  for (let i = 0; i < n; i++) {
    const y = r.y + i * (dh + gap)
    fillRoundRect(ctx, r.x, y, r.w, dh, 1.2, steel(ctx, y, y + dh, 0.95))
    brushLines(ctx, r.x, y, r.w, dh)
    strokeRoundRect(ctx, r.x, y, r.w, dh, 1.2, 'rgba(0,0,0,0.28)', 0.5)
    barHandle(ctx, r.x + r.w * 0.2, y + dh * 0.42, r.w * 0.6, 2)
  }
}

const doorsPainter = (count: 1 | 2): Painter => (ctx, r) => {
  const gap = 1
  const dw = (r.w - gap * (count - 1)) / count
  for (let i = 0; i < count; i++) {
    const x = r.x + i * (dw + gap)
    fillRoundRect(ctx, x, r.y, dw, r.h, 1.2, steel(ctx, r.y, r.y + r.h, 0.92))
    brushLines(ctx, x, r.y, dw, r.h)
    strokeRoundRect(ctx, x, r.y, dw, r.h, 1.2, 'rgba(0,0,0,0.28)', 0.5)
    const hx = count === 2 ? (i === 0 ? x + dw - 4 : x + 4) : x + dw - 4.5
    vHandle(ctx, hx, r.y + r.h * 0.2, r.h * 0.45)
  }
}

const trash: Painter = (ctx, r) => {
  fillRoundRect(ctx, r.x, r.y, r.w, r.h, 1.2, steel(ctx, r.y, r.y + r.h, 0.9))
  brushLines(ctx, r.x, r.y, r.w, r.h)
  strokeRoundRect(ctx, r.x, r.y, r.w, r.h, 1.2, 'rgba(0,0,0,0.28)', 0.5)
  barHandle(ctx, r.x + r.w * 0.18, r.y + 5, r.w * 0.64, 2.2)
  // recycling triangle
  const cx = r.x + r.w / 2
  const cy = r.y + r.h * 0.6
  ctx.strokeStyle = 'rgba(40,90,50,0.75)'
  ctx.lineWidth = 1
  ctx.beginPath()
  for (let i = 0; i < 3; i++) {
    const a = -Math.PI / 2 + (i * Math.PI * 2) / 3
    const x = cx + Math.cos(a) * 4.5
    const y = cy + Math.sin(a) * 4.5
    i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)
  }
  ctx.closePath()
  ctx.stroke()
}

const woodstore: Painter = (ctx, r) => {
  // open dark cavity
  const g = ctx.createLinearGradient(0, r.y, 0, r.y + r.h)
  g.addColorStop(0, '#171310')
  g.addColorStop(1, '#241c15')
  fillRoundRect(ctx, r.x, r.y, r.w, r.h, 1.2, g)
  // stacked log ends
  const rows = [r.y + r.h - 5, r.y + r.h - 12.5, r.y + r.h - 20]
  rows.forEach((cy, row) => {
    if (cy - 4 < r.y) return
    const count = Math.floor((r.w - 6) / 8.4)
    for (let i = 0; i < count - (row % 2); i++) {
      const cx = r.x + 7 + i * 8.4 + (row % 2) * 4.2
      const rad = 3.6 - (i % 2) * 0.4
      const wood = ctx.createRadialGradient(cx, cy, 0.4, cx, cy, rad)
      wood.addColorStop(0, '#d8b98d')
      wood.addColorStop(0.7, '#a67c4e')
      wood.addColorStop(1, '#6d4b2a')
      ctx.beginPath()
      ctx.arc(cx, cy, rad, 0, Math.PI * 2)
      ctx.fillStyle = wood
      ctx.fill()
      ctx.strokeStyle = 'rgba(60,40,20,0.6)'
      ctx.lineWidth = 0.4
      ctx.beginPath()
      ctx.arc(cx, cy, rad * 0.55, 0, Math.PI * 2)
      ctx.stroke()
    }
  })
}

export const PAINTERS: Record<string, Painter> = {
  'grill-90': grill,
  'grill-80': grill,
  'santamaria-90': santamaria,
  'egg-xl': kamado('egg'),
  'primo-xl': kamado('primo'),
  'griddle-60': griddle,
  'burner-40': burner,
  'sink-40': sink,
  'icebin-40': icebin,
  'pizza-60': pizza,
  'fridge-60': fridgeish('fridge'),
  'kegerator-60': fridgeish('keg'),
  'icemaker-60': fridgeish('ice'),
  'drawers-40': drawers,
  'doors-60': doorsPainter(2),
  'door-40': doorsPainter(1),
  'trash-40': trash,
  'woodstore-40': woodstore,
}
