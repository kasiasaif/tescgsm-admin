import { useEffect, useState, type ChangeEvent, type FormEvent } from 'react'
import { ActiveSwitch } from '../components/ActiveSwitch'
import { BinButton } from '../components/BinButton'
import { Icon } from '../components/Icon'
import { useAuth } from '../auth'
import { shopAssetUrl } from '../config'
import { type BrandRecord } from '../data/catalog'
import { authHeader } from '../lib/session'

const emptyForm: BrandRecord = {
  id: 0,
  name: '',
  image: '',
  active: true,
}

function readImageFile(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const okType = /^image\/(png|jpe?g|webp|gif|svg\+xml)$/i.test(file.type)
    const okName = /\.(png|jpe?g|webp|gif|svg)$/i.test(file.name)
    if (!okType && !okName) {
      reject(new Error('Use a PNG, JPG, WebP, GIF, or SVG image.'))
      return
    }
    if (file.size > 2 * 1024 * 1024) {
      reject(new Error('Use an image smaller than 2 MB.'))
      return
    }
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result ?? ''))
    reader.onerror = () => reject(new Error('Could not read that image.'))
    reader.readAsDataURL(file)
  })
}

export function Brands() {
  const { token, error, setError, notify, denyManage } = useAuth()
  const [brands, setBrands] = useState<BrandRecord[]>([])
  const [form, setForm] = useState<BrandRecord>(emptyForm)
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [query, setQuery] = useState('')
  const [uploading, setUploading] = useState(false)

  const editing = selectedId !== null && selectedId > 0

  const visible = brands.filter((brand) => {
    const haystack = `${brand.name} ${brand.id}`.toLowerCase()
    return haystack.includes(query.trim().toLowerCase())
  })

  async function refresh() {
    const response = await fetch('/api/brands')
    if (!response.ok) throw new Error('Could not load brands')
    setBrands((await response.json()) as BrandRecord[])
  }

  useEffect(() => {
    void refresh().catch(() => setError('Could not load brands'))
  }, [setError])

  function selectBrand(brand: BrandRecord) {
    setError('')
    setSelectedId(brand.id)
    setForm(brand)
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

  function editForm(patch: Partial<BrandRecord>) {
    if (denyManage()) return
    setForm((current) => ({ ...current, ...patch }))
  }

  async function onUpload(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    if (denyManage()) return
    setError('')
    setUploading(true)
    try {
      const data = await readImageFile(file)
      const response = await fetch('/api/images', {
        method: 'POST',
        headers: authHeader(token),
        body: JSON.stringify({ filename: file.name, data, brand: form.name }),
      })
      const payload = (await response.json()) as { path?: string; error?: string }
      if (!response.ok || !payload.path) {
        setError(payload.error ?? 'Could not upload image')
        return
      }
      editForm({ image: payload.path })
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not upload image')
    } finally {
      setUploading(false)
    }
  }

  async function onSave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (denyManage()) return
    setError('')
    if (!form.image.trim()) {
      setError('Upload an image.')
      return
    }
    const response = await fetch('/api/brands', {
      method: 'PUT',
      headers: authHeader(token),
      body: JSON.stringify(form),
    })
    const data = (await response.json()) as BrandRecord & { error?: string }
    if (!response.ok) {
      setError(data.error ?? 'Could not save')
      return
    }
    setSelectedId(data.id)
    setForm(data)
    notify('Brand saved.')
    await refresh()
  }

  async function onDelete(id: number) {
    if (denyManage()) return
    if (!confirm('Remove this brand?')) return
    const response = await fetch(`/api/brands/${id}`, {
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
            <h2>All brands</h2>
            <p className="muted">
              {visible.length} of {brands.length}
            </p>
          </div>
          <button className="button button-primary" type="button" onClick={startNew}>
            <Icon name="plus" />
            New
          </button>
        </div>
        <label className="search-field search-field-block">
          <Icon name="search" />
          <input
            className="search-input search-input-full"
            type="search"
            placeholder="Search name…"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </label>
        <div className="table-wrap product-table-wrap">
          <table className="data-table product-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((brand) => (
                <tr
                  key={brand.id}
                  className={selectedId === brand.id ? 'is-selected' : undefined}
                  onClick={() => selectBrand(brand)}
                >
                  <td>
                    <span className="brand-name-cell">
                      {brand.image ? (
                        <img className="brand-row-thumb" src={shopAssetUrl(brand.image)} alt="" />
                      ) : (
                        <span className="brand-row-thumb" />
                      )}
                      <span>
                        <strong>{brand.name}</strong>
                        <div className="cell-sub">ID {brand.id}</div>
                      </span>
                    </span>
                  </td>
                  <td>{brand.active ? 'Active' : 'Hidden'}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {visible.length === 0 ? <p className="muted">No brands match that search.</p> : null}
        </div>
      </section>

      <section className="panel product-edit-panel">
        {selectedId === null ? (
          <div className="empty-panel">
            <h2>Brand</h2>
            <p className="muted">Click a row in the table to edit it here, or add a new one.</p>
          </div>
        ) : (
          <>
            <div className="panel-head">
              <div>
                <h2>{editing ? form.name || 'Edit brand' : 'Add brand'}</h2>
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
              <label className="admin-wide">
                Name
                <input
                  value={form.name}
                  onChange={(event) => editForm({ name: event.target.value })}
                  required
                />
              </label>
              <div className="brand-image-wrap admin-wide">
                <span>Image</span>
                <div className="brand-image-field">
                  {form.image ? (
                    <img className="brand-form-preview" src={shopAssetUrl(form.image)} alt="" />
                  ) : (
                    <span className="brand-form-preview" />
                  )}
                  <button
                    className="button"
                    type="button"
                    disabled={uploading}
                    onClick={() => document.getElementById('brand-image')?.click()}
                  >
                    <Icon name="camera" />
                    {uploading ? 'Uploading…' : form.image ? 'Replace image' : 'Upload image'}
                  </button>
                  <input
                    id="brand-image"
                    type="file"
                    accept="image/png,image/jpeg,image/webp,image/gif,image/svg+xml"
                    disabled={uploading}
                    onChange={(event) => void onUpload(event)}
                  />
                </div>
              </div>
              <ActiveSwitch
                checked={form.active}
                onChange={(active) => editForm({ active })}
              />
              {error ? <p className="form-error">{error}</p> : null}
              <div className="hero-actions">
                <button className="button button-primary" type="submit" disabled={uploading}>
                  <Icon name={editing ? 'check' : 'plus'} />
                  {editing ? 'Save changes' : 'Add brand'}
                </button>
              </div>
            </form>
          </>
        )}
      </section>
    </div>
  )
}
