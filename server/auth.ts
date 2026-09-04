import { randomBytes } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { findLoginByUsername, findStaffById, publicUserFromRecord } from './db.ts'
import { verifyPassword } from './password.ts'
import { type Permission, type PublicUser, hasPermission } from '../src/data/permissions.ts'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')

function loadEnvFile() {
  try {
    const text = readFileSync(join(root, '.env'), 'utf8')
    for (const line of text.split(/\r?\n/)) {
      const trimmed = line.trim()
      if (!trimmed || trimmed.startsWith('#')) continue
      const split = trimmed.indexOf('=')
      if (split < 1) continue
      const key = trimmed.slice(0, split)
      const value = trimmed.slice(split + 1)
      if (!process.env[key]) process.env[key] = value
    }
  } catch {
    // .env is optional
  }
}

loadEnvFile()

type Session = {
  userId: number
  expires: number
}

const sessions = new Map<string, Session>()
const sessionMs = 1000 * 60 * 60 * 8

export async function login(username: string, password: string): Promise<{ token: string; user: PublicUser } | null> {
  const record = await findLoginByUsername(username.trim())
  if (!record || !record.active) return null
  if (!verifyPassword(password, record.passwordHash)) return null
  const user = publicUserFromRecord(record)
  const token = randomBytes(32).toString('hex')
  sessions.set(token, { userId: record.id, expires: Date.now() + sessionMs })
  return { token, user }
}

export function logout(token: string) {
  sessions.delete(token)
}

export async function currentUser(token: string | undefined): Promise<PublicUser | undefined> {
  if (!token) return undefined
  const session = sessions.get(token)
  if (!session) return undefined
  if (session.expires < Date.now()) {
    sessions.delete(token)
    return undefined
  }
  const record = await findStaffById(session.userId)
  if (!record || !record.active) {
    sessions.delete(token)
    return undefined
  }
  return publicUserFromRecord(record)
}

export async function isAuthed(token: string | undefined): Promise<boolean> {
  return Boolean(await currentUser(token))
}

export async function can(token: string | undefined, permission: Permission): Promise<boolean> {
  return hasPermission(await currentUser(token), permission)
}

export function readToken(header: string | undefined): string | undefined {
  if (!header?.startsWith('Bearer ')) return undefined
  return header.slice(7)
}
