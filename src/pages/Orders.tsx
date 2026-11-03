import { useEffect, useState, type FormEvent } from 'react'
import { useAuth } from '../auth'
import { formatMoney } from '../lib/money'
import {
  formatWhen,
  orderStatuses,
  orderTotal,
  type ShopOrder,
  type ShopOrderInput,
  type ShopOrderLine,
  type ShopOrderStatus,
} from '../data/sales'
import { authHeader, readError } from '../lib/session'

type OrderForm = ShopOrderInput & { id: number; discount: number }

function toForm(order: ShopOrder): OrderForm {
  return {
    id: order.id,
    ref: order.ref,
    email: order.email,
    name: order.name,
    phone: order.phone,
    street: order.street,
    city: order.city,
    postcode: order.postcode,
    province: order.province,
    country: order.country,
    lines: order.lines.map((line) => ({ ...line })),
    status: order.status,
    placedAt: order.placedAt,
    discount: order.discount,
  }
}

function paidAmounts(lines: ShopOrderLine[], discount: number) {
  const total = orderTotal(lines)
  const off = Math.min(total, Math.max(0, discount))
  return { total, discount: off, totalPaid: Math.round((total - off) * 100) / 100 }
}

function OrderMoney({ lines, discount }: { lines: ShopOrderLine[]; discount: number }) {
  const amounts = paidAmounts(lines, discount)
  return (
    <div className="admin-wide order-amounts order-amounts-block">
      {amounts.discount > 0 ? (
        <>
          <p><span>Total</span><strong>{formatMoney(amounts.total)}</strong></p>
          <p><span>Discount</span><strong>−{formatMoney(amounts.discount)}</strong></p>
        </>
      ) : null}
      <p><span>Total paid</span><strong>{formatMoney(amounts.totalPaid)}</strong></p>
    </div>
  )
}

export function Orders() {
  const { token, user, error, setError, notify } = useAuth()
  const [orders, setOrders] = useState<ShopOrder[]>([])
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [form, setForm] = useState<OrderForm | null>(null)
  const [query, setQuery] = useState('')
  const canEdit = user?.role === 'admin'

  const visible = orders.filter((order) => {
    const haystack = `${order.ref} ${order.name} ${order.email} ${order.status}`.toLowerCase()
    return haystack.includes(query.trim().toLowerCase())
  })

  async function refresh(preferId?: number) {
    setError('')
    const response = await fetch('/api/orders', { headers: authHeader(token) })
    if (!response.ok) throw new Error(await readError(response))
    const list = (await response.json()) as ShopOrder[]
    setOrders(list)
    const nextId = preferId && list.some((item) => item.id === preferId)
      ? preferId
      : list[0]?.id ?? null
    setSelectedId(nextId)
    setForm(nextId ? toForm(list.find((item) => item.id === nextId) as ShopOrder) : null)
  }

  useEffect(() => {
    void refresh().catch((caught) => setError(caught instanceof Error ? caught.message : 'Could not load orders'))
  }, [setError, token])

  function selectOrder(order: ShopOrder) {
    setError('')
    setSelectedId(order.id)
    setForm(toForm(order))
  }

  function editForm(patch: Partial<OrderForm>) {
    if (!canEdit) return
    setForm((current) => (current ? { ...current, ...patch } : current))
  }

  function editLine(index: number, patch: Partial<ShopOrderLine>) {
    if (!canEdit || !form) return
    editForm({
      lines: form.lines.map((line, lineIndex) => (lineIndex === index ? { ...line, ...patch } : line)),
    })
  }

  async function onSave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!canEdit || !form) return
    setError('')
    const response = await fetch(`/api/orders/${form.id}`, {
      method: 'PUT',
      headers: authHeader(token),
      body: JSON.stringify(form),
    })
    const data = (await response.json()) as ShopOrder & { error?: string }
    if (!response.ok) {
      setError(data.error ?? 'Could not save')
      return
    }
    notify('Order saved.')
    await refresh(data.id)
  }

  return (
    <div className="split-page orders-page">
      <section className="panel product-list-panel">
        <div className="panel-head">
          <div>
            <h2>Orders</h2>
            <p className="muted">{visible.length} of {orders.length}</p>
          </div>
        </div>
        {error ? <p className="form-error">{error}</p> : null}
        <label className="search-field search-field-block">
          <input
            className="search-input search-input-full"
            type="search"
            placeholder="Search reference, name, email…"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </label>
        <div className="table-wrap product-table-wrap">
          <table className="data-table product-table orders-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>Totals</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((order) => (
                <tr
                  key={order.id}
                  className={selectedId === order.id ? 'is-selected' : undefined}
                  onClick={() => selectOrder(order)}
                >
                  <td>
                    <strong>{order.name || '—'}</strong>
                    <div className="cell-sub">
                      {order.ref} · {orderStatuses.find((item) => item.value === order.status)?.label ?? order.status}
                    </div>
                  </td>
                  <td>{order.email}</td>
                  <td>
                    <div className="order-amounts">
                      {order.discount > 0 ? (
                        <>
                          <span>Total {formatMoney(order.total)}</span>
                          <span>Discount −{formatMoney(order.discount)}</span>
                        </>
                      ) : null}
                      <strong>Paid {formatMoney(order.totalPaid)}</strong>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {orders.length === 0 ? <p className="muted">No orders yet. A placed shop order appears here.</p> : null}
          {orders.length > 0 && visible.length === 0 ? <p className="muted">No orders match that search.</p> : null}
        </div>
      </section>

      <section className="panel product-edit-panel">
        {!form ? (
          <div className="empty-panel">
            <h2>Order</h2>
            <p className="muted">Select an order to see it.</p>
          </div>
        ) : (
          <>
            <div className="panel-head">
              <div>
                <h2>{form.ref}</h2>
                <p className="muted">{formatWhen(form.placedAt)}</p>
              </div>
            </div>
            <form className="admin-form" onSubmit={(event) => void onSave(event)}>
              <label className="admin-wide">
                Progress
                <select
                  value={form.status ?? 'placed'}
                  disabled={!canEdit}
                  onChange={(event) => editForm({ status: event.target.value as ShopOrderStatus })}
                >
                  {orderStatuses.map((step) => (
                    <option key={step.value} value={step.value}>{step.label}</option>
                  ))}
                </select>
              </label>
              <ol className="order-progress admin-wide" aria-hidden="true">
                {orderStatuses.map((step, index) => {
                  const current = orderStatuses.findIndex((item) => item.value === (form.status ?? 'placed'))
                  const state = index < current ? 'is-done' : index === current ? 'is-current' : ''
                  return (
                    <li key={step.value} className={state}>
                      <div className="step">
                        <span>{index + 1}</span>
                        {step.label}
                      </div>
                    </li>
                  )
                })}
              </ol>
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
                Name
                <input value={form.name} readOnly={!canEdit} onChange={(event) => editForm({ name: event.target.value })} />
              </label>
              <label>
                Phone
                <input value={form.phone} readOnly={!canEdit} onChange={(event) => editForm({ phone: event.target.value })} />
              </label>
              <label>
                Country
                <input value={form.country} readOnly={!canEdit} onChange={(event) => editForm({ country: event.target.value })} />
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
              <label className="admin-wide">
                Province
                <input value={form.province} readOnly={!canEdit} onChange={(event) => editForm({ province: event.target.value })} />
              </label>
              <div className="admin-wide order-lines">
                <span>Parts</span>
                {form.lines.map((line, index) => (
                  <div className="order-line" key={`${line.id}-${index}`}>
                    <input
                      value={line.name}
                      readOnly={!canEdit}
                      aria-label="Part name"
                      onChange={(event) => editLine(index, { name: event.target.value })}
                    />
                    <input
                      type="number"
                      min={1}
                      value={line.quantity}
                      readOnly={!canEdit}
                      aria-label="Quantity"
                      onChange={(event) => editLine(index, { quantity: Number(event.target.value) })}
                    />
                    <input
                      type="number"
                      min={0}
                      value={line.price}
                      readOnly={!canEdit}
                      aria-label="Price"
                      onChange={(event) => editLine(index, { price: Number(event.target.value) })}
                    />
                    {canEdit && form.lines.length > 1 ? (
                      <button
                        className="button"
                        type="button"
                        onClick={() => editForm({ lines: form.lines.filter((_, lineIndex) => lineIndex !== index) })}
                      >
                        Remove
                      </button>
                    ) : null}
                  </div>
                ))}
                {canEdit ? (
                  <button
                    className="button"
                    type="button"
                    onClick={() => editForm({
                      lines: [...form.lines, { id: 0, name: '', detail: '', quantity: 1, price: 0 }],
                    })}
                  >
                    Add part
                  </button>
                ) : null}
              </div>
              <OrderMoney lines={form.lines} discount={form.discount} />
              {error ? <p className="form-error admin-wide">{error}</p> : null}
              {canEdit ? (
                <div className="hero-actions">
                  <button className="button button-primary" type="submit">Save changes</button>
                </div>
              ) : (
                <p className="muted admin-wide">Only an administrator can edit orders.</p>
              )}
            </form>
          </>
        )}
      </section>
    </div>
  )
}
