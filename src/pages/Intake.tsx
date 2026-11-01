import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Icon } from '../components/Icon'
import { useAuth } from '../auth'
import {
  isBelowMinStock,
  isOutOfStock,
  labelForCategory,
  minItemsForCategory,
  outOfStockForCategory,
  type CategoryRecord,
  type Product,
} from '../data/catalog'

type StockSort = 'low' | 'most' | 'out' | 'min'
type StockView = 'table' | 'chart'
type StockTone = 'ok' | 'low' | 'out'

function stockTone(product: Product, categories: CategoryRecord[]): StockTone {
  if (isOutOfStock(product, categories)) return 'out'
  if (isBelowMinStock(product, categories)) return 'low'
  return 'ok'
}

function stockPill(tone: StockTone) {
  const label = tone === 'out' ? 'Out of stock' : tone === 'low' ? 'Low stock' : 'In stock'
  return <span className={`stock-pill is-${tone}`}>{label}</span>
}

function StockTable({
  products,
  categories,
  onOpen,
}: {
  products: Product[]
  categories: CategoryRecord[]
  onOpen: (product: Product) => void
}) {
  return (
    <div className="table-wrap">
      <table className="data-table product-table">
        <thead>
          <tr>
            <th>Name</th>
            <th>Brand</th>
            <th>Category</th>
            <th>Items</th>
            <th className="col-oos">Out of stock</th>
            <th>Min</th>
            <th>Stock</th>
          </tr>
        </thead>
        <tbody>
          {products.map((product) => {
            const min = minItemsForCategory(product.category, categories)
            return (
              <tr key={product.id} onClick={() => onOpen(product)}>
                <td>
                  <strong>{product.name}</strong>
                  <div className="cell-sub">{product.model}</div>
                </td>
                <td>{product.brand}</td>
                <td>{labelForCategory(product.category, categories)}</td>
                <td>{product.items}</td>
                <td className="col-oos">{outOfStockForCategory(product.category, categories)}</td>
                <td>{min}</td>
                <td>{stockPill(stockTone(product, categories))}</td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

function StockChart({
  products,
  categories,
  onOpen,
}: {
  products: Product[]
  categories: CategoryRecord[]
  onOpen: (product: Product) => void
}) {
  const maxItems = Math.max(1, ...products.map((product) => Number(product.items) || 0))

  return (
    <ul className="stock-chart">
      {products.map((product) => {
        const items = Number(product.items) || 0
        const tone = stockTone(product, categories)
        return (
          <li key={product.id} className={`is-${tone}`}>
            <div className="stock-chart-label">
              <button type="button" className="stock-chart-name" onClick={() => onOpen(product)}>
                {product.name}
              </button>
              <span className="stock-chart-count">{items}</span>
              {stockPill(tone)}
            </div>
            <div className="stock-chart-track" aria-hidden="true">
              <span style={{ width: `${Math.max(items > 0 ? 4 : 0, (items / maxItems) * 100)}%` }} />
            </div>
          </li>
        )
      })}
    </ul>
  )
}

export function Intake() {
  const navigate = useNavigate()
  const { products } = useAuth()
  const [categories, setCategories] = useState<CategoryRecord[]>([])
  const [stockSort, setStockSort] = useState<StockSort>('low')
  const [stockView, setStockView] = useState<StockView>('chart')

  const sortedStock = useMemo(() => {
    const copy =
      stockSort === 'out'
        ? products.filter((product) => isOutOfStock(product, categories))
        : [...products]
    copy.sort((a, b) => {
      const byName = a.name.localeCompare(b.name)
      const itemsDiff = Number(a.items) - Number(b.items)
      if (stockSort === 'most') return itemsDiff !== 0 ? -itemsDiff : byName
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

  function openProduct(product: Product) {
    navigate(`/products?id=${product.id}`)
  }

  return (
    <section className="panel">
      <div className="panel-head">
        <div>
          <h2>Stock levels</h2>
          <p className="muted">Click a part to edit it.</p>
        </div>
        <div className="stock-tools">
          <div className="view-toggle" role="group" aria-label="View">
            <button
              type="button"
              className={stockView === 'table' ? 'is-on' : undefined}
              onClick={() => setStockView('table')}
            >
              <Icon name="table" />
              Table
            </button>
            <button
              type="button"
              className={stockView === 'chart' ? 'is-on' : undefined}
              onClick={() => setStockView('chart')}
            >
              <Icon name="bars" />
              Chart
            </button>
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
      </div>
      {products.length === 0 ? (
        <p className="muted">No parts in the catalog.</p>
      ) : sortedStock.length === 0 ? (
        <p className="muted">No parts are out of stock.</p>
      ) : stockView === 'chart' ? (
        <StockChart products={sortedStock} categories={categories} onOpen={openProduct} />
      ) : (
        <StockTable products={sortedStock} categories={categories} onOpen={openProduct} />
      )}
    </section>
  )
}
