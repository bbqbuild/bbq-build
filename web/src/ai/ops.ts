import type { ChatOperation } from '../auth/api'
import { getAppliance } from '../catalog/appliances'
import { checkPlacement } from '../catalog/compat'
import { useStore } from '../state/store'
import type { FrameFinish, FrameWidth, GroundType, LayoutShape, RunId, Zone } from '../types'
import { FRAME_WIDTHS, runsForLayout } from '../types'

export interface OpResult {
  ok: boolean
  text: string
}

/**
 * Apply AI chat operations to the design, one by one, validating each.
 * Returns a human-readable log the chat renders as chips.
 */
export function applyOperations(ops: ChatOperation[]): OpResult[] {
  const results: OpResult[] = []
  const s = () => useStore.getState()
  const frameAt = (i: unknown) => s().design.frames[Number(i)]

  for (const o of ops) {
    try {
      switch (o.op) {
        case 'add_frame': {
          const width = Number(o.width) as FrameWidth
          if (!FRAME_WIDTHS.includes(width)) {
            results.push({ ok: false, text: `Bad frame width ${o.width}` })
            break
          }
          const index = o.index === undefined ? undefined : Number(o.index)
          const run = (o.run as RunId) || 'back'
          const d = s().design
          if (run !== 'back' && run !== 'island' && !runsForLayout(d.layout).includes(run)) {
            results.push({ ok: false, text: `The ${run} wing isn't part of the current layout` })
            break
          }
          if (run === 'island' && !d.island) s().setIsland(true)
          s().addFrame(width, index, Boolean(o.lowered), run)
          results.push({ ok: true, text: `Added ${o.lowered ? 'smoker table' : 'frame'} ${width} cm${run !== 'back' ? ` (${run})` : ''}` })
          break
        }
        case 'set_layout': {
          s().setLayout(o.layout as LayoutShape)
          results.push({ ok: true, text: `Layout → ${o.layout}` })
          break
        }
        case 'set_island': {
          s().setIsland(Boolean(o.island))
          results.push({ ok: true, text: o.island ? 'Added an island' : 'Removed the island' })
          break
        }
        case 'remove_frame': {
          const f = frameAt(o.frameIndex)
          if (!f) results.push({ ok: false, text: `No frame #${o.frameIndex}` })
          else {
            s().removeFrame(f.id)
            results.push({ ok: true, text: `Removed frame ${Number(o.frameIndex) + 1}` })
          }
          break
        }
        case 'place_appliance': {
          const f = frameAt(o.frameIndex)
          if (!f) {
            results.push({ ok: false, text: `No frame #${o.frameIndex}` })
            break
          }
          let type
          try {
            type = getAppliance(String(o.typeId))
          } catch {
            results.push({ ok: false, text: `Unknown appliance ${o.typeId}` })
            break
          }
          const check = checkPlacement(s().design, f, type)
          if (!check.ok) {
            results.push({ ok: false, text: `${type.shortName}: ${check.reason}` })
            break
          }
          s().placeAppliance(f.id, type.id)
          results.push({ ok: true, text: `Placed ${type.shortName} in frame ${Number(o.frameIndex) + 1}` })
          break
        }
        case 'remove_appliance': {
          const f = frameAt(o.frameIndex)
          const placed = f && s().design.appliances.find((a) => a.frameId === f.id && a.zone === (o.zone as Zone))
          if (!placed) {
            results.push({ ok: false, text: `Nothing in that slot` })
            break
          }
          const name = getAppliance(placed.typeId).shortName
          s().removeAppliance(placed.id)
          results.push({ ok: true, text: `Removed ${name}` })
          break
        }
        case 'set_ground': {
          const patch: { type?: GroundType; width?: number } = {}
          if (o.groundType) patch.type = o.groundType as GroundType
          if (o.groundWidth !== undefined) patch.width = Number(o.groundWidth)
          s().setGround(patch)
          results.push({ ok: true, text: `Updated ground` })
          break
        }
        case 'set_finish': {
          s().setAllFinishes(o.finish as FrameFinish)
          results.push({ ok: true, text: `Finish → ${o.finish}` })
          break
        }
        case 'set_frame_lowered': {
          const f = frameAt(o.frameIndex)
          if (!f) results.push({ ok: false, text: `No frame #${o.frameIndex}` })
          else if (!s().setFrameLowered(f.id, Boolean(o.lowered)))
            results.push({ ok: false, text: `Frame ${Number(o.frameIndex) + 1} has appliances that block that change` })
          else results.push({ ok: true, text: `Frame ${Number(o.frameIndex) + 1} ${o.lowered ? 'lowered' : 'raised'}` })
          break
        }
        case 'move_frame': {
          const f = frameAt(o.frameIndex)
          if (!f) results.push({ ok: false, text: `No frame #${o.frameIndex}` })
          else {
            s().moveFrame(f.id, Number(o.toIndex ?? 0), (o.run as RunId) || undefined)
            results.push({ ok: true, text: `Moved frame ${Number(o.frameIndex) + 1}` })
          }
          break
        }
        case 'set_name': {
          s().setName(String(o.name).slice(0, 80))
          results.push({ ok: true, text: `Renamed to “${o.name}”` })
          break
        }
        case 'clear': {
          s().clearAll()
          results.push({ ok: true, text: 'Cleared the kitchen' })
          break
        }
        default:
          results.push({ ok: false, text: `Unknown operation ${o.op}` })
      }
    } catch (e) {
      results.push({ ok: false, text: e instanceof Error ? e.message : 'Operation failed' })
    }
  }
  return results
}
