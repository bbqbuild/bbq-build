import { useEffect, useRef } from 'react'
import { useStore } from '../state/store'
import { fitsFrame, getAppliance } from '../catalog/appliances'
import { COUNTER_T, FRAME_BODY_H } from '../types'
import { camera, fitTo, screenToWorld, zoomAt } from './camera'
import { computeLayout, insertionIndex, rectContains, type SceneLayout } from './layout'
import { renderScene, type RenderState } from './renderScene'

type Hit =
  | { kind: 'appliance'; id: string }
  | { kind: 'frame'; id: string }
  | { kind: 'ground' }
  | null

function hitTest(layout: SceneLayout, wx: number, wy: number): Hit {
  // top-zone appliances stick out above the counter
  for (const al of layout.appliances) {
    if (al.placed.zone === 'top' && rectContains(al.rect, wx, wy)) return { kind: 'appliance', id: al.placed.id }
  }
  for (const al of layout.appliances) {
    if (al.placed.zone === 'base' && rectContains(al.rect, wx, wy)) return { kind: 'appliance', id: al.placed.id }
  }
  for (const fl of layout.frames) {
    const r = { x: fl.body.x, y: fl.body.y - COUNTER_T, w: fl.body.w, h: fl.body.h + COUNTER_T }
    if (rectContains(r, wx, wy)) return { kind: 'frame', id: fl.frame.id }
  }
  if (rectContains(layout.ground, wx, wy)) return { kind: 'ground' }
  return null
}

interface PointerState {
  downX: number
  downY: number
  panStart: { camX: number; camY: number } | null
  frameDragId: string | null
  grabOffsetX: number
  moved: boolean
  hit: Hit
}

export function CanvasStage() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const wrapRef = useRef<HTMLDivElement>(null)
  const pointer = useRef<PointerState | null>(null)
  const frameDragX = useRef<number | null>(null)
  const dropTarget = useRef<string | null>(null)
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
      const layout = computeLayout(s.design)

      if (!didInitialFit.current && wrap.clientWidth > 0) {
        fitTo(layout.bounds, wrap.clientWidth, wrap.clientHeight)
        didInitialFit.current = true
      }

      const dragging = s.dragging
      let dropTargets: Set<string> | null = null
      if (dragging?.kind === 'appliance') {
        const type = getAppliance(dragging.typeId)
        dropTargets = new Set(s.design.frames.filter((f) => fitsFrame(type, f.width)).map((f) => f.id))
      }

      const rs: RenderState = {
        design: s.design,
        layout,
        selection: s.selection,
        hoveredFrameId: hover.current.frame,
        hoveredApplianceId: hover.current.appliance,
        dropTargets,
        activeDropTarget: dropTarget.current,
        frameDrag:
          pointer.current?.frameDragId && frameDragX.current !== null
            ? { frameId: pointer.current.frameDragId, worldX: frameDragX.current }
            : null,
        showDims: s.showDims,
        showGrid: s.showGrid,
        time: (now - start) / 1000,
        camera,
        width: wrap.clientWidth,
        height: wrap.clientHeight,
        dpr: window.devicePixelRatio || 1,
      }
      renderScene(ctx, rs)
      raf = requestAnimationFrame(frame)
    }

    raf = requestAnimationFrame(frame)
    return () => cancelAnimationFrame(raf)
  }, [])

  // ---- pointer interactions ----

  function localPos(e: { clientX: number; clientY: number }) {
    const rect = canvasRef.current!.getBoundingClientRect()
    return { sx: e.clientX - rect.left, sy: e.clientY - rect.top }
  }

  function onPointerDown(e: React.PointerEvent) {
    if (e.button !== 0) return
    canvasRef.current!.setPointerCapture(e.pointerId)
    const { sx, sy } = localPos(e)
    const wrap = wrapRef.current!
    const w = screenToWorld(sx, sy, wrap.clientWidth, wrap.clientHeight)
    const layout = computeLayout(useStore.getState().design)
    const hit = hitTest(layout, w.x, w.y)
    const fl = hit?.kind === 'frame' ? layout.frames.find((f) => f.frame.id === hit.id) : null
    pointer.current = {
      downX: sx,
      downY: sy,
      panStart: hit && hit.kind !== 'ground' ? null : { camX: camera.x, camY: camera.y },
      frameDragId: hit?.kind === 'frame' ? hit.id : null,
      grabOffsetX: fl ? w.x - (fl.body.x + fl.body.w / 2) : 0,
      moved: false,
      hit,
    }
  }

  function onPointerMove(e: React.PointerEvent) {
    const { sx, sy } = localPos(e)
    const wrap = wrapRef.current!
    const w = screenToWorld(sx, sy, wrap.clientWidth, wrap.clientHeight)
    const p = pointer.current

    if (!p) {
      // hover feedback
      const s = useStore.getState()
      const layout = computeLayout(s.design)
      const hit = hitTest(layout, w.x, w.y)
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
      frameDragX.current = w.x - p.grabOffsetX
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
      // simple click → selection
      if (!p.hit) s.select({ kind: 'none' })
      else if (p.hit.kind === 'ground') s.select({ kind: 'ground' })
      else if (p.hit.kind === 'frame') s.select({ kind: 'frame', id: p.hit.id })
      else s.select({ kind: 'appliance', id: p.hit.id })
    } else if (p.frameDragId && frameDragX.current !== null) {
      // commit reorder
      const layout = computeLayout(s.design)
      const currentIdx = s.design.frames.findIndex((f) => f.id === p.frameDragId)
      let idx = insertionIndex(layout, frameDragX.current)
      // dropping past its own slot: account for removal shifting indices
      if (idx > currentIdx) idx -= 1
      if (idx !== currentIdx) s.moveFrame(p.frameDragId, idx)
      s.select({ kind: 'frame', id: p.frameDragId })
    }
    frameDragX.current = null
  }

  function onWheel(e: React.WheelEvent) {
    const { sx, sy } = localPos(e)
    const wrap = wrapRef.current!
    const factor = Math.exp(-e.deltaY * 0.0012)
    zoomAt(sx, sy, factor, wrap.clientWidth, wrap.clientHeight)
  }

  // ---- HTML5 drag & drop from the catalog ----

  function onDragOver(e: React.DragEvent) {
    const s = useStore.getState()
    if (!s.dragging) return
    e.preventDefault()
    e.dataTransfer.dropEffect = 'copy'
    const { sx, sy } = localPos(e)
    const wrap = wrapRef.current!
    const w = screenToWorld(sx, sy, wrap.clientWidth, wrap.clientHeight)
    if (s.dragging.kind === 'appliance') {
      const layout = computeLayout(s.design)
      const type = getAppliance(s.dragging.typeId)
      const hit = hitTest(layout, w.x, w.y)
      let frameId: string | null = null
      if (hit?.kind === 'frame') frameId = hit.id
      if (hit?.kind === 'appliance') {
        const al = layout.appliances.find((a) => a.placed.id === hit.id)
        frameId = al?.frame.frame.id ?? null
      }
      const frame = s.design.frames.find((f) => f.id === frameId)
      dropTarget.current = frame && fitsFrame(type, frame.width) ? frame.id : null
    }
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault()
    const s = useStore.getState()
    const { sx, sy } = localPos(e)
    const wrap = wrapRef.current!
    const w = screenToWorld(sx, sy, wrap.clientWidth, wrap.clientHeight)
    if (s.dragging?.kind === 'appliance' && dropTarget.current) {
      s.placeAppliance(dropTarget.current, s.dragging.typeId)
    } else if (s.dragging?.kind === 'frame') {
      const layout = computeLayout(s.design)
      s.addFrame(s.dragging.width, insertionIndex(layout, w.x))
    }
    dropTarget.current = null
    s.setDragging(null)
  }

  function onDragLeave() {
    dropTarget.current = null
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

/** Zoom the camera so the whole kitchen is visible. Used by the toolbar. */
export function fitView() {
  const wrap = document.querySelector('.canvas-wrap') as HTMLElement | null
  if (!wrap) return
  const layout = computeLayout(useStore.getState().design)
  fitTo(layout.bounds, wrap.clientWidth, wrap.clientHeight)
}

export { FRAME_BODY_H }
