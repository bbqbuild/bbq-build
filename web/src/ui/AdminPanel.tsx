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

type Section = 'appliances' | 'companies'

/** Full-page back-office for admins. Nav is object-type based; filters live inside a screen. */
export function AdminPanel({ onExit }: { onExit: () => void }) {
  const [section, setSection] = useState<Section>('appliances')
  const [items, setItems] = useState<AdminAppliance[] | null>(null)
  const loadApps = () => adminListAppliances().then(setItems).catch(() => setItems([]))
  useEffect(() => {
    loadApps()
  }, [])
  const pendingCount = items?.filter((a) => a.status === 'pending').length ?? 0

  const nav: { id: Section; label: string; badge?: number }[] = [
    { id: 'appliances', label: 'Appliances', badge: pendingCount || undefined },
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
            <button key={n.id} className={section === n.id ? 'active' : ''} onClick={() => setSection(n.id)}>
              <span>{n.label}</span>
              {n.badge != null && <span className="admin-nav-badge">{n.badge}</span>}
            </button>
          ))}
        </nav>
        <main className="admin-content admin-content-wide">
          {section === 'appliances' && <AppliancesScreen items={items} reload={loadApps} />}
          {section === 'companies' && <CompaniesScreen />}
        </main>
      </div>
    </div>
  )
}

type Filter = 'all' | 'approved' | 'pending'

function AppliancesScreen({ items, reload }: { items: AdminAppliance[] | null; reload: () => void }) {
  const [filter, setFilter] = useState<Filter>('all')
  const [selectedKey, setSelectedKey] = useState<string | null>(null)
  const [url, setUrl] = useState('')
  const [busy, setBusy] = useState(false)
  const push = useToasts((s) => s.push)

  const all = items ?? []
  const counts = { all: all.length, approved: all.filter((a) => a.status === 'approved').length, pending: all.filter((a) => a.status === 'pending').length }
  const list = filter === 'all' ? all : all.filter((a) => a.status === filter)
  const selected = all.find((a) => a.key === selectedKey) ?? null

  async function scanAdd(e: React.FormEvent) {
    e.preventDefault()
    if (!url.trim() || busy) return
    setBusy(true)
    try {
      const { item } = await adminScan(url.trim())
      const type = toApplianceType(item)
      if (typeof type === 'string') push(type, 'error')
      else {
        await importAppliance(type)
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

  const act = async (fn: () => Promise<void>, msg: string) => {
    try {
      await fn()
      push(msg, 'success')
      reload()
    } catch (err) {
      push(err instanceof Error ? err.message : 'Failed', 'error')
    }
  }

  const TABS: { id: Filter; label: string }[] = [
    { id: 'all', label: `All (${counts.all})` },
    { id: 'approved', label: `Vetted (${counts.approved})` },
    { id: 'pending', label: `Pending (${counts.pending})` },
  ]

  return (
    <>
      <h2>Appliances</h2>
      <p className="admin-sub">Scan a URL to add a vetted product, or review user-submitted imports.</p>
      <form className="ai-search-row admin-scan" onSubmit={scanAdd}>
        <input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="Scan a product URL → add to the vetted list" disabled={busy} />
        <button className="btn btn-primary" type="submit" disabled={busy || !url.trim()}>
          {busy ? '…' : 'Scan & add'}
        </button>
      </form>
      <div className="admin-filter-tabs">
        {TABS.map((t) => (
          <button key={t.id} className={filter === t.id ? 'active' : ''} onClick={() => setFilter(t.id)}>
            {t.label}
          </button>
        ))}
      </div>

      <div className="admin-split">
        <ul className="admin-list">
          {!items && <li className="hint">Loading…</li>}
          {items && !list.length && <li className="hint">Nothing here.</li>}
          {list.map((a) => (
            <li
              key={a.key}
              className={`admin-row admin-row-click ${a.key === selectedKey ? 'sel' : ''}`}
              onClick={() => setSelectedKey(a.key)}
            >
              <span className="appliance-icon">{a.icon}</span>
              <div className="admin-row-main">
                <strong>{a.name}</strong>
                <span className="admin-row-meta">
                  {a.brand} · {a.minFrameWidth} cm · {formatPrice(a.price)}
                </span>
              </div>
              <span className={`admin-status admin-status-${a.status}`}>{a.status === 'pending' ? 'Pending' : 'Vetted'}</span>
            </li>
          ))}
        </ul>

        {selected ? (
          <aside className="admin-detail">
            <div className="admin-detail-head">
              <span className="appliance-icon big">{selected.icon}</span>
              <div>
                <h3>{selected.name}</h3>
                <span className={`admin-status admin-status-${selected.status}`}>{selected.status === 'pending' ? 'Pending review' : 'Vetted'}</span>
              </div>
            </div>
            <p className="admin-detail-desc">{selected.description}</p>
            <dl className="admin-detail-facts">
              <div><dt>Brand</dt><dd>{selected.brand || '—'}</dd></div>
              <div><dt>Fits frame</dt><dd>{selected.minFrameWidth} cm</dd></div>
              <div><dt>Zone</dt><dd>{selected.zone === 'base' ? 'Under counter' : 'Counter level'}</dd></div>
              <div><dt>Mount</dt><dd>{selected.mount}</dd></div>
              {selected.dims && (
                <div><dt>Cutout</dt><dd>{selected.dims.w} × {selected.dims.h} × {selected.dims.d} cm</dd></div>
              )}
              <div><dt>Price</dt><dd className="accent">{formatPrice(selected.price)}</dd></div>
              {selected.addedBy && <div><dt>Submitted by</dt><dd>{selected.addedBy}</dd></div>}
              <div><dt>ID</dt><dd className="admin-detail-id">{selected.key}</dd></div>
            </dl>
            {selected.url && (
              <a className="btn btn-ghost admin-detail-source" href={selected.url} target="_blank" rel="noreferrer">
                Open source listing ↗
              </a>
            )}
            <div className="admin-detail-actions">
              {selected.status === 'pending' && (
                <button className="btn btn-primary" onClick={() => act(() => adminApprove(selected.key), 'Approved — now available to everyone')}>
                  Approve
                </button>
              )}
              <button
                className="btn btn-danger-ghost"
                onClick={() => act(() => adminReject(selected.key).then(() => setSelectedKey(null)), 'Removed')}
              >
                {selected.status === 'pending' ? 'Reject' : 'Remove'}
              </button>
            </div>
          </aside>
        ) : (
          <aside className="admin-detail admin-detail-empty">
            <p>Select an appliance to see its full spec.</p>
          </aside>
        )}
      </div>
    </>
  )
}

function CompaniesScreen() {
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
