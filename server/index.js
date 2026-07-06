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

  // ---- auth ----
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

  function requireAuth(req, res, next) {
    const header = req.headers.authorization || ''
    const payload = verify(header.replace(/^Bearer\s+/i, ''))
    if (!payload) return res.status(401).json({ error: 'Not signed in' })
    req.userEmail = payload.email
    next()
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
