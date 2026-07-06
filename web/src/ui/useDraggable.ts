import { useCallback, useEffect, useRef, useState } from 'react'

export interface Pos {
  x: number
  y: number
}

/**
 * Pointer-drag positioning persisted to localStorage. Returns the current
 * position, a ref-less onPointerDown handler for the drag handle, and whether
 * a drag is in progress (to suppress click-through).
 */
export function useDraggable(key: string, initial: () => Pos, size: () => { w: number; h: number }) {
  const [pos, setPos] = useState<Pos>(() => {
    const saved = localStorage.getItem(key)
    if (saved) {
      try {
        return clamp(JSON.parse(saved), size())
      } catch {
        /* ignore */
      }
    }
    return clamp(initial(), size())
  })
  const dragging = useRef(false)
  const moved = useRef(false)
  const offset = useRef<Pos>({ x: 0, y: 0 })

  const onPointerDown = useCallback(
    (e: React.PointerEvent) => {
      // left button / touch only; don't capture so the subsequent click still fires
      if (e.button !== 0) return
      dragging.current = true
      moved.current = false
      offset.current = { x: e.clientX - pos.x, y: e.clientY - pos.y }
    },
    [pos.x, pos.y],
  )

  useEffect(() => {
    function onMove(e: PointerEvent) {
      if (!dragging.current) return
      moved.current = true
      setPos(clamp({ x: e.clientX - offset.current.x, y: e.clientY - offset.current.y }, size()))
    }
    function onUp() {
      if (!dragging.current) return
      dragging.current = false
      setPos((p) => {
        localStorage.setItem(key, JSON.stringify(p))
        return p
      })
    }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
    return () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
    }
  }, [key, size])

  // keep in-bounds on resize
  useEffect(() => {
    const onResize = () => setPos((p) => clamp(p, size()))
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [size])

  return { pos, onPointerDown, didMove: () => moved.current }
}

function clamp(p: Pos, s: { w: number; h: number }): Pos {
  const maxX = Math.max(0, window.innerWidth - s.w)
  const maxY = Math.max(0, window.innerHeight - s.h)
  return { x: Math.min(Math.max(0, p.x), maxX), y: Math.min(Math.max(0, p.y), maxY) }
}
