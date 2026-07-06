import { useEffect, useState } from 'react'
import { aiValidate, type ValidationReport } from '../auth/api'
import { catalogSummary } from '../catalog/appliances'
import { useStore } from '../state/store'

const SEV_ICON = { error: '⛔', warning: '⚠️', info: 'ℹ️' } as const

export function ValidateModal({ onClose }: { onClose: () => void }) {
  const [report, setReport] = useState<ValidationReport | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const design = useStore.getState().design
    aiValidate(design, catalogSummary(design.custom ?? []))
      .then(setReport)
      .catch((e) => setError(e instanceof Error ? e.message : 'Validation failed'))
  }, [])

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <header className="modal-head">
          <h2>AI build check</h2>
          <button className="btn btn-icon" onClick={onClose}>
            ✕
          </button>
        </header>
        {!report && !error && (
          <div className="validate-loading">
            <div className="chat-typing">
              <span />
              <span />
              <span />
            </div>
            <p className="hint">Gemini is reviewing clearances, utilities and workflow…</p>
          </div>
        )}
        {error && <div className="login-error">{error}</div>}
        {report && (
          <div className="validate-report">
            <div className="validate-header">
              <div className={`validate-score ${report.feasible ? 'good' : 'bad'}`}>
                <strong>{Math.round(report.score)}</strong>
                <span>/100</span>
              </div>
              <div>
                <div className={`validate-verdict ${report.feasible ? 'good' : 'bad'}`}>
                  {report.feasible ? '✓ Buildable' : '✕ Not buildable yet'}
                </div>
                <p className="validate-summary">{report.summary}</p>
              </div>
            </div>
            {report.issues?.length > 0 && (
              <ul className="validate-issues">
                {report.issues.map((i, k) => (
                  <li key={k} className={`sev-${i.severity}`}>
                    <span>{SEV_ICON[i.severity] ?? 'ℹ️'}</span> {i.message}
                  </li>
                ))}
              </ul>
            )}
            {report.suggestions?.length > 0 && (
              <>
                <h3>Suggestions</h3>
                <ul className="validate-suggestions">
                  {report.suggestions.map((s, k) => (
                    <li key={k}>{s}</li>
                  ))}
                </ul>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
