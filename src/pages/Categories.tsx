import { useEffect, useState, type FormEvent } from 'react'
import { ActiveSwitch } from '../components/ActiveSwitch'
import { BinButton } from '../components/BinButton'
import { useAuth } from '../auth'
import { type CategoryRecord } from '../data/catalog'
import { authHeader } from '../lib/session'

const emptyForm: CategoryRecord = {
  id: 0,
  name: '',
  active: true,
  sortOrder: 0,
  minItems: 0,
}

export function Categories() {
  const { token, error, setError, denyManage } = useAuth()
  const [categories, setCategories] = useState<CategoryRecord[]>([])
  const [form, setForm] = useState<CategoryRecord>(emptyForm)
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [query, setQuery] = useState('')

  const editing = selectedId !== null && selectedId > 0

  const visible = categories.filter((category) => {
    const haystack = `${category.name} ${category.id}`.toLowerCase()
    return haystack.includes(query.trim().toLowerCase())
  })

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
    setForm({ ...category, minItems: Number(category.minItems ?? 0) })
  }

  function startNew() {
    if (denyManage()) return
    setError('')
    setSelectedId(0)
    setForm({
      ...emptyForm,
      sortOrder: categories.length,
    })
  }

  function clearEditor() {
    setSelectedId(null)
    setForm(emptyForm)
  }

  function editForm(patch: Partial<CategoryRecord>) {
    if (denyManage()) return
    setForm((current) => ({ ...current, ...patch }))
  }

  async function onSave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (denyManage()) return
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
    if (denyManage()) return
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
            <h2>All categories</h2>
            <p className="muted">
              {visible.length} of {categories.length}
            </p>
          </div>
          <button className="button button-primary" type="button" onClick={startNew}>
            New
          </button>
        </div>
        <input
          className="search-input search-input-full"
          type="search"
          placeholder="Search name…"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
        <div className="table-wrap product-table-wrap">
          <table className="data-table product-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Sort</th>
                <th>Min</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((category) => (
                <tr
                  key={category.id}
                  className={selectedId === category.id ? 'is-selected' : undefined}
                  onClick={() => selectCategory(category)}
                >
                  <td>
                    <strong>{category.name}</strong>
                    <div className="cell-sub">ID {category.id}</div>
                  </td>
                  <td>{category.sortOrder}</td>
                  <td>{category.minItems}</td>
                  <td>{category.active ? 'Active' : 'Hidden'}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {visible.length === 0 ? <p className="muted">No categories match that search.</p> : null}
        </div>
      </section>

      <section className="panel product-edit-panel">
        {selectedId === null ? (
          <div className="empty-panel">
            <h2>Category</h2>
            <p className="muted">Click a row in the table to edit it here, or add a new one.</p>
          </div>
        ) : (
          <>
            <div className="panel-head">
              <div>
                <h2>{editing ? form.name || 'Edit category' : 'Add category'}</h2>
                <p className="muted">{editing ? `ID ${form.id}` : 'Creates a new row in MySQL.'}</p>
              </div>
              {editing ? <BinButton onClick={() => void onDelete(form.id)} /> : (
                <button className="button" type="button" onClick={clearEditor}>
                  Cancel
                </button>
              )}
            </div>
            <form className="admin-form" onSubmit={onSave}>
              <label className="admin-wide">
                Name
                <input
                  value={form.name}
                  onChange={(event) => editForm({ name: event.target.value })}
                  required
                />
              </label>
              <div className="admin-pair">
                <label>
                  Sort
                  <input
                    type="number"
                    value={form.sortOrder}
                    onChange={(event) => editForm({ sortOrder: Number(event.target.value) })}
                  />
                </label>
                <label>
                  Min items in stock
                  <input
                    type="number"
                    min={0}
                    step={1}
                    value={form.minItems}
                    onChange={(event) => editForm({ minItems: Number(event.target.value) })}
                    required
                  />
                </label>
              </div>
              <ActiveSwitch
                checked={form.active}
                onChange={(active) => editForm({ active })}
              />
              {error ? <p className="form-error">{error}</p> : null}
              <div className="hero-actions">
                <button className="button button-primary" type="submit">
                  {editing ? 'Save changes' : 'Add category'}
                </button>
              </div>
            </form>
          </>
        )}
      </section>
    </div>
  )
}
