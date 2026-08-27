import { useState, type FormEvent } from 'react'
import { useAuth } from '../auth'
import { categories, categoryLabel, type Brand, type Category, type Product } from '../data/catalog'
import { authHeader } from '../lib/session'
import { formatPrice } from '../lib/money'

const emptyForm: Product = {
  id: '',
  name: '',
  category: 'Batteries',
  brand: 'Apple',
  model: '',
  spec: '',
  price: 0,
  image: 'images/battery-apple.png',
}

export function Products() {
  const { token, products, refresh, error, setError } = useAuth()
  const [form, setForm] = useState<Product>(emptyForm)
  const [editing, setEditing] = useState(false)
  const [query, setQuery] = useState('')

  const visible = products.filter((product) => {
    const haystack = `${product.name} ${product.model} ${product.brand} ${product.category}`.toLowerCase()
    return haystack.includes(query.trim().toLowerCase())
  })

  async function onSave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')
    const payload = {
      ...form,
      id: form.id.trim() || `item-${Date.now()}`,
    }
    const response = await fetch('/api/products', {
      method: 'PUT',
      headers: authHeader(token),
      body: JSON.stringify(payload),
    })
    const data = (await response.json()) as { error?: string }
    if (!response.ok) {
      setError(data.error ?? 'Could not save')
      return
    }
    setForm(emptyForm)
    setEditing(false)
    await refresh()
  }

  async function onDelete(id: string) {
    if (!confirm('Remove this part?')) return
    const response = await fetch(`/api/products/${encodeURIComponent(id)}`, {
      method: 'DELETE',
      headers: authHeader(token),
    })
    if (!response.ok) {
      setError('Could not delete')
      return
    }
    if (form.id === id) {
      setForm(emptyForm)
      setEditing(false)
    }
    await refresh()
  }

  return (
    <div className="stack">
      <section className="panel">
        <div className="panel-head">
          <div>
            <h2>{editing ? 'Edit part' : 'Add part'}</h2>
            <p className="muted">Writes to the MySQL products table used by the shop.</p>
          </div>
        </div>
        <form className="admin-form" onSubmit={onSave}>
          <label>
            Id
            <input
              value={form.id}
              onChange={(event) => setForm({ ...form, id: event.target.value })}
              disabled={editing}
              placeholder="bat-iphone-16"
            />
          </label>
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
              onChange={(event) => setForm({ ...form, category: event.target.value as Category })}
            >
              {categories.map((item) => (
                <option key={item} value={item}>
                  {categoryLabel[item]}
                </option>
              ))}
            </select>
          </label>
          <label>
            Brand
            <select
              value={form.brand}
              onChange={(event) => setForm({ ...form, brand: event.target.value as Brand })}
            >
              <option value="Apple">Apple</option>
              <option value="Samsung">Samsung</option>
            </select>
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
          {error ? <p className="form-error">{error}</p> : null}
          <div className="hero-actions">
            <button className="button button-primary" type="submit">
              {editing ? 'Save changes' : 'Add part'}
            </button>
            {editing ? (
              <button
                className="button"
                type="button"
                onClick={() => {
                  setForm(emptyForm)
                  setEditing(false)
                }}
              >
                Cancel
              </button>
            ) : null}
          </div>
        </form>
      </section>

      <section className="panel">
        <div className="panel-head">
          <div>
            <h2>Inventory</h2>
            <p className="muted">{visible.length} of {products.length} parts</p>
          </div>
          <input
            className="search-input"
            type="search"
            placeholder="Search name, model, brand…"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </div>
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Brand</th>
                <th>Category</th>
                <th>Price</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {visible.map((product) => (
                <tr key={product.id}>
                  <td>
                    <strong>{product.name}</strong>
                    <div className="cell-sub">{product.model}</div>
                  </td>
                  <td>{product.brand}</td>
                  <td>{product.category}</td>
                  <td>{formatPrice(product.price)}</td>
                  <td className="row-actions">
                    <button
                      className="text-btn"
                      type="button"
                      onClick={() => {
                        setForm(product)
                        setEditing(true)
                      }}
                    >
                      Edit
                    </button>
                    <button className="text-btn" type="button" onClick={() => void onDelete(product.id)}>
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  )
}
