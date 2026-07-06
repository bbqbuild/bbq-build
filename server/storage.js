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
    return {
      kind: 'postgres',
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
  const parse = (row) => row && { ...row, data: JSON.parse(row.data) }
  return {
    kind: 'sqlite',
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
