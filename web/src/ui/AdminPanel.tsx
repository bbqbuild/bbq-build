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

type Page = 'appliances' | 'pending' | 'companies'

/** Full-page back-office for admins: vet imported appliances + manage build companies. */
export function AdminPanel({ onExit }: { onExit: () => void }) {
  const [page, setPage] = useState<Page>('appliances')
  const [items, setItems] = useState<AdminAppliance[] | null>(null)
  const loadApps = () => adminListAppliances().then(setItems).catch(() => setItems([]))
  useEffect(() => {
    loadApps()
  }, [])
  const pending = items?.filter((a) => a.status === 'pending') ?? []
  const vetted = items?.filter((a) => a.status === 'approved') ?? []

  const nav: { id: Page; label: string; badge?: number }[] = [
    { id: 'appliances', label: 'Vetted appliances', badge: vetted.length || undefined },
    { id: 'pending', label: 'Pending review', badge: pending.length || undefined },
    { id: 'companies', label: 'Build companies' },
  ]

  return (
    <div className="admin-page">
      <header className="admin-topbar">
        <div className="logo">
          <img src="/flame.svg" alt="" width={22} height={22} />
          <span>
            bbq<em>.build</em>
          </span>
          <span className="admin-badge">Admin</span>
        </div>
        <button className="btn btn-ghost" onClick={onExit}>
          ← Back to app
        </button>
      </header>
      <div className="admin-layout">
        <nav className="admin-nav">
          {nav.map((n) => (
            <button key={n.id} className={page === n.id ? 'active' : ''} onClick={() => setPage(n.id)}>
              <span>{n.label}</span>
              {n.badge != null && <span className="admin-nav-badge">{n.badge}</span>}
            </button>
          ))}
        </nav>
        <main className="admin-content">
          {page === 'appliances' && <VettedPage items={items} vetted={vetted} reload={loadApps} />}
          {page === 'pending' && <PendingPage pending={pending} loaded={items != null} reload={loadApps} />}
          {page === 'companies' && <CompaniesPage />}
        </main>
      </div>
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

function VettedPage({ items, vetted, reload }: { items: AdminAppliance[] | null; vetted: AdminAppliance[]; reload: () => void }) {
  const [url, setUrl] = useState('')
  const [busy, setBusy] = useState(false)
  const push = useToasts((s) => s.push)

  async function scanAdd(e: React.FormEvent) {
    e.preventDefault()
    if (!url.trim() || busy) return
    setBusy(true)
    try {
      const { item } = await adminScan(url.trim())
      const type = toApplianceType(item)
      if (typeof type === 'string') push(type, 'error')
      else {
        await importAppliance(type) // admin → auto-approved
        push(`${type.name} added to the vetted list`, 'success')
        setUrl('')
        reload()
      }
    } catch (err) {
      push(err instanceof Error ? err.message : 'Scan failed', 'error')
    } finally {
      setBusy(false)
    }
  }

  const remove = async (key: string) => {
    try {
      await adminReject(key)
      reload()
    } catch (err) {
      push(err instanceof Error ? err.message : 'Failed', 'error')
    }
  }

  return (
    <>
      <h2>Vetted appliances</h2>
      <p className="admin-sub">Products available to every user. Scan a URL to add one directly.</p>
      <form className="ai-search-row admin-scan" onSubmit={scanAdd}>
        <input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="Scan a product URL → add to the vetted list" disabled={busy} />
        <button className="btn btn-primary" type="submit" disabled={busy || !url.trim()}>
          {busy ? '…' : 'Scan & add'}
        </button>
      </form>
      {!items && <p className="hint">Loading…</p>}
      {items && (
        <ul className="admin-list">
          {vetted.map((a) => (
            <ApplianceRow key={a.key} a={a} onReject={() => remove(a.key)} />
          ))}
          {!vetted.length && <li className="hint">No vetted appliances yet.</li>}
        </ul>
      )}
    </>
  )
}

function PendingPage({ pending, loaded, reload }: { pending: AdminAppliance[]; loaded: boolean; reload: () => void }) {
  const push = useToasts((s) => s.push)
  const act = async (fn: () => Promise<void>) => {
    try {
      await fn()
      reload()
    } catch (err) {
      push(err instanceof Error ? err.message : 'Failed', 'error')
    }
  }
  return (
    <>
      <h2>Pending review</h2>
      <p className="admin-sub">User-submitted imports. Approve to publish to everyone, or reject to remove.</p>
      {!loaded && <p className="hint">Loading…</p>}
      {loaded && (
        <ul className="admin-list">
          {pending.map((a) => (
            <ApplianceRow key={a.key} a={a} onApprove={() => act(() => adminApprove(a.key))} onReject={() => act(() => adminReject(a.key))} />
          ))}
          {!pending.length && <li className="hint">Nothing waiting for review. 🎉</li>}
        </ul>
      )}
    </>
  )
}

function CompaniesPage() {
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
    <>
      <h2>Build companies</h2>
      <p className="admin-sub">Outdoor-kitchen builders users can request quotes from.</p>
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
                <button className="btn btn-danger-ghost btn-sm" onClick={() => adminRemoveCompany(c.id).then(load)}>
                  Delete
                </button>
              </div>
            </li>
          ))}
          {!items.length && <li className="hint">No companies yet.</li>}
        </ul>
      )}
    </>
  )
}
