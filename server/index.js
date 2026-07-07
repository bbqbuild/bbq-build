const crypto = require('crypto')
const fs = require('fs')
const path = require('path')

// minimal .env loader (no dependency): KEY=VALUE lines, # comments
try {
  const envFile = fs.readFileSync(path.join(__dirname, '..', '.env'), 'utf8')
  for (const line of envFile.split('\n')) {
    const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/)
    if (m && !(m[1] in process.env)) process.env[m[1]] = m[2]
  }
} catch {}

const express = require('express')
const compression = require('compression')
const { createStorage } = require('./storage')
const ai = require('./ai')

const PORT = process.env.PORT || 8000
// Render needs 0.0.0.0; locally we stay on loopback (ports are tunnelled).
const HOST = process.env.HOST || (process.env.RENDER ? '0.0.0.0' : '127.0.0.1')

// v1: a single invited builder. Supabase-backed multi-user auth lands in v2.
const USER_EMAIL = process.env.BBQ_USER_EMAIL || 'sagirodin@gmail.com'
const USER_PASSWORD = process.env.BBQ_USER_PASSWORD || 'Ember&Oak-2417'
const SECRET = process.env.BBQ_SECRET || 'dev-secret-not-for-prod'
const SUPABASE_URL = process.env.SUPABASE_URL || ''
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || ''
const TOKEN_TTL_MS = 1000 * 60 * 60 * 24 * 30 // 30 days

function sign(payload) {
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url')
  const mac = crypto.createHmac('sha256', SECRET).update(body).digest('base64url')
  return `${body}.${mac}`
}

function verify(token) {
  if (!token) return null
  const [body, mac] = token.split('.')
  if (!body || !mac) return null
  const expected = crypto.createHmac('sha256', SECRET).update(body).digest('base64url')
  const a = Buffer.from(mac)
  const b = Buffer.from(expected)
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null
  try {
    const payload = JSON.parse(Buffer.from(body, 'base64url').toString())
    if (payload.exp < Date.now()) return null
    return payload
  } catch {
    return null
  }
}

function timingSafeEqualStr(a, b) {
  const ha = crypto.createHash('sha256').update(a).digest()
  const hb = crypto.createHash('sha256').update(b).digest()
  return crypto.timingSafeEqual(ha, hb)
}

async function main() {
  const storage = await createStorage()
  const app = express()
  app.use(compression())
  app.use(express.json({ limit: '1mb' }))

  // ---- auth (Supabase) ----
  // Legacy HMAC login kept as a fallback when Supabase isn't configured.
  app.post('/api/auth/login', (req, res) => {
    const { email, password } = req.body ?? {}
    if (
      typeof email !== 'string' ||
      typeof password !== 'string' ||
      !timingSafeEqualStr(email.toLowerCase().trim(), USER_EMAIL.toLowerCase()) ||
      !timingSafeEqualStr(password, USER_PASSWORD)
    ) {
      return res.status(401).json({ error: 'Wrong email or password' })
    }
    const token = sign({ email: USER_EMAIL, exp: Date.now() + TOKEN_TTL_MS })
    res.json({ token, email: USER_EMAIL })
  })

  // Verify a Supabase access token against the project's /auth/v1/user endpoint,
  // with a short cache to avoid a network round-trip per request.
  const tokenCache = new Map() // token -> { email, at }
  const CACHE_TTL = 60_000

  async function verifySupabase(token) {
    const hit = tokenCache.get(token)
    if (hit && Date.now() - hit.at < CACHE_TTL) return hit.email
    if (!SUPABASE_URL || !SUPABASE_ANON_KEY) return null
    try {
      const r = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
        headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${token}` },
      })
      if (!r.ok) return null
      const user = await r.json()
      const email = user?.email || user?.id
      if (email) {
        tokenCache.set(token, { email, at: Date.now() })
        if (tokenCache.size > 500) tokenCache.clear()
      }
      return email ?? null
    } catch {
      return null
    }
  }

  async function requireAuth(req, res, next) {
    const token = (req.headers.authorization || '').replace(/^Bearer\s+/i, '')
    if (!token) return res.status(401).json({ error: 'Not signed in' })
    // Supabase tokens first, then legacy HMAC
    const supaEmail = await verifySupabase(token)
    if (supaEmail) {
      req.userEmail = supaEmail
      return next()
    }
    const payload = verify(token)
    if (payload) {
      req.userEmail = payload.email
      return next()
    }
    res.status(401).json({ error: 'Not signed in' })
  }

  // Admin allow-list (comma-separated emails in ADMIN_EMAILS; defaults to the owner)
  const ADMIN_EMAILS = new Set(
    (process.env.ADMIN_EMAILS || 'sagi@frontegg.com,sagi@qipi.ai,sagirodin@gmail.com')
      .split(',')
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean),
  )
  const isAdmin = (email) => Boolean(email) && ADMIN_EMAILS.has(email.toLowerCase())
  async function requireAdmin(req, res, next) {
    await requireAuth(req, res, () => {
      if (!isAdmin(req.userEmail)) return res.status(403).json({ error: 'Admin only' })
      next()
    })
  }

  // ---- designs ----
  const designRouter = express.Router()
  designRouter.use(requireAuth)

  designRouter.get('/', async (req, res) => {
    res.json(await storage.list(req.userEmail))
  })

  designRouter.post('/', async (req, res) => {
    const { name, data } = req.body ?? {}
    if (typeof name !== 'string' || !name.trim() || typeof data !== 'object' || data === null) {
      return res.status(400).json({ error: 'name and data are required' })
    }
    res.status(201).json(await storage.create(req.userEmail, name.trim().slice(0, 120), data))
  })

  designRouter.get('/:id', async (req, res) => {
    const row = await storage.get(req.userEmail, Number(req.params.id))
    if (!row) return res.status(404).json({ error: 'Design not found' })
    res.json(row)
  })

  designRouter.put('/:id', async (req, res) => {
    const { name, data } = req.body ?? {}
    if (typeof name !== 'string' || !name.trim() || typeof data !== 'object' || data === null) {
      return res.status(400).json({ error: 'name and data are required' })
    }
    const row = await storage.update(req.userEmail, Number(req.params.id), name.trim().slice(0, 120), data)
    if (!row) return res.status(404).json({ error: 'Design not found' })
    res.json(row)
  })

  designRouter.delete('/:id', async (req, res) => {
    const ok = await storage.remove(req.userEmail, Number(req.params.id))
    if (!ok) return res.status(404).json({ error: 'Design not found' })
    res.json({ ok: true })
  })

  app.use('/api/designs', designRouter)

  // ---- AI (Gemini) ----
  const aiRouter = express.Router()
  aiRouter.use(requireAuth)

  const aiHandler = (fn) => async (req, res) => {
    try {
      res.json(await fn(req))
    } catch (err) {
      console.error('AI error:', err.message)
      res.status(err.status || 502).json({ error: err.message })
    }
  }

  aiRouter.post(
    '/appliances',
    aiHandler(async (req) => {
      const { query } = req.body ?? {}
      if (typeof query !== 'string' || query.trim().length < 2) {
        throw Object.assign(new Error('query is required'), { status: 400 })
      }
      return ai.searchAppliances(query.trim().slice(0, 200))
    }),
  )

  aiRouter.post(
    '/scan-url',
    aiHandler(async (req) => {
      const { url } = req.body ?? {}
      if (typeof url !== 'string' || !/^https?:\/\//i.test(url)) throw Object.assign(new Error('A valid http(s) URL is required'), { status: 400 })
      return ai.scanUrl(url.trim())
    }),
  )

  aiRouter.post(
    '/validate',
    aiHandler(async (req) => {
      const { design, catalogSummary } = req.body ?? {}
      if (!design || typeof design !== 'object') throw Object.assign(new Error('design is required'), { status: 400 })
      return ai.validateBuild(design, String(catalogSummary ?? '').slice(0, 8000))
    }),
  )

  aiRouter.post(
    '/chat',
    aiHandler(async (req) => {
      const { messages, design, catalogSummary } = req.body ?? {}
      if (!Array.isArray(messages) || !messages.length) throw Object.assign(new Error('messages required'), { status: 400 })
      if (!design || typeof design !== 'object') throw Object.assign(new Error('design is required'), { status: 400 })
      return ai.chat(messages, design, String(catalogSummary ?? '').slice(0, 8000))
    }),
  )

  app.use('/api/ai', aiRouter)

  // ---- shared appliance catalog (user-imported products, visible to everyone) ----
  app.get('/api/catalog/shared', async (_req, res) => {
    try {
      res.json({ items: await storage.listShared() })
    } catch (err) {
      console.error('catalog list error:', err.message)
      res.json({ items: [] })
    }
  })

  app.post('/api/catalog/import', requireAuth, async (req, res) => {
    try {
      const t = req.body ?? {}
      if (!t || typeof t.id !== 'string' || typeof t.name !== 'string' || typeof t.minFrameWidth !== 'number') {
        return res.status(400).json({ error: 'invalid appliance' })
      }
      // whitelist the fields we persist so arbitrary data can't ride along
      const clean = {
        id: t.id.slice(0, 80),
        name: String(t.name).slice(0, 120),
        shortName: String(t.shortName ?? t.name).slice(0, 40),
        brand: String(t.brand ?? '').slice(0, 60),
        zone: t.zone === 'base' ? 'base' : 'top',
        mount: String(t.mount ?? 'dropin').slice(0, 20),
        minFrameWidth: Math.max(20, Math.min(400, Math.round(t.minFrameWidth))),
        price: Math.max(0, Math.round(Number(t.price) || 0)),
        description: String(t.description ?? '').slice(0, 300),
        icon: String(t.icon ?? '📦').slice(0, 8),
        custom: true,
        ...(t.paintAs ? { paintAs: String(t.paintAs).slice(0, 40) } : {}),
        ...(t.url ? { url: String(t.url).slice(0, 500) } : {}),
        ...(t.dims && typeof t.dims === 'object'
          ? { dims: { w: Number(t.dims.w) || 0, h: Number(t.dims.h) || 0, d: Number(t.dims.d) || 0 } }
          : {}),
      }
      // admins publish straight to the vetted list; everyone else submits for review
      if (isAdmin(req.userEmail)) await storage.upsertApproved(clean.id, clean, req.userEmail)
      else await storage.addPending(clean.id, clean, req.userEmail)
      res.json({ item: clean, status: isAdmin(req.userEmail) ? 'approved' : 'pending' })
    } catch (err) {
      console.error('catalog import error:', err.message)
      res.status(500).json({ error: 'could not save' })
    }
  })

  // who am I (for showing the admin entry point)
  app.get('/api/me', requireAuth, (req, res) => res.json({ email: req.userEmail, isAdmin: isAdmin(req.userEmail) }))

  // ---- admin: appliance vetting + build companies ----
  const cleanCompany = (b) => ({
    name: String(b?.name ?? '').trim().slice(0, 120),
    region: String(b?.region ?? '').trim().slice(0, 80) || null,
    url: String(b?.url ?? '').trim().slice(0, 400) || null,
    phone: String(b?.phone ?? '').trim().slice(0, 40) || null,
    email: String(b?.email ?? '').trim().slice(0, 120) || null,
    notes: String(b?.notes ?? '').trim().slice(0, 500) || null,
  })

  const adminRouter = express.Router()
  adminRouter.use(requireAdmin)
  const adminHandler = (fn) => async (req, res) => {
    try {
      res.json(await fn(req))
    } catch (err) {
      console.error('admin error:', err.message)
      res.status(err.status || 500).json({ error: err.message })
    }
  }

  adminRouter.get('/appliances', adminHandler(async () => ({ items: await storage.listAllShared() })))
  adminRouter.post('/appliances/:key/approve', adminHandler(async (req) => ({ ok: await storage.setSharedStatus(req.params.key, 'approved') })))
  adminRouter.post('/appliances/:key/reject', adminHandler(async (req) => ({ ok: await storage.removeShared(req.params.key) })))
  adminRouter.post(
    '/scan',
    adminHandler(async (req) => {
      const { url } = req.body ?? {}
      if (typeof url !== 'string' || !/^https?:\/\//i.test(url)) throw Object.assign(new Error('A valid URL is required'), { status: 400 })
      const { item } = await ai.scanUrl(url.trim())
      return { item } // the client builds the ApplianceType and re-POSTs to /import as admin (auto-approved)
    }),
  )
  adminRouter.get('/companies', adminHandler(async () => ({ items: await storage.listCompanies() })))
  adminRouter.post(
    '/companies',
    adminHandler(async (req) => {
      const c = cleanCompany(req.body)
      if (!c.name) throw Object.assign(new Error('name is required'), { status: 400 })
      return { item: await storage.addCompany(c) }
    }),
  )
  adminRouter.delete('/companies/:id', adminHandler(async (req) => ({ ok: await storage.removeCompany(Number(req.params.id)) })))
  app.use('/api/admin', adminRouter)

  app.get('/api/health', (_req, res) =>
    res.json({ ok: true, storage: storage.kind, ai: Boolean(process.env.GEMINI_API_KEY) }),
  )

  // ---- static frontend ----
  const dist = path.join(__dirname, '..', 'web', 'dist')
  app.use(express.static(dist, { maxAge: '1h', index: 'index.html' }))
  app.get(/^\/(?!api\/).*/, (_req, res) => res.sendFile(path.join(dist, 'index.html')))

  app.listen(PORT, HOST, () => {
    console.log(`bbq.build listening on http://${HOST}:${PORT} (storage: ${storage.kind})`)
  })
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
