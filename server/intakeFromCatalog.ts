import { type Product } from '../src/data/catalog.ts'

export type IntakeMatchedRow = {
  line: string
  notePrice: number
  product: Product
}

function asProposedItem(value: unknown): { line: string; productId: number; price: number } | null {
  if (!value || typeof value !== 'object') return null
  const item = value as Record<string, unknown>
  const line = String(item.line ?? '').trim()
  const productId = Number(item.productId)
  const price = Number(item.price)
  if (!line) return null
  if (!Number.isInteger(productId) || productId < 1) return null
  if (!Number.isFinite(price) || price <= 0) return null
  return { line, productId, price }
}

export function intakeRowsFromCatalog(
  catalog: Product[],
  proposed: unknown[],
): { matched: IntakeMatchedRow[]; unmatched: string[] } {
  const byId = new Map(catalog.map((product) => [product.id, product]))
  const used = new Set<number>()
  const matched: IntakeMatchedRow[] = []
  const unmatched: string[] = []

  for (const value of proposed) {
    const item = asProposedItem(value)
    if (!item) {
      if (value && typeof value === 'object') {
        const line = String((value as Record<string, unknown>).line ?? '').trim()
        if (line) unmatched.push(line)
      }
      continue
    }

    const product = byId.get(item.productId)
    if (!product || used.has(product.id)) {
      unmatched.push(item.line)
      continue
    }

    used.add(product.id)
    matched.push({
      line: item.line,
      notePrice: item.price,
      product: {
        id: product.id,
        name: product.name,
        category: product.category,
        brand: product.brand,
        model: product.model,
        spec: product.spec,
        price: product.price,
        previousPrice: product.previousPrice,
        image: product.image,
        items: product.items,
        outOfStock: product.outOfStock,
        active: product.active,
      },
    })
  }

  return { matched, unmatched }
}
