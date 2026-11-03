import { useEffect, useState, type FormEvent } from 'react'
import { ActiveSwitch } from '../components/ActiveSwitch'
import { BinButton } from '../components/BinButton'
import { Icon } from '../components/Icon'
import { useAuth } from '../auth'
import { authHeader } from '../lib/session'

type Voucher = {
  id: number
  name: string
  code: string
  type: 1 | 2
  value: number
  percentage: number
  active: boolean
}

const emptyForm: Voucher = {
  id: 0,
  name: '',
  code: '',
  type: 1,
  value: 0,
  percentage: 0,
  active: true,
}

function typeLabel(type: number) {
  return type === 2 ? 'Value' : 'Percentage'
}

function money(value: number) {
  return new Intl.NumberFormat('en-GB', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value)
}

function percent(value: number) {
  return `${Number(value.toFixed(2))}%`
}

export function Vouchers() {
  const { token, error, setError, notify, denyManage } = useAuth()
  const [vouchers, setVouchers] = useState<Voucher[]>([])
  const [form, setForm] = useState<Voucher>(emptyForm)
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [query, setQuery] = useState('')

  const editing = selectedId !== null && selectedId > 0

  const visible = vouchers.filter((voucher) => {
    const haystack = `${voucher.name} ${voucher.code}`.toLowerCase()
    return haystack.includes(query.trim().toLowerCase())
  })

  async function refresh() {
    const response = await fetch('/api/vouchers', { headers: authHeader(token) })
    if (!response.ok) throw new Error('Could not load vouchers')
    setVouchers((await response.json()) as Voucher[])
  }

  useEffect(() => {
    void refresh().catch(() => setError('Could not load vouchers'))
  }, [setError])

  function selectVoucher(voucher: Voucher) {
    setError('')
    setSelectedId(voucher.id)
    setForm(voucher)
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

  function editForm(patch: Partial<Voucher>) {
    if (denyManage()) return
    setForm((current) => ({ ...current, ...patch }))
  }

  async function onSave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (denyManage()) return
    setError('')
    const response = await fetch('/api/vouchers', {
      method: 'PUT',
      headers: authHeader(token),
      body: JSON.stringify({
        ...form,
        type: form.type === 2 ? 2 : 1,
        value: form.type === 2 ? form.value : 0,
        percentage: form.type === 1 ? form.percentage : 0,
      }),
    })
    const data = (await response.json()) as Voucher & { error?: string }
    if (!response.ok) {
      setError(data.error ?? 'Could not save')
      return
    }
    setSelectedId(data.id)
    setForm(data)
    notify('Discount code saved.')
    await refresh()
  }

  async function onDelete(id: number) {
    if (denyManage()) return
    if (!confirm('Remove this discount code?')) return
    const response = await fetch(`/api/vouchers/${id}`, {
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
            <h2>Discount codes</h2>
            <p className="muted">
              {visible.length} of {vouchers.length}
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
            placeholder="Search name or code…"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </label>
        <div className="table-wrap product-table-wrap">
          <table className="data-table product-table vouchers-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Code</th>
                <th>Type</th>
                <th>Value</th>
                <th>Percentage</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((voucher) => (
                <tr
                  key={voucher.id}
                  className={selectedId === voucher.id ? 'is-selected' : undefined}
                  onClick={() => selectVoucher(voucher)}
                >
                  <td>
                    <strong>{voucher.name}</strong>
                  </td>
                  <td>{voucher.code}</td>
                  <td>{typeLabel(voucher.type)}</td>
                  <td>{voucher.value > 0 ? money(voucher.value) : '—'}</td>
                  <td>{voucher.percentage > 0 ? percent(voucher.percentage) : '—'}</td>
                  <td>{voucher.active ? 'Active' : 'Disabled'}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {visible.length === 0 ? <p className="muted">No discount codes yet.</p> : null}
        </div>
      </section>

      <section className="panel product-edit-panel">
        {selectedId === null ? (
          <div className="empty-panel">
            <h2>Voucher</h2>
            <p className="muted">Click a row to edit it, or add a discount code.</p>
          </div>
        ) : (
          <>
            <div className="panel-head">
              <div>
                <h2>{editing ? form.name || 'Edit voucher' : 'Add discount code'}</h2>
                <p className="muted">{editing ? form.code : 'Customers can enter this code at checkout.'}</p>
              </div>
              {editing ? (
                <BinButton onClick={() => void onDelete(form.id)} />
              ) : (
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
              <label className="admin-wide">
                Code
                <input
                  value={form.code}
                  onChange={(event) => editForm({ code: event.target.value.toUpperCase() })}
                  autoCapitalize="characters"
                  spellCheck={false}
                  required
                />
              </label>
              <label className="admin-wide">
                Type
                <select
                  value={form.type}
                  onChange={(event) => {
                    const type = Number(event.target.value) === 2 ? 2 : 1
                    editForm(type === 1 ? { type, value: 0 } : { type, percentage: 0 })
                  }}
                >
                  <option value={1}>Percentage</option>
                  <option value={2}>Value</option>
                </select>
              </label>
              {form.type === 2 ? (
                <label className="admin-wide">
                  Value (€)
                  <input
                    type="number"
                    min={0.01}
                    step="0.01"
                    value={form.value || ''}
                    onChange={(event) => editForm({ value: event.target.value === '' ? 0 : Number(event.target.value) })}
                    required
                  />
                </label>
              ) : (
                <label className="admin-wide">
                  Percentage (%)
                  <input
                    type="number"
                    min={0.01}
                    max={100}
                    step="0.01"
                    value={form.percentage || ''}
                    onChange={(event) =>
                      editForm({ percentage: event.target.value === '' ? 0 : Number(event.target.value) })
                    }
                    required
                  />
                </label>
              )}
              <ActiveSwitch checked={form.active} onChange={(active) => editForm({ active })} />
              {error ? <p className="form-error">{error}</p> : null}
              <div className="hero-actions">
                <button className="button button-primary" type="submit">
                  <Icon name={editing ? 'check' : 'plus'} />
                  {editing ? 'Save changes' : 'Add discount code'}
                </button>
              </div>
            </form>
          </>
        )}
      </section>
    </div>
  )
}
