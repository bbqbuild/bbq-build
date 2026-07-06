import type { Rect } from './layout'
import type { Camera } from './renderScene'

/**
 * Camera lives outside React/zustand: it changes at pointer-move frequency and
 * is only read by the render loop, so re-renders would be wasted work.
 */
export const camera: Camera = { x: 0, y: -55, zoom: 3.2 }

// Exposed for the QA harness (scripts/qa.mjs)
if (typeof window !== 'undefined') {
  ;(window as unknown as { __bbqCam: Camera }).__bbqCam = camera
}

export const MIN_ZOOM = 0.8
export const MAX_ZOOM = 14

export function zoomAt(screenX: number, screenY: number, factor: number, viewW: number, viewH: number) {
  const next = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, camera.zoom * factor))
  const wx = camera.x + (screenX - viewW / 2) / camera.zoom
  const wy = camera.y + (screenY - viewH / 2) / camera.zoom
  camera.x = wx - (screenX - viewW / 2) / next
  camera.y = wy - (screenY - viewH / 2) / next
  camera.zoom = next
}

export function zoomStep(factor: number, viewW: number, viewH: number) {
  zoomAt(viewW / 2, viewH / 2, factor, viewW, viewH)
}

export function fitTo(bounds: Rect, viewW: number, viewH: number) {
  const pad = 1.16
  const zx = viewW / (bounds.w * pad)
  const zy = viewH / (bounds.h * pad)
  camera.zoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, Math.min(zx, zy)))
  camera.x = bounds.x + bounds.w / 2
  camera.y = bounds.y + bounds.h / 2
}

export function screenToWorld(sx: number, sy: number, viewW: number, viewH: number): { x: number; y: number } {
  return {
    x: camera.x + (sx - viewW / 2) / camera.zoom,
    y: camera.y + (sy - viewH / 2) / camera.zoom,
  }
}
