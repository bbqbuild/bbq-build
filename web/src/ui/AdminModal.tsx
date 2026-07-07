import { useEffect, useState } from 'react'
import {
  adminAddCompany,
  adminApprove,
  adminListAppliances,
  adminListCompanies,
  adminReject,
  adminRemoveCompany,
  adminScan,
  importAppliance,
  type AdminAppliance,
  type Company,
} from '../auth/api'
import { toApplianceType } from '../catalog/aiProducts'
import { formatPrice } from '../state/store'
import { useToasts } from './toast'

type Tab = 'appliances' | 'companies'

export function AdminModal({ onClose }: { onClose: () => void }) {
  const [tab, setTab] = useState<Tab>('appliances')
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal modal-wide" onClick={(e) => e.stopPropagation()}>
        <header className="modal-head">
          <h2>Admin</h2>
          <button className="btn btn-icon" onClick={onClose}>
            ✕
          </button>
        </header>
        <div className="tabs" style={{ marginBottom: 12 }}>
          <button className={tab === 'appliances' ? 'active' : ''} onClick={() => setTab('appliances')}>
            Appliances
          </button>
          <button className={tab === 'companies' ? 'active' : ''} onClick={() => setTab('companies')}>
            Build companies
          </button>
        </div>
        {tab === 'appliances' ? <AppliancesAdmin /> : <CompaniesAdmin />}
      </div>
    </div>
  )
}

function AppliancesAdmin() {
  const [items, setItems] = useState<AdminAppliance[] | null>(null)
  const [url, setUrl] = useState('')
  const [busy, setBusy] = useState(false)
  const push = useToasts((s) => s.push)

  const load = () => adminListAppliances().then(setItems).catch(() => setItems([]))
  useEffect(() => {
    load()
  }, [])

  async function scanAdd(e: React.FormEvent) {
    e.preventDefault()
    if (!url.trim() || busy) return
    setBusy(true)
    try {
      const { item } = await adminScan(url.trim())
      const type = toApplianceType(item)
      if (typeof type === 'string') {
        push(type, 'error')
      } else {
        await importAppliance(type) // admin → auto-approved into the vetted list
        push(`${type.name} added to the vetted list`, 'success')
        setUrl('')
        load()
      }
    } catch (err) {
      push(err instanceof Error ? err.message : 'Scan failed', 'error')
    } finally {
      setBusy(false)
    }
  }

  const act = async (fn: () => Promise<void>) => {
    try {
      await fn()
      load()
    } catch (err) {
      push(err instanceof Error ? err.message : 'Failed', 'error')
    }
  }

  const pending = items?.filter((a) => a.status === 'pending') ?? []
  const approved = items?.filter((a) => a.status === 'approved') ?? []

  return (
    <div className="admin-body">
      <form className="ai-search-row" onSubmit={scanAdd}>
        <input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="Scan a product URL → add to the vetted list" disabled={busy} />
        <button className="btn btn-primary" type="submit" disabled={busy || !url.trim()}>
          {busy ? '…' : 'Scan & add'}
        </button>
      </form>

      {!items && <p className="hint">Loading…</p>}
      {items && (
        <>
          {pending.length > 0 && (
            <>
              <h3>Pending review ({pending.length})</h3>
              <ul className="admin-list">
                {pending.map((a) => (
                  <ApplianceRow key={a.key} a={a} onApprove={() => act(() => adminApprove(a.key))} onReject={() => act(() => adminReject(a.key))} />
                ))}
              </ul>
            </>
          )}
          <h3>Vetted list ({approved.length})</h3>
          <ul className="admin-list">
            {approved.map((a) => (
              <ApplianceRow key={a.key} a={a} onReject={() => act(() => adminReject(a.key))} />
            ))}
            {!approved.length && <li className="hint">No vetted appliances yet.</li>}
          </ul>
        </>
      )}
    </div>
  )
}

function ApplianceRow({ a, onApprove, onReject }: { a: AdminAppliance; onApprove?: () => void; onReject?: () => void }) {
  return (
    <li className="admin-row">
      <span className="appliance-icon">{a.icon}</span>
      <div className="admin-row-main">
        <strong>{a.name}</strong>
        <span className="admin-row-meta">
          {a.brand} · {a.minFrameWidth} cm · {formatPrice(a.price)}
          {a.dims ? ` · cutout ${a.dims.w}×${a.dims.h}×${a.dims.d}` : ''}
          {a.addedBy ? ` · by ${a.addedBy}` : ''}
        </span>
        {a.url && (
          <a className="admin-row-link" href={a.url} target="_blank" rel="noreferrer">
            source ↗
          </a>
        )}
      </div>
      <div className="admin-row-actions">
        {onApprove && (
          <button className="btn btn-primary btn-sm" onClick={onApprove}>
            Approve
          </button>
        )}
        {onReject && (
          <button className="btn btn-danger-ghost btn-sm" onClick={onReject}>
            {onApprove ? 'Reject' : 'Remove'}
          </button>
        )}
      </div>
    </li>
  )
}

function CompaniesAdmin() {
  const [items, setItems] = useState<Company[] | null>(null)
  const [form, setForm] = useState({ name: '', region: '', url: '', phone: '', email: '', notes: '' })
  const push = useToasts((s) => s.push)
  const load = () => adminListCompanies().then(setItems).catch(() => setItems([]))
  useEffect(() => {
    load()
  }, [])

  async function add(e: React.FormEvent) {
    e.preventDefault()
    if (!form.name.trim()) return
    try {
      await adminAddCompany(form)
      setForm({ name: '', region: '', url: '', phone: '', email: '', notes: '' })
      load()
    } catch (err) {
      push(err instanceof Error ? err.message : 'Failed', 'error')
    }
  }

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) => setForm((f) => ({ ...f, [k]: e.target.value }))

  return (
    <div className="admin-body">
      <form className="admin-company-form" onSubmit={add}>
        <input placeholder="Company name *" value={form.name} onChange={set('name')} />
        <input placeholder="Region / city" value={form.region} onChange={set('region')} />
        <input placeholder="Website" value={form.url} onChange={set('url')} />
        <input placeholder="Phone" value={form.phone} onChange={set('phone')} />
        <input placeholder="Email" value={form.email} onChange={set('email')} />
        <input placeholder="Notes" value={form.notes} onChange={set('notes')} />
        <button className="btn btn-primary" type="submit" disabled={!form.name.trim()}>
          Add company
        </button>
      </form>
      {!items && <p className="hint">Loading…</p>}
      {items && (
        <ul className="admin-list">
          {items.map((c) => (
            <li key={c.id} className="admin-row">
              <div className="admin-row-main">
                <strong>{c.name}</strong>
                <span className="admin-row-meta">
                  {[c.region, c.phone, c.email].filter(Boolean).join(' · ')}
                  {c.notes ? ` — ${c.notes}` : ''}
                </span>
                {c.url && (
                  <a className="admin-row-link" href={c.url} target="_blank" rel="noreferrer">
                    {c.url} ↗
                  </a>
                )}
              </div>
              <div className="admin-row-actions">
                <button
                  className="btn btn-danger-ghost btn-sm"
                  onClick={() => adminRemoveCompany(c.id).then(load)}
                >
                  Delete
                </button>
              </div>
            </li>
          ))}
          {!items.length && <li className="hint">No companies yet — add outdoor-kitchen builders to request quotes from.</li>}
        </ul>
      )}
    </div>
  )
}
