import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import mysql from 'mysql2/promise'
import { parseHeaderBannerFont, parseOpacity, seedBanners, type Banner, type HeaderBanner } from '../src/data/banner.ts'
import { seedBrands, seedCategories, type BrandRecord, type CategoryRecord, type Product } from '../src/data/catalog.ts'
import { parseRole, permissionsForRole, type PublicUser, type UserRole } from '../src/data/permissions.ts'
import {
  type ShopCustomer,
  type ShopCustomerInput,
  type ShopOrder,
  type ShopOrderInput,
  type ShopOrderLine,
  type ShopOrderStatus,
} from '../src/data/sales.ts'
import { migrateNumericIds } from './migrate-ids.ts'
import { hashPassword, verifyPassword } from './password.ts'
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
  items: number
  out_of_stock: number
  active: number
}

export type CategoryRow = {
  id: number
  name: string
  active: number
  sort_order: number
  min_items: number
  out_of_stock: number
}

export type BrandRow = {
  id: number
  name: string
  image: string
  active: number
}

export type VoucherRow = {
  id: number
  name: string
  code: string
  discount_type: number | string
  discount_value: number | string
  percentage: number | string
  active: number
}

export type VoucherRecord = {
  id: number
  name: string
  code: string
  type: 1 | 2
  value: number
  percentage: number
  active: boolean
}

export type HeaderBannerRow = {
  id: number
  text: string
  background: string
  color: string
  font: string
  bold: number
  background_opacity: number
  active: number
  sort_order: number
}

function mysqlConfig() {
  return {
    host: process.env.MYSQL_HOST ?? '127.0.0.1',
    port: Number(process.env.MYSQL_PORT ?? 3306),
    user: process.env.MYSQL_USER ?? '',
    password: process.env.MYSQL_PASSWORD ?? '',
    database: process.env.MYSQL_DATABASE ?? '',
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
      sort_order INT NOT NULL DEFAULT 0,
      min_items INT NOT NULL DEFAULT 0,
      out_of_stock INT NOT NULL DEFAULT 1
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
      items INT NOT NULL DEFAULT 0,
      out_of_stock INT NOT NULL DEFAULT 1,
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
    CREATE TABLE IF NOT EXISTS brands (
      id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
      name VARCHAR(64) NOT NULL UNIQUE,
      image VARCHAR(255) NOT NULL,
      active TINYINT(1) NOT NULL DEFAULT 1
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `)
  await db.query(`
    CREATE TABLE IF NOT EXISTS vouchers (
      id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
      name VARCHAR(128) NOT NULL,
      code VARCHAR(32) NOT NULL,
      discount_type TINYINT NOT NULL DEFAULT 1,
      discount_value DECIMAL(10,2) NOT NULL DEFAULT 0,
      percentage DECIMAL(5,2) NOT NULL DEFAULT 0,
      active TINYINT(1) NOT NULL DEFAULT 1,
      UNIQUE KEY vouchers_code (code)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `)
  await db.query(`
    CREATE TABLE IF NOT EXISTS header_banners (
      id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
      text VARCHAR(512) NOT NULL,
      background VARCHAR(16) NOT NULL,
      color VARCHAR(16) NOT NULL DEFAULT '#ffffff',
      font VARCHAR(64) NOT NULL DEFAULT 'Plus Jakarta Sans',
      bold TINYINT(1) NOT NULL DEFAULT 1,
      background_opacity INT NOT NULL DEFAULT 100,
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
      email VARCHAR(255) NOT NULL DEFAULT '',
      photo MEDIUMTEXT NULL,
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
  await db.query(`
    CREATE TABLE IF NOT EXISTS customers (
      id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
      email VARCHAR(255) NOT NULL UNIQUE,
      kind VARCHAR(16) NOT NULL DEFAULT '',
      first_name VARCHAR(128) NOT NULL DEFAULT '',
      last_name VARCHAR(128) NOT NULL DEFAULT '',
      company VARCHAR(255) NOT NULL DEFAULT '',
      tax_id VARCHAR(64) NOT NULL DEFAULT '',
      phone VARCHAR(64) NOT NULL DEFAULT '',
      street VARCHAR(255) NOT NULL DEFAULT '',
      city VARCHAR(128) NOT NULL DEFAULT '',
      postcode VARCHAR(32) NOT NULL DEFAULT '',
      province VARCHAR(128) NOT NULL DEFAULT '',
      country VARCHAR(128) NOT NULL DEFAULT '',
      password_hash VARCHAR(255) NOT NULL DEFAULT '',
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `)
  await db.query(`
    CREATE TABLE IF NOT EXISTS orders (
      id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
      order_ref VARCHAR(32) NOT NULL UNIQUE,
      email VARCHAR(255) NOT NULL,
      customer_name VARCHAR(255) NOT NULL DEFAULT '',
      phone VARCHAR(64) NOT NULL DEFAULT '',
      street VARCHAR(255) NOT NULL DEFAULT '',
      city VARCHAR(128) NOT NULL DEFAULT '',
      postcode VARCHAR(32) NOT NULL DEFAULT '',
      province VARCHAR(128) NOT NULL DEFAULT '',
      country VARCHAR(128) NOT NULL DEFAULT '',
      order_lines TEXT NOT NULL,
      total INT NOT NULL,
      discount DECIMAL(10,2) NOT NULL DEFAULT 0,
      total_paid DECIMAL(10,2) NOT NULL DEFAULT 0,
      status VARCHAR(16) NOT NULL DEFAULT 'placed',
      placed_at DATETIME NOT NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      INDEX orders_email (email)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `)
}

async function createPostgresSchema(db: SqlDb) {
  await db.query(`
    CREATE TABLE IF NOT EXISTS categories (
      id INTEGER GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      active SMALLINT NOT NULL DEFAULT 1,
      sort_order INTEGER NOT NULL DEFAULT 0,
      min_items INTEGER NOT NULL DEFAULT 0,
      out_of_stock INTEGER NOT NULL DEFAULT 1
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
      items INTEGER NOT NULL DEFAULT 0,
      out_of_stock INTEGER NOT NULL DEFAULT 1,
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
    CREATE TABLE IF NOT EXISTS brands (
      id INTEGER GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
      name VARCHAR(64) NOT NULL UNIQUE,
      image VARCHAR(255) NOT NULL,
      active SMALLINT NOT NULL DEFAULT 1
    )
  `)
  await db.query(`
    CREATE TABLE IF NOT EXISTS vouchers (
      id INTEGER GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
      name VARCHAR(128) NOT NULL,
      code VARCHAR(32) NOT NULL UNIQUE,
      discount_type SMALLINT NOT NULL DEFAULT 1,
      discount_value NUMERIC(10,2) NOT NULL DEFAULT 0,
      percentage NUMERIC(5,2) NOT NULL DEFAULT 0,
      active SMALLINT NOT NULL DEFAULT 1
    )
  `)
  await db.query(`
    CREATE TABLE IF NOT EXISTS header_banners (
      id INTEGER GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
      text VARCHAR(512) NOT NULL,
      background VARCHAR(16) NOT NULL,
      color VARCHAR(16) NOT NULL DEFAULT '#ffffff',
      font VARCHAR(64) NOT NULL DEFAULT 'Plus Jakarta Sans',
      bold SMALLINT NOT NULL DEFAULT 1,
      background_opacity INTEGER NOT NULL DEFAULT 100,
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
      email VARCHAR(255) NOT NULL DEFAULT '',
      photo TEXT,
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
  await db.query(`
    CREATE TABLE IF NOT EXISTS customers (
      id INTEGER GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
      email VARCHAR(255) NOT NULL UNIQUE,
      kind VARCHAR(16) NOT NULL DEFAULT '',
      first_name VARCHAR(128) NOT NULL DEFAULT '',
      last_name VARCHAR(128) NOT NULL DEFAULT '',
      company VARCHAR(255) NOT NULL DEFAULT '',
      tax_id VARCHAR(64) NOT NULL DEFAULT '',
      phone VARCHAR(64) NOT NULL DEFAULT '',
      street VARCHAR(255) NOT NULL DEFAULT '',
      city VARCHAR(128) NOT NULL DEFAULT '',
      postcode VARCHAR(32) NOT NULL DEFAULT '',
      province VARCHAR(128) NOT NULL DEFAULT '',
      country VARCHAR(128) NOT NULL DEFAULT '',
      password_hash VARCHAR(255) NOT NULL DEFAULT '',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `)
  await db.query(`
    CREATE TABLE IF NOT EXISTS orders (
      id INTEGER GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
      order_ref VARCHAR(32) NOT NULL UNIQUE,
      email VARCHAR(255) NOT NULL,
      customer_name VARCHAR(255) NOT NULL DEFAULT '',
      phone VARCHAR(64) NOT NULL DEFAULT '',
      street VARCHAR(255) NOT NULL DEFAULT '',
      city VARCHAR(128) NOT NULL DEFAULT '',
      postcode VARCHAR(32) NOT NULL DEFAULT '',
      province VARCHAR(128) NOT NULL DEFAULT '',
      country VARCHAR(128) NOT NULL DEFAULT '',
      order_lines TEXT NOT NULL,
      total INTEGER NOT NULL,
      discount NUMERIC(10,2) NOT NULL DEFAULT 0,
      total_paid NUMERIC(10,2) NOT NULL DEFAULT 0,
      status VARCHAR(16) NOT NULL DEFAULT 'placed',
      placed_at TIMESTAMPTZ NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `)
  await db.query('CREATE INDEX IF NOT EXISTS orders_email ON orders (email)')
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
    await ensureStaffProfileColumns(created)
    await ensureProductItemsColumn(created)
    await ensureProductOutOfStockColumn(created)
    await ensureCategoryMinItemsColumn(created)
    await ensureCategoryOutOfStockColumn(created)
    await ensureHeaderBannerStyleColumns(created)
    await ensureVoucherDiscountColumns(created)
    await ensureOrderMoneyColumns(created)
    await seedCategoriesIfEmpty()
    await seedBrandsIfEmpty()
    await seedBannersIfEmpty()
    await seedAdminStaff()
    await seedVisitorStaff()
    await resetIdentity('categories')
    await resetIdentity('products')
    await resetIdentity('banners')
    await resetIdentity('brands')
    await resetIdentity('header_banners')
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
  await ensureColumn(pool, 'products', 'active', 'TINYINT(1) NOT NULL DEFAULT 1')
  await ensureProductItemsColumn(pool)
  await ensureProductOutOfStockColumn(pool)
  await ensureCategoryMinItemsColumn(pool)
  await ensureCategoryOutOfStockColumn(pool)
  await ensureHeaderBannerStyleColumns(pool)
  await ensureVoucherDiscountColumns(pool)
  await ensureOrderMoneyColumns(pool)
  await migrateNumericIds(createdMysql)
  try {
    await ensureForeignKey(pool, 'staff_permissions', 'fk_staff_permissions_staff', 'staff_id', 'staff', 'id', 'CASCADE')
  } catch {
    // Constraint already exists, or staff is empty
  }
  await ensureColumn(pool, 'staff', 'role', "VARCHAR(16) NOT NULL DEFAULT 'staff'")
  await ensureStaffProfileColumns(pool)
  await seedCategoriesIfEmpty()
  await seedBrandsIfEmpty()
  await linkProductsToCategories(pool)
  await seedBannersIfEmpty()
  await migrateStaffFromUsers()
  await migrateAdminsIntoStaff()
  await seedAdminStaff()
  await seedVisitorStaff()
  return pool
}

async function getDb(): Promise<SqlDb> {
  if (!ready) {
    ready = init().catch((error) => {
      ready = undefined
      throw error
    })
  }
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

async function ensureProductItemsColumn(db: SqlDb) {
  if (db.dialect === 'postgres') {
    await db.query('ALTER TABLE products ADD COLUMN IF NOT EXISTS items INTEGER NOT NULL DEFAULT 0')
    return
  }
  await ensureColumn(db, 'products', 'items', 'INT NOT NULL DEFAULT 0')
}

async function ensureProductOutOfStockColumn(db: SqlDb) {
  if (db.dialect === 'postgres') {
    await db.query('ALTER TABLE products ADD COLUMN IF NOT EXISTS out_of_stock INTEGER NOT NULL DEFAULT 1')
    return
  }
  await ensureColumn(db, 'products', 'out_of_stock', 'INT NOT NULL DEFAULT 1')
}

async function ensureCategoryMinItemsColumn(db: SqlDb) {
  if (db.dialect === 'postgres') {
    await db.query('ALTER TABLE categories ADD COLUMN IF NOT EXISTS min_items INTEGER NOT NULL DEFAULT 0')
    return
  }
  await ensureColumn(db, 'categories', 'min_items', 'INT NOT NULL DEFAULT 0')
}

async function ensureCategoryOutOfStockColumn(db: SqlDb) {
  if (db.dialect === 'postgres') {
    await db.query('ALTER TABLE categories ADD COLUMN IF NOT EXISTS out_of_stock INTEGER NOT NULL DEFAULT 1')
  } else {
    await ensureColumn(db, 'categories', 'out_of_stock', 'INT NOT NULL DEFAULT 1')
  }
  await db.query(`
    UPDATE categories c
    SET out_of_stock = COALESCE((
      SELECT MIN(p.out_of_stock) FROM products p WHERE p.category = c.id
    ), c.out_of_stock)
  `)
}

async function ensureOrderMoneyColumns(db: SqlDb) {
  if (db.dialect === 'postgres') {
    await db.query('ALTER TABLE orders ADD COLUMN IF NOT EXISTS discount NUMERIC(10,2) NOT NULL DEFAULT 0')
    await db.query('ALTER TABLE orders ADD COLUMN IF NOT EXISTS total_paid NUMERIC(10,2) NOT NULL DEFAULT 0')
  } else {
    await ensureColumn(db, 'orders', 'discount', 'DECIMAL(10,2) NOT NULL DEFAULT 0')
    await ensureColumn(db, 'orders', 'total_paid', 'DECIMAL(10,2) NOT NULL DEFAULT 0')
  }
  await db.query('UPDATE orders SET total_paid = total WHERE discount = 0 AND total_paid = 0')
}

async function ensureVoucherDiscountColumns(db: SqlDb) {
  if (db.dialect === 'postgres') {
    await db.query('ALTER TABLE vouchers ADD COLUMN IF NOT EXISTS discount_type SMALLINT NOT NULL DEFAULT 1')
    await db.query('ALTER TABLE vouchers ADD COLUMN IF NOT EXISTS discount_value NUMERIC(10,2) NOT NULL DEFAULT 0')
    await db.query('ALTER TABLE vouchers ADD COLUMN IF NOT EXISTS percentage NUMERIC(5,2) NOT NULL DEFAULT 0')
  } else {
    await ensureColumn(db, 'vouchers', 'discount_type', 'TINYINT NOT NULL DEFAULT 1')
    await ensureColumn(db, 'vouchers', 'discount_value', 'DECIMAL(10,2) NOT NULL DEFAULT 0')
    await ensureColumn(db, 'vouchers', 'percentage', 'DECIMAL(5,2) NOT NULL DEFAULT 0')
  }
  await db.query('UPDATE vouchers SET discount_type = 2 WHERE discount_value > 0 AND percentage = 0')
}

async function ensureHeaderBannerStyleColumns(db: SqlDb) {
  if (db.dialect === 'postgres') {
    await db.query("ALTER TABLE header_banners ADD COLUMN IF NOT EXISTS color VARCHAR(16) NOT NULL DEFAULT '#ffffff'")
    await db.query("ALTER TABLE header_banners ADD COLUMN IF NOT EXISTS font VARCHAR(64) NOT NULL DEFAULT 'Plus Jakarta Sans'")
    await db.query('ALTER TABLE header_banners ADD COLUMN IF NOT EXISTS bold SMALLINT NOT NULL DEFAULT 1')
    await db.query('ALTER TABLE header_banners ADD COLUMN IF NOT EXISTS background_opacity INTEGER NOT NULL DEFAULT 100')
    return
  }
  await ensureColumn(db, 'header_banners', 'color', "VARCHAR(16) NOT NULL DEFAULT '#ffffff'")
  await ensureColumn(db, 'header_banners', 'font', "VARCHAR(64) NOT NULL DEFAULT 'Plus Jakarta Sans'")
  await ensureColumn(db, 'header_banners', 'bold', 'TINYINT(1) NOT NULL DEFAULT 1')
  await ensureColumn(db, 'header_banners', 'background_opacity', 'INT NOT NULL DEFAULT 100')
}

async function ensureStaffProfileColumns(db: SqlDb) {
  if (db.dialect === 'postgres') {
    await db.query("ALTER TABLE staff ADD COLUMN IF NOT EXISTS email VARCHAR(255) NOT NULL DEFAULT ''")
    await db.query('ALTER TABLE staff ADD COLUMN IF NOT EXISTS photo TEXT')
    return
  }
  await ensureColumn(db, 'staff', 'email', "VARCHAR(255) NOT NULL DEFAULT ''")
  await ensureColumn(db, 'staff', 'photo', 'MEDIUMTEXT NULL')
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
    items: Number(row.items ?? 0),
    outOfStock: Number(row.out_of_stock ?? 1),
    active: row.active == null ? true : Boolean(Number(row.active)),
  }
}

export async function listProducts(): Promise<Product[]> {
  const db = await getDb()
  const { rows } = await db.query<ProductRow>(
    `
    SELECT p.id, p.name, p.category, p.brand, p.model, p.spec, p.price, p.previous_price, p.image, p.items,
           COALESCE(c.out_of_stock, 1) AS out_of_stock, p.active
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
    product.items,
    product.outOfStock,
    product.active ? 1 : 0,
  ]
  let id = product.id
  if (id > 0) {
    await db.query(
      `
      UPDATE products
      SET name = ?, category = ?, brand = ?, model = ?, spec = ?, price = ?, previous_price = ?, image = ?, items = ?, out_of_stock = ?, active = ?
      WHERE id = ?
      `,
      [...values, id],
    )
  } else {
    const result = await db.query(
      `
      INSERT INTO products (name, category, brand, model, spec, price, previous_price, image, items, out_of_stock, active)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
  let products: Product[] = []
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
    minItems: Number(row.min_items ?? 0),
    outOfStock: Number(row.out_of_stock ?? 1),
  }
}

export async function listCategories(): Promise<CategoryRecord[]> {
  const db = await getDb()
  const { rows } = await db.query<CategoryRow>(
    'SELECT id, name, active, sort_order, min_items, out_of_stock FROM categories ORDER BY sort_order, name',
  )
  return rows.map(rowToCategory).filter((item) => Number.isInteger(item.id) && item.id > 0)
}

export async function upsertCategory(category: CategoryRecord): Promise<CategoryRecord> {
  const db = await getDb()
  let id = category.id
  if (id > 0) {
    await db.query(
      'UPDATE categories SET name = ?, active = ?, sort_order = ?, min_items = ?, out_of_stock = ? WHERE id = ?',
      [category.name, category.active ? 1 : 0, category.sortOrder, category.minItems, category.outOfStock, id],
    )
  } else {
    const result = await db.query(
      'INSERT INTO categories (name, active, sort_order, min_items, out_of_stock) VALUES (?, ?, ?, ?, ?)',
      [category.name, category.active ? 1 : 0, category.sortOrder, category.minItems, category.outOfStock],
    )
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

async function seedCategoriesIfEmpty() {
  const db = pool
  if (!db) return
  for (const category of seedCategories) {
    await db.query(
      ignoreInsert(
        `
      INSERT IGNORE INTO categories (id, name, active, sort_order, min_items)
      VALUES (?, ?, ?, ?, ?)
      `,
        db.dialect,
      ),
      [category.id, category.name, category.active ? 1 : 0, category.sortOrder, category.minItems],
    )
  }
}

export function rowToBrand(row: BrandRow): BrandRecord {
  return {
    id: Number(row.id),
    name: row.name,
    image: row.image,
    active: Boolean(Number(row.active)),
  }
}

export async function listBrands(): Promise<BrandRecord[]> {
  const db = await getDb()
  const { rows } = await db.query<BrandRow>('SELECT id, name, image, active FROM brands ORDER BY name')
  return rows.map(rowToBrand).filter((item) => Number.isInteger(item.id) && item.id > 0)
}

export async function upsertBrand(brand: BrandRecord): Promise<BrandRecord> {
  const db = await getDb()
  const { rows: taken } = await db.query<{ id: number }>('SELECT id FROM brands WHERE name = ? LIMIT 1', [brand.name])
  const existingId = Number(taken[0]?.id)
  if (existingId && existingId !== brand.id) {
    throw new Error('That brand name is already in use.')
  }
  let id = brand.id
  if (id > 0) {
    await db.query('UPDATE brands SET name = ?, image = ?, active = ? WHERE id = ?', [
      brand.name,
      brand.image,
      brand.active ? 1 : 0,
      id,
    ])
  } else {
    const result = await db.query('INSERT INTO brands (name, image, active) VALUES (?, ?, ?)', [
      brand.name,
      brand.image,
      brand.active ? 1 : 0,
    ])
    id = result.insertId
  }
  const saved = { ...brand, id }
  await exportBrandsJson()
  return saved
}

export async function deleteBrand(id: number) {
  const db = await getDb()
  const { rows } = await db.query<{ name: string }>('SELECT name FROM brands WHERE id = ? LIMIT 1', [id])
  const name = rows[0]?.name
  if (name) {
    const used = await db.query<{ total: number }>('SELECT COUNT(*) AS total FROM products WHERE brand = ?', [name])
    if (Number(used.rows[0]?.total) > 0) {
      throw new Error('Move or delete products with this brand first.')
    }
  }
  await db.query('DELETE FROM brands WHERE id = ?', [id])
  await exportBrandsJson()
}

export function normalizeVoucherCode(value: string) {
  return value.trim().toUpperCase().replace(/[^A-Z0-9-]+/g, '')
}

function voucherAmount(value: number | string) {
  const amount = Number(value)
  return Number.isFinite(amount) ? Math.round(amount * 100) / 100 : 0
}

export function rowToVoucher(row: VoucherRow): VoucherRecord {
  return {
    id: Number(row.id),
    name: row.name,
    code: row.code,
    type: Number(row.discount_type) === 2 ? 2 : 1,
    value: voucherAmount(row.discount_value),
    percentage: voucherAmount(row.percentage),
    active: Boolean(Number(row.active)),
  }
}

const voucherColumns = 'id, name, code, discount_type, discount_value, percentage, active'

export async function listVouchers(): Promise<VoucherRecord[]> {
  const db = await getDb()
  const { rows } = await db.query<VoucherRow>(`SELECT ${voucherColumns} FROM vouchers ORDER BY name, code`)
  return rows.map(rowToVoucher).filter((item) => Number.isInteger(item.id) && item.id > 0)
}

export async function findActiveVoucher(code: string): Promise<VoucherRecord | null> {
  const db = await getDb()
  const normalized = normalizeVoucherCode(code)
  if (!normalized) return null
  const { rows } = await db.query<VoucherRow>(
    `SELECT ${voucherColumns} FROM vouchers WHERE code = ? LIMIT 1`,
    [normalized],
  )
  const voucher = rows[0] ? rowToVoucher(rows[0]) : null
  return voucher?.active ? voucher : null
}

export async function upsertVoucher(voucher: VoucherRecord): Promise<VoucherRecord> {
  const db = await getDb()
  const code = normalizeVoucherCode(voucher.code)
  const name = voucher.name.trim()
  const type = voucher.type === 2 ? 2 : voucher.type === 1 ? 1 : 0
  const value = type === 2 ? voucherAmount(voucher.value) : 0
  const percentage = type === 1 ? voucherAmount(voucher.percentage) : 0
  if (!name) throw new Error('Enter a name.')
  if (code.length < 2) throw new Error('Enter a code with at least 2 letters or numbers.')
  if (type !== 1 && type !== 2) throw new Error('Choose type 1 for a percentage or type 2 for a value.')
  if (type === 1 && (percentage <= 0 || percentage > 100)) throw new Error('Enter a percentage from 0 to 100.')
  if (type === 2 && value <= 0) throw new Error('Enter a value greater than 0.')
  const { rows: taken } = await db.query<{ id: number }>('SELECT id FROM vouchers WHERE code = ? LIMIT 1', [code])
  const existingId = Number(taken[0]?.id)
  if (existingId && existingId !== voucher.id) {
    throw new Error('That code is already in use.')
  }
  let id = voucher.id
  if (id > 0) {
    await db.query(
      'UPDATE vouchers SET name = ?, code = ?, discount_type = ?, discount_value = ?, percentage = ?, active = ? WHERE id = ?',
      [name, code, type, value, percentage, voucher.active ? 1 : 0, id],
    )
  } else {
    const result = await db.query(
      'INSERT INTO vouchers (name, code, discount_type, discount_value, percentage, active) VALUES (?, ?, ?, ?, ?, ?)',
      [name, code, type, value, percentage, voucher.active ? 1 : 0],
    )
    id = result.insertId
  }
  return { id, name, code, type, value, percentage, active: voucher.active }
}

export async function deleteVoucher(id: number) {
  const db = await getDb()
  await db.query('DELETE FROM vouchers WHERE id = ?', [id])
}

export async function exportBrandsJson() {
  let brands = seedBrands
  try {
    brands = await listBrands()
  } catch {
    // GitHub Pages build has no database
  }
  const body = `${JSON.stringify(brands, null, 2)}\n`
  for (const target of jsonTargets('brands.json')) {
    mkdirSync(dirname(target), { recursive: true })
    writeFileSync(target, body)
  }
}

async function seedBrandsIfEmpty() {
  const db = pool
  if (!db) return
  for (const brand of seedBrands) {
    await db.query(
      ignoreInsert(
        `
      INSERT IGNORE INTO brands (id, name, image, active)
      VALUES (?, ?, ?, ?)
      `,
        db.dialect,
      ),
      [brand.id, brand.name, brand.image, brand.active ? 1 : 0],
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

export function rowToHeaderBanner(row: HeaderBannerRow): HeaderBanner {
  return {
    id: Number(row.id),
    text: row.text,
    background: row.background,
    color: row.color || '#ffffff',
    font: parseHeaderBannerFont(row.font),
    bold: row.bold == null ? true : Boolean(Number(row.bold)),
    backgroundOpacity: parseOpacity(row.background_opacity ?? 100),
    active: Boolean(Number(row.active)),
    sortOrder: Number(row.sort_order),
  }
}

export async function listHeaderBanners(): Promise<HeaderBanner[]> {
  const db = await getDb()
  const { rows } = await db.query<HeaderBannerRow>(
    'SELECT id, text, background, background_opacity, color, font, bold, active, sort_order FROM header_banners ORDER BY sort_order, id',
  )
  return rows.map(rowToHeaderBanner).filter((item) => Number.isInteger(item.id) && item.id > 0)
}

export async function upsertHeaderBanner(banner: HeaderBanner): Promise<HeaderBanner> {
  const db = await getDb()
  const values = [
    banner.text,
    banner.background,
    banner.color,
    banner.font,
    banner.bold ? 1 : 0,
    banner.backgroundOpacity,
    banner.active ? 1 : 0,
    banner.sortOrder,
  ]
  let id = banner.id
  if (id > 0) {
    await db.query(
      `
      UPDATE header_banners
      SET text = ?, background = ?, color = ?, font = ?, bold = ?, background_opacity = ?, active = ?, sort_order = ?
      WHERE id = ?
      `,
      [...values, id],
    )
  } else {
    const result = await db.query(
      'INSERT INTO header_banners (text, background, color, font, bold, background_opacity, active, sort_order) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      values,
    )
    id = result.insertId
  }
  const saved = { ...banner, id }
  await exportHeaderBannersJson()
  return saved
}

export async function deleteHeaderBanner(id: number) {
  const db = await getDb()
  await db.query('DELETE FROM header_banners WHERE id = ?', [id])
  await exportHeaderBannersJson()
}

export async function exportHeaderBannersJson() {
  let banners: HeaderBanner[] = []
  try {
    banners = await listHeaderBanners()
  } catch {
    // GitHub Pages build has no database
  }
  const body = `${JSON.stringify(banners, null, 2)}\n`
  for (const target of jsonTargets('header-banners.json')) {
    mkdirSync(dirname(target), { recursive: true })
    writeFileSync(target, body)
  }
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
  email: string
  photo: string
  passwordHash: string
  role: UserRole
  active: boolean
}

type StaffRow = {
  id: number
  username: string
  email?: string | null
  photo?: string | null
  password_hash: string
  role: string
  active: number
}

function rowToStaff(row: StaffRow): UserRecord {
  return {
    id: Number(row.id),
    username: row.username,
    email: String(row.email ?? ''),
    photo: String(row.photo ?? ''),
    passwordHash: row.password_hash,
    role: parseRole(row.role),
    active: Boolean(Number(row.active)),
  }
}

export function publicUserFromRecord(record: UserRecord): PublicUser {
  return {
    id: record.id,
    username: record.username,
    email: record.email,
    photo: record.photo,
    role: record.role,
    active: record.active,
    permissions: permissionsForRole(record.role),
  }
}

type CustomerRow = {
  id: number
  email: string
  kind: string
  first_name: string
  last_name: string
  company: string
  tax_id: string
  phone: string
  street: string
  city: string
  postcode: string
  province: string
  country: string
  order_count: number | string
  created_at: Date | string
  updated_at: Date | string
}

type OrderRow = {
  id: number
  order_ref: string
  email: string
  customer_name: string
  phone: string
  street: string
  city: string
  postcode: string
  province: string
  country: string
  order_lines: string
  total: number | string
  discount: number | string
  total_paid: number | string
  status: string
  placed_at: Date | string
}

const customerColumns =
  'c.id, c.email, c.kind, c.first_name, c.last_name, c.company, c.tax_id, c.phone, c.street, c.city, c.postcode, c.province, c.country, c.created_at, c.updated_at'

function asIso(value: Date | string) {
  if (value instanceof Date) return value.toISOString()
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? String(value) : date.toISOString()
}

function asStatus(value: string): ShopOrderStatus {
  if (value === 'processing' || value === 'sent' || value === 'delivered' || value === 'placed') return value
  if (value === 'packed') return 'processing'
  return 'placed'
}

function asKind(value: string): ShopCustomer['kind'] {
  if (value === 'private' || value === 'business') return value
  return ''
}

function readLines(value: unknown): ShopOrderLine[] {
  try {
    const parsed = typeof value === 'string' ? JSON.parse(value) : value
    if (!Array.isArray(parsed)) return []
    return parsed.flatMap((line) => {
      if (!line || typeof line !== 'object') return []
      const item = line as Partial<ShopOrderLine>
      const name = String(item.name ?? '').trim()
      if (!name) return []
      return [{
        id: Number(item.id) || 0,
        name,
        detail: String(item.detail ?? ''),
        quantity: Number(item.quantity) || 0,
        price: Number(item.price) || 0,
      }]
    })
  } catch {
    return []
  }
}

function rowToCustomer(row: CustomerRow): ShopCustomer {
  return {
    id: Number(row.id),
    email: row.email,
    kind: asKind(row.kind),
    firstName: row.first_name,
    lastName: row.last_name,
    company: row.company,
    taxId: row.tax_id,
    phone: row.phone,
    street: row.street,
    city: row.city,
    postcode: row.postcode,
    province: row.province,
    country: row.country,
    orderCount: Number(row.order_count) || 0,
    createdAt: asIso(row.created_at),
    updatedAt: asIso(row.updated_at),
  }
}

function roundMoney(value: number | string | null | undefined) {
  const amount = Number(value)
  return Number.isFinite(amount) ? Math.round(amount * 100) / 100 : 0
}

function voucherDiscount(total: number, voucher: { type: 1 | 2; value: number; percentage: number }) {
  const base = Math.max(0, Math.round(total * 100))
  const percentOff = voucher.type === 2 ? 0 : Math.round((base * voucher.percentage) / 100)
  const valueOff = voucher.type === 1 ? 0 : Math.round(voucher.value * 100)
  return Math.min(base, Math.max(0, percentOff) + Math.max(0, valueOff)) / 100
}

const orderColumns =
  'id, order_ref, email, customer_name, phone, street, city, postcode, province, country, order_lines, total, discount, total_paid, status, placed_at'

function rowToOrder(row: OrderRow): ShopOrder {
  const lines = readLines(row.order_lines)
  const total = roundMoney(row.total)
  const discount = Math.min(total, Math.max(0, roundMoney(row.discount)))
  return {
    id: Number(row.id),
    ref: row.order_ref,
    email: row.email,
    name: row.customer_name,
    phone: row.phone,
    street: row.street,
    city: row.city,
    postcode: row.postcode,
    province: row.province,
    country: row.country,
    lines,
    total,
    discount,
    totalPaid: roundMoney(total - discount),
    status: asStatus(row.status),
    placedAt: asIso(row.placed_at),
  }
}

async function customerById(id: number) {
  const db = await getDb()
  const { rows } = await db.query<CustomerRow>(
    `
    SELECT ${customerColumns},
      (SELECT COUNT(*) FROM orders o WHERE o.email = c.email) AS order_count
    FROM customers c
    WHERE c.id = ?
    LIMIT 1
    `,
    [id],
  )
  return rows[0] ? rowToCustomer(rows[0]) : null
}

async function orderById(id: number) {
  const db = await getDb()
  const { rows } = await db.query<OrderRow>(
    `
    SELECT ${orderColumns}
    FROM orders
    WHERE id = ?
    LIMIT 1
    `,
    [id],
  )
  return rows[0] ? rowToOrder(rows[0]) : null
}

export async function listShopCustomers(): Promise<ShopCustomer[]> {
  const db = await getDb()
  const { rows } = await db.query<CustomerRow>(
    `
    SELECT ${customerColumns},
      (SELECT COUNT(*) FROM orders o WHERE o.email = c.email) AS order_count
    FROM customers c
    ORDER BY c.created_at DESC, c.id DESC
    `,
  )
  return rows.map(rowToCustomer)
}

export async function orderProgress(email: string, refs: string[]) {
  const unique = [...new Set(refs)].slice(0, 40)
  if (!email || unique.length === 0) return []
  const db = await getDb()
  const marks = unique.map(() => '?').join(', ')
  const { rows } = await db.query<{ order_ref: string; status: string }>(
    `SELECT order_ref, status FROM orders WHERE email = ? AND order_ref IN (${marks})`,
    [email, ...unique],
  )
  return rows.map((row) => ({ ref: row.order_ref, status: asStatus(row.status) }))
}

export async function listShopOrders(): Promise<ShopOrder[]> {
  const db = await getDb()
  const { rows } = await db.query<OrderRow>(
    `
    SELECT ${orderColumns}
    FROM orders
    ORDER BY placed_at DESC, id DESC
    `,
  )
  return rows.map(rowToOrder)
}

export async function saveShopCustomer(input: ShopCustomerInput, overwrite: boolean): Promise<ShopCustomer> {
  const db = await getDb()
  const hash = input.passwordHash ?? ''
  const existing = await db.query<{ id: number }>(
    'SELECT id FROM customers WHERE email = ? LIMIT 1',
    [input.email],
  )
  const id = Number(existing.rows[0]?.id ?? 0)
  if (!id) {
    const inserted = await db.query(
      `
      INSERT INTO customers (
        email, kind, first_name, last_name, company, tax_id, phone, street, city, postcode, province, country, password_hash
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      [
        input.email, input.kind, input.firstName, input.lastName, input.company, input.taxId,
        input.phone, input.street, input.city, input.postcode, input.province, input.country, hash,
      ],
    )
    const saved = await customerById(inserted.insertId)
    if (!saved) throw new Error('Could not save that customer.')
    return saved
  }
  if (overwrite) {
    const hashRow = await db.query<{ password_hash: string }>(
      'SELECT password_hash FROM customers WHERE id = ? LIMIT 1',
      [id],
    )
    const storedHash = hashRow.rows[0]?.password_hash ?? ''
    if (storedHash && storedHash !== hash) {
      throw new Error('That email already has an account.')
    }
    await db.query(
      `
      UPDATE customers SET
        kind = ?, first_name = ?, last_name = ?, company = ?, tax_id = ?, phone = ?,
        street = ?, city = ?, postcode = ?, province = ?, country = ?,
        password_hash = CASE WHEN password_hash = '' AND ? <> '' THEN ? ELSE password_hash END,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
      `,
      [
        input.kind, input.firstName, input.lastName, input.company, input.taxId, input.phone,
        input.street, input.city, input.postcode, input.province, input.country, hash, hash, id,
      ],
    )
  }
  const saved = await customerById(id)
  if (!saved) throw new Error('Could not save that customer.')
  return saved
}

export async function updateShopCustomer(id: number, input: ShopCustomerInput): Promise<ShopCustomer> {
  const db = await getDb()
  const current = await db.query<{ id: number; email: string }>(
    'SELECT id, email FROM customers WHERE id = ? LIMIT 1',
    [id],
  )
  const row = current.rows[0]
  if (!row) throw new Error('That customer was not found.')
  const taken = await db.query<{ id: number }>(
    'SELECT id FROM customers WHERE email = ? AND id <> ? LIMIT 1',
    [input.email, id],
  )
  if (taken.rows.length > 0) throw new Error('Another customer already uses that email.')
  await db.query(
    `
    UPDATE customers SET
      email = ?, kind = ?, first_name = ?, last_name = ?, company = ?, tax_id = ?, phone = ?,
      street = ?, city = ?, postcode = ?, province = ?, country = ?, updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
    `,
    [
      input.email, input.kind, input.firstName, input.lastName, input.company, input.taxId, input.phone,
      input.street, input.city, input.postcode, input.province, input.country, id,
    ],
  )
  if (row.email !== input.email) {
    await db.query('UPDATE orders SET email = ? WHERE email = ?', [input.email, row.email])
  }
  const saved = await customerById(id)
  if (!saved) throw new Error('Could not save that customer.')
  return saved
}

export async function saveShopOrder(input: ShopOrderInput): Promise<ShopOrder> {
  const db = await getDb()
  const existing = await db.query<{ id: number }>(
    'SELECT id FROM orders WHERE order_ref = ? LIMIT 1',
    [input.ref],
  )
  const existingId = Number(existing.rows[0]?.id ?? 0)
  if (existingId) {
    const saved = await orderById(existingId)
    if (!saved) throw new Error('Could not save that order.')
    return saved
  }
  const total = roundMoney(input.lines.reduce((sum, line) => sum + line.price * line.quantity, 0))
  const voucher = input.discountCode ? await findActiveVoucher(input.discountCode) : null
  if (input.discountCode && !voucher) throw new Error('That discount code is not valid.')
  const discount = voucher ? voucherDiscount(total, voucher) : 0
  const totalPaid = roundMoney(total - discount)
  const placed = new Date(input.placedAt)
  const inserted = await db.query(
    `
    INSERT INTO orders (
      order_ref, email, customer_name, phone, street, city, postcode, province, country, order_lines, total, discount, total_paid, status, placed_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'placed', ?)
    `,
    [
      input.ref, input.email, input.name, input.phone, input.street, input.city, input.postcode,
      input.province, input.country, JSON.stringify(input.lines), total, discount, totalPaid,
      Number.isNaN(placed.getTime()) ? new Date() : placed,
    ],
  )
  const saved = await orderById(inserted.insertId)
  if (!saved) throw new Error('Could not save that order.')
  return saved
}

export async function updateShopOrder(id: number, input: ShopOrderInput): Promise<ShopOrder> {
  const db = await getDb()
  const current = await orderById(id)
  if (!current) throw new Error('That order was not found.')
  const total = roundMoney(input.lines.reduce((sum, line) => sum + line.price * line.quantity, 0))
  const discount = Math.min(total, Math.max(0, current.discount))
  const totalPaid = roundMoney(total - discount)
  await db.query(
    `
    UPDATE orders SET
      email = ?, customer_name = ?, phone = ?, street = ?, city = ?, postcode = ?, province = ?, country = ?,
      order_lines = ?, total = ?, discount = ?, total_paid = ?, status = ?
    WHERE id = ?
    `,
    [
      input.email, input.name, input.phone, input.street, input.city, input.postcode, input.province,
      input.country, JSON.stringify(input.lines), total, discount, totalPaid, input.status ?? current.status, id,
    ],
  )
  const saved = await orderById(id)
  if (!saved) throw new Error('Could not save that order.')
  return saved
}

const staffSelect =
  'SELECT id, username, email, photo, password_hash, role, active FROM staff'

export async function findStaffById(id: number): Promise<UserRecord | undefined> {
  const db = await getDb()
  const { rows } = await db.query<StaffRow>(`${staffSelect} WHERE id = ? LIMIT 1`, [id])
  const row = rows[0]
  if (!row) return undefined
  return rowToStaff(row)
}

export async function findLoginByUsername(username: string): Promise<UserRecord | undefined> {
  const db = await getDb()
  const { rows } = await db.query<StaffRow>(`${staffSelect} WHERE username = ? LIMIT 1`, [username])
  const row = rows[0]
  if (!row) return undefined
  return rowToStaff(row)
}

export async function listStaff(): Promise<PublicUser[]> {
  const db = await getDb()
  const { rows } = await db.query<StaffRow>(`${staffSelect} ORDER BY role, username`)
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

export async function updateOwnAccount(input: {
  id: number
  username: string
  email: string
  photo: string
  currentPassword?: string
  newPassword?: string
}): Promise<PublicUser> {
  const db = await getDb()
  const existing = await findStaffById(input.id)
  if (!existing) throw new Error('Account not found.')

  const usernameTaken = await findLoginByUsername(input.username)
  if (usernameTaken && usernameTaken.id !== existing.id) {
    throw new Error('That username is already in use.')
  }

  let passwordHash = existing.passwordHash
  if (input.newPassword) {
    if (!input.currentPassword || !verifyPassword(input.currentPassword, existing.passwordHash)) {
      throw new Error('Current password is not correct.')
    }
    passwordHash = hashPassword(input.newPassword)
  }

  await db.query('UPDATE staff SET username = ?, email = ?, photo = ?, password_hash = ? WHERE id = ?', [
    input.username,
    input.email,
    input.photo,
    passwordHash,
    existing.id,
  ])
  const saved = await findStaffById(existing.id)
  if (!saved) throw new Error('Could not save account.')
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
  const password = process.env.ADMIN_PASSWORD ?? ''
  if (!password) return
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

async function seedVisitorStaff() {
  const db = pool
  if (!db) return
  const username = process.env.VISITOR_USER ?? 'visitor'
  const password = process.env.VISITOR_PASSWORD ?? 'welcome'
  const existing = await db.query<{ id: number }>('SELECT id FROM staff WHERE username = ? LIMIT 1', [username])
  if (existing.rows.length > 0) {
    await db.query("UPDATE staff SET role = 'visitor', active = 1 WHERE id = ?", [existing.rows[0].id])
    return
  }
  await db.query(
    `
    INSERT INTO staff (username, password_hash, role, active)
    VALUES (?, ?, 'visitor', 1)
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
