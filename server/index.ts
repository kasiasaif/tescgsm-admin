import { createReadStream, existsSync, statSync } from 'node:fs'
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http'
import { extname, join, normalize } from 'node:path'
import { fileURLToPath } from 'node:url'
import { isAuthed, login, logout, readToken } from './auth.ts'
import { deleteProduct, listProducts, upsertProduct } from './db.ts'
import { type Product } from '../src/data/catalog.ts'

const port = Number(process.env.PORT ?? 3001)
const isProd = process.env.NODE_ENV === 'production'
const host = process.env.HOST ?? (isProd ? '0.0.0.0' : '127.0.0.1')
const distDir = join(fileURLToPath(new URL('.', import.meta.url)), '..', 'dist')
const allowedOrigins = (
  process.env.CORS_ORIGINS ??
  'http://localhost:5173,http://localhost:5174,https://tescgsm.es,https://www.tescgsm.es,https://admin-tescgsm.es'
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

async function readJson(request: IncomingMessage): Promise<Record<string, unknown>> {
  const chunks: Buffer[] = []
  for await (const chunk of request) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk))
  }
  const raw = Buffer.concat(chunks).toString('utf8')
  if (!raw) return {}
  return JSON.parse(raw) as Record<string, unknown>
}

function asProduct(body: Record<string, unknown>): Product | null {
  const id = String(body.id ?? '').trim()
  const name = String(body.name ?? '').trim()
  const category = String(body.category ?? '')
  const brand = String(body.brand ?? '')
  const model = String(body.model ?? '').trim()
  const spec = String(body.spec ?? '').trim()
  const image = String(body.image ?? '').trim()
  const price = Number(body.price)
  const previous = body.previousPrice === '' || body.previousPrice == null
    ? undefined
    : Number(body.previousPrice)

  if (!id || !name || !model || !spec || !image || !Number.isFinite(price)) return null
  if (category !== 'Batteries' && category !== 'LCD') return null
  if (brand !== 'Apple' && brand !== 'Samsung') return null
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

    if (method === 'POST' && url.pathname === '/api/login') {
      const body = await readJson(request)
      const session = login(String(body.username ?? ''), String(body.password ?? ''))
      if (!session) {
        send(response, 401, { error: 'Wrong username or password.' })
        return
      }
      send(response, 200, { token: session })
      return
    }

    if (method === 'POST' && url.pathname === '/api/logout') {
      if (token) logout(token)
      send(response, 200, { ok: true })
      return
    }

    if (method === 'GET' && url.pathname === '/api/session') {
      send(response, 200, { ok: isAuthed(token) })
      return
    }

    if (method === 'PUT' && url.pathname === '/api/products') {
      if (!isAuthed(token)) {
        unauthorized(response)
        return
      }
      const product = asProduct(await readJson(request))
      if (!product) {
        send(response, 400, { error: 'The part is missing required fields.' })
        return
      }
      await upsertProduct(product)
      send(response, 200, product)
      return
    }

    if (method === 'DELETE' && url.pathname.startsWith('/api/products/')) {
      if (!isAuthed(token)) {
        unauthorized(response)
        return
      }
      const id = decodeURIComponent(url.pathname.slice('/api/products/'.length))
      if (!id) {
        send(response, 400, { error: 'Missing id.' })
        return
      }
      await deleteProduct(id)
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
