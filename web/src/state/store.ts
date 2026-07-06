import { create } from 'zustand'
import type { Design, FrameFinish, FrameWidth, GroundType, PlacedAppliance, Selection, Zone } from '../types'
import { getAppliance, fitsFrame } from '../catalog/appliances'
import { frameSpecByWidth, GROUND_TYPES } from '../catalog/frames'

export function newId(prefix: string): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 9)}`
}

export function emptyDesign(): Design {
  return {
    name: 'Untitled kitchen',
    ground: { type: 'deck', width: 360 },
    frames: [],
    appliances: [],
  }
}

/** Deep-clone a design (plain JSON data). */
const clone = (d: Design): Design => JSON.parse(JSON.stringify(d))

export type DragPayload =
  | { kind: 'appliance'; typeId: string }
  | { kind: 'frame'; width: FrameWidth }

interface BuilderState {
  design: Design
  selection: Selection
  /** id of the server-side saved design this session is editing, if any */
  savedId: number | null
  dirty: boolean
  history: Design[]
  future: Design[]
  // Transient UI state
  dragging: DragPayload | null
  hoveredFrameId: string | null
  showDims: boolean
  showGrid: boolean

  select: (s: Selection) => void
  setDragging: (d: DragPayload | null) => void
  setHoveredFrame: (id: string | null) => void
  toggleDims: () => void
  toggleGrid: () => void

  setDesign: (d: Design, savedId?: number | null) => void
  setName: (name: string) => void
  setGround: (patch: Partial<{ type: GroundType; width: number }>) => void
  addFrame: (width: FrameWidth, index?: number) => string
  removeFrame: (id: string) => void
  moveFrame: (id: string, toIndex: number) => void
  setFrameFinish: (id: string, finish: FrameFinish) => void
  setAllFinishes: (finish: FrameFinish) => void
  placeAppliance: (frameId: string, typeId: string) => boolean
  removeAppliance: (id: string) => void
  clearAll: () => void
  markSaved: (savedId: number) => void
  undo: () => void
  redo: () => void
  deleteSelection: () => void
}

const MAX_HISTORY = 100

export const useStore = create<BuilderState>((set, get) => {
  /** Snapshot current design onto the undo stack, then apply a mutation. */
  function commit(mutate: (d: Design) => void) {
    const { design, history } = get()
    const before = clone(design)
    const next = clone(design)
    mutate(next)
    set({
      design: next,
      history: [...history.slice(-MAX_HISTORY + 1), before],
      future: [],
      dirty: true,
    })
  }

  return {
    design: emptyDesign(),
    selection: { kind: 'none' },
    savedId: null,
    dirty: false,
    history: [],
    future: [],
    dragging: null,
    hoveredFrameId: null,
    showDims: true,
    showGrid: false,

    select: (selection) => set({ selection }),
    setDragging: (dragging) => set({ dragging }),
    setHoveredFrame: (hoveredFrameId) => set({ hoveredFrameId }),
    toggleDims: () => set((s) => ({ showDims: !s.showDims })),
    toggleGrid: () => set((s) => ({ showGrid: !s.showGrid })),

    setDesign: (d, savedId = null) =>
      set({ design: clone(d), savedId, dirty: false, history: [], future: [], selection: { kind: 'none' } }),

    setName: (name) => commit((d) => void (d.name = name)),

    setGround: (patch) =>
      commit((d) => {
        if (patch.type) d.ground.type = patch.type
        if (patch.width !== undefined) d.ground.width = Math.max(100, Math.min(1200, Math.round(patch.width)))
      }),

    addFrame: (width, index) => {
      const id = newId('f')
      commit((d) => {
        const finish = d.frames[0]?.finish ?? 'graphite'
        const frame = { id, width, finish }
        if (index === undefined || index >= d.frames.length) d.frames.push(frame)
        else d.frames.splice(Math.max(0, index), 0, frame)
      })
      set({ selection: { kind: 'frame', id } })
      return id
    },

    removeFrame: (id) => {
      commit((d) => {
        d.frames = d.frames.filter((f) => f.id !== id)
        d.appliances = d.appliances.filter((a) => a.frameId !== id)
      })
      set({ selection: { kind: 'none' } })
    },

    moveFrame: (id, toIndex) =>
      commit((d) => {
        const from = d.frames.findIndex((f) => f.id === id)
        if (from < 0) return
        const [f] = d.frames.splice(from, 1)
        d.frames.splice(Math.max(0, Math.min(toIndex, d.frames.length)), 0, f)
      }),

    setFrameFinish: (id, finish) =>
      commit((d) => {
        const f = d.frames.find((f) => f.id === id)
        if (f) f.finish = finish
      }),

    setAllFinishes: (finish) =>
      commit((d) => {
        for (const f of d.frames) f.finish = finish
      }),

    placeAppliance: (frameId, typeId) => {
      const { design } = get()
      const frame = design.frames.find((f) => f.id === frameId)
      const type = getAppliance(typeId)
      if (!frame || !fitsFrame(type, frame.width)) return false
      const id = newId('a')
      commit((d) => {
        // A frame holds at most one appliance per zone; replace the old one.
        d.appliances = d.appliances.filter((a) => !(a.frameId === frameId && a.zone === type.zone))
        d.appliances.push({ id, typeId, frameId, zone: type.zone })
      })
      set({ selection: { kind: 'appliance', id } })
      return true
    },

    removeAppliance: (id) => {
      commit((d) => {
        d.appliances = d.appliances.filter((a) => a.id !== id)
      })
      set({ selection: { kind: 'none' } })
    },

    clearAll: () => {
      commit((d) => {
        d.frames = []
        d.appliances = []
      })
      set({ selection: { kind: 'none' } })
    },

    markSaved: (savedId) => set({ savedId, dirty: false }),

    undo: () => {
      const { history, future, design } = get()
      if (!history.length) return
      const prev = history[history.length - 1]
      set({
        design: prev,
        history: history.slice(0, -1),
        future: [clone(design), ...future].slice(0, MAX_HISTORY),
        selection: { kind: 'none' },
        dirty: true,
      })
    },

    redo: () => {
      const { history, future, design } = get()
      if (!future.length) return
      const [next, ...rest] = future
      set({
        design: next,
        future: rest,
        history: [...history, clone(design)].slice(-MAX_HISTORY),
        selection: { kind: 'none' },
        dirty: true,
      })
    },

    deleteSelection: () => {
      const { selection, removeFrame, removeAppliance } = get()
      if (selection.kind === 'frame') removeFrame(selection.id)
      else if (selection.kind === 'appliance') removeAppliance(selection.id)
    },
  }
})

// Exposed for the QA harness (scripts/qa.mjs)
if (typeof window !== 'undefined') {
  ;(window as unknown as { __bbq: typeof useStore.getState }).__bbq = useStore.getState
}

// ---- Derived helpers ----

export function applianceForZone(design: Design, frameId: string, zone: Zone): PlacedAppliance | undefined {
  return design.appliances.find((a) => a.frameId === frameId && a.zone === zone)
}

export interface PriceLine {
  label: string
  detail: string
  qty: number
  unit: number
  total: number
}

export function priceBreakdown(design: Design): { lines: PriceLine[]; total: number } {
  const lines: PriceLine[] = []
  const g = GROUND_TYPES.find((g) => g.id === design.ground.type)
  if (g) {
    const meters = design.ground.width / 100
    lines.push({
      label: g.name,
      detail: `${design.ground.width} cm platform`,
      qty: 1,
      unit: Math.round(g.pricePerM * meters),
      total: Math.round(g.pricePerM * meters),
    })
  }
  const frameCounts = new Map<number, number>()
  for (const f of design.frames) frameCounts.set(f.width, (frameCounts.get(f.width) ?? 0) + 1)
  for (const [width, qty] of [...frameCounts.entries()].sort((a, b) => a[0] - b[0])) {
    const spec = frameSpecByWidth.get(width as FrameWidth)
    if (spec) lines.push({ label: spec.name, detail: `${width} cm module`, qty, unit: spec.price, total: spec.price * qty })
  }
  const applCounts = new Map<string, number>()
  for (const a of design.appliances) applCounts.set(a.typeId, (applCounts.get(a.typeId) ?? 0) + 1)
  for (const [typeId, qty] of applCounts) {
    const t = getAppliance(typeId)
    lines.push({ label: t.name, detail: t.brand, qty, unit: t.price, total: t.price * qty })
  }
  return { lines, total: lines.reduce((s, l) => s + l.total, 0) }
}

export function formatPrice(n: number): string {
  return '$' + n.toLocaleString('en-US')
}
