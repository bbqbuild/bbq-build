import { useStore } from '../state/store'
import { getAppliance } from '../catalog/appliances'

/**
 * Shown when an appliance is dropped onto a frame that can't take it cleanly —
 * the slot is occupied or the unit doesn't fit. Lets the user replace the
 * existing appliance, add a fresh frame for it, or cancel the drop.
 */
export function DropDecisionModal() {
  const pending = useStore((s) => s.pendingDrop)
  const resolve = useStore((s) => s.resolvePendingDrop)
  if (!pending) return null

  const type = (() => {
    try {
      return getAppliance(pending.typeId)
    } catch {
      return null
    }
  })()
  const name = type?.name ?? 'appliance'

  return (
    <div className="modal-backdrop" onClick={() => resolve('cancel')}>
      <div className="modal" style={{ width: 'min(440px, calc(100vw - 48px))' }} onClick={(e) => e.stopPropagation()}>
        <header className="modal-head">
          <h2>Can’t drop here</h2>
        </header>
        <p style={{ margin: '0 0 4px', color: 'var(--text-dim)', lineHeight: 1.5 }}>
          {pending.reason ?? `${name} can’t go on that frame.`}
        </p>
        <p style={{ margin: '0 0 6px', color: 'var(--text-faint)', fontSize: 13 }}>What would you like to do?</p>
        <div className="modal-actions" style={{ flexWrap: 'wrap' }}>
          <button className="btn btn-ghost" onClick={() => resolve('cancel')}>
            Cancel
          </button>
          <button className="btn" onClick={() => resolve('newframe')}>
            Add a new frame
          </button>
          {pending.occupantId && pending.fits && (
            <button className="btn btn-primary" onClick={() => resolve('replace')}>
              Replace existing
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
