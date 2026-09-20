import { useEffect, useState, type ChangeEvent, type FormEvent } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useAuth } from '../auth'
import { authHeader } from '../lib/session'
import { type PublicUser } from '../data/permissions'

function initialsFor(name: string) {
  return name.slice(0, 2).toUpperCase() || 'ME'
}

function readPhoto(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    if (!file.type.startsWith('image/')) {
      reject(new Error('Choose a JPG, PNG, or WebP photo.'))
      return
    }
    if (file.size > 4 * 1024 * 1024) {
      reject(new Error('Use a photo smaller than 4 MB.'))
      return
    }
    const image = new Image()
    const url = URL.createObjectURL(file)
    image.onload = () => {
      URL.revokeObjectURL(url)
      const size = 256
      const canvas = document.createElement('canvas')
      canvas.width = size
      canvas.height = size
      const context = canvas.getContext('2d')
      if (!context) {
        reject(new Error('Could not read that photo.'))
        return
      }
      const scale = Math.max(size / image.width, size / image.height)
      const width = image.width * scale
      const height = image.height * scale
      context.drawImage(image, (size - width) / 2, (size - height) / 2, width, height)
      resolve(canvas.toDataURL('image/jpeg', 0.86))
    }
    image.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('Could not read that photo.'))
    }
    image.src = url
  })
}

export function Account() {
  const { token, user, reloadUser, denyManage } = useAuth()
  const [searchParams, setSearchParams] = useSearchParams()
  const editing = searchParams.get('edit') === '1'
  const changingPassword = searchParams.get('password') === '1'
  const [username, setUsername] = useState(user?.username ?? '')
  const [email, setEmail] = useState(user?.email ?? '')
  const [photo, setPhoto] = useState(user?.photo ?? '')
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState('')
  const [saved, setSaved] = useState('')

  useEffect(() => {
    if (!user) return
    setUsername(user.username)
    setEmail(user.email ?? '')
    setPhoto(user.photo ?? '')
  }, [user])

  useEffect(() => {
    if (!editing && !changingPassword) return
    if (!denyManage()) return
    setSearchParams({})
  }, [changingPassword, denyManage, editing, setSearchParams])

  async function onPhoto(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    if (denyManage()) return
    setError('')
    setSaved('')
    try {
      setPhoto(await readPhoto(file))
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not read that photo.')
    }
  }

  async function onSave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (denyManage()) return
    setError('')
    setSaved('')
    if (changingPassword) {
      if (!currentPassword) {
        setError('Enter your current password to change it.')
        return
      }
      if (!newPassword) {
        setError('Enter a new password.')
        return
      }
      if (newPassword !== confirmPassword) {
        setError('The new passwords do not match.')
        return
      }
    }
    const response = await fetch('/api/account', {
      method: 'PUT',
      headers: authHeader(token),
      body: JSON.stringify({
        username,
        email,
        photo,
        currentPassword: changingPassword ? currentPassword : '',
        newPassword: changingPassword ? newPassword : '',
      }),
    })
    const data = (await response.json()) as PublicUser & { error?: string }
    if (!response.ok) {
      setError(data.error ?? 'Could not save account')
      return
    }
    setCurrentPassword('')
    setNewPassword('')
    setConfirmPassword('')
    setSaved(changingPassword ? 'Password updated.' : 'Account updated.')
    setSearchParams({})
    await reloadUser()
  }

  function cancelEdit() {
    setError('')
    setSaved('')
    setCurrentPassword('')
    setNewPassword('')
    setConfirmPassword('')
    if (user) {
      setUsername(user.username)
      setEmail(user.email ?? '')
      setPhoto(user.photo ?? '')
    }
    setSearchParams({})
  }

  const initials = initialsFor(username)

  return (
    <div className="stack">
      <section className="panel">
        <div className="panel-head">
          <div>
            <h2>{changingPassword ? 'Change password' : 'Account'}</h2>
            <p className="muted">
              {changingPassword
                ? 'Enter your current password, then choose a new one.'
                : 'Your photo, email, and username for this CRM login.'}
            </p>
          </div>
        </div>
        {editing ? (
        <form className="admin-form" onSubmit={(event) => void onSave(event)}>
          <div className="account-photo admin-wide">
            {photo ? (
              <img src={photo} alt="" />
            ) : (
              <span className="account-photo-fallback">{initials}</span>
            )}
            <div>
              <label className="button" htmlFor="account-photo">
                Change photo
              </label>
              <input id="account-photo" type="file" accept="image/*" onChange={(event) => void onPhoto(event)} />
              {photo ? (
                <button className="text-btn" type="button" onClick={() => setPhoto('')}>
                  Remove photo
                </button>
              ) : null}
            </div>
          </div>
          <label>
            Username
            <input
              autoComplete="username"
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              required
            />
          </label>
          <label>
            Email
            <input
              type="email"
              autoComplete="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="name@tescgsm.es"
            />
          </label>
          {error ? <p className="form-error admin-wide">{error}</p> : null}
          {saved ? <p className="form-ok admin-wide">{saved}</p> : null}
          <div className="hero-actions account-actions">
            <button className="button" type="button" onClick={cancelEdit}>
              Cancel
            </button>
            <button className="button button-primary" type="submit">
              Save changes
            </button>
          </div>
        </form>
        ) : changingPassword ? (
        <form className="admin-form password-form" onSubmit={(event) => void onSave(event)}>
          <label>
            Current password
            <input
              type="password"
              autoComplete="current-password"
              value={currentPassword}
              onChange={(event) => setCurrentPassword(event.target.value)}
              required
            />
          </label>
          <label>
            New password
            <input
              type="password"
              autoComplete="new-password"
              value={newPassword}
              onChange={(event) => setNewPassword(event.target.value)}
              minLength={4}
              required
            />
          </label>
          <label>
            Confirm new password
            <input
              type="password"
              autoComplete="new-password"
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              required
            />
          </label>
          {error ? <p className="form-error admin-wide">{error}</p> : null}
          {saved ? <p className="form-ok admin-wide">{saved}</p> : null}
          <div className="hero-actions account-actions">
            <button className="button" type="button" onClick={cancelEdit}>
              Cancel
            </button>
            <button className="button button-primary" type="submit">
              Save changes
            </button>
          </div>
        </form>
        ) : (
          <div className="account-view">
            <div className="account-photo">
              {photo ? (
                <img src={photo} alt="" />
              ) : (
                <span className="account-photo-fallback">{initials}</span>
              )}
            </div>
            <dl className="meta-list">
              <div>
                <dt>Username</dt>
                <dd>{username}</dd>
              </div>
              <div>
                <dt>Email</dt>
                <dd>{email || 'Not set'}</dd>
              </div>
            </dl>
          </div>
        )}
      </section>
    </div>
  )
}
