import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { ActiveSwitch } from '../components/ActiveSwitch'
import { BinButton } from '../components/BinButton'
import { Icon } from '../components/Icon'
import { useAuth } from '../auth'
import {
  brands,
  isBelowMinStock,
  isOutOfStock,
  labelForCategory,
  minItemsForCategory,
  type CategoryRecord,
  type Product,
} from '../data/catalog'
import { authHeader } from '../lib/session'
import { formatPrice } from '../lib/money'

type ProductSort = 'name' | 'low' | 'most' | 'out' | 'min'

const emptyForm: Product = {
  id: 0,
  name: '',
  category: 1,
  brand: 'Apple',
  model: '',
  spec: '',
  price: 0,
  image: 'images/battery-apple.png',
  items: 0,
  outOfStock: 1,
  active: true,
}

export function Products() {
  const { token, products, refresh, error, setError, denyManage } = useAuth()
  const [searchParams, setSearchParams] = useSearchParams()
  const [form, setForm] = useState<Product>(emptyForm)
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [query, setQuery] = useState('')
  const [productSort, setProductSort] = useState<ProductSort>('name')
  const [categories, setCategories] = useState<CategoryRecord[]>([])

  const editing = selectedId !== null && selectedId > 0
  const openId = Number(searchParams.get('id'))

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase()
    const matched = products.filter((product) => {
      if (productSort === 'out' && !isOutOfStock(product, categories)) return false
      const haystack = `${product.name} ${product.model} ${product.brand} ${product.category}`.toLowerCase()
      return !needle || haystack.includes(needle)
    })
    matched.sort((a, b) => {
      const byName = a.name.localeCompare(b.name)
      const itemsDiff = Number(a.items) - Number(b.items)
      if (productSort === 'most') return itemsDiff !== 0 ? -itemsDiff : byName
      if (productSort === 'low' || productSort === 'out') {
        return itemsDiff !== 0 ? itemsDiff : byName
      }
      if (productSort === 'min') {
        const aLow = isBelowMinStock(a, categories) ? 0 : 1
        const bLow = isBelowMinStock(b, categories) ? 0 : 1
        if (aLow !== bLow) return aLow - bLow
        const aGap = Number(a.items) - minItemsForCategory(a.category, categories)
        const bGap = Number(b.items) - minItemsForCategory(b.category, categories)
        if (aGap !== bGap) return aGap - bGap
        return byName
      }
      return byName
    })
    return matched
  }, [categories, productSort, products, query])

  useEffect(() => {
    void fetch('/api/categories')
      .then((response) => (response.ok ? response.json() : []))
      .then((items: CategoryRecord[]) => setCategories(items))
      .catch(() => setCategories([]))
  }, [])

  useEffect(() => {
    if (!Number.isInteger(openId) || openId < 1) return
    const product = products.find((item) => item.id === openId)
    if (!product) return
    setError('')
    setSelectedId(product.id)
    setForm({
      ...product,
      active: product.active !== false,
      items: Number(product.items ?? 0),
      outOfStock: Number(product.outOfStock ?? 1),
    })
  }, [openId, products, setError])

  function selectProduct(product: Product) {
    setError('')
    setSelectedId(product.id)
    setForm({
      ...product,
      active: product.active !== false,
      items: Number(product.items ?? 0),
      outOfStock: Number(product.outOfStock ?? 1),
    })
    setSearchParams({ id: String(product.id) }, { replace: true })
  }

  function startNew() {
    if (denyManage()) return
    setError('')
    setSelectedId(0)
    setForm({
      ...emptyForm,
      category: categories[0]?.id ?? emptyForm.category,
    })
    setSearchParams({}, { replace: true })
  }

  function clearEditor() {
    setSelectedId(null)
    setForm(emptyForm)
    setSearchParams({}, { replace: true })
  }

  function editForm(patch: Partial<Product>) {
    if (denyManage()) return
    setForm((current) => ({ ...current, ...patch }))
  }

  async function onSave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (denyManage()) return
    setError('')
    const response = await fetch('/api/products', {
      method: 'PUT',
      headers: authHeader(token),
      body: JSON.stringify(form),
    })
    const data = (await response.json()) as Product & { error?: string }
    if (!response.ok) {
      setError(data.error ?? 'Could not save')
      return
    }
    setSelectedId(data.id)
    setForm(data)
    setSearchParams({ id: String(data.id) }, { replace: true })
    await refresh()
  }

  async function onDelete(id: number) {
    if (denyManage()) return
    if (!confirm('Remove this part?')) return
    const response = await fetch(`/api/products/${id}`, {
      method: 'DELETE',
      headers: authHeader(token),
    })
    if (!response.ok) {
      setError('Could not delete')
      return
    }
    clearEditor()
    await refresh()
  }

  return (
    <div className="split-page">
      <section className="panel product-list-panel">
        <div className="panel-head">
          <div>
            <h2>All products</h2>
            <p className="muted">
              {visible.length} of {products.length}
            </p>
          </div>
          <button className="button button-primary" type="button" onClick={startNew}>
            <Icon name="plus" />
            New
          </button>
        </div>
        <div className="product-toolbar">
          <label className="search-field">
            <Icon name="search" />
            <input
              className="search-input search-input-full"
              type="search"
              placeholder="Search name, model, brand…"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
          </label>
          <label className="stock-sort">
            Sort
            <select
              value={productSort}
              onChange={(event) => setProductSort(event.target.value as ProductSort)}
            >
              <option value="name">Name</option>
              <option value="low">Low</option>
              <option value="most">Most</option>
              <option value="out">Out of stock</option>
              <option value="min">Min</option>
            </select>
          </label>
        </div>
        <div className="table-wrap product-table-wrap">
          <table className="data-table product-table products-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Brand</th>
                <th>Category</th>
                <th>Items</th>
                <th>Price</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((product) => (
                <tr
                  key={product.id}
                  className={selectedId === product.id ? 'is-selected' : undefined}
                  onClick={() => selectProduct(product)}
                >
                  <td>
                    <strong>{product.name}</strong>
                    <div className="cell-sub">{product.model}</div>
                  </td>
                  <td>{product.brand}</td>
                  <td>{labelForCategory(product.category, categories)}</td>
                  <td>{product.items}</td>
                  <td>{formatPrice(product.price)}</td>
                  <td>{product.active !== false ? 'Active' : 'Hidden'}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {visible.length === 0 ? <p className="muted">No parts match that search.</p> : null}
        </div>
      </section>

      <section className="panel product-edit-panel">
        {selectedId === null ? (
          <div className="empty-panel">
            <h2>Product</h2>
            <p className="muted">Click a row in the table to edit it here, or add a new one.</p>
            {categories.length === 0 ? (
              <p className="muted">
                <Link to="/categories">Add a category</Link> before creating parts.
              </p>
            ) : null}
          </div>
        ) : (
          <>
            <div className="panel-head">
              <div>
                <h2>{editing ? form.name || 'Edit part' : 'Add part'}</h2>
                <p className="muted">{editing ? `ID ${form.id}` : 'Creates a new row in MySQL.'}</p>
              </div>
              {editing ? <BinButton onClick={() => void onDelete(form.id)} /> : (
                <button className="button" type="button" onClick={clearEditor}>
                  <Icon name="close" />
                  Cancel
                </button>
              )}
            </div>
            <form className="admin-form" onSubmit={onSave}>
              <label>
                Name
                <input
                  value={form.name}
                  onChange={(event) => editForm({ name: event.target.value })}
                  required
                />
              </label>
              <label>
                Category
                <select
                  value={form.category}
                  onChange={(event) => editForm({ category: Number(event.target.value) })}
                  required
                >
                  {form.category && !categories.some((item) => item.id === form.category) ? (
                    <option value={form.category}>{form.category} (missing)</option>
                  ) : null}
                  {categories.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name}{item.active ? '' : ' (hidden)'}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Brand
                <input
                  list="brand-options"
                  value={form.brand}
                  onChange={(event) => editForm({ brand: event.target.value })}
                  required
                />
                <datalist id="brand-options">
                  {brands.map((item) => (
                    <option key={item} value={item} />
                  ))}
                </datalist>
              </label>
              <label>
                Model
                <input
                  value={form.model}
                  onChange={(event) => editForm({ model: event.target.value })}
                  required
                />
              </label>
              <label>
                Spec
                <input
                  value={form.spec}
                  onChange={(event) => editForm({ spec: event.target.value })}
                  required
                />
              </label>
              <label>
                Items
                <input
                  type="number"
                  min={0}
                  step={1}
                  value={form.items}
                  onChange={(event) => editForm({ items: Number(event.target.value) })}
                  required
                />
              </label>
              <div className="admin-pair">
                <label>
                  Price (€)
                  <input
                    type="number"
                    min={0}
                    value={form.price}
                    onChange={(event) => editForm({ price: Number(event.target.value) })}
                    required
                  />
                </label>
                <label>
                  Previous price
                  <input
                    type="number"
                    min={0}
                    value={form.previousPrice ?? ''}
                    onChange={(event) =>
                      editForm({
                        previousPrice: event.target.value === '' ? undefined : Number(event.target.value),
                      })
                    }
                  />
                </label>
              </div>
              <label className="admin-wide">
                Image
                <input
                  value={form.image}
                  onChange={(event) => editForm({ image: event.target.value })}
                  required
                />
              </label>
              <ActiveSwitch
                checked={form.active !== false}
                onChange={(active) => editForm({ active })}
              />
              {error ? <p className="form-error">{error}</p> : null}
              <div className="hero-actions">
                <button className="button button-primary" type="submit">
                  <Icon name={editing ? 'check' : 'plus'} />
                  {editing ? 'Save changes' : 'Add part'}
                </button>
              </div>
            </form>
          </>
        )}
      </section>
    </div>
  )
}
