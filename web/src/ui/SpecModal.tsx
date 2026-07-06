import { formatPrice, priceBreakdown, useStore } from '../state/store'

export function SpecModal({ onClose }: { onClose: () => void }) {
  const design = useStore((s) => s.design)
  const { lines, total } = priceBreakdown(design)

  function exportJson() {
    const spec = {
      generator: 'bbq.build v1',
      exportedAt: new Date().toISOString(),
      design,
      billOfMaterials: lines,
      totalUsd: total,
    }
    const blob = new Blob([JSON.stringify(spec, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${design.name.replace(/\s+/g, '-').toLowerCase() || 'kitchen'}-spec.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <header className="modal-head">
          <h2>Spec sheet</h2>
          <button className="btn btn-icon" onClick={onClose}>
            ✕
          </button>
        </header>
        <p className="hint">
          {design.name} · {design.frames.length} frames ·{' '}
          {design.frames.reduce((s, f) => s + f.width, 0)} cm run
        </p>
        <table className="spec-table">
          <thead>
            <tr>
              <th>Item</th>
              <th>Detail</th>
              <th className="num">Qty</th>
              <th className="num">Unit</th>
              <th className="num">Total</th>
            </tr>
          </thead>
          <tbody>
            {lines.map((l, i) => (
              <tr key={i}>
                <td>{l.label}</td>
                <td className="dim">{l.detail}</td>
                <td className="num">{l.qty}</td>
                <td className="num">{formatPrice(l.unit)}</td>
                <td className="num">{formatPrice(l.total)}</td>
              </tr>
            ))}
            {!lines.length && (
              <tr>
                <td colSpan={5} className="dim">
                  Nothing here yet — add frames and appliances.
                </td>
              </tr>
            )}
          </tbody>
          <tfoot>
            <tr>
              <td colSpan={4}>Estimated total</td>
              <td className="num accent">{formatPrice(total)}</td>
            </tr>
          </tfoot>
        </table>
        <p className="hint">v3 preview: this spec will be sendable to local shops for real quotes.</p>
        <div className="modal-actions">
          <button className="btn btn-ghost" onClick={exportJson}>
            Export JSON
          </button>
          <button className="btn btn-primary" onClick={onClose}>
            Done
          </button>
        </div>
      </div>
    </div>
  )
}
