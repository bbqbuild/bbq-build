import { create } from 'zustand'
import type { CornerId, Design, FrameFinish, FrameWidth, GroundType, LayoutShape, PlacedAppliance, RunId, Selection, Zone } from '../types'
import { FRAME_WIDTHS, cornerFor, runsForLayout } from '../types'
import { getAppliance, fitsFrame, registerCustomAppliances } from '../catalog/appliances'
import { checkPlacement } from '../catalog/compat'
import type { ApplianceType } from '../types'
import { frameSpecByWidth, GROUND_TYPES, counterMaterial as counterMaterialFor } from '../catalog/frames'
import { formatLen, type Unit } from '../units'

export function newId(prefix: string): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 9)}`
}

export function emptyDesign(): Design {
  return {
    name: 'Untitled kitchen',
    ground: { type: 'concrete', width: 420, depth: 320 },
    layout: 'straight',
    island: false,
    frames: [],
    appliances: [],
  }
}

/** Deep-clone a design (plain JSON data). */
const clone = (d: Design): Design => JSON.parse(JSON.stringify(d))

export type DragPayload =
  | { kind: 'appliance'; typeId: string }
  | { kind: 'frame'; width: FrameWidth; lowered?: boolean }

/** A dropped appliance that couldn't be placed cleanly — awaiting a user choice. */
export interface PendingDrop {
  typeId: string
  frameId: string
  /** fallback run + index for "add a new frame instead" */
  run: RunId
  index?: number
  zone: Zone
  /** existing same-zone appliance id, if the slot is occupied */
  occupantId?: string
  /** whether the appliance actually fits the frame (width / mount / pairing) */
  fits: boolean
  reason?: string
}

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
  unit: Unit
  chatOpen: boolean
  viewMode: '3d' | '2d'
  measuring: boolean
  openMode: boolean

  /** shared catalog of appliances imported by any user (fetched once on load) */
  sharedCatalog: ApplianceType[]
  setSharedCatalog: (list: ApplianceType[]) => void

  select: (s: Selection) => void
  toggleChat: () => void
  toggleView: () => void
  toggleMeasure: () => void
  toggleOpen: () => void
  flipAppliance: (id: string) => void
  addCustomAppliance: (t: ApplianceType) => void
  removeCustomAppliance: (id: string) => void
  setDragging: (d: DragPayload | null) => void
  setHoveredFrame: (id: string | null) => void
  toggleDims: () => void
  toggleGrid: () => void
  toggleUnit: () => void

  setDesign: (d: Design, savedId?: number | null) => void
  setName: (name: string) => void
  setGround: (patch: Partial<{ type: GroundType; width: number; depth: number }>) => void
  setLayout: (layout: LayoutShape) => void
  setIsland: (island: boolean) => void
  addIslandCorner: (style?: 'diagonal' | 'square') => void
  setIslandCornerStyle: (style: 'diagonal' | 'square') => void
  removeIslandCorner: () => void
  setIslandPos: (x: number, z: number) => void
  addFrame: (width: number, index?: number, lowered?: boolean, run?: RunId) => string
  removeFrame: (id: string) => void
  /** absorb the adjacent (empty) frame on one side into this one; returns false if not possible */
  mergeFrame: (id: string, dir: 'left' | 'right') => boolean
  /** split this frame into two — appliances stay on the left, the right is a new empty frame */
  splitFrame: (id: string) => boolean
  moveFrame: (id: string, toIndex: number, run?: RunId) => void
  setFrameFinish: (id: string, finish: FrameFinish) => void
  setFrameLowered: (id: string, lowered: boolean) => boolean
  setFrameWidth: (id: string, width: number) => void
  setFrameHeight: (id: string, height: number) => void
  setCounterMaterial: (id: string) => void
  setAllHeights: (height: number) => void
  setPergola: (on: boolean) => void
  setIslandBar: (on: boolean) => void
  setCornerFinish: (side: CornerId, finish: FrameFinish) => void
  setCornerLowered: (side: CornerId, lowered: boolean) => void
  setCorner: (side: CornerId, present: boolean, style?: 'diagonal' | 'square') => void
  setCornerStyle: (side: CornerId, style: 'diagonal' | 'square') => void
  setCornerAppliance: (side: CornerId, typeId: string | null) => void
  setCornerBase: (side: CornerId, typeId: string | null) => void
  /** which run newly-added frames go into (drives shape via corners) */
  activeRun: RunId
  setActiveRun: (run: RunId) => void
  /** add a corner unit that opens a new wing; returns the wing run, or null if full */
  addCornerUnit: (style: 'diagonal' | 'square') => RunId | null
  setAllFinishes: (finish: FrameFinish) => void
  placeAppliance: (frameId: string, typeId: string) => boolean
  /** Drop an appliance on blank space: auto-create a compatible frame and place it. */
  addFrameForAppliance: (typeId: string, run?: RunId, index?: number) => boolean
  /** Drop onto a specific frame: place if it fits & the slot is free, else prompt. */
  tryDropAppliance: (frameId: string, typeId: string, run: RunId, index?: number) => void
  pendingDrop: PendingDrop | null
  resolvePendingDrop: (choice: 'replace' | 'newframe' | 'cancel') => void
  removeAppliance: (id: string) => void
  clearAll: () => void
  markSaved: (savedId: number) => void
  undo: () => void
  redo: () => void
  deleteSelection: () => void
}

const MAX_HISTORY = 100

export const useStore = create<BuilderState>((set, get) => {
  // Consecutive commits sharing a coalesce key collapse into ONE undo step
  // (e.g. nudging a frame's height 5× → a single undo reverts all 5).
  let lastCoalesce: string | null = null

  /** Snapshot current design onto the undo stack, then apply a mutation. */
  function commit(mutate: (d: Design) => void, coalesceKey?: string) {
    const { design, history } = get()
    const before = clone(design)
    const next = clone(design)
    mutate(next)
    const coalesce = coalesceKey != null && coalesceKey === lastCoalesce
    lastCoalesce = coalesceKey ?? null
    set({
      design: next,
      // when coalescing, keep the existing history top (pre-first-edit state)
      history: coalesce ? history : [...history.slice(-MAX_HISTORY + 1), before],
      future: [],
      dirty: true,
    })
  }

  const resetCoalesce = () => {
    lastCoalesce = null
  }

  return {
    design: emptyDesign(),
    selection: { kind: 'none' },
    savedId: null,
    pendingDrop: null,
    sharedCatalog: [],
    dirty: false,
    history: [],
    future: [],
    dragging: null,
    hoveredFrameId: null,
    showDims: true,
    showGrid: false,
    unit: (localStorage.getItem('bbq_unit') as Unit) || 'imperial',
    chatOpen: localStorage.getItem('bbq_chat') === 'open',
    viewMode: (localStorage.getItem('bbq_view') as '3d' | '2d') || '3d',
    measuring: false,
    openMode: false,

    setSharedCatalog: (list) => {
      registerCustomAppliances(list)
      set({ sharedCatalog: list })
    },

    select: (selection) => {
      resetCoalesce()
      set({ selection })
    },
    toggleView: () =>
      set((s) => {
        const viewMode = s.viewMode === '3d' ? '2d' : '3d'
        localStorage.setItem('bbq_view', viewMode)
        return { viewMode, measuring: false }
      }),
    toggleMeasure: () => set((s) => ({ measuring: !s.measuring })),
    toggleOpen: () => set((s) => ({ openMode: !s.openMode })),
    flipAppliance: (id) =>
      commit((d) => {
        const a = d.appliances.find((a) => a.id === id)
        if (a) a.flipped = !a.flipped
      }),
    toggleChat: () =>
      set((s) => {
        localStorage.setItem('bbq_chat', s.chatOpen ? 'closed' : 'open')
        return { chatOpen: !s.chatOpen }
      }),
    addCustomAppliance: (t) => {
      registerCustomAppliances([t])
      commit((d) => {
        // newest first so a freshly imported product tops the catalog list
        d.custom = [t, ...(d.custom ?? []).filter((c) => c.id !== t.id)]
      })
    },

    removeCustomAppliance: (id) => {
      // drop it from this design's personal catalog list; the shared DB copy
      // (pending review or already vetted) stays so others can still use it
      commit((d) => {
        d.custom = (d.custom ?? []).filter((c) => c.id !== id)
        d.appliances = d.appliances.filter((a) => a.typeId !== id)
      })
    },
    setDragging: (dragging) => set({ dragging }),
    setHoveredFrame: (hoveredFrameId) => set({ hoveredFrameId }),
    toggleDims: () => set((s) => ({ showDims: !s.showDims })),
    toggleGrid: () => set((s) => ({ showGrid: !s.showGrid })),
    toggleUnit: () =>
      set((s) => {
        const unit: Unit = s.unit === 'cm' ? 'imperial' : 'cm'
        localStorage.setItem('bbq_unit', unit)
        return { unit }
      }),

    setDesign: (d, savedId = null) => {
      registerCustomAppliances(d.custom)
      set({ design: clone(d), savedId, dirty: false, history: [], future: [], selection: { kind: 'none' } })
    },

    setName: (name) => commit((d) => void (d.name = name), 'name'),

    setGround: (patch) =>
      commit(
        (d) => {
          if (patch.type) d.ground.type = patch.type
          if (patch.width !== undefined) d.ground.width = Math.max(100, Math.min(1200, Math.round(patch.width)))
          if (patch.depth !== undefined) d.ground.depth = Math.max(120, Math.min(1200, Math.round(patch.depth)))
        },
        patch.width !== undefined ? 'ground-w' : patch.depth !== undefined ? 'ground-d' : undefined,
      ),

    setLayout: (layout) =>
      commit((d) => {
        d.layout = layout
        // frames stranded in removed runs fall back to the back counter
        const active = new Set(runsForLayout(layout))
        for (const f of d.frames) {
          if (f.run && f.run !== 'island' && f.run !== 'island-wing' && !active.has(f.run)) f.run = 'back'
        }
      }),

    setIsland: (island) =>
      commit((d) => {
        d.island = island
        if (!island) {
          for (const f of d.frames) if (f.run === 'island' || f.run === 'island-wing') f.run = 'back'
          delete d.islandPos
          delete d.islandCorner
        }
      }),

    addIslandCorner: (style = 'diagonal') =>
      commit((d) => {
        d.island = true
        d.islandCorner = true
        d.islandCornerStyle = style
      }),

    setIslandCornerStyle: (style) =>
      commit((d) => {
        d.islandCornerStyle = style
      }),

    removeIslandCorner: () =>
      commit((d) => {
        d.islandCorner = false
        // fold the wing back into the main island run
        for (const f of d.frames) if (f.run === 'island-wing') f.run = 'island'
      }),

    setIslandPos: (x, z) =>
      commit((d) => {
        d.islandPos = { x: Math.round(x / 5) * 5, z: Math.round(z / 5) * 5 }
      }, 'island-pos'),

    addFrame: (width, index, lowered, run = 'back') => {
      const id = newId('f')
      commit((d) => {
        const finish = d.frames[0]?.finish ?? 'graphite'
        const frame = { id, width, finish, ...(lowered ? { lowered: true } : {}), ...(run !== 'back' ? { run } : {}) }
        // index is within the run; map to a flat-array position
        const runIdxs = d.frames.map((f, i) => ((f.run ?? 'back') === run ? i : -1)).filter((i) => i >= 0)
        if (index === undefined || index >= runIdxs.length) {
          const after = runIdxs.length ? runIdxs[runIdxs.length - 1] + 1 : d.frames.length
          d.frames.splice(after, 0, frame)
        } else {
          d.frames.splice(runIdxs[Math.max(0, index)], 0, frame)
        }
      })
      set({ selection: { kind: 'frame', id } })
      return id
    },

    setFrameWidth: (id, width) =>
      commit((d) => {
        const f = d.frames.find((f) => f.id === id)
        if (f) f.width = Math.max(20, Math.min(200, Math.round(width)))
      }, `fw:${id}`),

    setFrameHeight: (id, height) =>
      commit((d) => {
        const f = d.frames.find((f) => f.id === id)
        if (f) f.height = Math.max(45, Math.min(140, Math.round(height)))
      }, `fh:${id}`),

    activeRun: 'back',
    setActiveRun: (activeRun) => set({ activeRun }),

    addCornerUnit: (style) => {
      const { design } = get()
      const layout = design.layout ?? 'straight'
      const finish = design.frames[0]?.finish ?? 'graphite'
      let wing: RunId | null = null
      let nextLayout: LayoutShape = layout
      let side: CornerId | null = null
      if (layout === 'straight') {
        nextLayout = 'l-right'
        side = 'right'
        wing = 'right'
      } else if (layout === 'l-right') {
        nextLayout = 'u'
        side = 'left'
        wing = 'left'
      } else if (layout === 'l-left') {
        nextLayout = 'u'
        side = 'right'
        wing = 'right'
      } else {
        return null // U already has both corners
      }
      commit((d) => {
        d.layout = nextLayout
        d.corners = d.corners ?? {}
        d.corners[side!] = { finish, style }
      })
      set({ activeRun: wing })
      return wing
    },

    setCornerStyle: (side, style) =>
      commit((d) => {
        d.corners = d.corners ?? {}
        d.corners[side] = { ...(d.corners[side] ?? { finish: d.frames[0]?.finish ?? 'graphite' }), style }
      }),

    setCornerAppliance: (side, typeId) =>
      commit((d) => {
        d.corners = d.corners ?? {}
        const cur = d.corners[side] ?? { finish: d.frames[0]?.finish ?? 'graphite' }
        d.corners[side] = { ...cur, top: typeId ?? undefined }
      }),

    setCornerBase: (side, typeId) =>
      commit((d) => {
        d.corners = d.corners ?? {}
        const cur = d.corners[side] ?? { finish: d.frames[0]?.finish ?? 'graphite' }
        d.corners[side] = { ...cur, base: typeId ?? undefined }
      }),

    setCounterMaterial: (id) =>
      commit((d) => {
        d.counterMaterial = id
      }),

    setPergola: (on) =>
      commit((d) => {
        d.pergola = on
      }),

    setIslandBar: (on) =>
      commit((d) => {
        d.islandBar = on
        if (on && !d.island) d.island = true
      }),

    setAllHeights: (height) =>
      commit((d) => {
        const h = Math.max(45, Math.min(140, Math.round(height)))
        for (const f of d.frames) f.height = h
      }, 'all-heights'),

    setCornerFinish: (side, finish) =>
      commit((d) => {
        d.corners = d.corners ?? {}
        d.corners[side] = { ...(d.corners[side] ?? { finish }), finish }
      }),

    setCornerLowered: (side, lowered) =>
      commit((d) => {
        d.corners = d.corners ?? {}
        const cur = d.corners[side] ?? { finish: d.frames[0]?.finish ?? 'graphite' }
        d.corners[side] = { ...cur, lowered }
      }),

    setCorner: (side, present, style = 'diagonal') => {
      commit((d) => {
        d.corners = d.corners ?? {}
        d.corners[side] = present ? { finish: d.frames[0]?.finish ?? 'graphite', style } : null
      })
      set({ selection: present ? { kind: 'corner', id: side } : { kind: 'none' } })
    },

    setFrameLowered: (id, lowered) => {
      const { design } = get()
      const frame = design.frames.find((f) => f.id === id)
      if (!frame || Boolean(frame.lowered) === lowered) return true
      // block the toggle if a current occupant would become invalid
      for (const a of design.appliances.filter((a) => a.frameId === id)) {
        const type = getAppliance(a.typeId)
        if (!checkPlacement(design, { ...frame, lowered }, type).ok) return false
      }
      commit((d) => {
        const f = d.frames.find((f) => f.id === id)
        if (f) f.lowered = lowered
      })
      return true
    },

    removeFrame: (id) => {
      commit((d) => {
        d.frames = d.frames.filter((f) => f.id !== id)
        d.appliances = d.appliances.filter((a) => a.frameId !== id)
      })
      set({ selection: { kind: 'none' } })
    },

    mergeFrame: (id, dir) => {
      const { design } = get()
      const frame = design.frames.find((f) => f.id === id)
      if (!frame) return false
      const run = frame.run ?? 'back'
      const runFrames = design.frames.filter((f) => (f.run ?? 'back') === run)
      const idx = runFrames.findIndex((f) => f.id === id)
      const neighbor = dir === 'left' ? runFrames[idx - 1] : runFrames[idx + 1]
      // only merge an existing, EMPTY neighbour (no appliance in either zone)
      if (!neighbor || design.appliances.some((a) => a.frameId === neighbor.id)) return false
      commit((d) => {
        const f = d.frames.find((x) => x.id === id)!
        f.width += neighbor.width
        d.frames = d.frames.filter((x) => x.id !== neighbor.id)
      })
      set({ selection: { kind: 'frame', id } })
      return true
    },

    splitFrame: (id) => {
      const { design } = get()
      const frame = design.frames.find((f) => f.id === id)
      if (!frame) return false
      const appls = design.appliances.filter((a) => a.frameId === id)
      // the appliances keep a valid footprint on the left; the rest becomes a new empty frame
      const minLeft = appls.reduce((m, a) => Math.max(m, getAppliance(a.typeId).minFrameWidth), 20)
      const leftW = appls.length ? minLeft : Math.round(frame.width / 2)
      const rightW = frame.width - leftW
      if (leftW < 20 || rightW < 20) return false // not enough room for two frames
      commit((d) => {
        const f = d.frames.find((x) => x.id === id)!
        f.width = leftW
        const nf = {
          id: newId('f'),
          width: rightW,
          finish: f.finish,
          ...(f.lowered ? { lowered: true } : {}),
          ...(f.run && f.run !== 'back' ? { run: f.run } : {}),
        }
        const idx = d.frames.findIndex((x) => x.id === id)
        d.frames.splice(idx + 1, 0, nf)
      })
      set({ selection: { kind: 'frame', id } })
      return true
    },

    moveFrame: (id, toIndex, run) =>
      commit((d) => {
        const from = d.frames.findIndex((f) => f.id === id)
        if (from < 0) return
        const [f] = d.frames.splice(from, 1)
        const targetRun = run ?? f.run ?? 'back'
        if (targetRun === 'back') delete f.run
        else f.run = targetRun
        const runIdxs = d.frames.map((fr, i) => ((fr.run ?? 'back') === targetRun ? i : -1)).filter((i) => i >= 0)
        const clamped = Math.max(0, Math.min(toIndex, runIdxs.length))
        if (clamped >= runIdxs.length) {
          const after = runIdxs.length ? runIdxs[runIdxs.length - 1] + 1 : d.frames.length
          d.frames.splice(after, 0, f)
        } else {
          d.frames.splice(runIdxs[clamped], 0, f)
        }
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
      if (!frame || !checkPlacement(design, frame, type).ok) return false
      const id = newId('a')
      commit((d) => {
        // A frame holds at most one appliance per zone; replace the old one.
        d.appliances = d.appliances.filter((a) => !(a.frameId === frameId && a.zone === type.zone))
        d.appliances.push({ id, typeId, frameId, zone: type.zone })
      })
      set({ selection: { kind: 'appliance', id } })
      return true
    },

    addFrameForAppliance: (typeId, run = 'back', index) => {
      let type
      try {
        type = getAppliance(typeId)
      } catch {
        return false
      }
      // smallest standard width that fits, else a custom width for odd units
      const std = FRAME_WIDTHS.find((w) => w >= type.minFrameWidth)
      const width = (std ?? Math.ceil(type.minFrameWidth / 5) * 5) as FrameWidth
      const lowered = type.mount === 'kamado'
      const { addFrame, placeAppliance } = get()
      const frameId = addFrame(width, index, lowered, run)
      const ok = placeAppliance(frameId, typeId)
      if (!ok) {
        // shouldn't happen (frame was sized for it), but don't leave an orphan frame
        get().removeFrame(frameId)
        return false
      }
      return true
    },

    tryDropAppliance: (frameId, typeId, run, index) => {
      const { design } = get()
      const frame = design.frames.find((f) => f.id === frameId)
      let type
      try {
        type = getAppliance(typeId)
      } catch {
        return
      }
      if (!frame) {
        get().addFrameForAppliance(typeId, run, index)
        return
      }
      const check = checkPlacement(design, frame, type)
      const occupant = design.appliances.find((a) => a.frameId === frameId && a.zone === type.zone)
      // clean placement: fits and the zone slot is free → just drop it in
      if (check.ok && !occupant) {
        get().placeAppliance(frameId, typeId)
        return
      }
      // otherwise ask the user what to do
      set({
        pendingDrop: {
          typeId,
          frameId,
          run,
          index,
          zone: type.zone,
          occupantId: occupant?.id,
          fits: check.ok,
          reason: !check.ok
            ? check.reason
            : occupant
              ? `That frame already has ${getAppliance(occupant.typeId).shortName} on ${type.zone === 'top' ? 'the counter' : 'the base'}.`
              : undefined,
        },
      })
    },

    resolvePendingDrop: (choice) => {
      const { pendingDrop } = get()
      if (!pendingDrop) return
      set({ pendingDrop: null })
      if (choice === 'cancel') return
      if (choice === 'replace' && pendingDrop.fits) {
        get().placeAppliance(pendingDrop.frameId, pendingDrop.typeId) // replaces same-zone occupant
      } else if (choice === 'newframe') {
        get().addFrameForAppliance(pendingDrop.typeId, pendingDrop.run, pendingDrop.index)
      }
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
      resetCoalesce()
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
      resetCoalesce()
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

export function priceBreakdown(design: Design, unit: Unit = 'cm'): { lines: PriceLine[]; total: number } {
  const lines: PriceLine[] = []
  const g = GROUND_TYPES.find((g) => g.id === design.ground.type)
  if (g) {
    const depth = design.ground.depth ?? 300
    const sqm = (design.ground.width / 100) * (depth / 100)
    const price = Math.round((g.pricePerM * sqm) / 3)
    lines.push({
      label: g.name,
      detail: `${formatLen(design.ground.width, unit)} × ${formatLen(depth, unit)} platform`,
      qty: 1,
      unit: price,
      total: price,
    })
  }
  const frameCounts = new Map<string, number>()
  for (const f of design.frames) {
    const key = `${f.width}${f.lowered ? ':low' : ''}`
    frameCounts.set(key, (frameCounts.get(key) ?? 0) + 1)
  }
  for (const [key, qty] of [...frameCounts.entries()].sort()) {
    const [w, low] = key.split(':')
    const width = Number(w)
    const spec = frameSpecByWidth.get(width as FrameWidth)
    // custom widths: price ~ $4.6/cm (matches the preset ladder)
    const basePrice = spec ? spec.price : Math.round(width * 4.6 + 110)
    const price = low ? basePrice + 60 : basePrice
    lines.push({
      label: low ? `Smoker Table ${width}` : spec ? spec.name : `Custom Frame ${width}`,
      detail: `${formatLen(width, unit)} ${low ? 'lowered table' : 'module'}`,
      qty,
      unit: price,
      total: price * qty,
    })
  }
  // countertop material surcharge over total run length
  const cmat = counterMaterialFor(design.counterMaterial)
  const runM = design.frames.reduce((s, f) => s + f.width, 0) / 100
  if (runM > 0 && cmat.pricePerM > 0) {
    const total = Math.round(cmat.pricePerM * runM)
    lines.push({ label: `${cmat.name} counter`, detail: `${formatLen(design.frames.reduce((s,f)=>s+f.width,0), unit)} run`, qty: 1, unit: total, total })
  }
  const corners = (['left', 'right'] as const).filter((s) => cornerFor(design, s)).length
  if (corners) {
    lines.push({
      label: 'Corner unit',
      detail: `${formatLen(90, unit)} diagonal junction cabinet`,
      qty: corners,
      unit: 350,
      total: 350 * corners,
    })
  }
  const applCounts = new Map<string, number>()
  for (const a of design.appliances) applCounts.set(a.typeId, (applCounts.get(a.typeId) ?? 0) + 1)
  for (const side of ['left', 'right'] as const) {
    const c = cornerFor(design, side)
    if (c?.top) applCounts.set(c.top, (applCounts.get(c.top) ?? 0) + 1)
    if (c?.base) applCounts.set(c.base, (applCounts.get(c.base) ?? 0) + 1)
  }
  for (const [typeId, qty] of applCounts) {
    const t = getAppliance(typeId)
    lines.push({ label: t.name, detail: t.brand, qty, unit: t.price, total: t.price * qty })
  }
  return { lines, total: lines.reduce((s, l) => s + l.total, 0) }
}

export function formatPrice(n: number): string {
  return '$' + n.toLocaleString('en-US')
}
