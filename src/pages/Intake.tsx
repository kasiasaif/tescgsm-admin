import { useEffect, useMemo, useState } from 'react'
import { useAuth } from '../auth'
import {
  isBelowMinStock,
  isOutOfStock,
  labelForCategory,
  minItemsForCategory,
  stockStatusLabel,
  type CategoryRecord,
  type Product,
} from '../data/catalog'
import { authHeader } from '../lib/session'
import { formatPrice } from '../lib/money'

const sampleNote =
  'iphone 13 screen 39eur, a15 battery 11, galaxy s22 battery 15, iphone 99 battery 20.'

type IntakeRow = {
  line: string
  notePrice: number
  selected: boolean
  product: Product
}

type StockSort = 'low' | 'most' | 'out' | 'min'

function StockTable({
  products,
  categories,
}: {
  products: Product[]
  categories: CategoryRecord[]
}) {
  return (
    <div className="table-wrap">
      <table className="data-table">
        <thead>
          <tr>
            <th>Name</th>
            <th>Brand</th>
            <th>Category</th>
            <th>Items</th>
            <th>Out of stock</th>
            <th>Min</th>
            <th>Stock</th>
          </tr>
        </thead>
        <tbody>
          {products.map((product) => {
            const min = minItemsForCategory(product.category, categories)
            const empty = isOutOfStock(product)
            const low = isBelowMinStock(product, categories)
            return (
              <tr
                key={product.id}
                className={empty ? 'is-out-of-stock' : low ? 'is-low-stock' : undefined}
              >
                <td>
                  <strong>{product.name}</strong>
                  <div className="cell-sub">{product.model}</div>
                </td>
                <td>{product.brand}</td>
                <td>{labelForCategory(product.category, categories)}</td>
                <td>{product.items}</td>
                <td>{product.outOfStock}</td>
                <td>{min}</td>
                <td>{stockStatusLabel(product, categories) || 'In stock'}</td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

export function Intake() {
  const { token, refresh, denyManage, products } = useAuth()
  const [note, setNote] = useState(sampleNote)
  const [rows, setRows] = useState<IntakeRow[]>([])
  const [unmatched, setUnmatched] = useState<string[]>([])
  const [error, setError] = useState('')
  const [busy, setBusy] = useState<'match' | 'save' | ''>('')
  const [savedCount, setSavedCount] = useState(0)
  const [categories, setCategories] = useState<CategoryRecord[]>([])
  const [stockSort, setStockSort] = useState<StockSort>('low')

  const selected = rows.filter((row) => row.selected)
  const sortedStock = useMemo(() => {
    const copy = [...products]
    copy.sort((a, b) => {
      const byName = a.name.localeCompare(b.name)
      const itemsDiff = Number(a.items) - Number(b.items)
      if (stockSort === 'most') return itemsDiff !== 0 ? -itemsDiff : byName
      if (stockSort === 'out') {
        const aOut = isOutOfStock(a) ? 0 : 1
        const bOut = isOutOfStock(b) ? 0 : 1
        if (aOut !== bOut) return aOut - bOut
        return itemsDiff !== 0 ? itemsDiff : byName
      }
      if (stockSort === 'min') {
        const aLow = isBelowMinStock(a, categories) ? 0 : 1
        const bLow = isBelowMinStock(b, categories) ? 0 : 1
        if (aLow !== bLow) return aLow - bLow
        const aGap = Number(a.items) - minItemsForCategory(a.category, categories)
        const bGap = Number(b.items) - minItemsForCategory(b.category, categories)
        if (aGap !== bGap) return aGap - bGap
        return byName
      }
      return itemsDiff !== 0 ? itemsDiff : byName
    })
    return copy
  }, [categories, products, stockSort])

  useEffect(() => {
    void fetch('/api/categories')
      .then((response) => (response.ok ? response.json() : []))
      .then((items: CategoryRecord[]) => setCategories(items))
      .catch(() => setCategories([]))
  }, [])

  async function onMatch() {
    if (denyManage()) return
    setError('')
    setSavedCount(0)
    setBusy('match')
    try {
      const response = await fetch('/api/intake/match', {
        method: 'POST',
        headers: authHeader(token),
        body: JSON.stringify({ note }),
      })
      const data = (await response.json()) as {
        matched?: Array<{ line: string; notePrice: number; product: Product }>
        unmatched?: string[]
        error?: string
      }
      if (!response.ok) {
        setRows([])
        setUnmatched([])
        setError(data.error ?? 'Could not match the note.')
        return
      }
      setRows(
        (data.matched ?? []).map((item) => ({
          ...item,
          selected: true,
          notePrice: Number(item.notePrice),
        })),
      )
      setUnmatched(data.unmatched ?? [])
    } catch {
      setError('Could not reach the catalog API.')
    } finally {
      setBusy('')
    }
  }

  function editPrice(id: number, value: string) {
    if (denyManage()) return
    const notePrice = Number(value)
    setRows((current) =>
      current.map((row) => (row.product.id === id ? { ...row, notePrice } : row)),
    )
  }

  function toggleRow(id: number) {
    if (denyManage()) return
    setRows((current) =>
      current.map((row) =>
        row.product.id === id ? { ...row, selected: !row.selected } : row,
      ),
    )
  }

  async function onSave() {
    if (denyManage()) return
    setError('')
    setSavedCount(0)
    const toSave = selected.filter((row) => Number.isFinite(row.notePrice) && row.notePrice > 0)
    if (toSave.length === 0) {
      setError('Tick the rows you want to save, and check the new prices.')
      return
    }
    setBusy('save')
    try {
      for (const row of toSave) {
        const price = Number(row.notePrice)
        const previousPrice = price !== row.product.price ? row.product.price : row.product.previousPrice
        const response = await fetch('/api/products', {
          method: 'PUT',
          headers: authHeader(token),
          body: JSON.stringify({
            ...row.product,
            price,
            previousPrice,
          }),
        })
        const data = (await response.json()) as Product & { error?: string }
        if (!response.ok) {
          setError(data.error ?? `Could not save ${row.product.name}.`)
          await refresh()
          return
        }
      }
      await refresh()
      setSavedCount(toSave.length)
    } catch {
      setError('Could not save the selected prices.')
    } finally {
      setBusy('')
    }
  }

  return (
    <div className="stack">
      <section className="panel">
        <div className="panel-head">
          <div>
            <h2>Stock levels</h2>
            <p className="muted">Yellow text means items are below the category minimum.</p>
          </div>
          <label className="stock-sort">
            Sort
            <select
              value={stockSort}
              onChange={(event) => setStockSort(event.target.value as StockSort)}
            >
              <option value="low">Low</option>
              <option value="most">Most</option>
              <option value="out">Out of stock</option>
              <option value="min">Min</option>
            </select>
          </label>
        </div>
        {products.length === 0 ? (
          <p className="muted">No parts in the catalog.</p>
        ) : (
          <StockTable products={sortedStock} categories={categories} />
        )}
      </section>

      <section className="panel">
        <div className="panel-head">
          <div>
            <h2>Price note</h2>
            <p className="muted">
              Paste a WhatsApp-style list. Match uses the existing catalog only. Nothing is written until you save.
            </p>
          </div>
          <button className="button button-primary" type="button" onClick={() => void onMatch()} disabled={busy !== ''}>
            {busy === 'match' ? 'Matching…' : 'Match'}
          </button>
        </div>
        <label className="admin-wide">
          <span className="muted">Note</span>
          <textarea
            className="intake-note"
            value={note}
            onChange={(event) => setNote(event.target.value)}
            rows={6}
          />
        </label>
      </section>

      <section className="panel">
        <div className="panel-head">
          <div>
            <h2>Matched products</h2>
            <p className="muted">Catalog name, brand, model, spec, and image stay as they are. Only the note price is new.</p>
          </div>
          <button className="button button-primary" type="button" onClick={() => void onSave()} disabled={busy !== ''}>
            {busy === 'save' ? 'Saving…' : 'Save selected'}
          </button>
        </div>
        {error ? <p className="form-error">{error}</p> : null}
        {savedCount > 0 ? (
          <p className="muted">{savedCount} price{savedCount === 1 ? '' : 's'} saved. Products now shows the new figures.</p>
        ) : null}
        {rows.length === 0 ? (
          <p className="muted">Run Match to fill this table from the catalog.</p>
        ) : (
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Save</th>
                  <th>Catalog</th>
                  <th>Brand</th>
                  <th>Model</th>
                  <th>Current price</th>
                  <th>Price from note</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr
                    key={row.product.id}
                    className={
                      isOutOfStock(row.product)
                        ? 'is-out-of-stock'
                        : isBelowMinStock(row.product, categories)
                          ? 'is-low-stock'
                          : undefined
                    }
                  >
                    <td>
                      <input
                        type="checkbox"
                        checked={row.selected}
                        onChange={() => toggleRow(row.product.id)}
                        aria-label={`Save ${row.product.name}`}
                      />
                    </td>
                    <td>
                      <strong>{row.product.name}</strong>
                      <div className="cell-sub">{row.product.spec}</div>
                    </td>
                    <td>{row.product.brand}</td>
                    <td>{row.product.model}</td>
                    <td>{formatPrice(row.product.price)}</td>
                    <td>
                      <input
                        className="intake-price"
                        type="number"
                        min="1"
                        step="1"
                        value={Number.isFinite(row.notePrice) ? row.notePrice : ''}
                        onChange={(event) => editPrice(row.product.id, event.target.value)}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="panel">
        <h2>No catalog match</h2>
        <p className="muted">These lines are not saved. Stock never creates a new product.</p>
        {unmatched.length === 0 ? (
          <p className="muted">None.</p>
        ) : (
          <ul className="intake-unmatched">
            {unmatched.map((line, index) => (
              <li key={`${index}-${line}`}>{line}</li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}
