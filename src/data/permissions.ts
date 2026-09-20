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

export type UserRole = 'admin' | 'staff' | 'visitor'

export type PublicUser = {
  id: number
  username: string
  email: string
  photo: string
  role: UserRole
  active: boolean
  permissions: Permission[]
}

export const staffPermissions: Permission[] = permissionKeys.filter((item) => item !== 'staff')

export const visitorPermissions: Permission[] = permissionKeys.filter((item) => item !== 'staff')

export const roleLabel: Record<UserRole, string> = {
  admin: 'Admin',
  staff: 'General staff',
  visitor: 'Visitor',
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
  if (value === 'admin') return 'admin'
  if (value === 'visitor') return 'visitor'
  return 'staff'
}

export function permissionsForRole(role: UserRole): Permission[] {
  if (role === 'admin') return [...permissionKeys]
  if (role === 'visitor') return [...visitorPermissions]
  return [...staffPermissions]
}

export function canManage(user: PublicUser | null | undefined): boolean {
  return Boolean(user?.active && user.role !== 'visitor')
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
