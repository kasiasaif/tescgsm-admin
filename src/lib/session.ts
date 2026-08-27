const tokenKey = 'tescgsm-admin-token'

export function getToken() {
  return sessionStorage.getItem(tokenKey) ?? ''
}

export function setToken(token: string) {
  sessionStorage.setItem(tokenKey, token)
}

export function clearToken() {
  sessionStorage.removeItem(tokenKey)
}

export function authHeader(token: string) {
  return { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }
}

export async function readError(response: Response) {
  try {
    const data = (await response.json()) as { error?: string }
    return data.error ?? 'Request failed'
  } catch {
    return 'Request failed'
  }
}
