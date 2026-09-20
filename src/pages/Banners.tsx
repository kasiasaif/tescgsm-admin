import { useEffect, useState, type FormEvent } from 'react'
import { ActiveSwitch } from '../components/ActiveSwitch'
import { BinButton } from '../components/BinButton'
import { BannerPreview } from '../components/BannerPreview'
import { useAuth } from '../auth'
import { shopAssetUrl } from '../config'
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
  const { token, error, setError, denyManage } = useAuth()
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
    if (denyManage()) return
    setError('')
    setSelectedId(0)
    setForm(emptyForm)
  }

  function clearEditor() {
    setSelectedId(null)
    setForm(emptyForm)
  }

  function editForm(patch: Partial<Banner>) {
    if (denyManage()) return
    setForm((current) => ({ ...current, ...patch }))
  }

  async function onSave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (denyManage()) return
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
    if (denyManage()) return
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

  const previewBanners =
    selectedId === null
      ? banners.filter((item) => item.active).sort((a, b) => a.sortOrder - b.sortOrder || a.id - b.id)
      : [form]
  const previewCaption =
    selectedId === null
      ? 'Active banners as they appear on tescgsm.es'
      : 'Live preview of this banner'
  const previewBadge = selectedId !== null && !form.active ? 'Hidden on shop' : undefined

  return (
    <div className="banners-layout">
      <BannerPreview banners={previewBanners} caption={previewCaption} badge={previewBadge} />
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
              className={selectedId === banner.id ? 'product-row banner-row is-active' : 'product-row banner-row'}
              onClick={() => selectBanner(banner)}
            >
              <img className="banner-row-thumb" src={shopAssetUrl(banner.image)} alt="" />
              <span className="banner-row-copy">
                <strong>{banner.title}</strong>
                <span>{banner.active ? 'Active' : 'Disable'} · {banner.ctaHref}</span>
              </span>
            </button>
          ))}
        </div>
        </section>

        <section className="panel product-edit-panel">
        {selectedId === null ? (
          <div className="empty-panel">
            <h2>Select a banner</h2>
            <p className="muted">These rows drive the homepage banner on tescgsm.es. The preview above matches the shop.</p>
          </div>
        ) : (
          <>
            <div className="panel-head">
              <div>
                <h2>{editing ? form.title || 'Edit banner' : 'Add banner'}</h2>
                <p className="muted">{editing ? `ID ${form.id}` : 'Creates a new row in the banners table.'}</p>
              </div>
              {editing ? <BinButton onClick={() => void onDelete(form.id)} /> : null}
            </div>
            <form className="admin-form" onSubmit={onSave}>
              <label>
                Sort
                <input
                  type="number"
                  value={form.sortOrder}
                  onChange={(event) => editForm({ sortOrder: Number(event.target.value) })}
                />
              </label>
              <label className="admin-wide">
                Title
                <input
                  value={form.title}
                  onChange={(event) => editForm({ title: event.target.value })}
                  required
                />
              </label>
              <label className="admin-wide">
                Body
                <input
                  value={form.body}
                  onChange={(event) => editForm({ body: event.target.value })}
                  required
                />
              </label>
              <label>
                Button label
                <input
                  value={form.ctaLabel}
                  onChange={(event) => editForm({ ctaLabel: event.target.value })}
                  required
                />
              </label>
              <label>
                Button link
                <input
                  value={form.ctaHref}
                  onChange={(event) => editForm({ ctaHref: event.target.value })}
                  required
                />
              </label>
              <label className="admin-wide">
                Image
                <input
                  value={form.image}
                  onChange={(event) => editForm({ image: event.target.value })}
                  required
                />
              </label>
              <ActiveSwitch
                checked={form.active}
                onChange={(active) => editForm({ active })}
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
    </div>
  )
}
