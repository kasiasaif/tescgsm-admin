import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import mysql from 'mysql2/promise'
import { seedBanners, type Banner } from '../src/data/banner.ts'
import { seedCategories, seedProducts, type CategoryRecord, type Product } from '../src/data/catalog.ts'
import { parseRole, permissionsForRole, type PublicUser, type UserRole } from '../src/data/permissions.ts'
import { migrateNumericIds } from './migrate-ids.ts'
import { hashPassword } from './password.ts'
import { ignoreInsert, openPostgres, usesPostgres, wrapMysql, type SqlDb } from './sql.ts'

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

export type BannerRow = {
  id: number
  title: string
  body: string
  cta_label: string
  cta_href: string
  image: string
  active: number
  sort_order: number
}

export type ProductRow = {
  id: number
  name: string
  category: number
  brand: string
  model: string
  spec: string
  price: number
  previous_price: number | null
  image: string
  active: number
}

export type CategoryRow = {
  id: number
  name: string
  active: number
  sort_order: number
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

function jsonTargets(fileName: string) {
  const targets = [join(root, 'public', fileName)]
  const shop = process.env.SHOP_JSON_PATH?.trim()
  if (shop) targets.push(join(dirname(resolve(root, shop)), fileName))
  return [...new Set(targets)]
}

let pool: SqlDb | undefined
let ready: Promise<SqlDb> | undefined

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

async function createMysqlSchema(db: mysql.Pool) {
  await db.query(`
    CREATE TABLE IF NOT EXISTS categories (
      id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      active TINYINT(1) NOT NULL DEFAULT 1,
      sort_order INT NOT NULL DEFAULT 0
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `)
  await db.query(`
    CREATE TABLE IF NOT EXISTS products (
      id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      category INT NOT NULL,
      brand VARCHAR(64) NOT NULL,
      model VARCHAR(255) NOT NULL,
      spec VARCHAR(255) NOT NULL,
      price INT NOT NULL,
      previous_price INT NULL,
      image VARCHAR(255) NOT NULL,
      active TINYINT(1) NOT NULL DEFAULT 1
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `)
  await db.query(`
    CREATE TABLE IF NOT EXISTS banners (
      id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
      title VARCHAR(255) NOT NULL,
      body VARCHAR(512) NOT NULL,
      cta_label VARCHAR(128) NOT NULL,
      cta_href VARCHAR(255) NOT NULL,
      image VARCHAR(255) NOT NULL,
      active TINYINT(1) NOT NULL DEFAULT 1,
      sort_order INT NOT NULL DEFAULT 0
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `)
  await db.query(`
    CREATE TABLE IF NOT EXISTS users (
      id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
      username VARCHAR(64) NOT NULL UNIQUE,
      password_hash VARCHAR(255) NOT NULL,
      role VARCHAR(16) NOT NULL,
      active TINYINT(1) NOT NULL DEFAULT 1
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `)
  await db.query(`
    CREATE TABLE IF NOT EXISTS staff (
      id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
      username VARCHAR(64) NOT NULL UNIQUE,
      password_hash VARCHAR(255) NOT NULL,
      role VARCHAR(16) NOT NULL DEFAULT 'staff',
      active TINYINT(1) NOT NULL DEFAULT 1
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `)
  await db.query(`
    CREATE TABLE IF NOT EXISTS staff_permissions (
      staff_id INT NOT NULL,
      permission VARCHAR(64) NOT NULL,
      PRIMARY KEY (staff_id, permission)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `)
}

async function createPostgresSchema(db: SqlDb) {
  await db.query(`
    CREATE TABLE IF NOT EXISTS categories (
      id INTEGER GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      active SMALLINT NOT NULL DEFAULT 1,
      sort_order INTEGER NOT NULL DEFAULT 0
    )
  `)
  await db.query(`
    CREATE TABLE IF NOT EXISTS products (
      id INTEGER GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      category INTEGER NOT NULL REFERENCES categories(id) ON DELETE RESTRICT ON UPDATE CASCADE,
      brand VARCHAR(64) NOT NULL,
      model VARCHAR(255) NOT NULL,
      spec VARCHAR(255) NOT NULL,
      price INTEGER NOT NULL,
      previous_price INTEGER,
      image VARCHAR(255) NOT NULL,
      active SMALLINT NOT NULL DEFAULT 1
    )
  `)
  await db.query(`
    CREATE TABLE IF NOT EXISTS banners (
      id INTEGER GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
      title VARCHAR(255) NOT NULL,
      body VARCHAR(512) NOT NULL,
      cta_label VARCHAR(128) NOT NULL,
      cta_href VARCHAR(255) NOT NULL,
      image VARCHAR(255) NOT NULL,
      active SMALLINT NOT NULL DEFAULT 1,
      sort_order INTEGER NOT NULL DEFAULT 0
    )
  `)
  await db.query(`
    CREATE TABLE IF NOT EXISTS staff (
      id INTEGER GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
      username VARCHAR(64) NOT NULL UNIQUE,
      password_hash VARCHAR(255) NOT NULL,
      role VARCHAR(16) NOT NULL DEFAULT 'staff',
      active SMALLINT NOT NULL DEFAULT 1
    )
  `)
  await db.query(`
    CREATE TABLE IF NOT EXISTS staff_permissions (
      staff_id INTEGER NOT NULL REFERENCES staff(id) ON DELETE CASCADE ON UPDATE CASCADE,
      permission VARCHAR(64) NOT NULL,
      PRIMARY KEY (staff_id, permission)
    )
  `)
  await db.query('CREATE INDEX IF NOT EXISTS products_category ON products (category)')
}

async function resetIdentity(table: string) {
  if (!pool || pool.dialect !== 'postgres') return
  await pool.query(
    `SELECT setval(pg_get_serial_sequence('${table}', 'id'), COALESCE((SELECT MAX(id) FROM ${table}), 1))`,
  )
}

async function init(): Promise<SqlDb> {
  if (pool) return pool
  if (
    process.env.NODE_ENV === 'production' &&
    !usesPostgres() &&
    (process.env.MYSQL_HOST ?? '127.0.0.1') === '127.0.0.1'
  ) {
    throw new Error('Set DATABASE_URL to the Render Postgres Internal Database URL.')
  }
  if (usesPostgres()) {
    const created = openPostgres()
    pool = created
    await createPostgresSchema(created)
    await seedCategoriesIfEmpty()
    await seedIfEmpty()
    await seedBannersIfEmpty()
    await seedAdminStaff()
    await resetIdentity('categories')
    await resetIdentity('products')
    await resetIdentity('banners')
    await resetIdentity('staff')
    return created
  }

  await bootstrap()
  const createdMysql = mysql.createPool({
    ...mysqlConfig(),
    waitForConnections: true,
    connectionLimit: 8,
    connectTimeout: 5000,
  })
  await createMysqlSchema(createdMysql)
  pool = wrapMysql(createdMysql)
  try {
    await createdMysql.query('ALTER TABLE categories ENGINE=InnoDB')
    await createdMysql.query('ALTER TABLE products ENGINE=InnoDB')
  } catch {
    // Already InnoDB, or the engine change is not needed
  }
  await migrateNumericIds(createdMysql)
  try {
    await ensureForeignKey(pool, 'staff_permissions', 'fk_staff_permissions_staff', 'staff_id', 'staff', 'id', 'CASCADE')
  } catch {
    // Constraint already exists, or staff is empty
  }
  await ensureColumn(pool, 'products', 'active', 'TINYINT(1) NOT NULL DEFAULT 1')
  await ensureColumn(pool, 'staff', 'role', "VARCHAR(16) NOT NULL DEFAULT 'staff'")
  await seedCategoriesIfEmpty()
  await linkProductsToCategories(pool)
  await seedIfEmpty()
  await seedBannersIfEmpty()
  await migrateStaffFromUsers()
  await migrateAdminsIntoStaff()
  await seedAdminStaff()
  return pool
}

async function getDb(): Promise<SqlDb> {
  if (!ready) ready = init()
  return ready
}

async function ensureColumn(db: SqlDb, table: string, column: string, definition: string) {
  const { rows } = await db.query(
    `SHOW COLUMNS FROM ${table} LIKE ?`,
    [column],
  )
  if (rows.length > 0) return
  await db.query(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`)
}

async function ensureIndex(db: SqlDb, table: string, index: string, column: string) {
  const { rows } = await db.query(
    `
    SELECT INDEX_NAME FROM information_schema.STATISTICS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND INDEX_NAME = ?
    `,
    [table, index],
  )
  if (rows.length > 0) return
  await db.query(`ALTER TABLE ${table} ADD INDEX ${index} (${column})`)
}

async function ensureForeignKey(
  db: SqlDb,
  table: string,
  constraint: string,
  column: string,
  refTable: string,
  refColumn: string,
  onDelete = 'RESTRICT',
) {
  const { rows } = await db.query(
    `
    SELECT CONSTRAINT_NAME FROM information_schema.TABLE_CONSTRAINTS
    WHERE CONSTRAINT_SCHEMA = DATABASE()
      AND TABLE_NAME = ?
      AND CONSTRAINT_NAME = ?
      AND CONSTRAINT_TYPE = 'FOREIGN KEY'
    `,
    [table, constraint],
  )
  if (rows.length > 0) return
  await db.query(
    `ALTER TABLE ${table}
     ADD CONSTRAINT ${constraint}
     FOREIGN KEY (${column}) REFERENCES ${refTable}(${refColumn})
     ON DELETE ${onDelete} ON UPDATE CASCADE`,
  )
}

async function linkProductsToCategories(db: SqlDb) {
  await ensureIndex(db, 'products', 'products_category', 'category')
  try {
    await ensureForeignKey(db, 'products', 'fk_products_category', 'category', 'categories', 'id')
  } catch {
    await db.query('ALTER TABLE categories CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci')
    await db.query('ALTER TABLE products CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci')
    await ensureForeignKey(db, 'products', 'fk_products_category', 'category', 'categories', 'id')
  }
}

async function assertCategoryExists(id: number) {
  const db = await getDb()
  const { rows } = await db.query<{ id: number }>('SELECT id FROM categories WHERE id = ? LIMIT 1', [id])
  if (rows.length === 0) {
    throw new Error('Choose a category that exists in the categories table.')
  }
}

export function rowToProduct(row: ProductRow): Product {
  return {
    id: Number(row.id),
    name: row.name,
    category: Number(row.category),
    brand: row.brand,
    model: row.model,
    spec: row.spec,
    price: Number(row.price),
    previousPrice: row.previous_price == null ? undefined : Number(row.previous_price),
    image: row.image,
    active: row.active == null ? true : Boolean(Number(row.active)),
  }
}

export async function listProducts(): Promise<Product[]> {
  const db = await getDb()
  const { rows } = await db.query<ProductRow>(
    `
    SELECT p.id, p.name, p.category, p.brand, p.model, p.spec, p.price, p.previous_price, p.image, p.active
    FROM products p
    INNER JOIN categories c ON c.id = p.category
    ORDER BY p.name
    `,
  )
  return rows
    .map(rowToProduct)
    .filter((item) => Number.isInteger(item.id) && item.id > 0 && Number.isInteger(item.category) && item.category > 0)
}

export async function upsertProduct(product: Product): Promise<Product> {
  await assertCategoryExists(product.category)
  const db = await getDb()
  const values = [
    product.name,
    product.category,
    product.brand,
    product.model,
    product.spec,
    product.price,
    product.previousPrice ?? null,
    product.image,
    product.active ? 1 : 0,
  ]
  let id = product.id
  if (id > 0) {
    await db.query(
      `
      UPDATE products
      SET name = ?, category = ?, brand = ?, model = ?, spec = ?, price = ?, previous_price = ?, image = ?, active = ?
      WHERE id = ?
      `,
      [...values, id],
    )
  } else {
    const result = await db.query(
      `
      INSERT INTO products (name, category, brand, model, spec, price, previous_price, image, active)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      values,
    )
    id = result.insertId
  }
  const saved = { ...product, id }
  await exportProductsJson()
  return saved
}

export async function deleteProduct(id: number) {
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
    // GitHub Pages build has no database
  }
  const body = `${JSON.stringify(products, null, 2)}\n`
  for (const target of jsonTargets('products.json')) {
    mkdirSync(dirname(target), { recursive: true })
    writeFileSync(target, body)
  }
}

export function rowToCategory(row: CategoryRow): CategoryRecord {
  return {
    id: Number(row.id),
    name: row.name,
    active: Boolean(Number(row.active)),
    sortOrder: Number(row.sort_order),
  }
}

export async function listCategories(): Promise<CategoryRecord[]> {
  const db = await getDb()
  const { rows } = await db.query<CategoryRow>(
    'SELECT id, name, active, sort_order FROM categories ORDER BY sort_order, name',
  )
  return rows.map(rowToCategory).filter((item) => Number.isInteger(item.id) && item.id > 0)
}

export async function upsertCategory(category: CategoryRecord): Promise<CategoryRecord> {
  const db = await getDb()
  let id = category.id
  if (id > 0) {
    await db.query('UPDATE categories SET name = ?, active = ?, sort_order = ? WHERE id = ?', [
      category.name,
      category.active ? 1 : 0,
      category.sortOrder,
      id,
    ])
  } else {
    const result = await db.query('INSERT INTO categories (name, active, sort_order) VALUES (?, ?, ?)', [
      category.name,
      category.active ? 1 : 0,
      category.sortOrder,
    ])
    id = result.insertId
  }
  const saved = { ...category, id }
  await exportCategoriesJson()
  return saved
}

export async function deleteCategory(id: number) {
  const db = await getDb()
  const { rows } = await db.query<{ total: number }>('SELECT COUNT(*) AS total FROM products WHERE category = ?', [id])
  if (Number(rows[0]?.total) > 0) {
    throw new Error('Move or delete products in this category first.')
  }
  await db.query('DELETE FROM categories WHERE id = ?', [id])
  await exportCategoriesJson()
}

export async function exportCategoriesJson() {
  let categories = seedCategories
  try {
    categories = await listCategories()
  } catch {
    // GitHub Pages build has no database
  }
  const body = `${JSON.stringify(categories, null, 2)}\n`
  for (const target of jsonTargets('categories.json')) {
    mkdirSync(dirname(target), { recursive: true })
    writeFileSync(target, body)
  }
}

async function seedIfEmpty() {
  const db = pool
  if (!db) return
  const { rows } = await db.query<{ total: number }>('SELECT COUNT(*) AS total FROM products')
  const total = Number(rows[0]?.total)
  if (total > 0) return

  for (const product of seedProducts) {
    await db.query(
      ignoreInsert(
        `
      INSERT IGNORE INTO products (id, name, category, brand, model, spec, price, previous_price, image, active)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
        db.dialect,
      ),
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
        product.active ? 1 : 0,
      ],
    )
  }
}

async function seedCategoriesIfEmpty() {
  const db = pool
  if (!db) return
  for (const category of seedCategories) {
    await db.query(
      ignoreInsert(
        `
      INSERT IGNORE INTO categories (id, name, active, sort_order)
      VALUES (?, ?, ?, ?)
      `,
        db.dialect,
      ),
      [category.id, category.name, category.active ? 1 : 0, category.sortOrder],
    )
  }
}

export function rowToBanner(row: BannerRow): Banner {
  return {
    id: Number(row.id),
    title: row.title,
    body: row.body,
    ctaLabel: row.cta_label,
    ctaHref: row.cta_href,
    image: row.image,
    active: Boolean(Number(row.active)),
    sortOrder: Number(row.sort_order),
  }
}

export async function listBanners(): Promise<Banner[]> {
  const db = await getDb()
  const { rows } = await db.query<BannerRow>(
    'SELECT id, title, body, cta_label, cta_href, image, active, sort_order FROM banners ORDER BY sort_order, title',
  )
  return rows.map(rowToBanner).filter((item) => Number.isInteger(item.id) && item.id > 0)
}

export async function upsertBanner(banner: Banner): Promise<Banner> {
  const db = await getDb()
  const values = [
    banner.title,
    banner.body,
    banner.ctaLabel,
    banner.ctaHref,
    banner.image,
    banner.active ? 1 : 0,
    banner.sortOrder,
  ]
  let id = banner.id
  if (id > 0) {
    await db.query(
      `
      UPDATE banners
      SET title = ?, body = ?, cta_label = ?, cta_href = ?, image = ?, active = ?, sort_order = ?
      WHERE id = ?
      `,
      [...values, id],
    )
  } else {
    const result = await db.query(
      'INSERT INTO banners (title, body, cta_label, cta_href, image, active, sort_order) VALUES (?, ?, ?, ?, ?, ?, ?)',
      values,
    )
    id = result.insertId
  }
  const saved = { ...banner, id }
  await exportBannersJson()
  return saved
}

export async function deleteBanner(id: number) {
  const db = await getDb()
  await db.query('DELETE FROM banners WHERE id = ?', [id])
  await exportBannersJson()
}

export async function exportBannersJson() {
  let banners = seedBanners
  try {
    banners = await listBanners()
  } catch {
    // GitHub Pages build has no database
  }
  const body = `${JSON.stringify(banners, null, 2)}\n`
  for (const target of jsonTargets('banners.json')) {
    mkdirSync(dirname(target), { recursive: true })
    writeFileSync(target, body)
  }
}

async function seedBannersIfEmpty() {
  const db = pool
  if (!db) return

  for (const banner of seedBanners) {
    await db.query(
      ignoreInsert(
        `
      INSERT IGNORE INTO banners (id, title, body, cta_label, cta_href, image, active, sort_order)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `,
        db.dialect,
      ),
      [
        banner.id,
        banner.title,
        banner.body,
        banner.ctaLabel,
        banner.ctaHref,
        banner.image,
        banner.active ? 1 : 0,
        banner.sortOrder,
      ],
    )
  }
}

export type UserRecord = {
  id: number
  username: string
  passwordHash: string
  role: UserRole
  active: boolean
}

type StaffRow = {
  id: number
  username: string
  password_hash: string
  role: string
  active: number
}

function rowToStaff(row: StaffRow): UserRecord {
  return {
    id: Number(row.id),
    username: row.username,
    passwordHash: row.password_hash,
    role: parseRole(row.role),
    active: Boolean(Number(row.active)),
  }
}

export function publicUserFromRecord(record: UserRecord): PublicUser {
  return {
    id: record.id,
    username: record.username,
    role: record.role,
    active: record.active,
    permissions: permissionsForRole(record.role),
  }
}

export async function findStaffById(id: number): Promise<UserRecord | undefined> {
  const db = await getDb()
  const { rows } = await db.query<StaffRow>(
    'SELECT id, username, password_hash, role, active FROM staff WHERE id = ? LIMIT 1',
    [id],
  )
  const row = rows[0]
  if (!row) return undefined
  return rowToStaff(row)
}

export async function findLoginByUsername(username: string): Promise<UserRecord | undefined> {
  const db = await getDb()
  const { rows } = await db.query<StaffRow>(
    'SELECT id, username, password_hash, role, active FROM staff WHERE username = ? LIMIT 1',
    [username],
  )
  const row = rows[0]
  if (!row) return undefined
  return rowToStaff(row)
}

export async function listStaff(): Promise<PublicUser[]> {
  const db = await getDb()
  const { rows } = await db.query<StaffRow>(
    'SELECT id, username, password_hash, role, active FROM staff ORDER BY role, username',
  )
  return rows
    .map((row) => publicUserFromRecord(rowToStaff(row)))
    .filter((item) => Number.isInteger(item.id) && item.id > 0)
}

async function countActiveAdmins(exceptId?: number): Promise<number> {
  const db = await getDb()
  const { rows } = await db.query<{ n: number }>(
    exceptId
      ? "SELECT COUNT(*) AS n FROM staff WHERE role = 'admin' AND active = 1 AND id <> ?"
      : "SELECT COUNT(*) AS n FROM staff WHERE role = 'admin' AND active = 1",
    exceptId ? [exceptId] : [],
  )
  return Number(rows[0]?.n)
}

export async function upsertStaff(input: {
  id: number
  username: string
  password?: string
  active: boolean
  role: UserRole
}): Promise<PublicUser> {
  const db = await getDb()
  const existing = input.id > 0 ? await findStaffById(input.id) : undefined
  const usernameTaken = await findLoginByUsername(input.username)
  if (usernameTaken && usernameTaken.id !== existing?.id) {
    throw new Error('That username is already in use.')
  }

  const passwordHash = input.password ? hashPassword(input.password) : existing?.passwordHash
  if (!passwordHash) {
    throw new Error('Set a password for the new staff account.')
  }

  const nextRole = parseRole(input.role)
  if (existing?.role === 'admin' && (nextRole !== 'admin' || !input.active)) {
    const remaining = await countActiveAdmins(existing.id)
    if (remaining < 1) {
      throw new Error('Keep at least one admin account.')
    }
  }

  let id = existing?.id ?? 0
  if (existing) {
    await db.query('UPDATE staff SET username = ?, password_hash = ?, role = ?, active = ? WHERE id = ?', [
      input.username,
      passwordHash,
      nextRole,
      input.active ? 1 : 0,
      existing.id,
    ])
  } else {
    const result = await db.query('INSERT INTO staff (username, password_hash, role, active) VALUES (?, ?, ?, ?)', [
      input.username,
      passwordHash,
      nextRole,
      input.active ? 1 : 0,
    ])
    id = result.insertId
  }
  const saved = await findStaffById(id)
  if (!saved) throw new Error('Could not save staff.')
  return publicUserFromRecord(saved)
}

export async function deleteStaff(id: number) {
  const db = await getDb()
  const existing = await findStaffById(id)
  if (existing?.role === 'admin' && existing.active && (await countActiveAdmins(id)) < 1) {
    throw new Error('Keep at least one admin account.')
  }
  await db.query('DELETE FROM staff WHERE id = ?', [id])
}

async function seedAdminStaff() {
  const db = pool
  if (!db) return
  const { rows } = await db.query<{ id: number }>("SELECT id FROM staff WHERE role = 'admin' LIMIT 1")
  if (rows.length > 0) return
  const username = process.env.ADMIN_USER ?? 'admin'
  const password = process.env.ADMIN_PASSWORD ?? 'tescgsm'
  const existing = await db.query<{ id: number }>('SELECT id FROM staff WHERE username = ? LIMIT 1', [username])
  if (existing.rows.length > 0) {
    await db.query("UPDATE staff SET role = 'admin', active = 1 WHERE id = ?", [existing.rows[0].id])
    return
  }
  await db.query(
    `
    INSERT INTO staff (username, password_hash, role, active)
    VALUES (?, ?, 'admin', 1)
    `,
    [username, hashPassword(password)],
  )
}

async function migrateAdminsIntoStaff() {
  const db = pool
  if (!db) return
  try {
    const { rows } = await db.query<{ username: string; password_hash: string; active: number }>(
      "SELECT username, password_hash, active FROM users WHERE role = 'admin'",
    )
    for (const row of rows) {
      const existing = await db.query<{ id: number }>('SELECT id FROM staff WHERE username = ? LIMIT 1', [row.username])
      if (existing.rows.length > 0) {
        await db.query("UPDATE staff SET role = 'admin' WHERE id = ? AND role <> 'admin'", [existing.rows[0].id])
      } else {
        await db.query(
          `
          INSERT INTO staff (username, password_hash, role, active)
          VALUES (?, ?, 'admin', ?)
          `,
          [row.username, row.password_hash, row.active ? 1 : 0],
        )
      }
    }
  } catch {
    // users table may not exist
  }
}

async function migrateStaffFromUsers() {
  const db = pool
  if (!db) return
  try {
    const { rows } = await db.query<StaffRow>("SELECT id, username, password_hash, active FROM users WHERE role = 'staff'")
    for (const row of rows) {
      const existingStaff = await db.query<{ id: number }>('SELECT id FROM staff WHERE username = ? LIMIT 1', [
        row.username,
      ])
      let staffId = Number(existingStaff.rows[0]?.id ?? 0)
      if (!staffId) {
        const inserted = await db.query(
          `
          INSERT INTO staff (username, password_hash, role, active)
          VALUES (?, ?, 'staff', ?)
          `,
          [row.username, row.password_hash, row.active],
        )
        staffId = inserted.insertId
      }
      try {
        const perms = await db.query<{ permission: string }>('SELECT permission FROM user_permissions WHERE user_id = ?', [
          row.id,
        ])
        for (const perm of perms.rows) {
          const next = perm.permission === 'users' ? 'staff' : perm.permission
          if (next === 'staff') continue
          await db.query(
            ignoreInsert('INSERT IGNORE INTO staff_permissions (staff_id, permission) VALUES (?, ?)', db.dialect),
            [staffId, next],
          )
        }
        await db.query('DELETE FROM user_permissions WHERE user_id = ?', [row.id])
      } catch {
        // user_permissions may not exist on a fresh install
      }
      await db.query('DELETE FROM users WHERE id = ?', [row.id])
    }
  } catch {
    // users table may not have staff rows
  }
}
