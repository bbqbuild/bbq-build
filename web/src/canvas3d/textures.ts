// Canvas-texture factories for the 3D view — reuse the 2D painter art so the
// cabinet fronts and appliances keep their hand-drawn detail in 3D.

import * as THREE from 'three'
import { PAINTERS } from '../canvas/applianceArt'
import { brushLines, fillRoundRect, label, steel, graphite, strokeRoundRect } from '../canvas/draw'
import { getAppliance } from '../catalog/appliances'
import type { ApplianceType, Frame, PlacedAppliance } from '../types'
import { COUNTER_T, frameBodyH } from '../types'

const S = 6 // px per cm for textures

function makeCanvas(wCm: number, hCm: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const c = document.createElement('canvas')
  c.width = Math.max(2, Math.round(wCm * S))
  c.height = Math.max(2, Math.round(hCm * S))
  const ctx = c.getContext('2d')!
  ctx.scale(S, S)
  return [c, ctx]
}

function toTexture(c: HTMLCanvasElement): THREE.CanvasTexture {
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  t.anisotropy = 4
  return t
}

function finishFill(ctx: CanvasRenderingContext2D, finish: Frame['finish'], y0: number, y1: number) {
  switch (finish) {
    case 'steel':
      return steel(ctx, y0, y1)
    case 'graphite':
      return graphite(ctx, y0, y1)
    case 'teak': {
      const g = ctx.createLinearGradient(0, y0, 0, y1)
      g.addColorStop(0, '#a5754b')
      g.addColorStop(1, '#7a5230')
      return g
    }
    case 'stone': {
      const g = ctx.createLinearGradient(0, y0, 0, y1)
      g.addColorStop(0, '#7a766f')
      g.addColorStop(1, '#5f5b55')
      return g
    }
  }
}

export const FINISH_COLORS: Record<Frame['finish'], string> = {
  graphite: '#3d434a',
  steel: '#9aa1a8',
  teak: '#8f6138',
  stone: '#6c6862',
}

/** Front of one cabinet frame incl. its base appliance (or empty-cavity hint). */
export function frameFrontTexture(frame: Frame, base: PlacedAppliance | undefined): THREE.CanvasTexture {
  const bodyH = frameBodyH(frame)
  const [c, ctx] = makeCanvas(frame.width, bodyH)
  const w = frame.width
  // body face
  fillRoundRect(ctx, 0, 0, w, bodyH, 0, finishFill(ctx, frame.finish, 0, bodyH)!)
  if (frame.finish === 'steel') brushLines(ctx, 0, 0, w, bodyH, 0.04)
  if (frame.finish === 'teak') {
    ctx.strokeStyle = 'rgba(40,24,10,0.4)'
    ctx.lineWidth = 0.6
    for (let y = 8; y < bodyH - 4; y += 8) {
      ctx.beginPath()
      ctx.moveTo(1, y)
      ctx.lineTo(w - 1, y)
      ctx.stroke()
    }
  }
  if (frame.finish === 'stone') {
    ctx.strokeStyle = 'rgba(25,22,18,0.35)'
    ctx.lineWidth = 0.6
    for (let i = 1; i <= 3; i++) {
      ctx.beginPath()
      ctx.moveTo(1, (i * bodyH) / 4)
      ctx.lineTo(w - 1, (i * bodyH) / 4)
      ctx.stroke()
    }
  }
  // cavity
  const o = { x: 3, y: 3, w: w - 6, h: bodyH - 12 }
  const cav = ctx.createLinearGradient(0, o.y, 0, o.y + o.h)
  cav.addColorStop(0, '#0c0e11')
  cav.addColorStop(1, '#191d22')
  fillRoundRect(ctx, o.x, o.y, o.w, o.h, 1, cav)
  // base appliance art (painters expect y<0 space; translate so cavity top = opening)
  if (base) {
    let painter = PAINTERS[base.typeId]
    if (!painter) {
      try {
        const paintAs = getAppliance(base.typeId).paintAs
        if (paintAs) painter = PAINTERS[paintAs]
      } catch {
        painter = undefined as never
      }
    }
    if (painter) painter(ctx, o, { counterY: -bodyH - COUNTER_T, counterH: COUNTER_T, time: 0.4 })
  } else {
    ctx.save()
    ctx.setLineDash([2.5, 2.5])
    strokeRoundRect(ctx, o.x + 2, o.y + 2, o.w - 4, o.h - 4, 1, 'rgba(148,163,184,0.3)', 0.7)
    ctx.restore()
    label(ctx, '+', w / 2, o.y + o.h / 2, 10, 'rgba(148,163,184,0.4)')
  }
  ctx.strokeStyle = 'rgba(0,0,0,0.4)'
  ctx.lineWidth = 0.6
  ctx.strokeRect(0.3, 0.3, w - 0.6, bodyH - 0.6)
  return toTexture(c)
}

/** Front art for a top-zone appliance volume (transparent background). */
export function applianceFrontTexture(placed: PlacedAppliance, type: ApplianceType, wCm: number, hCm: number): THREE.CanvasTexture {
  const [c, ctx] = makeCanvas(wCm, hCm)
  let painter = PAINTERS[type.id] ?? (type.paintAs ? PAINTERS[type.paintAs] : undefined)
  if (painter) {
    // painters draw fascia at counterY below the rect — give them a counter
    // strip inside the texture so nothing lands outside
    painter(ctx, { x: 0, y: 0, w: wCm, h: hCm - COUNTER_T }, { counterY: hCm - COUNTER_T, counterH: COUNTER_T, time: 0.4 })
  }
  return toTexture(c)
}

/** Top surface of the ground platform. */
export function groundTopTexture(type: string, wCm: number, dCm: number): THREE.CanvasTexture {
  const GS = 2
  const c = document.createElement('canvas')
  c.width = Math.max(2, Math.round(wCm * GS))
  c.height = Math.max(2, Math.round(dCm * GS))
  const ctx = c.getContext('2d')!
  ctx.scale(GS, GS)
  if (type === 'deck') {
    ctx.fillStyle = '#7c552f'
    ctx.fillRect(0, 0, wCm, dCm)
    for (let z = 0; z < dCm; z += 14) {
      const shade = 0.9 + 0.12 * Math.sin(z * 12.9898)
      ctx.fillStyle = `rgb(${Math.round(134 * shade)}, ${Math.round(92 * shade)}, ${Math.round(58 * shade)})`
      ctx.fillRect(0, z, wCm, Math.min(12.6, dCm - z))
      ctx.fillStyle = 'rgba(0,0,0,0.25)'
      const off = (Math.floor(z / 14) % 2) * 45
      for (let x = 30 + off; x < wCm; x += 90) ctx.fillRect(x, z, 1, 12.6)
    }
  } else if (type === 'concrete') {
    ctx.fillStyle = '#85878a'
    ctx.fillRect(0, 0, wCm, dCm)
    ctx.strokeStyle = 'rgba(0,0,0,0.16)'
    ctx.lineWidth = 0.8
    for (let x = 90; x < wCm; x += 90) {
      ctx.beginPath()
      ctx.moveTo(x, 1)
      ctx.lineTo(x, dCm - 1)
      ctx.stroke()
    }
    for (let z = 90; z < dCm; z += 90) {
      ctx.beginPath()
      ctx.moveTo(1, z)
      ctx.lineTo(wCm - 1, z)
      ctx.stroke()
    }
  } else if (type === 'pavers') {
    ctx.fillStyle = '#54585d'
    ctx.fillRect(0, 0, wCm, dCm)
    const tile = 40
    let row = 0
    for (let z = 0; z < dCm; z += tile, row++) {
      for (let x = ((row % 2) * tile) / 2 - tile / 2; x < wCm; x += tile) {
        const w = Math.min(tile - 2, wCm - x - 1)
        const d = Math.min(tile - 2, dCm - z - 1)
        if (w > 2 && d > 2 && x >= 0) {
          ctx.fillStyle = row % 2 ? '#75797f' : '#7d8187'
          ctx.beginPath()
          ctx.roundRect(x + 1, z + 1, w, d, 1)
          ctx.fill()
        }
      }
    }
  } else {
    ctx.fillStyle = '#4f4b46'
    ctx.fillRect(0, 0, wCm, dCm)
    let z = 2
    let flip = false
    while (z < dCm - 4) {
      let x = 2 + (flip ? 14 : 0)
      const dRow = 26 + (flip ? 8 : 0)
      while (x < wCm - 3) {
        const w = flip ? 36 : 28
        const ww = Math.min(w, wCm - x - 2)
        const dd = Math.min(dRow, dCm - z - 2)
        if (ww > 4 && dd > 4) {
          ctx.fillStyle = flip ? '#6f6a63' : '#7d766d'
          ctx.beginPath()
          ctx.roundRect(x, z, ww, dd, 3)
          ctx.fill()
        }
        x += ww + 3
        flip = !flip
      }
      z += dRow + 3
    }
  }
  return toTexture(c)
}

/** Simple label sprite (dimensions, measurements). */
export function labelSprite(text: string, scale = 1, bg = 'rgba(21,25,32,0.92)'): THREE.Sprite {
  const pad = 8
  const fs = 26
  const measure = document.createElement('canvas').getContext('2d')!
  measure.font = `600 ${fs}px Inter, system-ui, sans-serif`
  const tw = measure.measureText(text).width
  const c = document.createElement('canvas')
  c.width = Math.ceil(tw + pad * 2)
  c.height = fs + pad * 2
  const ctx = c.getContext('2d')!
  ctx.fillStyle = bg
  ctx.beginPath()
  ctx.roundRect(0, 0, c.width, c.height, 10)
  ctx.fill()
  ctx.font = `600 ${fs}px Inter, system-ui, sans-serif`
  ctx.fillStyle = '#cbd5e1'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(text, c.width / 2, c.height / 2 + 1)
  const t = toTexture(c)
  const mat = new THREE.SpriteMaterial({ map: t, depthTest: false })
  const sprite = new THREE.Sprite(mat)
  const k = 0.28 * scale
  sprite.scale.set(c.width * k, c.height * k, 1)
  sprite.renderOrder = 999
  return sprite
}
