import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import mysql from 'mysql2/promise'
import { seedBanners, type Banner } from '../src/data/banner.ts'
import { seedCategories, seedProducts, type CategoryRecord, type Product } from '../src/data/catalog.ts'
import { parseRole, permissionsForRole, type PublicUser, type UserRole } from '../src/data/permissions.ts'
import { migrateNumericIds } from './migrate-ids.ts'
import { hashPassword } from './password.ts'

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
    CREATE TABLE IF NOT EXISTS categories (
      id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      active TINYINT(1) NOT NULL DEFAULT 1,
      sort_order INT NOT NULL DEFAULT 0
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `)
  await created.query(`
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
  await created.query(`
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
  await created.query(`
    CREATE TABLE IF NOT EXISTS users (
      id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
      username VARCHAR(64) NOT NULL UNIQUE,
      password_hash VARCHAR(255) NOT NULL,
      role VARCHAR(16) NOT NULL,
      active TINYINT(1) NOT NULL DEFAULT 1
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `)
  await created.query(`
    CREATE TABLE IF NOT EXISTS staff (
      id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
      username VARCHAR(64) NOT NULL UNIQUE,
      password_hash VARCHAR(255) NOT NULL,
      role VARCHAR(16) NOT NULL DEFAULT 'staff',
      active TINYINT(1) NOT NULL DEFAULT 1
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `)
  await created.query(`
    CREATE TABLE IF NOT EXISTS staff_permissions (
      staff_id INT NOT NULL,
      permission VARCHAR(64) NOT NULL,
      PRIMARY KEY (staff_id, permission)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `)
  pool = created
  try {
    await created.query('ALTER TABLE categories ENGINE=InnoDB')
    await created.query('ALTER TABLE products ENGINE=InnoDB')
  } catch {
    // Already InnoDB, or the engine change is not needed
  }
  await migrateNumericIds(created)
  try {
    await ensureForeignKey(created, 'staff_permissions', 'fk_staff_permissions_staff', 'staff_id', 'staff', 'id', 'CASCADE')
  } catch {
    // Constraint already exists, or staff is empty
  }
  await ensureColumn(created, 'products', 'active', 'TINYINT(1) NOT NULL DEFAULT 1')
  await ensureColumn(created, 'staff', 'role', "VARCHAR(16) NOT NULL DEFAULT 'staff'")
  await seedCategoriesIfEmpty()
  await linkProductsToCategories(created)
  await seedIfEmpty()
  await seedBannersIfEmpty()
  await migrateStaffFromUsers()
  await migrateAdminsIntoStaff()
  await seedAdminStaff()
  return created
}

async function getDb(): Promise<mysql.Pool> {
  if (!ready) ready = init()
  return ready
}

async function ensureColumn(
  db: mysql.Pool,
  table: string,
  column: string,
  definition: string,
) {
  const [rows] = await db.query<mysql.RowDataPacket[]>(
    `SHOW COLUMNS FROM ${table} LIKE ?`,
    [column],
  )
  if (rows.length > 0) return
  await db.query(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`)
}

async function ensureIndex(db: mysql.Pool, table: string, index: string, column: string) {
  const [rows] = await db.query<mysql.RowDataPacket[]>(
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
  db: mysql.Pool,
  table: string,
  constraint: string,
  column: string,
  refTable: string,
  refColumn: string,
  onDelete = 'RESTRICT',
) {
  const [rows] = await db.query<mysql.RowDataPacket[]>(
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

async function linkProductsToCategories(db: mysql.Pool) {
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
  const [rows] = await db.query<mysql.RowDataPacket[]>(
    'SELECT id FROM categories WHERE id = ? LIMIT 1',
    [id],
  )
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
    active: row.active == null ? true : Boolean(row.active),
  }
}

export async function listProducts(): Promise<Product[]> {
  const db = await getDb()
  const [rows] = await db.query<mysql.RowDataPacket[]>(
    `
    SELECT p.id, p.name, p.category, p.brand, p.model, p.spec, p.price, p.previous_price, p.image, p.active
    FROM products p
    INNER JOIN categories c ON c.id = p.category
    ORDER BY p.name
    `,
  )
  return (rows as ProductRow[]).map(rowToProduct).filter((item) => Number.isInteger(item.id) && item.id > 0 && Number.isInteger(item.category) && item.category > 0)
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
    const [result] = await db.query<mysql.ResultSetHeader>(
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
    // GitHub Pages build has no MySQL
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
    active: Boolean(row.active),
    sortOrder: Number(row.sort_order),
  }
}

export async function listCategories(): Promise<CategoryRecord[]> {
  const db = await getDb()
  const [rows] = await db.query<mysql.RowDataPacket[]>(
    'SELECT id, name, active, sort_order FROM categories ORDER BY sort_order, name',
  )
  return (rows as CategoryRow[]).map(rowToCategory).filter((item) => Number.isInteger(item.id) && item.id > 0)
}

export async function upsertCategory(category: CategoryRecord): Promise<CategoryRecord> {
  const db = await getDb()
  let id = category.id
  if (id > 0) {
    await db.query(
      'UPDATE categories SET name = ?, active = ?, sort_order = ? WHERE id = ?',
      [category.name, category.active ? 1 : 0, category.sortOrder, id],
    )
  } else {
    const [result] = await db.query<mysql.ResultSetHeader>(
      'INSERT INTO categories (name, active, sort_order) VALUES (?, ?, ?)',
      [category.name, category.active ? 1 : 0, category.sortOrder],
    )
    id = result.insertId
  }
  const saved = { ...category, id }
  await exportCategoriesJson()
  return saved
}

export async function deleteCategory(id: number) {
  const db = await getDb()
  const [rows] = await db.query<mysql.RowDataPacket[]>(
    'SELECT COUNT(*) AS total FROM products WHERE category = ?',
    [id],
  )
  if (Number((rows[0] as { total: number }).total) > 0) {
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
    // GitHub Pages build has no MySQL
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
  const [rows] = await db.query<mysql.RowDataPacket[]>('SELECT COUNT(*) AS total FROM products')
  const total = Number((rows[0] as { total: number }).total)
  if (total > 0) return

  for (const product of seedProducts) {
    await db.query(
      `
      INSERT INTO products (id, name, category, brand, model, spec, price, previous_price, image, active)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
      `
      INSERT IGNORE INTO categories (id, name, active, sort_order)
      VALUES (?, ?, ?, ?)
      `,
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
    active: Boolean(row.active),
    sortOrder: Number(row.sort_order),
  }
}

export async function listBanners(): Promise<Banner[]> {
  const db = await getDb()
  const [rows] = await db.query<mysql.RowDataPacket[]>(
    'SELECT id, title, body, cta_label, cta_href, image, active, sort_order FROM banners ORDER BY sort_order, title',
  )
  return (rows as BannerRow[]).map(rowToBanner).filter((item) => Number.isInteger(item.id) && item.id > 0)
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
    const [result] = await db.query<mysql.ResultSetHeader>(
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
    // GitHub Pages build has no MySQL
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
      `
      INSERT IGNORE INTO banners (id, title, body, cta_label, cta_href, image, active, sort_order)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `,
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
    active: Boolean(row.active),
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
  const [rows] = await db.query<mysql.RowDataPacket[]>(
    'SELECT id, username, password_hash, role, active FROM staff WHERE id = ? LIMIT 1',
    [id],
  )
  const row = (rows as StaffRow[])[0]
  if (!row) return undefined
  return rowToStaff(row)
}

export async function findLoginByUsername(username: string): Promise<UserRecord | undefined> {
  const db = await getDb()
  const [staff] = await db.query<mysql.RowDataPacket[]>(
    'SELECT id, username, password_hash, role, active FROM staff WHERE username = ? LIMIT 1',
    [username],
  )
  const row = (staff as StaffRow[])[0]
  if (!row) return undefined
  return rowToStaff(row)
}

export async function listStaff(): Promise<PublicUser[]> {
  const db = await getDb()
  const [rows] = await db.query<mysql.RowDataPacket[]>(
    'SELECT id, username, password_hash, role, active FROM staff ORDER BY role, username',
  )
  return (rows as StaffRow[])
    .map((row) => publicUserFromRecord(rowToStaff(row)))
    .filter((item) => Number.isInteger(item.id) && item.id > 0)
}

async function countActiveAdmins(exceptId?: number): Promise<number> {
  const db = await getDb()
  const [rows] = await db.query<mysql.RowDataPacket[]>(
    exceptId
      ? "SELECT COUNT(*) AS n FROM staff WHERE role = 'admin' AND active = 1 AND id <> ?"
      : "SELECT COUNT(*) AS n FROM staff WHERE role = 'admin' AND active = 1",
    exceptId ? [exceptId] : [],
  )
  return Number((rows[0] as { n: number }).n)
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
    await db.query(
      'UPDATE staff SET username = ?, password_hash = ?, role = ?, active = ? WHERE id = ?',
      [input.username, passwordHash, nextRole, input.active ? 1 : 0, existing.id],
    )
  } else {
    const [result] = await db.query<mysql.ResultSetHeader>(
      'INSERT INTO staff (username, password_hash, role, active) VALUES (?, ?, ?, ?)',
      [input.username, passwordHash, nextRole, input.active ? 1 : 0],
    )
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
  const [rows] = await db.query<mysql.RowDataPacket[]>(
    "SELECT id FROM staff WHERE role = 'admin' LIMIT 1",
  )
  if (rows.length > 0) return
  const username = process.env.ADMIN_USER ?? 'admin'
  const password = process.env.ADMIN_PASSWORD ?? 'tescgsm'
  const [existing] = await db.query<mysql.RowDataPacket[]>(
    'SELECT id FROM staff WHERE username = ? LIMIT 1',
    [username],
  )
  if (existing.length > 0) {
    await db.query("UPDATE staff SET role = 'admin', active = 1 WHERE id = ?", [existing[0].id])
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
    const [rows] = await db.query<mysql.RowDataPacket[]>(
      "SELECT username, password_hash, active FROM users WHERE role = 'admin'",
    )
    for (const row of rows as { username: string; password_hash: string; active: number }[]) {
      const [existing] = await db.query<mysql.RowDataPacket[]>(
        'SELECT id FROM staff WHERE username = ? LIMIT 1',
        [row.username],
      )
      if (existing.length > 0) {
        await db.query("UPDATE staff SET role = 'admin' WHERE id = ? AND role <> 'admin'", [existing[0].id])
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
    const [rows] = await db.query<mysql.RowDataPacket[]>(
      "SELECT id, username, password_hash, active FROM users WHERE role = 'staff'",
    )
    for (const row of rows as StaffRow[]) {
      const [existingStaff] = await db.query<mysql.RowDataPacket[]>(
        'SELECT id FROM staff WHERE username = ? LIMIT 1',
        [row.username],
      )
      let staffId = Number((existingStaff[0] as { id?: number } | undefined)?.id ?? 0)
      if (!staffId) {
        const [inserted] = await db.query<mysql.ResultSetHeader>(
          `
          INSERT INTO staff (username, password_hash, role, active)
          VALUES (?, ?, 'staff', ?)
          `,
          [row.username, row.password_hash, row.active],
        )
        staffId = inserted.insertId
      }
      try {
        const [perms] = await db.query<mysql.RowDataPacket[]>(
          'SELECT permission FROM user_permissions WHERE user_id = ?',
          [row.id],
        )
        for (const perm of perms as { permission: string }[]) {
          const next = perm.permission === 'users' ? 'staff' : perm.permission
          if (next === 'staff') continue
          await db.query(
            'INSERT IGNORE INTO staff_permissions (staff_id, permission) VALUES (?, ?)',
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

