export const shopUrl = import.meta.env.DEV
  ? (import.meta.env.VITE_SHOP_URL ?? 'http://localhost:5173')
  : (import.meta.env.VITE_SHOP_URL ?? 'https://tescgsm.es')

export const adminUrl = import.meta.env.DEV
  ? (import.meta.env.VITE_ADMIN_URL ?? 'http://localhost:5174')
  : (import.meta.env.VITE_ADMIN_URL ?? 'https://tescgsm-admin.es')

export function shopAssetUrl(path: string): string {
  const trimmed = path.trim()
  if (!trimmed) return ''
  if (/^(https?:|data:|blob:)/i.test(trimmed)) return trimmed
  return `${shopUrl.replace(/\/$/, '')}/${trimmed.replace(/^\//, '')}`
}
