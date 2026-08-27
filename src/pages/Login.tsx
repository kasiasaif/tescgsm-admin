import { useState, type FormEvent } from 'react'
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
      <form className="login-card" onSubmit={onSubmit}>
        <p className="crumb">tescgsm CRM</p>
        <h1>Sign in</h1>
        <p className="lede">Sign in to manage tescgsm.es from admin-tescgsm.es.</p>
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
        <button className="button button-primary" type="submit">
          Continue
        </button>
      </form>
    </div>
  )
}
