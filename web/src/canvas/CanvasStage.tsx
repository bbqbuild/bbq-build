import { useEffect, useRef } from 'react'
import { useStore } from '../state/store'
import { getAppliance } from '../catalog/appliances'
import { checkPlacement } from '../catalog/compat'
import { type RunId } from '../types'
import { camera, fitTo, screenToWorld, zoomAt } from './camera'
import { computeScene, type RunScene, type SceneLayout3 } from './scene'
import { type RenderState } from './renderScene'
import {
  frameForDrop,
  framePlans,
  planBounds,
  planHitTest,
  planRunUnderPointer,
  renderPlan,
  type PlanHit,
} from './planScene'

type Hit = PlanHit

/** Top-down plan hit-test (world-screen == plan coords). */
function hitTest(scene: SceneLayout3, sx: number, sy: number): Hit {
  return planHitTest(scene, sx, sy)
}

/** Which run + insertion u the pointer is over (nearest run band). */
function runUnderPointer(scene: SceneLayout3, sx: number, sy: number): { run: RunScene; u: number } | null {
  return planRunUnderPointer(scene, sx, sy)
}

function insertionIndexInRun(run: RunScene, u: number): number {
  let idx = 0
  for (const fl of run.elev.frames) {
    if (u > fl.body.x + fl.body.w / 2) idx = fl.index + 1
  }
  return idx
}

interface PointerState {
  downX: number
  downY: number
  panStart: { camX: number; camY: number } | null
  frameDragId: string | null
  moved: boolean
  hit: Hit
}

export function CanvasStage() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const wrapRef = useRef<HTMLDivElement>(null)
  const pointer = useRef<PointerState | null>(null)
  const frameDrag = useRef<{ runId: RunId; u: number } | null>(null)
  const dropTarget = useRef<string | null>(null)
  const frameDropHint = useRef<{ runId: RunId; u: number } | null>(null)
  const hover = useRef<{ frame: string | null; appliance: string | null }>({ frame: null, appliance: null })
  const didInitialFit = useRef(false)

  useEffect(() => {
    const canvas = canvasRef.current!
    const wrap = wrapRef.current!
    const ctx = canvas.getContext('2d')!
    let raf = 0
    const start = performance.now()

    function resize() {
      const dpr = window.devicePixelRatio || 1
      const { clientWidth: w, clientHeight: h } = wrap
      if (canvas.width !== w * dpr || canvas.height !== h * dpr) {
        canvas.width = w * dpr
        canvas.height = h * dpr
        canvas.style.width = `${w}px`
        canvas.style.height = `${h}px`
      }
    }

    function frame(now: number) {
      resize()
      const s = useStore.getState()
      const scene = computeScene(s.design)

      if (!didInitialFit.current && wrap.clientWidth > 0) {
        fitTo(planBounds(scene), wrap.clientWidth, wrap.clientHeight)
        didInitialFit.current = true
      }

      let dropTargets: Set<string> | null = null
      if (s.dragging?.kind === 'appliance') {
        const type = getAppliance(s.dragging.typeId)
        dropTargets = new Set(s.design.frames.filter((f) => checkPlacement(s.design, f, type).ok).map((f) => f.id))
      }

      const dragState =
        pointer.current?.frameDragId && frameDrag.current
          ? { frameId: pointer.current.frameDragId, runId: frameDrag.current.runId, u: frameDrag.current.u }
          : s.dragging?.kind === 'frame' && frameDropHint.current
            ? { frameId: '__new__', runId: frameDropHint.current.runId, u: frameDropHint.current.u }
            : null

      const rs: RenderState = {
        design: s.design,
        scene,
        selection: s.selection,
        hoveredFrameId: hover.current.frame,
        hoveredApplianceId: hover.current.appliance,
        dropTargets,
        activeDropTarget: dropTarget.current,
        frameDrag: dragState,
        showDims: s.showDims,
        showGrid: s.showGrid,
        unit: s.unit,
        time: (now - start) / 1000,
        camera,
        width: wrap.clientWidth,
        height: wrap.clientHeight,
        dpr: window.devicePixelRatio || 1,
      }
      renderPlan(ctx, rs)
      raf = requestAnimationFrame(frame)
    }

    raf = requestAnimationFrame(frame)
    return () => cancelAnimationFrame(raf)
  }, [])

  function localPos(e: { clientX: number; clientY: number }) {
    const rect = canvasRef.current!.getBoundingClientRect()
    return { sx: e.clientX - rect.left, sy: e.clientY - rect.top }
  }

  function worldPos(e: { clientX: number; clientY: number }) {
    const { sx, sy } = localPos(e)
    const wrap = wrapRef.current!
    return screenToWorld(sx, sy, wrap.clientWidth, wrap.clientHeight)
  }

  function onPointerDown(e: React.PointerEvent) {
    if (e.button !== 0) return
    canvasRef.current!.setPointerCapture(e.pointerId)
    const { sx, sy } = localPos(e)
    const w = worldPos(e)
    const scene = computeScene(useStore.getState().design)
    const hit = hitTest(scene, w.x, w.y)
    pointer.current = {
      downX: sx,
      downY: sy,
      panStart: hit && hit.kind !== 'ground' ? null : { camX: camera.x, camY: camera.y },
      frameDragId: hit?.kind === 'frame' ? hit.id : null,
      moved: false,
      hit,
    }
  }

  function onPointerMove(e: React.PointerEvent) {
    const { sx, sy } = localPos(e)
    const w = worldPos(e)
    const p = pointer.current

    if (!p) {
      const s = useStore.getState()
      const scene = computeScene(s.design)
      const hit = hitTest(scene, w.x, w.y)
      hover.current = {
        frame: hit?.kind === 'frame' ? hit.id : null,
        appliance: hit?.kind === 'appliance' ? hit.id : null,
      }
      canvasRef.current!.style.cursor = hit && hit.kind !== 'ground' ? 'pointer' : 'default'
      return
    }

    const dx = sx - p.downX
    const dy = sy - p.downY
    if (!p.moved && Math.hypot(dx, dy) > 4) p.moved = true
    if (!p.moved) return

    if (p.frameDragId) {
      const scene = computeScene(useStore.getState().design)
      const target = runUnderPointer(scene, w.x, w.y)
      if (target) frameDrag.current = { runId: target.run.id, u: target.u }
      canvasRef.current!.style.cursor = 'grabbing'
    } else if (p.panStart) {
      camera.x = p.panStart.camX - dx / camera.zoom
      camera.y = p.panStart.camY - dy / camera.zoom
      canvasRef.current!.style.cursor = 'grabbing'
    }
  }

  function onPointerUp(e: React.PointerEvent) {
    const p = pointer.current
    pointer.current = null
    canvasRef.current!.style.cursor = 'default'
    if (!p) return
    const s = useStore.getState()

    if (!p.moved) {
      if (!p.hit) s.select({ kind: 'none' })
      else if (p.hit.kind === 'ground') s.select({ kind: 'ground' })
      else if (p.hit.kind === 'corner') s.select({ kind: 'corner', id: p.hit.id })
      else if (p.hit.kind === 'frame') s.select({ kind: 'frame', id: p.hit.id })
      else s.select({ kind: 'appliance', id: p.hit.id })
    } else if (p.frameDragId && frameDrag.current) {
      const scene = computeScene(s.design)
      const target = scene.runs.find((r) => r.id === frameDrag.current!.runId)
      if (target) {
        const frame = s.design.frames.find((f) => f.id === p.frameDragId)
        let idx = insertionIndexInRun(target, frameDrag.current.u)
        if (frame && (frame.run ?? 'back') === target.id) {
          const cur = target.frames.findIndex((f) => f.id === frame.id)
          if (idx > cur) idx -= 1
        }
        s.moveFrame(p.frameDragId, idx, target.id)
      }
      s.select({ kind: 'frame', id: p.frameDragId })
    }
    frameDrag.current = null
  }

  function onWheel(e: React.WheelEvent) {
    const { sx, sy } = localPos(e)
    const wrap = wrapRef.current!
    zoomAt(sx, sy, Math.exp(-e.deltaY * 0.0012), wrap.clientWidth, wrap.clientHeight)
  }

  // ---- HTML5 drag & drop from the catalog ----

  function onDragOver(e: React.DragEvent) {
    const s = useStore.getState()
    if (!s.dragging) return
    e.preventDefault()
    e.dataTransfer.dropEffect = 'copy'
    const w = worldPos(e)
    const scene = computeScene(s.design)
    if (s.dragging.kind === 'appliance') {
      // highlight whichever frame we'd act on (even if it's full/too small —
      // the drop decides place vs. prompt vs. new frame)
      const target = frameForDrop(scene, w.x, w.y)
      dropTarget.current = target?.id ?? null
    } else if (s.dragging.kind === 'frame') {
      const target = runUnderPointer(scene, w.x, w.y)
      frameDropHint.current = target ? { runId: target.run.id, u: target.u } : null
    }
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault()
    const s = useStore.getState()
    const w = worldPos(e)
    const scene = computeScene(s.design)
    if (s.dragging?.kind === 'appliance') {
      const onFrame = frameForDrop(scene, w.x, w.y)
      if (onFrame) {
        // dropped on an existing frame → place, or prompt if full / too small
        const target = runUnderPointer(scene, w.x, w.y)
        const idx = target ? insertionIndexInRun(target.run, target.u) : undefined
        s.tryDropAppliance(onFrame.id, s.dragging.typeId, onFrame.run, idx)
      } else {
        // blank space → auto-create a compatible frame at the drop point
        const target = runUnderPointer(scene, w.x, w.y)
        if (target) s.addFrameForAppliance(s.dragging.typeId, target.run.id, insertionIndexInRun(target.run, target.u))
        else s.addFrameForAppliance(s.dragging.typeId, 'back')
      }
    } else if (s.dragging?.kind === 'frame') {
      const target = runUnderPointer(scene, w.x, w.y)
      if (target) {
        s.addFrame(s.dragging.width, insertionIndexInRun(target.run, target.u), s.dragging.lowered, target.run.id)
      } else {
        s.addFrame(s.dragging.width, undefined, s.dragging.lowered, 'back')
      }
    }
    dropTarget.current = null
    frameDropHint.current = null
    s.setDragging(null)
  }

  function onDragLeave() {
    dropTarget.current = null
    frameDropHint.current = null
  }

  return (
    <div ref={wrapRef} className="canvas-wrap">
      <canvas
        ref={canvasRef}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onWheel={onWheel}
        onDragOver={onDragOver}
        onDrop={onDrop}
        onDragLeave={onDragLeave}
      />
    </div>
  )
}

/** Zoom the camera so the whole kitchen is visible. Works for both views. */
export function fitView() {
  window.dispatchEvent(new CustomEvent('bbq:fit'))
  const wrap = document.querySelector('.canvas-wrap') as HTMLElement | null
  if (!wrap) return
  const scene = computeScene(useStore.getState().design)
  fitTo(planBounds(scene), wrap.clientWidth, wrap.clientHeight)
}

// ---- QA helpers (scripts/qa.mjs) ----

function toCanvasPx(sx: number, sy: number) {
  const wrap = document.querySelector('.canvas-wrap') as HTMLElement
  return {
    x: wrap.clientWidth / 2 + (sx - camera.x) * camera.zoom,
    y: wrap.clientHeight / 2 + (sy - camera.y) * camera.zoom,
  }
}

declare global {
  interface Window {
    __bbqFrameScreen: (frameId: string) => { x: number; y: number } | null
    __bbqGroundScreen: () => { x: number; y: number }
  }
}

if (typeof window !== 'undefined') {
  window.__bbqFrameScreen = (frameId: string) => {
    const scene = computeScene(useStore.getState().design)
    const f = framePlans(scene).find((p) => p.id === frameId)
    if (!f) return null
    return toCanvasPx(f.x + f.w / 2, f.z + f.d / 2)
  }
  window.__bbqGroundScreen = () => {
    const scene = computeScene(useStore.getState().design)
    const g = scene.ground
    // a plan point on the platform in front of the kitchen
    const z = Math.min(g.z + g.d - 20, scene.extents.z1 + 40)
    return toCanvasPx(g.x + g.w * 0.15, z)
  }
}
