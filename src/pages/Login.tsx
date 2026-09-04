import { useState, type FormEvent } from 'react'
import { BrandMark } from '../components/BrandMark'
import { useAuth } from '../auth'

export function Login() {
  const { login, error } = useAuth()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    await login(username, password)
  }

  return (
    <div className="login-screen">
      <aside className="login-brand">
        <div className="login-brand-copy">
          <BrandMark size={112} />
          <p className="crumb">tescgsm</p>
          <h1>Catalog administration</h1>
          <p>Batteries and LCD for tescgsm.es</p>
        </div>
        <img
          className="login-graphic"
          src="/login-hex.png"
          alt=""
        />
      </aside>
      <main className="login-main">
        <form className="login-card" onSubmit={onSubmit}>
          <p className="crumb">Sign in</p>
          <h1>Staff access</h1>
          <p className="lede">Enter your credentials to manage the catalog.</p>
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
            Password
            <input
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
            />
          </label>
          {error ? <p className="form-error">{error}</p> : null}
          <button className="button button-primary button-block" type="submit">
            Continue
          </button>
          <p className="login-foot">Authorized staff only</p>
        </form>
      </main>
    </div>
  )
}
