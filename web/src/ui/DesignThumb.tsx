import { useEffect, useRef } from 'react'
import { computeScene, renderScene } from '../canvas/renderScene'
import { registerCustomAppliances } from '../catalog/appliances'
import type { Design } from '../types'

/** A static 2D (oblique) thumbnail render of a design. */
export function DesignThumb({ design, width = 280, height = 150 }: { design: Design; width?: number; height?: number }) {
  const ref = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    const canvas = ref.current!
    const ctx = canvas.getContext('2d')!
    const dpr = window.devicePixelRatio || 1
    canvas.width = width * dpr
    canvas.height = height * dpr
    canvas.style.width = `${width}px`
    canvas.style.height = `${height}px`
    registerCustomAppliances(design.custom)
    const scene = computeScene(design)
    const pad = 1.15
    const zoom = Math.min(width / (scene.bounds.w * pad), height / (scene.bounds.h * pad))
    renderScene(ctx, {
      design,
      scene,
      selection: { kind: 'none' },
      hoveredFrameId: null,
      hoveredApplianceId: null,
      dropTargets: null,
      activeDropTarget: null,
      frameDrag: null,
      showDims: false,
      showGrid: false,
      unit: 'cm',
      time: 0.4,
      camera: { x: scene.bounds.x + scene.bounds.w / 2, y: scene.bounds.y + scene.bounds.h / 2, zoom },
      width,
      height,
      dpr,
      thumbnail: true,
    })
  }, [design, width, height])
  return <canvas ref={ref} className="design-thumb" />
}
