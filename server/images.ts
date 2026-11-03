import { existsSync, mkdirSync, readdirSync, writeFileSync } from 'node:fs'
import { basename, dirname, extname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const imageName = /\.(png|jpe?g|gif|svg|webp)$/i
const allowedExt = new Set(['.png', '.jpg', '.jpeg', '.webp', '.gif', '.svg'])
const mimeExt: Record<string, string> = {
  'image/png': '.png',
  'image/jpeg': '.jpg',
  'image/jpg': '.jpg',
  'image/webp': '.webp',
  'image/gif': '.gif',
  'image/svg+xml': '.svg',
}

function shopPublicDir() {
  const shop = process.env.SHOP_JSON_PATH?.trim()
  if (shop) return dirname(resolve(root, shop))
  return join(root, '..', 'New Project', 'public')
}

export function listShopImages(prefix = '') {
  const needle = prefix.trim().toLowerCase()
  const dirs = [join(shopPublicDir(), 'images'), join(root, 'public', 'images')]
  const found = new Set<string>()

  for (const dir of dirs) {
    if (!existsSync(dir)) continue
    for (const name of readdirSync(dir)) {
      if (!imageName.test(name)) continue
      if (needle && !name.toLowerCase().startsWith(needle)) continue
      found.add(`images/${name}`)
    }
  }

  return [...found].sort((a, b) => a.localeCompare(b))
}

function imageDirs() {
  return [join(shopPublicDir(), 'images'), join(root, 'public', 'images')]
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

export function saveShopImage(input: { filename: string; data: string; brand?: string }) {
  const match = /^data:([^;,]+);base64,(.+)$/i.exec(input.data.trim())
  if (!match) throw new Error('The image file could not be read.')

  const mime = match[1].toLowerCase()
  const extFromName = extname(input.filename).toLowerCase()
  const ext = mimeExt[mime] || (allowedExt.has(extFromName) ? extFromName : '')
  if (!ext || !allowedExt.has(ext)) {
    throw new Error('Use a PNG, JPG, WebP, GIF, or SVG image.')
  }

  const buffer = Buffer.from(match[2], 'base64')
  if (buffer.length < 10) throw new Error('The image file is empty.')
  if (buffer.length > 2 * 1024 * 1024) throw new Error('Use an image smaller than 2 MB.')

  const fromBrand = slugify(input.brand ?? '')
  const fromFile = slugify(basename(input.filename, extname(input.filename)))
  const base = (fromBrand || fromFile || 'brand').replace(/^brand-/, '')
  let name = `brand-${base}${ext}`
  const dirs = imageDirs()
  if (dirs.some((dir) => existsSync(join(dir, name)))) {
    name = `brand-${base}-${Date.now()}${ext}`
  }

  for (const dir of dirs) {
    mkdirSync(dir, { recursive: true })
    writeFileSync(join(dir, name), buffer)
  }

  return `images/${name}`
}
