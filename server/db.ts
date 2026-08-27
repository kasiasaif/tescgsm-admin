import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import mysql from 'mysql2/promise'
import { seedProducts, type Product } from '../src/data/catalog.ts'

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

export type ProductRow = {
  id: string
  name: string
  category: string
  brand: string
  model: string
  spec: string
  price: number
  previous_price: number | null
  image: string
}

function mysqlConfig() {
  return {
    host: process.env.MYSQL_HOST ?? '127.0.0.1',
    port: Number(process.env.MYSQL_PORT ?? 3306),
    user: process.env.MYSQL_USER ?? 'tescgsm',
    password: process.env.MYSQL_PASSWORD ?? 'tescgsm',
    database: process.env.MYSQL_DATABASE ?? 'tescgsm',
  }
}

function jsonTargets() {
  const targets = [join(root, 'public', 'products.json')]
  const shop = process.env.SHOP_JSON_PATH?.trim()
  if (shop) targets.push(resolve(root, shop))
  return [...new Set(targets)]
}

let pool: mysql.Pool | undefined
let ready: Promise<mysql.Pool> | undefined

async function bootstrap() {
  const config = mysqlConfig()
  const rootUser = process.env.MYSQL_ROOT_USER ?? 'root'
  const rootPassword = process.env.MYSQL_ROOT_PASSWORD ?? config.password
  const rootPasswords = [...new Set([rootPassword, '', config.password])]

  let admin: mysql.Connection | undefined
  let lastError: unknown
  for (const password of rootPasswords) {
    try {
      admin = await mysql.createConnection({
        host: config.host,
        port: config.port,
        user: rootUser,
        password,
        connectTimeout: 5000,
      })
      if (password !== rootPassword) {
        await admin.query(
          `ALTER USER ${admin.escape(rootUser)}@'localhost' IDENTIFIED BY ${admin.escape(rootPassword)}`,
        )
        await admin.query('FLUSH PRIVILEGES')
      }
      break
    } catch (error) {
      lastError = error
    }
  }

  if (!admin) {
    throw lastError instanceof Error
      ? lastError
      : new Error('Could not connect to MySQL as root. Start MySQL Server, then try again.')
  }

  const dbName = admin.escapeId(config.database)
  const dbUser = admin.escape(config.user)
  const dbPass = admin.escape(config.password)
  await admin.query(
    `CREATE DATABASE IF NOT EXISTS ${dbName} CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`,
  )
  await admin.query(`CREATE USER IF NOT EXISTS ${dbUser}@'localhost' IDENTIFIED BY ${dbPass}`)
  await admin.query(`CREATE USER IF NOT EXISTS ${dbUser}@'127.0.0.1' IDENTIFIED BY ${dbPass}`)
  await admin.query(`ALTER USER ${dbUser}@'localhost' IDENTIFIED BY ${dbPass}`)
  await admin.query(`ALTER USER ${dbUser}@'127.0.0.1' IDENTIFIED BY ${dbPass}`)
  await admin.query(`GRANT ALL PRIVILEGES ON ${dbName}.* TO ${dbUser}@'localhost'`)
  await admin.query(`GRANT ALL PRIVILEGES ON ${dbName}.* TO ${dbUser}@'127.0.0.1'`)
  await admin.query('FLUSH PRIVILEGES')
  await admin.end()
}

async function init(): Promise<mysql.Pool> {
  if (pool) return pool
  await bootstrap()
  const created = mysql.createPool({
    ...mysqlConfig(),
    waitForConnections: true,
    connectionLimit: 8,
    connectTimeout: 5000,
  })
  await created.query(`
    CREATE TABLE IF NOT EXISTS products (
      id VARCHAR(64) PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      category VARCHAR(64) NOT NULL,
      brand VARCHAR(64) NOT NULL,
      model VARCHAR(255) NOT NULL,
      spec VARCHAR(255) NOT NULL,
      price INT NOT NULL,
      previous_price INT NULL,
      image VARCHAR(255) NOT NULL
    )
  `)
  pool = created
  await seedIfEmpty()
  return created
}

async function getDb(): Promise<mysql.Pool> {
  if (!ready) ready = init()
  return ready
}

export function rowToProduct(row: ProductRow): Product {
  return {
    id: row.id,
    name: row.name,
    category: row.category as Product['category'],
    brand: row.brand as Product['brand'],
    model: row.model,
    spec: row.spec,
    price: Number(row.price),
    previousPrice: row.previous_price == null ? undefined : Number(row.previous_price),
    image: row.image,
  }
}

export async function listProducts(): Promise<Product[]> {
  const db = await getDb()
  const [rows] = await db.query<mysql.RowDataPacket[]>(
    'SELECT id, name, category, brand, model, spec, price, previous_price, image FROM products ORDER BY name',
  )
  return (rows as ProductRow[]).map(rowToProduct)
}

export async function upsertProduct(product: Product) {
  const db = await getDb()
  await db.query(
    `
    INSERT INTO products (id, name, category, brand, model, spec, price, previous_price, image)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?) AS incoming
    ON DUPLICATE KEY UPDATE
      name = incoming.name,
      category = incoming.category,
      brand = incoming.brand,
      model = incoming.model,
      spec = incoming.spec,
      price = incoming.price,
      previous_price = incoming.previous_price,
      image = incoming.image
    `,
    [
      product.id,
      product.name,
      product.category,
      product.brand,
      product.model,
      product.spec,
      product.price,
      product.previousPrice ?? null,
      product.image,
    ],
  )
  await exportProductsJson()
}

export async function deleteProduct(id: string) {
  const db = await getDb()
  await db.query('DELETE FROM products WHERE id = ?', [id])
  await exportProductsJson()
}

export async function closeDb() {
  if (!pool) return
  await pool.end()
  pool = undefined
  ready = undefined
}

export async function exportProductsJson() {
  let products = seedProducts
  try {
    products = await listProducts()
  } catch {
    // GitHub Pages build has no MySQL
  }
  const body = `${JSON.stringify(products, null, 2)}\n`
  for (const target of jsonTargets()) {
    mkdirSync(dirname(target), { recursive: true })
    writeFileSync(target, body)
  }
}

async function seedIfEmpty() {
  const db = pool
  if (!db) return
  const [rows] = await db.query<mysql.RowDataPacket[]>('SELECT COUNT(*) AS total FROM products')
  const total = Number((rows[0] as { total: number }).total)
  if (total > 0) return

  for (const product of seedProducts) {
    await db.query(
      `
      INSERT INTO products (id, name, category, brand, model, spec, price, previous_price, image)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      [
        product.id,
        product.name,
        product.category,
        product.brand,
        product.model,
        product.spec,
        product.price,
        product.previousPrice ?? null,
        product.image,
      ],
    )
  }
}
