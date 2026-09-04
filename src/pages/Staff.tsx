import { useEffect, useState, type FormEvent } from 'react'
import { ActiveSwitch } from '../components/ActiveSwitch'
import { useAuth } from '../auth'
import { parseRole, roleLabel, type PublicUser, type UserRole } from '../data/permissions'
import { authHeader } from '../lib/session'

type StaffForm = {
  id: number
  username: string
  password: string
  active: boolean
  role: UserRole
}

const emptyForm: StaffForm = {
  id: 0,
  username: '',
  password: '',
  active: true,
  role: 'staff',
}

export function Staff() {
  const { token, error, setError } = useAuth()
  const [staff, setStaff] = useState<PublicUser[]>([])
  const [form, setForm] = useState<StaffForm>(emptyForm)
  const [selectedId, setSelectedId] = useState<number | null>(null)

  const editing = selectedId !== null && selectedId > 0
  const creating = selectedId === 0

  async function refresh() {
    const response = await fetch('/api/staff', { headers: authHeader(token) })
    if (!response.ok) throw new Error('Could not load staff')
    setStaff((await response.json()) as PublicUser[])
  }

  useEffect(() => {
    void refresh().catch(() => setError('Could not load staff'))
  }, [setError, token])

  function selectStaff(user: PublicUser) {
    setError('')
    setSelectedId(user.id)
    setForm({
      id: user.id,
      username: user.username,
      password: '',
      active: user.active,
      role: parseRole(user.role),
    })
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
    const payload = {
      ...form,
      password: form.password.trim(),
    }
    const response = await fetch('/api/staff', {
      method: 'PUT',
      headers: authHeader(token),
      body: JSON.stringify(payload),
    })
    const data = (await response.json()) as PublicUser & { error?: string }
    if (!response.ok) {
      setError(data.error ?? 'Could not save')
      return
    }
    setSelectedId(data.id)
    setForm({
      id: data.id,
      username: data.username,
      password: '',
      active: data.active,
      role: parseRole(data.role),
    })
    await refresh()
  }

  async function onDelete(id: number) {
    if (!confirm('Remove this staff account?')) return
    const response = await fetch(`/api/staff/${id}`, {
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
    <div className="stack">
      <section className="panel">
        <div className="panel-head">
          <div>
            <h2>Staff</h2>
            <p className="muted">
              {staff.length} in the staff table. Everyone signs in here — admin or general staff.
            </p>
          </div>
          <button className="button button-primary" type="button" onClick={startNew}>
            New staff
          </button>
        </div>
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>ID</th>
                <th>Username</th>
                <th>Permission</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {staff.length === 0 ? (
                <tr>
                  <td colSpan={4} className="muted">No staff accounts yet.</td>
                </tr>
              ) : (
                staff.map((user) => (
                  <tr
                    key={user.id}
                    className={selectedId === user.id ? 'is-selected' : ''}
                    onClick={() => selectStaff(user)}
                  >
                    <td>{user.id}</td>
                    <td>
                      <strong>{user.username}</strong>
                    </td>
                    <td>{roleLabel[user.role]}</td>
                    <td>{user.active ? 'Active' : 'Disable'}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      {selectedId !== null ? (
        <section className="panel">
          <div className="panel-head">
            <div>
              <h2>{editing ? form.username || 'Edit staff' : 'Add staff'}</h2>
              <p className="muted">
                {editing
                  ? `ID ${form.id}. Permission applies the next time they sign in.`
                  : 'Creates a login in the staff table.'}
              </p>
            </div>
            {editing ? (
              <button className="text-btn" type="button" onClick={() => void onDelete(form.id)}>
                Delete
              </button>
            ) : null}
          </div>
          <form className="admin-form" onSubmit={onSave}>
            <label>
              Username
              <input
                value={form.username}
                onChange={(event) => setForm({ ...form, username: event.target.value })}
                required
              />
            </label>
            <label>
              Password
              <input
                type="password"
                value={form.password}
                onChange={(event) => setForm({ ...form, password: event.target.value })}
                placeholder={editing ? 'Leave blank to keep' : ''}
                required={creating}
                minLength={creating ? 4 : undefined}
              />
            </label>
            <ActiveSwitch
              checked={form.active}
              onChange={(active) => setForm({ ...form, active })}
            />
            <fieldset className="admin-wide permission-set">
              <legend>Permission</legend>
              <div className="role-grid">
                <label className={form.role === 'admin' ? 'role-card is-selected' : 'role-card'}>
                  <input
                    type="radio"
                    name="role"
                    checked={form.role === 'admin'}
                    onChange={() => setForm({ ...form, role: 'admin' })}
                  />
                  <span>
                    <strong>Admin</strong>
                    <small>All pages, including staff accounts.</small>
                  </span>
                </label>
                <label className={form.role === 'staff' ? 'role-card is-selected' : 'role-card'}>
                  <input
                    type="radio"
                    name="role"
                    checked={form.role === 'staff'}
                    onChange={() => setForm({ ...form, role: 'staff' })}
                  />
                  <span>
                    <strong>General staff</strong>
                    <small>Catalog and shop pages. Cannot manage staff.</small>
                  </span>
                </label>
              </div>
            </fieldset>
            {error ? <p className="form-error">{error}</p> : null}
            <div className="hero-actions">
              <button className="button button-primary" type="submit">
                {editing ? 'Save changes' : 'Add staff'}
              </button>
              <button className="button" type="button" onClick={clearEditor}>
                Cancel
              </button>
            </div>
          </form>
        </section>
      ) : null}
    </div>
  )
}
