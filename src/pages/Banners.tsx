import { useEffect, useState, type FormEvent } from 'react'
import { ActiveSwitch } from '../components/ActiveSwitch'
import { useAuth } from '../auth'
import { type Banner } from '../data/banner'
import { authHeader } from '../lib/session'

const emptyForm: Banner = {
  id: 0,
  title: '',
  body: '',
  ctaLabel: 'Shop now',
  ctaHref: '/shop',
  image: 'images/banner-home.png',
  active: true,
  sortOrder: 0,
}

export function Banners() {
  const { token, error, setError } = useAuth()
  const [banners, setBanners] = useState<Banner[]>([])
  const [form, setForm] = useState<Banner>(emptyForm)
  const [selectedId, setSelectedId] = useState<number | null>(null)

  const editing = selectedId !== null && selectedId > 0
  const creating = selectedId === 0

  async function refresh() {
    const response = await fetch('/api/banners')
    if (!response.ok) throw new Error('Could not load banners')
    setBanners((await response.json()) as Banner[])
  }

  useEffect(() => {
    void refresh().catch(() => setError('Could not load banners'))
  }, [setError])

  function selectBanner(banner: Banner) {
    setError('')
    setSelectedId(banner.id)
    setForm(banner)
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
    const response = await fetch('/api/banners', {
      method: 'PUT',
      headers: authHeader(token),
      body: JSON.stringify(form),
    })
    const data = (await response.json()) as Banner & { error?: string }
    if (!response.ok) {
      setError(data.error ?? 'Could not save')
      return
    }
    setSelectedId(data.id)
    setForm(data)
    await refresh()
  }

  async function onDelete(id: number) {
    if (!confirm('Remove this banner?')) return
    const response = await fetch(`/api/banners/${id}`, {
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
            <h2>Banners</h2>
            <p className="muted">{banners.length} in MySQL</p>
          </div>
          <button className="button button-primary" type="button" onClick={startNew}>
            New
          </button>
        </div>
        <div className="product-list" role="list">
          {banners.map((banner) => (
            <button
              key={banner.id}
              type="button"
              role="listitem"
              className={selectedId === banner.id ? 'product-row is-active' : 'product-row'}
              onClick={() => selectBanner(banner)}
            >
              <strong>{banner.title}</strong>
              <span>{banner.active ? 'Active' : 'Disable'} · {banner.ctaHref}</span>
            </button>
          ))}
        </div>
      </section>

      <section className="panel product-edit-panel">
        {selectedId === null ? (
          <div className="empty-panel">
            <h2>Select a banner</h2>
            <p className="muted">These rows drive the homepage banner on tescgsm.es.</p>
          </div>
        ) : (
          <>
            <div className="panel-head">
              <div>
                <h2>{editing ? form.title || 'Edit banner' : 'Add banner'}</h2>
                <p className="muted">{editing ? `ID ${form.id}` : 'Creates a new row in the banners table.'}</p>
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
                Title
                <input
                  value={form.title}
                  onChange={(event) => setForm({ ...form, title: event.target.value })}
                  required
                />
              </label>
              <label className="admin-wide">
                Body
                <input
                  value={form.body}
                  onChange={(event) => setForm({ ...form, body: event.target.value })}
                  required
                />
              </label>
              <label>
                Button label
                <input
                  value={form.ctaLabel}
                  onChange={(event) => setForm({ ...form, ctaLabel: event.target.value })}
                  required
                />
              </label>
              <label>
                Button link
                <input
                  value={form.ctaHref}
                  onChange={(event) => setForm({ ...form, ctaHref: event.target.value })}
                  required
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
                checked={form.active}
                onChange={(active) => setForm({ ...form, active })}
              />
              {error ? <p className="form-error">{error}</p> : null}
              <div className="hero-actions">
                <button className="button button-primary" type="submit">
                  {editing ? 'Save changes' : 'Add banner'}
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
