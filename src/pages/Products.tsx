import { useEffect, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { ActiveSwitch } from '../components/ActiveSwitch'
import { useAuth } from '../auth'
import { brands, type CategoryRecord, type Product } from '../data/catalog'
import { authHeader } from '../lib/session'
import { formatPrice } from '../lib/money'

const emptyForm: Product = {
  id: 0,
  name: '',
  category: 1,
  brand: 'Apple',
  model: '',
  spec: '',
  price: 0,
  image: 'images/battery-apple.png',
  active: true,
}

export function Products() {
  const { token, products, refresh, error, setError } = useAuth()
  const [form, setForm] = useState<Product>(emptyForm)
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [query, setQuery] = useState('')
  const [categories, setCategories] = useState<CategoryRecord[]>([])

  const editing = selectedId !== null && selectedId > 0
  const creating = selectedId === 0

  const visible = products.filter((product) => {
    const haystack = `${product.name} ${product.model} ${product.brand} ${product.category}`.toLowerCase()
    return haystack.includes(query.trim().toLowerCase())
  })

  useEffect(() => {
    void fetch('/api/categories')
      .then((response) => (response.ok ? response.json() : []))
      .then((items: CategoryRecord[]) => setCategories(items))
      .catch(() => setCategories([]))
  }, [])

  function selectProduct(product: Product) {
    setError('')
    setSelectedId(product.id)
    setForm({ ...product, active: product.active !== false })
  }

  function startNew() {
    setError('')
    setSelectedId(0)
    setForm({
      ...emptyForm,
      category: categories[0]?.id ?? emptyForm.category,
    })
  }

  function clearEditor() {
    setSelectedId(null)
    setForm(emptyForm)
  }

  async function onSave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
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
    await refresh()
  }

  async function onDelete(id: number) {
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
            <h2>Products</h2>
            <p className="muted">
              {visible.length} of {products.length}
            </p>
          </div>
          <button className="button button-primary" type="button" onClick={startNew}>
            New
          </button>
        </div>
        <input
          className="search-input search-input-full"
          type="search"
          placeholder="Search name, model, brand…"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
        <div className="product-list" role="list">
          {visible.map((product) => (
            <button
              key={product.id}
              type="button"
              role="listitem"
              className={selectedId === product.id ? 'product-row is-active' : 'product-row'}
              onClick={() => selectProduct(product)}
            >
              <strong>{product.name}</strong>
              <span>
                {product.brand} · {product.model} · {product.active !== false ? 'Active' : 'Disable'}
              </span>
              <em>{formatPrice(product.price)}</em>
            </button>
          ))}
        </div>
      </section>

      <section className="panel product-edit-panel">
        {selectedId === null ? (
          <div className="empty-panel">
            <h2>Select a product</h2>
            <p className="muted">Click a part on the left to edit it here, or add a new one.</p>
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
              {editing ? (
                <button className="text-btn" type="button" onClick={() => void onDelete(form.id)}>
                  Delete
                </button>
              ) : null}
            </div>
            <form className="admin-form" onSubmit={onSave}>
              <label>
                Name
                <input
                  value={form.name}
                  onChange={(event) => setForm({ ...form, name: event.target.value })}
                  required
                />
              </label>
              <label>
                Category
                <select
                  value={form.category}
                  onChange={(event) => setForm({ ...form, category: Number(event.target.value) })}
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
                  onChange={(event) => setForm({ ...form, brand: event.target.value })}
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
                  onChange={(event) => setForm({ ...form, model: event.target.value })}
                  required
                />
              </label>
              <label>
                Spec
                <input
                  value={form.spec}
                  onChange={(event) => setForm({ ...form, spec: event.target.value })}
                  required
                />
              </label>
              <label>
                Price (€)
                <input
                  type="number"
                  min={0}
                  value={form.price}
                  onChange={(event) => setForm({ ...form, price: Number(event.target.value) })}
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
                    setForm({
                      ...form,
                      previousPrice: event.target.value === '' ? undefined : Number(event.target.value),
                    })
                  }
                />
              </label>
              <label className="admin-wide">
                Image
                <input
                  value={form.image}
                  onChange={(event) => setForm({ ...form, image: event.target.value })}
                  required
                />
              </label>
              <ActiveSwitch
                checked={form.active !== false}
                onChange={(active) => setForm({ ...form, active })}
              />
              {error ? <p className="form-error">{error}</p> : null}
              <div className="hero-actions">
                <button className="button button-primary" type="submit">
                  {editing ? 'Save changes' : 'Add part'}
                </button>
                {creating ? (
                  <button className="button" type="button" onClick={clearEditor}>
                    Cancel
                  </button>
                ) : null}
              </div>
            </form>
          </>
        )}
      </section>
    </div>
  )
}
