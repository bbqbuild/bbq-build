// Deterministic, geometry-based build checks with one-click fixes. These are
// the spatial problems the app can see and safely repair itself — complementing
// the qualitative AI review. Every fix routes through committed store actions,
// so it lands on the undo stack.

import type { Design, Frame, RunId } from '../types'
import { getAppliance } from './appliances'
import { useStore } from '../state/store'

const HEAT = /^(grill|santamaria|burner|griddle)/ // radiate heat down/sideways
const COLD = /^(fridge|kegerator|icemaker)/ // refrigeration
const GRILL = /^(grill|santamaria)/ // big cookers that need landing space
const SINK_SAFE = new Set(['doors-60', 'door-40', 'trash-40'])

export interface BuildIssue {
  id: string
  severity: 'error' | 'warning' | 'info'
  title: string
  detail: string
  /** a safe, deterministic repair the app can apply on click */
  fix?: { label: string; run: () => void }
}

/** Built-in base id an appliance paints as, for family matching. */
function baseId(typeId: string): string {
  try {
    return getAppliance(typeId).paintAs ?? typeId
  } catch {
    return typeId
  }
}

const runOf = (f: Frame): RunId => f.run ?? 'back'
const framesInRun = (d: Design, run: RunId) => d.frames.filter((f) => runOf(f) === run)
const topId = (d: Design, frameId: string) => d.appliances.find((a) => a.frameId === frameId && a.zone === 'top')?.typeId
const baseTypeId = (d: Design, frameId: string) => d.appliances.find((a) => a.frameId === frameId && a.zone === 'base')?.typeId
const frameHasHeatTop = (d: Design, frameId: string) => {
  const t = topId(d, frameId)
  return t ? HEAT.test(baseId(t)) : false
}

export function analyzeBuild(design: Design): BuildIssue[] {
  const issues: BuildIssue[] = []

  // ---- 1. refrigeration next to / under a heat source ----
  for (const a of design.appliances) {
    if (a.zone !== 'base' || !COLD.test(baseId(a.typeId))) continue
    const frame = design.frames.find((f) => f.id === a.frameId)
    if (!frame) continue
    const run = runOf(frame)
    const runFrames = framesInRun(design, run)
    const idx = runFrames.findIndex((f) => f.id === frame.id)
    const heatIdxs = runFrames.map((f, i) => (frameHasHeatTop(design, f.id) ? i : -1)).filter((i) => i >= 0)
    if (!heatIdxs.length) continue
    const adjacent = heatIdxs.some((h) => Math.abs(h - idx) <= 1)
    if (!adjacent) continue
    const cold = getAppliance(a.typeId)
    issues.push({
      id: `cold-heat-${a.id}`,
      severity: 'warning',
      title: `${cold.shortName} sits next to a heat source`,
      detail: 'Refrigeration next to a grill or burner loses efficiency and wears out faster. Move it away from the heat.',
      fix: {
        label: 'Move it away from the heat',
        run: () => {
          const nearest = heatIdxs.reduce((b, h) => (Math.abs(h - idx) < Math.abs(b - idx) ? h : b), heatIdxs[0])
          // heat at/left of the cold unit → send it to the far (right) end, else the left end
          const toIndex = nearest <= idx ? runFrames.length : 0
          useStore.getState().moveFrame(frame.id, toIndex, run)
        },
      },
    })
  }

  // ---- 2. sink without an open cabinet below (plumbing) ----
  for (const a of design.appliances) {
    if (a.zone !== 'top' || baseId(a.typeId) !== 'sink-40') continue
    const frame = design.frames.find((f) => f.id === a.frameId)
    if (!frame) continue
    const base = baseTypeId(design, frame.id)
    if (base && SINK_SAFE.has(baseId(base))) continue
    const fitId = frame.width >= 60 ? 'doors-60' : 'door-40'
    issues.push({
      id: `sink-base-${a.id}`,
      severity: base ? 'warning' : 'info',
      title: 'Sink needs an open cabinet below',
      detail: base
        ? 'The unit under the sink blocks the drain and supply lines. Swap it for doors so the plumbing has room.'
        : 'Add doors (or a trash pull-out) under the sink so the drain and water lines have room.',
      fix: {
        label: base ? 'Swap in doors below' : 'Add doors below',
        run: () => useStore.getState().placeAppliance(frame.id, fitId),
      },
    })
  }

  // ---- 3. no landing counter beside a grill ----
  for (const a of design.appliances) {
    if (a.zone !== 'top' || !GRILL.test(baseId(a.typeId))) continue
    const frame = design.frames.find((f) => f.id === a.frameId)
    if (!frame) continue
    const run = runOf(frame)
    const runFrames = framesInRun(design, run)
    const idx = runFrames.findIndex((f) => f.id === frame.id)
    const openBeside = [runFrames[idx - 1], runFrames[idx + 1]].some((n) => n && !topId(design, n.id))
    if (openBeside) continue
    const grill = getAppliance(a.typeId)
    issues.push({
      id: `landing-${a.id}`,
      severity: 'info',
      title: `No landing space beside the ${grill.shortName}`,
      detail: 'Leave open counter next to a grill to set down platters and tools. Add a small counter section beside it.',
      fix: {
        label: 'Add a counter beside it',
        run: () => useStore.getState().addFrame(40, idx + 1, false, run),
      },
    })
  }

  return issues
}
