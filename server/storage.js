// Storage layer: Postgres when DATABASE_URL is set (Render), SQLite otherwise (local dev).
// Both expose the same async API.

const path = require('path')

async function createStorage() {
  if (process.env.DATABASE_URL) {
    const { Pool } = require('pg')
    const pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: process.env.DATABASE_URL.includes('localhost') ? false : { rejectUnauthorized: false },
    })
    await pool.query(`
      CREATE TABLE IF NOT EXISTS designs (
        id SERIAL PRIMARY KEY,
        user_email TEXT NOT NULL,
        name TEXT NOT NULL,
        data JSONB NOT NULL,
        created_at TIMESTAMP NOT NULL DEFAULT now(),
        updated_at TIMESTAMP NOT NULL DEFAULT now()
      )
    `)
    // shared catalog of user-imported appliances — 'approved' ones are visible to
    // everyone; 'pending' ones await admin vetting.
    await pool.query(`
      CREATE TABLE IF NOT EXISTS shared_appliances (
        id SERIAL PRIMARY KEY,
        key TEXT UNIQUE NOT NULL,
        data JSONB NOT NULL,
        status TEXT NOT NULL DEFAULT 'approved',
        added_by TEXT,
        created_at TIMESTAMP NOT NULL DEFAULT now()
      )
    `)
    await pool.query(`ALTER TABLE shared_appliances ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'approved'`)
    await pool.query(`ALTER TABLE shared_appliances ADD COLUMN IF NOT EXISTS added_by TEXT`)
    // outdoor-kitchen build companies to send quote requests to
    await pool.query(`
      CREATE TABLE IF NOT EXISTS companies (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL,
        region TEXT,
        url TEXT,
        phone TEXT,
        email TEXT,
        notes TEXT,
        created_at TIMESTAMP NOT NULL DEFAULT now()
      )
    `)
    return {
      kind: 'postgres',
      async listShared() {
        const { rows } = await pool.query(
          `SELECT data FROM shared_appliances WHERE status = 'approved' ORDER BY created_at DESC LIMIT 500`,
        )
        return rows.map((r) => r.data)
      },
      async listAllShared() {
        const { rows } = await pool.query(
          `SELECT key, data, status, added_by, created_at FROM shared_appliances
           ORDER BY (status = 'pending') DESC, created_at DESC LIMIT 1000`,
        )
        return rows.map((r) => ({ ...r.data, key: r.key, status: r.status, addedBy: r.added_by, createdAt: r.created_at }))
      },
      async addPending(key, data, email) {
        // never downgrade an existing (possibly approved) entry
        await pool.query(
          `INSERT INTO shared_appliances (key, data, status, added_by) VALUES ($1, $2, 'pending', $3)
           ON CONFLICT (key) DO NOTHING`,
          [key, JSON.stringify(data), email ?? null],
        )
      },
      async upsertApproved(key, data, email) {
        await pool.query(
          `INSERT INTO shared_appliances (key, data, status, added_by) VALUES ($1, $2, 'approved', $3)
           ON CONFLICT (key) DO UPDATE SET data = $2, status = 'approved'`,
          [key, JSON.stringify(data), email ?? null],
        )
        return data
      },
      async setSharedStatus(key, status) {
        const res = await pool.query('UPDATE shared_appliances SET status = $2 WHERE key = $1', [key, status])
        return res.rowCount > 0
      },
      async removeShared(key) {
        const res = await pool.query('DELETE FROM shared_appliances WHERE key = $1', [key])
        return res.rowCount > 0
      },
      async listCompanies() {
        const { rows } = await pool.query('SELECT * FROM companies ORDER BY created_at DESC LIMIT 500')
        return rows
      },
      async addCompany(c) {
        const { rows } = await pool.query(
          `INSERT INTO companies (name, region, url, phone, email, notes) VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
          [c.name, c.region ?? null, c.url ?? null, c.phone ?? null, c.email ?? null, c.notes ?? null],
        )
        return rows[0]
      },
      async removeCompany(id) {
        const res = await pool.query('DELETE FROM companies WHERE id = $1', [id])
        return res.rowCount > 0
      },
      async list(email) {
        const { rows } = await pool.query(
          'SELECT id, name, data, updated_at FROM designs WHERE user_email = $1 ORDER BY updated_at DESC',
          [email],
        )
        return rows
      },
      async get(email, id) {
        const { rows } = await pool.query(
          'SELECT id, name, data, updated_at FROM designs WHERE user_email = $1 AND id = $2',
          [email, id],
        )
        return rows[0] ?? null
      },
      async create(email, name, data) {
        const { rows } = await pool.query(
          'INSERT INTO designs (user_email, name, data) VALUES ($1, $2, $3) RETURNING id, name, data, updated_at',
          [email, name, JSON.stringify(data)],
        )
        return rows[0]
      },
      async update(email, id, name, data) {
        const { rows } = await pool.query(
          `UPDATE designs SET name = $3, data = $4, updated_at = now()
           WHERE user_email = $1 AND id = $2 RETURNING id, name, data, updated_at`,
          [email, id, name, JSON.stringify(data)],
        )
        return rows[0] ?? null
      },
      async remove(email, id) {
        const res = await pool.query('DELETE FROM designs WHERE user_email = $1 AND id = $2', [email, id])
        return res.rowCount > 0
      },
    }
  }

  const Database = require('better-sqlite3')
  const file = process.env.SQLITE_PATH || path.join(__dirname, 'bbq.sqlite')
  const db = new Database(file)
  db.pragma('journal_mode = WAL')
  db.exec(`
    CREATE TABLE IF NOT EXISTS designs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_email TEXT NOT NULL,
      name TEXT NOT NULL,
      data TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `)
  db.exec(`
    CREATE TABLE IF NOT EXISTS shared_appliances (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      key TEXT UNIQUE NOT NULL,
      data TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'approved',
      added_by TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `)
  // migrate older tables that predate the status/added_by columns
  for (const col of ["status TEXT NOT NULL DEFAULT 'approved'", 'added_by TEXT']) {
    try {
      db.exec(`ALTER TABLE shared_appliances ADD COLUMN ${col}`)
    } catch {
      /* column already exists */
    }
  }
  db.exec(`
    CREATE TABLE IF NOT EXISTS companies (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      region TEXT, url TEXT, phone TEXT, email TEXT, notes TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `)
  const parse = (row) => row && { ...row, data: JSON.parse(row.data) }
  return {
    kind: 'sqlite',
    async listShared() {
      return db
        .prepare(`SELECT data FROM shared_appliances WHERE status = 'approved' ORDER BY created_at DESC LIMIT 500`)
        .all()
        .map((r) => JSON.parse(r.data))
    },
    async listAllShared() {
      return db
        .prepare(`SELECT key, data, status, added_by, created_at FROM shared_appliances
                  ORDER BY (status = 'pending') DESC, created_at DESC LIMIT 1000`)
        .all()
        .map((r) => ({ ...JSON.parse(r.data), key: r.key, status: r.status, addedBy: r.added_by, createdAt: r.created_at }))
    },
    async addPending(key, data, email) {
      db.prepare(
        `INSERT INTO shared_appliances (key, data, status, added_by) VALUES (?, ?, 'pending', ?)
         ON CONFLICT(key) DO NOTHING`,
      ).run(key, JSON.stringify(data), email ?? null)
    },
    async upsertApproved(key, data, email) {
      db.prepare(
        `INSERT INTO shared_appliances (key, data, status, added_by) VALUES (?, ?, 'approved', ?)
         ON CONFLICT(key) DO UPDATE SET data = excluded.data, status = 'approved'`,
      ).run(key, JSON.stringify(data), email ?? null)
      return data
    },
    async setSharedStatus(key, status) {
      return db.prepare('UPDATE shared_appliances SET status = ? WHERE key = ?').run(status, key).changes > 0
    },
    async removeShared(key) {
      return db.prepare('DELETE FROM shared_appliances WHERE key = ?').run(key).changes > 0
    },
    async listCompanies() {
      return db.prepare('SELECT * FROM companies ORDER BY created_at DESC LIMIT 500').all()
    },
    async addCompany(c) {
      const info = db
        .prepare('INSERT INTO companies (name, region, url, phone, email, notes) VALUES (?,?,?,?,?,?)')
        .run(c.name, c.region ?? null, c.url ?? null, c.phone ?? null, c.email ?? null, c.notes ?? null)
      return db.prepare('SELECT * FROM companies WHERE id = ?').get(info.lastInsertRowid)
    },
    async removeCompany(id) {
      return db.prepare('DELETE FROM companies WHERE id = ?').run(id).changes > 0
    },
    async list(email) {
      return db
        .prepare('SELECT id, name, data, updated_at FROM designs WHERE user_email = ? ORDER BY updated_at DESC')
        .all(email)
        .map(parse)
    },
    async get(email, id) {
      return parse(
        db.prepare('SELECT id, name, data, updated_at FROM designs WHERE user_email = ? AND id = ?').get(email, id),
      )
    },
    async create(email, name, data) {
      const info = db
        .prepare('INSERT INTO designs (user_email, name, data) VALUES (?, ?, ?)')
        .run(email, name, JSON.stringify(data))
      return this.get(email, info.lastInsertRowid)
    },
    async update(email, id, name, data) {
      const info = db
        .prepare(
          "UPDATE designs SET name = ?, data = ?, updated_at = datetime('now') WHERE user_email = ? AND id = ?",
        )
        .run(name, JSON.stringify(data), email, id)
      return info.changes ? this.get(email, id) : null
    },
    async remove(email, id) {
      return db.prepare('DELETE FROM designs WHERE user_email = ? AND id = ?').run(email, id).changes > 0
    },
  }
}

module.exports = { createStorage }
