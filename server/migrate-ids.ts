import type mysql from 'mysql2/promise'
import { seedBanners } from '../src/data/banner.ts'
import { seedCategories, seedProducts } from '../src/data/catalog.ts'
import { parseRole } from '../src/data/permissions.ts'

function isIntegerType(type: string) {
  const next = type.toLowerCase()
  return (
    next.startsWith('int') ||
    next.startsWith('bigint') ||
    next.startsWith('mediumint') ||
    next.startsWith('smallint') ||
    next.startsWith('tinyint')
  )
}

async function columnType(db: mysql.Pool, table: string, column: string): Promise<string> {
  const [rows] = await db.query<mysql.RowDataPacket[]>(`SHOW COLUMNS FROM \`${table}\` LIKE ?`, [column])
  return String(rows[0]?.Type ?? '')
}

async function tableExists(db: mysql.Pool, table: string): Promise<boolean> {
  const [rows] = await db.query<mysql.RowDataPacket[]>(
    `
    SELECT TABLE_NAME FROM information_schema.TABLES
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?
    `,
    [table],
  )
  return rows.length > 0
}

async function idIsInteger(db: mysql.Pool, table: string): Promise<boolean> {
  if (!(await tableExists(db, table))) return true
  return isIntegerType(await columnType(db, table, 'id'))
}

async function dropForeignKeysOn(db: mysql.Pool, table: string) {
  const [rows] = await db.query<mysql.RowDataPacket[]>(
    `
    SELECT CONSTRAINT_NAME FROM information_schema.TABLE_CONSTRAINTS
    WHERE CONSTRAINT_SCHEMA = DATABASE()
      AND TABLE_NAME = ?
      AND CONSTRAINT_TYPE = 'FOREIGN KEY'
    `,
    [table],
  )
  for (const row of rows as { CONSTRAINT_NAME: string }[]) {
    await db.query(`ALTER TABLE \`${table}\` DROP FOREIGN KEY \`${row.CONSTRAINT_NAME}\``)
  }
}

function nextMappedId(oldId: string, used: Set<number>, preferred?: number): number {
  if (preferred && preferred > 0 && !used.has(preferred)) {
    used.add(preferred)
    return preferred
  }
  const numeric = Number(oldId)
  if (Number.isInteger(numeric) && numeric > 0 && !used.has(numeric)) {
    used.add(numeric)
    return numeric
  }
  let next = 1
  while (used.has(next)) next += 1
  used.add(next)
  return next
}

async function replaceTable(db: mysql.Pool, current: string, next: string) {
  await db.query('SET FOREIGN_KEY_CHECKS = 0')
  await db.query(`DROP TABLE IF EXISTS \`${current}_old\``)
  await db.query(`RENAME TABLE \`${current}\` TO \`${current}_old\`, \`${next}\` TO \`${current}\``)
  await db.query(`DROP TABLE \`${current}_old\``)
  await db.query('SET FOREIGN_KEY_CHECKS = 1')
}

async function rebuildCatalog(db: mysql.Pool) {
  await dropForeignKeysOn(db, 'products')
  await db.query('SET FOREIGN_KEY_CHECKS = 0')
  await db.query('DROP TABLE IF EXISTS categories_new')
  await db.query('DROP TABLE IF EXISTS products_new')

  await db.query(`
    CREATE TABLE categories_new (
      id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      active TINYINT(1) NOT NULL DEFAULT 1,
      sort_order INT NOT NULL DEFAULT 0
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `)
  const [categoryRows] = await db.query<mysql.RowDataPacket[]>(
    'SELECT id, name, active, sort_order FROM categories',
  )
  const categoryMap = new Map<string, number>()
  const usedCategoryIds = new Set<number>()
  const nameToId = new Map<string, number>()
  for (const row of categoryRows) {
    const oldId = String(row.id)
    const name = String(row.name)
    const existing = nameToId.get(name)
    if (existing) {
      categoryMap.set(oldId, existing)
      continue
    }
    const seed = seedCategories.find((item) => item.name === name)
    const id = nextMappedId(oldId, usedCategoryIds, seed?.id)
    nameToId.set(name, id)
    categoryMap.set(oldId, id)
    await db.query(
      'INSERT INTO categories_new (id, name, active, sort_order) VALUES (?, ?, ?, ?)',
      [id, row.name, row.active ? 1 : 0, Number(row.sort_order ?? 0)],
    )
  }

  await db.query(`
    CREATE TABLE products_new (
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
  const [productRows] = await db.query<mysql.RowDataPacket[]>(
    'SELECT id, name, category, brand, model, spec, price, previous_price, image, active FROM products',
  )
  const usedProductIds = new Set<number>()
  const fallbackCategory = seedCategories[0]?.id ?? 1
  for (const row of productRows) {
    const seed = seedProducts.find((item) => item.name === String(row.name))
    const id = nextMappedId(String(row.id), usedProductIds, seed?.id)
    const category =
      categoryMap.get(String(row.category)) ??
      seed?.category ??
      fallbackCategory
    await db.query(
      `
      INSERT INTO products_new (id, name, category, brand, model, spec, price, previous_price, image, active)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      [
        id,
        row.name,
        category,
        row.brand,
        row.model,
        row.spec,
        Number(row.price),
        row.previous_price == null ? null : Number(row.previous_price),
        row.image,
        row.active == null ? 1 : row.active ? 1 : 0,
      ],
    )
  }

  await replaceTable(db, 'categories', 'categories_new')
  await replaceTable(db, 'products', 'products_new')
  await db.query('SET FOREIGN_KEY_CHECKS = 1')
}

async function rebuildBanners(db: mysql.Pool) {
  await db.query('DROP TABLE IF EXISTS banners_new')
  await db.query(`
    CREATE TABLE banners_new (
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
  const [rows] = await db.query<mysql.RowDataPacket[]>(
    'SELECT id, title, body, cta_label, cta_href, image, active, sort_order FROM banners',
  )
  const used = new Set<number>()
  const seenTitles = new Set<string>()
  for (const row of rows) {
    const title = String(row.title)
    if (seenTitles.has(title)) continue
    seenTitles.add(title)
    const seed = seedBanners.find((item) => item.title === title)
    const id = nextMappedId(String(row.id), used, seed?.id)
    const href = String(row.cta_href ?? '')
      .replace('?category=LCD', '?category=2')
      .replace('?category=Batteries', '?category=1')
    await db.query(
      `
      INSERT INTO banners_new (id, title, body, cta_label, cta_href, image, active, sort_order)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `,
      [
        id,
        row.title,
        row.body,
        row.cta_label,
        href,
        row.image,
        row.active ? 1 : 0,
        Number(row.sort_order ?? 0),
      ],
    )
  }
  await replaceTable(db, 'banners', 'banners_new')
}

async function rebuildStaff(db: mysql.Pool) {
  await dropForeignKeysOn(db, 'staff_permissions')
  await db.query('SET FOREIGN_KEY_CHECKS = 0')
  await db.query('DROP TABLE IF EXISTS staff_new')
  await db.query('DROP TABLE IF EXISTS staff_permissions_new')
  await db.query(`
    CREATE TABLE staff_new (
      id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
      username VARCHAR(64) NOT NULL UNIQUE,
      password_hash VARCHAR(255) NOT NULL,
      role VARCHAR(16) NOT NULL DEFAULT 'staff',
      active TINYINT(1) NOT NULL DEFAULT 1
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `)
  const [staffRows] = await db.query<mysql.RowDataPacket[]>(
    'SELECT id, username, password_hash, active FROM staff',
  )
  const staffMap = new Map<string, number>()
  const used = new Set<number>()
  for (const row of staffRows) {
    const id = nextMappedId(String(row.id), used)
    staffMap.set(String(row.id), id)
    await db.query(
      'INSERT INTO staff_new (id, username, password_hash, role, active) VALUES (?, ?, ?, ?, ?)',
      [id, row.username, row.password_hash, parseRole(row.role), row.active ? 1 : 0],
    )
  }

  await db.query(`
    CREATE TABLE staff_permissions_new (
      staff_id INT NOT NULL,
      permission VARCHAR(64) NOT NULL,
      PRIMARY KEY (staff_id, permission)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `)
  if (await tableExists(db, 'staff_permissions')) {
    const [permRows] = await db.query<mysql.RowDataPacket[]>(
      'SELECT staff_id, permission FROM staff_permissions',
    )
    for (const row of permRows) {
      const staffId = staffMap.get(String(row.staff_id))
      if (!staffId) continue
      await db.query(
        'INSERT IGNORE INTO staff_permissions_new (staff_id, permission) VALUES (?, ?)',
        [staffId, row.permission],
      )
    }
    await replaceTable(db, 'staff_permissions', 'staff_permissions_new')
  } else {
    await db.query('RENAME TABLE staff_permissions_new TO staff_permissions')
  }

  await replaceTable(db, 'staff', 'staff_new')
  await db.query('SET FOREIGN_KEY_CHECKS = 1')
}

async function rebuildUsers(db: mysql.Pool) {
  if (await tableExists(db, 'user_permissions')) {
    await dropForeignKeysOn(db, 'user_permissions')
  }
  await db.query('SET FOREIGN_KEY_CHECKS = 0')
  await db.query('DROP TABLE IF EXISTS users_new')
  await db.query(`
    CREATE TABLE users_new (
      id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
      username VARCHAR(64) NOT NULL UNIQUE,
      password_hash VARCHAR(255) NOT NULL,
      role VARCHAR(16) NOT NULL,
      active TINYINT(1) NOT NULL DEFAULT 1
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `)
  const [rows] = await db.query<mysql.RowDataPacket[]>(
    'SELECT id, username, password_hash, role, active FROM users',
  )
  const used = new Set<number>()
  for (const row of rows) {
    const id = nextMappedId(String(row.id), used, String(row.role) === 'admin' ? 1 : undefined)
    await db.query(
      'INSERT INTO users_new (id, username, password_hash, role, active) VALUES (?, ?, ?, ?, ?)',
      [id, row.username, row.password_hash, row.role, row.active ? 1 : 0],
    )
  }
  await replaceTable(db, 'users', 'users_new')
  if (await tableExists(db, 'user_permissions')) {
    await db.query('DROP TABLE IF EXISTS user_permissions')
  }
  await db.query('SET FOREIGN_KEY_CHECKS = 1')
}

async function dedupeCategories(db: mysql.Pool) {
  if (!(await tableExists(db, 'categories'))) return
  const [rows] = await db.query<mysql.RowDataPacket[]>('SELECT id, name FROM categories ORDER BY id')
  const groups = new Map<string, number[]>()
  for (const row of rows) {
    const name = String(row.name)
    const list = groups.get(name) ?? []
    list.push(Number(row.id))
    groups.set(name, list)
  }
  for (const [name, ids] of groups) {
    if (ids.length < 2) continue
    const seed = seedCategories.find((item) => item.name === name)
    const keeper = seed && ids.includes(seed.id) ? seed.id : Math.min(...ids)
    for (const id of ids) {
      if (id === keeper) continue
      await db.query('UPDATE products SET category = ? WHERE category = ?', [keeper, id])
      await db.query('DELETE FROM categories WHERE id = ?', [id])
    }
  }
}

async function dedupeBanners(db: mysql.Pool) {
  if (!(await tableExists(db, 'banners'))) return
  const [rows] = await db.query<mysql.RowDataPacket[]>('SELECT id, title FROM banners ORDER BY id')
  const groups = new Map<string, number[]>()
  for (const row of rows) {
    const title = String(row.title)
    const list = groups.get(title) ?? []
    list.push(Number(row.id))
    groups.set(title, list)
  }
  for (const [title, ids] of groups) {
    if (ids.length < 2) continue
    const seed = seedBanners.find((item) => item.title === title)
    const keeper = seed && ids.includes(seed.id) ? seed.id : Math.min(...ids)
    for (const id of ids) {
      if (id === keeper) continue
      await db.query('DELETE FROM banners WHERE id = ?', [id])
    }
  }
}

async function deleteNonNumericIdRows(db: mysql.Pool, table: string, column = 'id') {
  if (!(await tableExists(db, table))) return 0
  const type = await columnType(db, table, column)
  if (!type) return 0
  const [before] = await db.query<mysql.RowDataPacket[]>(`SELECT COUNT(*) AS n FROM \`${table}\``)
  if (isIntegerType(type)) {
    await db.query(`DELETE FROM \`${table}\` WHERE \`${column}\` IS NULL OR \`${column}\` < 1`)
  } else {
    await db.query(
      `DELETE FROM \`${table}\`
       WHERE \`${column}\` IS NULL
          OR TRIM(CAST(\`${column}\` AS CHAR)) = ''
          OR CAST(\`${column}\` AS CHAR) NOT REGEXP '^[0-9]+$'
          OR CAST(\`${column}\` AS UNSIGNED) < 1`,
    )
  }
  const [after] = await db.query<mysql.RowDataPacket[]>(`SELECT COUNT(*) AS n FROM \`${table}\``)
  return Number(before[0]?.n ?? 0) - Number(after[0]?.n ?? 0)
}

export async function migrateNumericIds(db: mysql.Pool) {
  const categoryPkIsInt = await idIsInteger(db, 'categories')
  const productCategoryIsInt =
    (await tableExists(db, 'products')) && isIntegerType(await columnType(db, 'products', 'category'))
  if (!categoryPkIsInt || !productCategoryIsInt) {
    await rebuildCatalog(db)
  }
  if (!(await idIsInteger(db, 'banners'))) {
    await rebuildBanners(db)
  }
  if (!(await idIsInteger(db, 'staff'))) {
    await rebuildStaff(db)
  }
  if (!(await idIsInteger(db, 'users'))) {
    await rebuildUsers(db)
  }

  await db.query('SET FOREIGN_KEY_CHECKS = 0')
  if (await tableExists(db, 'user_permissions')) {
    await dropForeignKeysOn(db, 'user_permissions')
    await db.query('DROP TABLE IF EXISTS user_permissions')
  }
  for (const leftover of [
    'categories_old',
    'products_old',
    'banners_old',
    'staff_old',
    'staff_permissions_old',
    'users_old',
    'categories_new',
    'products_new',
    'banners_new',
    'staff_new',
    'staff_permissions_new',
    'users_new',
  ]) {
    if (await tableExists(db, leftover)) {
      await db.query(`DROP TABLE IF EXISTS \`${leftover}\``)
    }
  }
  await db.query('SET FOREIGN_KEY_CHECKS = 1')
  await deleteNonNumericIdRows(db, 'products', 'category')
  await deleteNonNumericIdRows(db, 'products')
  await deleteNonNumericIdRows(db, 'categories')
  await deleteNonNumericIdRows(db, 'banners')
  await deleteNonNumericIdRows(db, 'staff')
  await deleteNonNumericIdRows(db, 'staff_permissions', 'staff_id')
  await deleteNonNumericIdRows(db, 'users')
  await dedupeCategories(db)
  await dedupeBanners(db)
}
