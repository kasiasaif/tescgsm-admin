import { useEffect, useState, type FormEvent } from 'react'
import { useAuth } from '../auth'
import { customerName, formatWhen, type ShopCustomer, type ShopCustomerInput } from '../data/sales'
import { authHeader, readError } from '../lib/session'

type CustomerForm = ShopCustomerInput & { id: number; orderCount: number; createdAt: string }

function toForm(customer: ShopCustomer): CustomerForm {
  return {
    id: customer.id,
    email: customer.email,
    kind: customer.kind,
    firstName: customer.firstName,
    lastName: customer.lastName,
    company: customer.company,
    taxId: customer.taxId,
    phone: customer.phone,
    street: customer.street,
    city: customer.city,
    postcode: customer.postcode,
    province: customer.province,
    country: customer.country,
    orderCount: customer.orderCount,
    createdAt: customer.createdAt,
  }
}

export function Customers() {
  const { token, user, error, setError, notify } = useAuth()
  const [customers, setCustomers] = useState<ShopCustomer[]>([])
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [form, setForm] = useState<CustomerForm | null>(null)
  const [query, setQuery] = useState('')
  const canEdit = user?.role === 'admin'

  const visible = customers.filter((customer) => {
    const haystack = `${customerName(customer)} ${customer.email} ${customer.phone} ${customer.city}`.toLowerCase()
    return haystack.includes(query.trim().toLowerCase())
  })

  async function refresh(preferId?: number) {
    setError('')
    const response = await fetch('/api/customers', { headers: authHeader(token) })
    if (!response.ok) throw new Error(await readError(response))
    const list = (await response.json()) as ShopCustomer[]
    setCustomers(list)
    const nextId = preferId && list.some((item) => item.id === preferId)
      ? preferId
      : list[0]?.id ?? null
    setSelectedId(nextId)
    setForm(nextId ? toForm(list.find((item) => item.id === nextId) as ShopCustomer) : null)
  }

  useEffect(() => {
    void refresh().catch((caught) => setError(caught instanceof Error ? caught.message : 'Could not load customers'))
  }, [setError, token])

  function selectCustomer(customer: ShopCustomer) {
    setError('')
    setSelectedId(customer.id)
    setForm(toForm(customer))
  }

  function editForm(patch: Partial<CustomerForm>) {
    if (!canEdit) return
    setForm((current) => (current ? { ...current, ...patch } : current))
  }

  async function onSave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!canEdit || !form) return
    setError('')
    const response = await fetch(`/api/customers/${form.id}`, {
      method: 'PUT',
      headers: authHeader(token),
      body: JSON.stringify(form),
    })
    const data = (await response.json()) as ShopCustomer & { error?: string }
    if (!response.ok) {
      setError(data.error ?? 'Could not save')
      return
    }
    notify('Customer saved.')
    await refresh(data.id)
  }

  return (
    <div className="split-page customers-page">
      <section className="panel product-list-panel">
        <div className="panel-head">
          <div>
            <h2>Customers</h2>
            <p className="muted">{visible.length} of {customers.length}</p>
          </div>
        </div>
        {error ? <p className="form-error">{error}</p> : null}
        <label className="search-field search-field-block">
          <input
            className="search-input search-input-full"
            type="search"
            placeholder="Search name, email, phone…"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </label>
        <div className="table-wrap product-table-wrap">
          <table className="data-table product-table customers-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>Orders</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((customer) => (
                <tr
                  key={customer.id}
                  className={selectedId === customer.id ? 'is-selected' : undefined}
                  onClick={() => selectCustomer(customer)}
                >
                  <td>
                    <strong>{customerName(customer)}</strong>
                    <div className="cell-sub">{customer.phone || customer.city || 'No phone yet'}</div>
                  </td>
                  <td>{customer.email}</td>
                  <td>{customer.orderCount}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {customers.length === 0 ? <p className="muted">No customers yet. An account appears here when someone checks out on the shop.</p> : null}
          {customers.length > 0 && visible.length === 0 ? <p className="muted">No customers match that search.</p> : null}
        </div>
      </section>

      <section className="panel product-edit-panel">
        {!form ? (
          <div className="empty-panel">
            <h2>Customer</h2>
            <p className="muted">Select a customer to see their account.</p>
          </div>
        ) : (
          <>
            <div className="panel-head">
              <div>
                <h2>{customerName(form)}</h2>
                <p className="muted">
                  {form.orderCount} {form.orderCount === 1 ? 'order' : 'orders'} · joined {formatWhen(form.createdAt)}
                </p>
              </div>
            </div>
            <form className="admin-form" onSubmit={(event) => void onSave(event)}>
              <label>
                Account
                <select
                  value={form.kind}
                  disabled={!canEdit}
                  onChange={(event) => editForm({ kind: event.target.value as CustomerForm['kind'] })}
                >
                  <option value="private">Private</option>
                  <option value="business">Business</option>
                  <option value="">Not set</option>
                </select>
              </label>
              <label>
                Phone
                <input value={form.phone} readOnly={!canEdit} onChange={(event) => editForm({ phone: event.target.value })} />
              </label>
              <label>
                First name
                <input value={form.firstName} readOnly={!canEdit} onChange={(event) => editForm({ firstName: event.target.value })} />
              </label>
              <label>
                Last name
                <input value={form.lastName} readOnly={!canEdit} onChange={(event) => editForm({ lastName: event.target.value })} />
              </label>
              <label>
                Company
                <input value={form.company} readOnly={!canEdit} onChange={(event) => editForm({ company: event.target.value })} />
              </label>
              <label>
                Tax ID
                <input value={form.taxId} readOnly={!canEdit} onChange={(event) => editForm({ taxId: event.target.value })} />
              </label>
              <label className="admin-wide">
                Email
                <input
                  type="email"
                  value={form.email}
                  readOnly={!canEdit}
                  required
                  onChange={(event) => editForm({ email: event.target.value })}
                />
              </label>
              <label className="admin-wide">
                Street
                <input value={form.street} readOnly={!canEdit} onChange={(event) => editForm({ street: event.target.value })} />
              </label>
              <label>
                City
                <input value={form.city} readOnly={!canEdit} onChange={(event) => editForm({ city: event.target.value })} />
              </label>
              <label>
                Postcode
                <input value={form.postcode} readOnly={!canEdit} onChange={(event) => editForm({ postcode: event.target.value })} />
              </label>
              <label>
                Province
                <input value={form.province} readOnly={!canEdit} onChange={(event) => editForm({ province: event.target.value })} />
              </label>
              <label>
                Country
                <input value={form.country} readOnly={!canEdit} onChange={(event) => editForm({ country: event.target.value })} />
              </label>
              {error ? <p className="form-error admin-wide">{error}</p> : null}
              {canEdit ? (
                <div className="hero-actions">
                  <button className="button button-primary" type="submit">Save changes</button>
                </div>
              ) : (
                <p className="muted admin-wide">Only an administrator can edit customers.</p>
              )}
            </form>
          </>
        )}
      </section>
    </div>
  )
}
