import { useEffect, useRef, useState, type FormEvent } from 'react'
import { ActiveSwitch } from '../components/ActiveSwitch'
import { BinButton } from '../components/BinButton'
import { Icon } from '../components/Icon'
import { useAuth } from '../auth'
import {
  headerBannerFonts,
  headerBannerFontStack,
  withOpacity,
  type HeaderBanner,
} from '../data/banner'
import { authHeader } from '../lib/session'

const emptyForm: HeaderBanner = {
  id: 0,
  text: '',
  background: '#111111',
  backgroundOpacity: 100,
  color: '#ffffff',
  font: 'Plus Jakarta Sans',
  bold: true,
  active: true,
  sortOrder: 0,
}

const emojis = ['🔥', '⚡', '✅', '📦', '🚚', '💰', '⭐', '🎉', '📱', '🛠️', '💥', '🎁', '⏰', '📣', '💚', '❤️']

function asColor(value: string) {
  const raw = value.trim()
  if (/^#([0-9a-fA-F]{6})$/.test(raw)) return raw.toLowerCase()
  if (/^#([0-9a-fA-F]{3})$/.test(raw)) {
    const [, hex] = raw.match(/^#([0-9a-fA-F]{3})$/) ?? []
    if (!hex) return raw
    return `#${hex[0]}${hex[0]}${hex[1]}${hex[1]}${hex[2]}${hex[2]}`.toLowerCase()
  }
  return raw
}

function previewHex(value: string, fallback: string) {
  return /^#([0-9a-fA-F]{6})$/.test(value) ? value : fallback
}

export function HeaderBanners() {
  const { token, error, setError, notify, denyManage } = useAuth()
  const [banners, setBanners] = useState<HeaderBanner[]>([])
  const [form, setForm] = useState<HeaderBanner>(emptyForm)
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [query, setQuery] = useState('')
  const textRef = useRef<HTMLInputElement>(null)
  const caretRef = useRef<number | null>(null)

  const editing = selectedId !== null && selectedId > 0

  const visible = banners.filter((banner) => {
    const haystack = `${banner.text} ${banner.id}`.toLowerCase()
    return haystack.includes(query.trim().toLowerCase())
  })

  async function refresh() {
    const response = await fetch('/api/header-banners')
    if (!response.ok) throw new Error('Could not load header banners')
    setBanners((await response.json()) as HeaderBanner[])
  }

  useEffect(() => {
    void refresh().catch(() => setError('Could not load header banners'))
  }, [setError])

  useEffect(() => {
    const input = textRef.current
    const pos = caretRef.current
    if (!input || pos == null) return
    input.focus()
    input.setSelectionRange(pos, pos)
    caretRef.current = null
  }, [form.text])

  function selectBanner(banner: HeaderBanner) {
    setError('')
    setSelectedId(banner.id)
    setForm({
      ...emptyForm,
      ...banner,
      color: banner.color || '#ffffff',
      font: banner.font || 'Plus Jakarta Sans',
      bold: banner.bold !== false,
      backgroundOpacity: banner.backgroundOpacity ?? 100,
    })
  }

  function startNew() {
    if (denyManage()) return
    setError('')
    setSelectedId(0)
    setForm({
      ...emptyForm,
      sortOrder: banners.length,
    })
  }

  function clearEditor() {
    setSelectedId(null)
    setForm(emptyForm)
  }

  function editForm(patch: Partial<HeaderBanner>) {
    if (denyManage()) return
    setForm((current) => ({ ...current, ...patch }))
  }

  function insertEmoji(emoji: string) {
    if (denyManage()) return
    const input = textRef.current
    const start = input?.selectionStart ?? form.text.length
    const end = input?.selectionEnd ?? start
    caretRef.current = start + emoji.length
    editForm({ text: `${form.text.slice(0, start)}${emoji}${form.text.slice(end)}` })
  }

  async function onSave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (denyManage()) return
    setError('')
    const response = await fetch('/api/header-banners', {
      method: 'PUT',
      headers: authHeader(token),
      body: JSON.stringify({
        ...form,
        background: asColor(form.background),
        color: asColor(form.color),
      }),
    })
    const data = (await response.json()) as HeaderBanner & { error?: string }
    if (!response.ok) {
      setError(data.error ?? 'Could not save')
      return
    }
    setSelectedId(data.id)
    setForm(data)
    notify('Header banner saved.')
    await refresh()
  }

  async function onDelete(id: number) {
    if (denyManage()) return
    if (!confirm('Remove this header banner?')) return
    const response = await fetch(`/api/header-banners/${id}`, {
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

  const previewBg = previewHex(form.background, '#111111')
  const previewColor = previewHex(form.color, '#ffffff')

  return (
    <div className="split-page">
      <section className="panel product-list-panel">
        <div className="panel-head">
          <div>
            <h2>Header banners</h2>
            <p className="muted">
              {visible.length} of {banners.length}
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
            placeholder="Search text…"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </label>
        <div className="table-wrap product-table-wrap">
          <table className="data-table product-table">
            <thead>
              <tr>
                <th>Text</th>
                <th>Color</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((banner) => (
                <tr
                  key={banner.id}
                  className={selectedId === banner.id ? 'is-selected' : undefined}
                  onClick={() => selectBanner(banner)}
                >
                  <td>
                    <strong>{banner.text}</strong>
                    <div className="cell-sub">ID {banner.id}</div>
                  </td>
                  <td>
                    <span className="header-banner-swatch-row">
                      <span className="header-banner-swatch" style={{ background: banner.background }} />
                      {banner.background}
                    </span>
                  </td>
                  <td>{banner.active ? 'Active' : 'Hidden'}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {visible.length === 0 ? <p className="muted">No header banners match that search.</p> : null}
        </div>
      </section>

      <section className="panel product-edit-panel">
        {selectedId === null ? (
          <div className="empty-panel">
            <h2>Header banner</h2>
            <p className="muted">
              45px bar under the shop category row. Text slides right to left and stops in the middle.
            </p>
          </div>
        ) : (
          <>
            <div className="panel-head">
              <div>
                <h2>{editing ? 'Edit header banner' : 'Add header banner'}</h2>
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
                Text
                <input
                  ref={textRef}
                  value={form.text}
                  onChange={(event) => editForm({ text: event.target.value })}
                  required
                />
              </label>
              <div className="emoji-row admin-wide">
                {emojis.map((emoji) => (
                  <button
                    key={emoji}
                    className="emoji-chip"
                    type="button"
                    onClick={() => insertEmoji(emoji)}
                  >
                    {emoji}
                  </button>
                ))}
              </div>
              <label>
                Font
                <select
                  value={form.font}
                  onChange={(event) => editForm({ font: event.target.value as HeaderBanner['font'] })}
                  style={{ fontFamily: headerBannerFontStack(form.font) }}
                >
                  {headerBannerFonts.map((font) => (
                    <option key={font} value={font} style={{ fontFamily: headerBannerFontStack(font) }}>
                      {font}
                    </option>
                  ))}
                </select>
              </label>
              <div className="switch-row">
                <span className={form.bold ? 'switch-caption is-on' : 'switch-caption'}>Bold</span>
                <label className={form.bold ? 'switch is-on' : 'switch'}>
                  <input
                    type="checkbox"
                    checked={form.bold}
                    onChange={(event) => editForm({ bold: event.target.checked })}
                    aria-label={form.bold ? 'Bold' : 'Regular'}
                  />
                  <span className="switch-track" aria-hidden="true">
                    <span className="switch-thumb" />
                  </span>
                </label>
              </div>
              <label>
                Background
                <span className="color-field">
                  <input
                    type="color"
                    value={previewBg}
                    onChange={(event) => editForm({ background: event.target.value })}
                  />
                  <input
                    value={form.background}
                    onChange={(event) => editForm({ background: event.target.value })}
                    required
                  />
                </span>
              </label>
              <label>
                Background opacity · {form.backgroundOpacity}%
                <input
                  className="opacity-range"
                  type="range"
                  min={0}
                  max={100}
                  step={5}
                  value={form.backgroundOpacity}
                  onChange={(event) => editForm({ backgroundOpacity: Number(event.target.value) })}
                />
              </label>
              <label>
                Text color
                <span className="color-field">
                  <input
                    type="color"
                    value={previewColor}
                    onChange={(event) => editForm({ color: event.target.value })}
                  />
                  <input
                    value={form.color}
                    onChange={(event) => editForm({ color: event.target.value })}
                    required
                  />
                </span>
              </label>
              <label>
                Sort
                <input
                  type="number"
                  value={form.sortOrder}
                  onChange={(event) => editForm({ sortOrder: Number(event.target.value) })}
                />
              </label>
              <div
                className="header-banner-preview admin-wide"
                style={{ background: withOpacity(previewBg, form.backgroundOpacity) }}
              >
                <span
                  key={`${form.text}-${form.font}-${form.bold}-${form.color}`}
                  style={{
                    color: previewColor,
                    fontFamily: headerBannerFontStack(form.font),
                    fontWeight: form.bold ? 700 : 400,
                  }}
                >
                  {form.text || 'Header banner preview'}
                </span>
              </div>
              <ActiveSwitch
                checked={form.active}
                onChange={(active) => editForm({ active })}
              />
              {error ? <p className="form-error">{error}</p> : null}
              <div className="hero-actions">
                <button className="button button-primary" type="submit">
                  <Icon name={editing ? 'check' : 'plus'} />
                  {editing ? 'Save changes' : 'Add header banner'}
                </button>
              </div>
            </form>
          </>
        )}
      </section>
    </div>
  )
}
