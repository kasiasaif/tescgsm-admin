export const permissionKeys = [
  'dashboard',
  'products',
  'categories',
  'banners',
  'orders',
  'customers',
  'settings',
  'staff',
] as const

export type Permission = (typeof permissionKeys)[number]

export type UserRole = 'admin' | 'staff'

export type PublicUser = {
  id: number
  username: string
  role: UserRole
  active: boolean
  permissions: Permission[]
}

export const staffPermissions: Permission[] = permissionKeys.filter((item) => item !== 'staff')

export const roleLabel: Record<UserRole, string> = {
  admin: 'Admin',
  staff: 'General staff',
}

export const routePermission: Record<string, Permission> = {
  '/': 'dashboard',
  '/products': 'products',
  '/categories': 'categories',
  '/banners': 'banners',
  '/orders': 'orders',
  '/customers': 'customers',
  '/settings': 'settings',
  '/staff': 'staff',
}

export function parseRole(value: unknown): UserRole {
  return value === 'admin' ? 'admin' : 'staff'
}

export function permissionsForRole(role: UserRole): Permission[] {
  return role === 'admin' ? [...permissionKeys] : [...staffPermissions]
}

export function hasPermission(user: PublicUser | null | undefined, permission: Permission): boolean {
  if (!user || !user.active) return false
  if (user.role === 'admin') return true
  return user.permissions.includes(permission)
}

export function firstAllowedPath(user: PublicUser | null | undefined): string {
  const order = Object.keys(routePermission)
  return order.find((path) => hasPermission(user, routePermission[path])) ?? '/'
}
