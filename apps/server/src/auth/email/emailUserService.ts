import { randomUUID } from 'node:crypto'
import bcrypt from 'bcryptjs'
import { getEmailUserDb } from './emailUserDb'

const SALT_ROUNDS = 11

export type EmailUserRow = {
  id: string
  email: string
  password_hash: string
  display_name: string
  created_at: number
}

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase()
}

export function findUserByEmail(email: string): EmailUserRow | undefined {
  const db = getEmailUserDb()
  const normalized = normalizeEmail(email)
  return db.prepare('SELECT * FROM email_users WHERE email = ?').get(normalized) as EmailUserRow | undefined
}

export function createEmailUser(email: string, password: string, displayName: string): EmailUserRow {
  const db = getEmailUserDb()
  const id = `local_${randomUUID()}`
  const hash = bcrypt.hashSync(password, SALT_ROUNDS)
  const normalized = normalizeEmail(email)
  const created = Date.now()
  db.prepare(
    'INSERT INTO email_users (id, email, password_hash, display_name, created_at) VALUES (?, ?, ?, ?, ?)',
  ).run(id, normalized, hash, displayName, created)
  return {
    id,
    email: normalized,
    password_hash: hash,
    display_name: displayName,
    created_at: created,
  }
}

export function verifyPassword(row: EmailUserRow, password: string): boolean {
  return bcrypt.compareSync(password, row.password_hash)
}
