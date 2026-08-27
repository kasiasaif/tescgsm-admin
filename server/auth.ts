import { timingSafeEqual, randomBytes } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

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

const adminUser = process.env.ADMIN_USER ?? 'admin'
const adminPassword = process.env.ADMIN_PASSWORD ?? 'tescgsm'
const sessions = new Map<string, number>()
const sessionMs = 1000 * 60 * 60 * 8

function safeEqual(left: string, right: string) {
  const a = Buffer.from(left)
  const b = Buffer.from(right)
  if (a.length !== b.length) return false
  return timingSafeEqual(a, b)
}

export function login(username: string, password: string): string | null {
  if (!safeEqual(username, adminUser) || !safeEqual(password, adminPassword)) {
    return null
  }
  const token = randomBytes(32).toString('hex')
  sessions.set(token, Date.now() + sessionMs)
  return token
}

export function logout(token: string) {
  sessions.delete(token)
}

export function isAuthed(token: string | undefined): boolean {
  if (!token) return false
  const expires = sessions.get(token)
  if (!expires) return false
  if (expires < Date.now()) {
    sessions.delete(token)
    return false
  }
  return true
}

export function readToken(header: string | undefined): string | undefined {
  if (!header?.startsWith('Bearer ')) return undefined
  return header.slice(7)
}
