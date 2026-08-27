import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { type Product } from './data/catalog'
import { authHeader, clearToken, getToken, setToken } from './lib/session'

type AuthContextValue = {
  token: string
  error: string
  setError: (value: string) => void
  products: Product[]
  refresh: () => Promise<void>
  login: (username: string, password: string) => Promise<boolean>
  logout: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setTokenState] = useState(getToken)
  const [error, setError] = useState('')
  const [products, setProducts] = useState<Product[]>([])

  async function refresh() {
    const response = await fetch('/api/products')
    if (!response.ok) throw new Error('Could not load the catalog')
    setProducts((await response.json()) as Product[])
  }

  useEffect(() => {
    if (!token) return
    void (async () => {
      try {
        const session = await fetch('/api/session', { headers: authHeader(token) })
        const data = (await session.json()) as { ok?: boolean }
        if (!data.ok) {
          clearToken()
          setTokenState('')
          return
        }
        await refresh()
      } catch {
        clearToken()
        setTokenState('')
        setError('The catalog API is not running. Keep npm run dev open in tescgsm-admin.')
      }
    })()
  }, [token])

  const value = useMemo<AuthContextValue>(
    () => ({
      token,
      error,
      setError,
      products,
      refresh,
      async login(username, password) {
        setError('')
        try {
          const response = await fetch('/api/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password }),
          })
          const data = (await response.json()) as { token?: string; error?: string }
          if (!response.ok || !data.token) {
            setError(data.error ?? 'Could not sign in')
            return false
          }
          setToken(data.token)
          setTokenState(data.token)
          return true
        } catch {
          setError('The catalog API is not running. Keep npm run dev open in tescgsm-admin.')
          return false
        }
      },
      async logout() {
        await fetch('/api/logout', { method: 'POST', headers: authHeader(token) })
        clearToken()
        setTokenState('')
        setProducts([])
      },
    }),
    [token, error, products],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) throw new Error('useAuth must be used inside AuthProvider')
  return context
}
