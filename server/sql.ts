import mysql from 'mysql2/promise'
import { Pool } from 'pg'

export type QueryResult<T = Record<string, unknown>> = {
  rows: T[]
  insertId: number
}

export type SqlDb = {
  dialect: 'mysql' | 'postgres'
  query<T = Record<string, unknown>>(sql: string, params?: unknown[]): Promise<QueryResult<T>>
  end(): Promise<void>
}

export function usesPostgres() {
  return Boolean(process.env.DATABASE_URL?.trim() || process.env.PGHOST?.trim())
}

function toPg(sql: string) {
  let index = 0
  return sql.replace(/\?/g, () => `$${++index}`)
}

function pgSsl(connectionString = '') {
  if (
    !connectionString ||
    connectionString.includes('localhost') ||
    connectionString.includes('127.0.0.1') ||
    connectionString.includes('.internal')
  ) {
    return undefined
  }
  return { rejectUnauthorized: false }
}

export function ignoreInsert(sql: string, dialect: SqlDb['dialect']) {
  if (dialect !== 'postgres') return sql
  return `${sql.replace(/INSERT IGNORE INTO/i, 'INSERT INTO')} ON CONFLICT DO NOTHING`
}

export function wrapMysql(pool: mysql.Pool): SqlDb {
  return {
    dialect: 'mysql',
    async query<T = Record<string, unknown>>(sql: string, params: unknown[] = []) {
      const [result] = await pool.query(sql, params)
      if (Array.isArray(result)) {
        return { rows: result as T[], insertId: 0 }
      }
      return { rows: [] as T[], insertId: Number(result.insertId ?? 0) }
    },
    end: () => pool.end(),
  }
}

export function openPostgres(): SqlDb {
  const connectionString = process.env.DATABASE_URL?.trim()
  const pool = connectionString
    ? new Pool({
        connectionString,
        ssl: pgSsl(connectionString),
        max: 8,
      })
    : new Pool({
        host: process.env.PGHOST,
        port: Number(process.env.PGPORT ?? 5432),
        user: process.env.PGUSER,
        password: process.env.PGPASSWORD,
        database: process.env.PGDATABASE,
        ssl: pgSsl(),
        max: 8,
      })

  return {
    dialect: 'postgres',
    async query<T = Record<string, unknown>>(sql: string, params: unknown[] = []) {
      let text = toPg(sql)
      if (/^\s*INSERT\b/i.test(sql) && !/\bRETURNING\b/i.test(sql)) {
        text += ' RETURNING id'
      }
      const result = await pool.query(text, params)
      return {
        rows: result.rows as T[],
        insertId: Number(result.rows[0]?.id ?? 0),
      }
    },
    end: () => pool.end(),
  }
}
