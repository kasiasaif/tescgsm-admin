import { createReadStream, existsSync, statSync } from 'node:fs'
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http'
import { extname, join, normalize } from 'node:path'
import { fileURLToPath } from 'node:url'
import { currentUser, login, logout, readToken } from './auth.ts'
import { deleteBanner, deleteCategory, deleteProduct, deleteStaff, listBanners, listCategories, listProducts, listStaff, upsertBanner, upsertCategory, upsertProduct, upsertStaff } from './db.ts'
import { type Banner } from '../src/data/banner.ts'
import { type CategoryRecord, type Product } from '../src/data/catalog.ts'
import { hasPermission, parseRole, type Permission, type UserRole } from '../src/data/permissions.ts'

const port = Number(process.env.PORT ?? 3001)
const isProd = process.env.NODE_ENV === 'production'
const host = process.env.HOST ?? (isProd ? '0.0.0.0' : '127.0.0.1')
const distDir = join(fileURLToPath(new URL('.', import.meta.url)), '..', 'dist')
const allowedOrigins = (
  process.env.CORS_ORIGINS ??
  'http://localhost:5173,http://localhost:5174,https://tescgsm.es,https://www.tescgsm.es,https://tescgsm-admin.es,https://www.tescgsm-admin.es'
)
  .split(',')
  .map((item) => item.trim())
  .filter(Boolean)

function send(response: ServerResponse, status: number, body: unknown) {
  response.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' })
  response.end(JSON.stringify(body))
}

function setCors(request: IncomingMessage, response: ServerResponse) {
  const origin = request.headers.origin
  if (origin && allowedOrigins.includes(origin)) {
    response.setHeader('Access-Control-Allow-Origin', origin)
  } else if (!origin) {
    response.setHeader('Access-Control-Allow-Origin', '*')
  }
  response.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS')
  response.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')
}

function unauthorized(response: ServerResponse) {
  send(response, 401, { error: 'Sign in to edit the catalog.' })
}

function forbidden(response: ServerResponse) {
  send(response, 403, { error: 'You do not have permission to do that.' })
}

async function requirePerm(token: string | undefined, permission: Permission, response: ServerResponse) {
  const user = await currentUser(token)
  if (!user) {
    unauthorized(response)
    return null
  }
  if (!hasPermission(user, permission)) {
    forbidden(response)
    return null
  }
  return user
}

async function readJson(request: IncomingMessage): Promise<Record<string, unknown>> {
  const chunks: Buffer[] = []
  for await (const chunk of request) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk))
  }
  const raw = Buffer.concat(chunks).toString('utf8')
  if (!raw) return {}
  return JSON.parse(raw) as Record<string, unknown>
}

function parseId(value: unknown): number {
  const id = Number(value)
  return Number.isInteger(id) && id > 0 ? id : 0
}

function pathId(pathname: string, prefix: string): number | null {
  const raw = decodeURIComponent(pathname.slice(prefix.length))
  const id = Number(raw)
  if (!Number.isInteger(id) || id < 1) return null
  return id
}

function asProduct(body: Record<string, unknown>): Product | null {
  const id = parseId(body.id)
  const name = String(body.name ?? '').trim()
  const category = parseId(body.category)
  const brand = String(body.brand ?? '').trim()
  const model = String(body.model ?? '').trim()
  const spec = String(body.spec ?? '').trim()
  const image = String(body.image ?? '').trim()
  const price = Number(body.price)
  const previous = body.previousPrice === '' || body.previousPrice == null
    ? undefined
    : Number(body.previousPrice)
  const active = body.active == null ? true : Boolean(body.active)

  if (!name || !category || !brand || !model || !spec || !image || !Number.isFinite(price)) return null
  if (previous !== undefined && !Number.isFinite(previous)) return null

  return {
    id,
    name,
    category,
    brand,
    model,
    spec,
    price,
    previousPrice: previous,
    image: image.replace(/^\//, ''),
    active,
  }
}

function asCategory(body: Record<string, unknown>): CategoryRecord | null {
  const id = parseId(body.id)
  const name = String(body.name ?? '').trim()
  const sortOrder = Number(body.sortOrder ?? 0)
  const active = body.active == null ? true : Boolean(body.active)

  if (!name) return null
  if (!Number.isFinite(sortOrder)) return null

  return { id, name, active, sortOrder }
}

function asStaff(body: Record<string, unknown>): {
  id: number
  username: string
  password?: string
  active: boolean
  role: UserRole
} | null {
  const username = String(body.username ?? '').trim()
  const id = parseId(body.id)
  const passwordRaw = String(body.password ?? '')
  const password = passwordRaw.trim() === '' ? undefined : passwordRaw
  const active = body.active == null ? true : Boolean(body.active)
  const role = parseRole(body.role)

  if (!username) return null
  if (!/^[a-zA-Z0-9._-]{2,64}$/.test(username)) return null
  if (password !== undefined && password.length < 4) return null

  return { id, username, password, active, role }
}

function asBanner(body: Record<string, unknown>): Banner | null {
  const id = parseId(body.id)
  const title = String(body.title ?? '').trim()
  const bannerBody = String(body.body ?? '').trim()
  const ctaLabel = String(body.ctaLabel ?? '').trim()
  const ctaHref = String(body.ctaHref ?? '').trim()
  const image = String(body.image ?? '').trim()
  const sortOrder = Number(body.sortOrder ?? 0)
  const active = Boolean(body.active)

  if (!title || !bannerBody || !ctaLabel || !ctaHref || !image) return null
  if (!Number.isFinite(sortOrder)) return null

  return {
    id,
    title,
    body: bannerBody,
    ctaLabel,
    ctaHref,
    image: image.replace(/^\//, ''),
    active,
    sortOrder,
  }
}

const server = createServer((request, response) => {
  void handle(request, response)
})

async function handle(request: IncomingMessage, response: ServerResponse) {
  setCors(request, response)

  if (request.method === 'OPTIONS') {
    response.writeHead(204)
    response.end()
    return
  }

  const url = new URL(request.url ?? '/', `http://127.0.0.1:${port}`)
  const token = readToken(request.headers.authorization)
  const method = request.method ?? 'GET'

  try {
    if (method === 'GET' && url.pathname === '/api/products') {
      send(response, 200, await listProducts())
      return
    }

    if (method === 'GET' && url.pathname === '/api/categories') {
      send(response, 200, await listCategories())
      return
    }

    if (method === 'GET' && url.pathname === '/api/banners') {
      send(response, 200, await listBanners())
      return
    }

    if (method === 'POST' && url.pathname === '/api/login') {
      const body = await readJson(request)
      const session = await login(String(body.username ?? ''), String(body.password ?? ''))
      if (!session) {
        send(response, 401, { error: 'Wrong username or password.' })
        return
      }
      send(response, 200, session)
      return
    }

    if (method === 'POST' && url.pathname === '/api/logout') {
      if (token) logout(token)
      send(response, 200, { ok: true })
      return
    }

    if (method === 'GET' && url.pathname === '/api/session') {
      const user = await currentUser(token)
      send(response, 200, { ok: Boolean(user), user })
      return
    }

    if (method === 'GET' && url.pathname === '/api/staff') {
      if (!(await requirePerm(token, 'staff', response))) return
      send(response, 200, await listStaff())
      return
    }

    if (method === 'PUT' && url.pathname === '/api/products') {
      if (!(await requirePerm(token, 'products', response))) return
      const product = asProduct(await readJson(request))
      if (!product) {
        send(response, 400, { error: 'The part is missing required fields.' })
        return
      }
      try {
        const saved = await upsertProduct(product)
        send(response, 200, saved)
      } catch (error) {
        send(response, 400, { error: error instanceof Error ? error.message : 'Could not save the part.' })
        return
      }
      return
    }

    if (method === 'PUT' && url.pathname === '/api/categories') {
      if (!(await requirePerm(token, 'categories', response))) return
      const category = asCategory(await readJson(request))
      if (!category) {
        send(response, 400, { error: 'The category is missing required fields.' })
        return
      }
      const saved = await upsertCategory(category)
      send(response, 200, saved)
      return
    }

    if (method === 'PUT' && url.pathname === '/api/banners') {
      if (!(await requirePerm(token, 'banners', response))) return
      const banner = asBanner(await readJson(request))
      if (!banner) {
        send(response, 400, { error: 'The banner is missing required fields.' })
        return
      }
      const saved = await upsertBanner(banner)
      send(response, 200, saved)
      return
    }

    if (method === 'PUT' && url.pathname === '/api/staff') {
      if (!(await requirePerm(token, 'staff', response))) return
      const user = asStaff(await readJson(request))
      if (!user) {
        send(response, 400, { error: 'The staff account is missing required fields.' })
        return
      }
      try {
        const saved = await upsertStaff(user)
        send(response, 200, saved)
      } catch (error) {
        send(response, 400, { error: error instanceof Error ? error.message : 'Could not save staff.' })
      }
      return
    }

    if (method === 'DELETE' && url.pathname.startsWith('/api/products/')) {
      if (!(await requirePerm(token, 'products', response))) return
      const id = pathId(url.pathname, '/api/products/')
      if (!id) {
        send(response, 400, { error: 'Missing id.' })
        return
      }
      await deleteProduct(id)
      send(response, 200, { ok: true })
      return
    }

    if (method === 'DELETE' && url.pathname.startsWith('/api/categories/')) {
      if (!(await requirePerm(token, 'categories', response))) return
      const id = pathId(url.pathname, '/api/categories/')
      if (!id) {
        send(response, 400, { error: 'Missing id.' })
        return
      }
      try {
        await deleteCategory(id)
      } catch (error) {
        send(response, 400, { error: error instanceof Error ? error.message : 'Could not delete category.' })
        return
      }
      send(response, 200, { ok: true })
      return
    }

    if (method === 'DELETE' && url.pathname.startsWith('/api/banners/')) {
      if (!(await requirePerm(token, 'banners', response))) return
      const id = pathId(url.pathname, '/api/banners/')
      if (!id) {
        send(response, 400, { error: 'Missing id.' })
        return
      }
      await deleteBanner(id)
      send(response, 200, { ok: true })
      return
    }

    if (method === 'DELETE' && url.pathname.startsWith('/api/staff/')) {
      if (!(await requirePerm(token, 'staff', response))) return
      const id = pathId(url.pathname, '/api/staff/')
      if (!id) {
        send(response, 400, { error: 'Missing id.' })
        return
      }
      try {
        await deleteStaff(id)
      } catch (error) {
        send(response, 400, { error: error instanceof Error ? error.message : 'Could not delete staff.' })
        return
      }
      send(response, 200, { ok: true })
      return
    }

    serveApp(url.pathname, response)
  } catch (error) {
    send(response, 500, { error: error instanceof Error ? error.message : 'Error' })
  }
}

function contentType(file: string) {
  switch (extname(file)) {
    case '.html':
      return 'text/html; charset=utf-8'
    case '.js':
      return 'text/javascript; charset=utf-8'
    case '.css':
      return 'text/css; charset=utf-8'
    case '.svg':
      return 'image/svg+xml'
    case '.json':
      return 'application/json'
    default:
      return 'application/octet-stream'
  }
}

function serveApp(urlPath: string, response: ServerResponse) {
  if (!isProd) {
    send(response, 404, { error: 'Not found' })
    return
  }

  const relative = urlPath === '/' ? 'index.html' : urlPath.replace(/^\//, '')
  const safe = normalize(relative).replace(/^(\.\.[/\\])+/, '')
  let file = join(distDir, safe)
  if (!existsSync(file) || statSync(file).isDirectory()) {
    file = join(distDir, 'index.html')
  }
  if (!existsSync(file)) {
    send(response, 404, { error: 'Not found' })
    return
  }
  response.writeHead(200, { 'Content-Type': contentType(file) })
  createReadStream(file).pipe(response)
}

server.listen(port, host, () => {
  console.log(`tescgsm admin on http://${host}:${port}`)
})
