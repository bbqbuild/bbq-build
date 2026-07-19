import { useState } from 'react'

/**
 * One-per-row collapsible sub-section for dock panels (e.g. appliance
 * categories). Open state persists per `id` across sessions.
 */
export function SubSection({
  id,
  title,
  icon,
  hint,
  count,
  defaultOpen = false,
  children,
}: {
  id: string
  title: string
  icon?: string
  hint?: string
  count?: number
  defaultOpen?: boolean
  children: React.ReactNode
}) {
  const key = `bbq_sub_${id}`
  const [open, setOpen] = useState(() => {
    const v = localStorage.getItem(key)
    return v === null ? defaultOpen : v === 'open'
  })

  const toggle = () => {
    const next = !open
    setOpen(next)
    localStorage.setItem(key, next ? 'open' : 'closed')
  }

  return (
    <section className={`subsection ${open ? 'is-open' : ''}`}>
      <button className="subsection-head" onClick={toggle}>
        <span className={`chevron ${open ? 'open' : ''}`}>▸</span>
        {icon && <span className="subsection-icon">{icon}</span>}
        <span className="subsection-title">{title}</span>
        {hint && <span className="h-hint">{hint}</span>}
        {typeof count === 'number' && <span className="subsection-count">{count}</span>}
      </button>
      {open && <div className="subsection-body">{children}</div>}
    </section>
  )
}
