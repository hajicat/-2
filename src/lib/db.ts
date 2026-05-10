import { createClient, type Client } from '@libsql/client'

let client: Client | null = null
let dbInitialized = false
let initPromise: Promise<void> | null = null

export function getDb(): Client {
  if (!client) {
    const url = process.env.TURSO_DATABASE_URL
    const token = process.env.TURSO_AUTH_TOKEN

    if (url && token) {
      client = createClient({ url, authToken: token })
    } else if (url) {
      client = createClient({ url })
    } else {
      throw new Error(
        'TURSO_DATABASE_URL and TURSO_AUTH_TOKEN environment variables are required.'
      )
    }
  }
  return client
}

export async function initDb(): Promise<void> {
  if (dbInitialized) return
  if (initPromise) { await initPromise; return }

  initPromise = doInit()
  try { await initPromise; dbInitialized = true }
  catch (err) { initPromise = null; throw err }
}

async function doInit(): Promise<void> {
  const db = getDb()

  await db.executeMultiple(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      nickname TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'user',
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS question_banks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      description TEXT DEFAULT '',
      question_count INTEGER NOT NULL DEFAULT 0,
      created_by INTEGER REFERENCES users(id),
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS questions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      bank_id INTEGER NOT NULL REFERENCES question_banks(id) ON DELETE CASCADE,
      type TEXT NOT NULL DEFAULT 'single',
      stem TEXT NOT NULL,
      options_json TEXT NOT NULL DEFAULT '[]',
      answer TEXT NOT NULL,
      explanation TEXT DEFAULT '',
      sort_order INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS attempt_records (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL REFERENCES users(id),
      bank_id INTEGER NOT NULL REFERENCES question_banks(id),
      total_questions INTEGER NOT NULL,
      correct_count INTEGER NOT NULL,
      total_time_ms INTEGER NOT NULL,
      detail_json TEXT NOT NULL DEFAULT '[]',
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS ai_jobs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      result TEXT,
      error TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `)

  // 确保存在默认管理员 admin/admin123
  const admin = await db.execute("SELECT id FROM users WHERE role = 'admin'")
  if (admin.rows.length === 0) {
    const { hashPassword } = await import('./auth')
    const hash = await hashPassword('admin123')
    await db.execute({
      sql: 'INSERT INTO users (username, password_hash, nickname, role) VALUES (?, ?, ?, ?)',
      args: ['admin', hash, '管理员', 'admin']
    })
    console.log('✅ 默认管理员已创建: admin / admin123')
  }

  // 为旧表添加 difficulty 字段（如不存在）
  try {
    await db.execute("ALTER TABLE questions ADD COLUMN difficulty TEXT DEFAULT ''")
  } catch { /* 字段已存在则忽略 */ }
}
