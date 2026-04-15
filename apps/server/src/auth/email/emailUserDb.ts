import fs from 'node:fs'
import path from 'node:path'
import Database from 'better-sqlite3'

let db: Database.Database | null = null

/** SQLite file for email/password accounts. Override with EMAIL_USERS_DB_PATH. */
export function getEmailUserDb(): Database.Database {
  if (db) {
    return db
  }
  const raw = process.env.EMAIL_USERS_DB_PATH
  const filePath =
    typeof raw === 'string' && raw.trim().length > 0
      ? path.resolve(raw.trim())
      : path.join(process.cwd(), 'data', 'email_users.sqlite')
  fs.mkdirSync(path.dirname(filePath), { recursive: true })
  db = new Database(filePath)
  db.pragma('journal_mode = WAL')
  db.exec(`
    CREATE TABLE IF NOT EXISTS email_users (
      id TEXT PRIMARY KEY NOT NULL,
      email TEXT NOT NULL UNIQUE COLLATE NOCASE,
      password_hash TEXT NOT NULL,
      display_name TEXT NOT NULL,
      created_at INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_email_users_email ON email_users(email);
  `)
  return db
}
