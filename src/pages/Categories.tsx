import { useEffect, useState, type FormEvent } from 'react'
import { ActiveSwitch } from '../components/ActiveSwitch'
import { useAuth } from '../auth'
import { type CategoryRecord } from '../data/catalog'
import { authHeader } from '../lib/session'

const emptyForm: CategoryRecord = {
  id: 0,
  name: '',
  active: true,
  sortOrder: 0,
}

export function Categories() {
  const { token, error, setError } = useAuth()
  const [categories, setCategories] = useState<CategoryRecord[]>([])
  const [form, setForm] = useState<CategoryRecord>(emptyForm)
  const [selectedId, setSelectedId] = useState<number | null>(null)

  const editing = selectedId !== null && selectedId > 0
  const creating = selectedId === 0

  async function refresh() {
    const response = await fetch('/api/categories')
    if (!response.ok) throw new Error('Could not load categories')
    setCategories((await response.json()) as CategoryRecord[])
  }

  useEffect(() => {
    void refresh().catch(() => setError('Could not load categories'))
  }, [setError])

  function selectCategory(category: CategoryRecord) {
    setError('')
    setSelectedId(category.id)
    setForm(category)
  }

  function startNew() {
    setError('')
    setSelectedId(0)
    setForm(emptyForm)
  }

  function clearEditor() {
    setSelectedId(null)
    setForm(emptyForm)
  }

  async function onSave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')
    const response = await fetch('/api/categories', {
      method: 'PUT',
      headers: authHeader(token),
      body: JSON.stringify(form),
    })
    const data = (await response.json()) as CategoryRecord & { error?: string }
    if (!response.ok) {
      setError(data.error ?? 'Could not save')
      return
    }
    setSelectedId(data.id)
    setForm(data)
    await refresh()
  }

  async function onDelete(id: number) {
    if (!confirm('Remove this category?')) return
    const response = await fetch(`/api/categories/${id}`, {
      method: 'DELETE',
      headers: authHeader(token),
    })
    const data = (await response.json()) as { error?: string }
    if (!response.ok) {
      setError(data.error ?? 'Could not delete')
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
            <h2>Categories</h2>
            <p className="muted">{categories.length} in MySQL</p>
          </div>
          <button className="button button-primary" type="button" onClick={startNew}>
            New
          </button>
        </div>
        <div className="product-list" role="list">
          {categories.map((category) => (
            <button
              key={category.id}
              type="button"
              role="listitem"
              className={selectedId === category.id ? 'product-row is-active' : 'product-row'}
              onClick={() => selectCategory(category)}
            >
              <strong>{category.name}</strong>
              <span>{category.active ? 'Active' : 'Disable'} · ID {category.id}</span>
            </button>
          ))}
        </div>
      </section>

      <section className="panel product-edit-panel">
        {selectedId === null ? (
          <div className="empty-panel">
            <h2>Select a category</h2>
            <p className="muted">Active categories appear in the shop nav and filters.</p>
          </div>
        ) : (
          <>
            <div className="panel-head">
              <div>
                <h2>{editing ? form.name || 'Edit category' : 'Add category'}</h2>
                <p className="muted">{editing ? `ID ${form.id}` : 'Creates a new row in the categories table.'}</p>
              </div>
              {editing ? (
                <button className="text-btn" type="button" onClick={() => void onDelete(form.id)}>
                  Delete
                </button>
              ) : null}
            </div>
            <form className="admin-form" onSubmit={onSave}>
              <label>
                Sort
                <input
                  type="number"
                  value={form.sortOrder}
                  onChange={(event) => setForm({ ...form, sortOrder: Number(event.target.value) })}
                />
              </label>
              <label className="admin-wide">
                Name
                <input
                  value={form.name}
                  onChange={(event) => setForm({ ...form, name: event.target.value })}
                  required
                />
              </label>
              <ActiveSwitch
                checked={form.active}
                onChange={(active) => setForm({ ...form, active })}
              />
              {error ? <p className="form-error">{error}</p> : null}
              <div className="hero-actions">
                <button className="button button-primary" type="submit">
                  {editing ? 'Save changes' : 'Add category'}
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
