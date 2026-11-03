export type ShopCustomer = {
  id: number
  email: string
  kind: '' | 'private' | 'business'
  firstName: string
  lastName: string
  company: string
  taxId: string
  phone: string
  street: string
  city: string
  postcode: string
  province: string
  country: string
  orderCount: number
  createdAt: string
  updatedAt: string
}

export type ShopCustomerInput = {
  email: string
  kind: '' | 'private' | 'business'
  firstName: string
  lastName: string
  company: string
  taxId: string
  phone: string
  street: string
  city: string
  postcode: string
  province: string
  country: string
  passwordHash?: string
}

export type ShopOrderLine = {
  id: number
  name: string
  detail: string
  quantity: number
  price: number
}

export type ShopOrderStatus = 'placed' | 'processing' | 'sent' | 'delivered'

export type ShopOrder = {
  id: number
  ref: string
  email: string
  name: string
  phone: string
  street: string
  city: string
  postcode: string
  province: string
  country: string
  lines: ShopOrderLine[]
  total: number
  discount: number
  totalPaid: number
  status: ShopOrderStatus
  placedAt: string
}

export type ShopOrderInput = {
  ref: string
  email: string
  name: string
  phone: string
  street: string
  city: string
  postcode: string
  province: string
  country: string
  lines: ShopOrderLine[]
  status?: ShopOrderStatus
  placedAt: string
  discountCode?: string
}

export const orderStatuses: { value: ShopOrderStatus; label: string }[] = [
  { value: 'placed', label: 'Placed' },
  { value: 'processing', label: 'Processing' },
  { value: 'sent', label: 'Sent' },
  { value: 'delivered', label: 'Delivered' },
]

export function customerName(customer: Pick<ShopCustomer, 'kind' | 'company' | 'firstName' | 'lastName' | 'email'>) {
  if (customer.kind === 'business' && customer.company.trim()) return customer.company.trim()
  const name = [customer.firstName, customer.lastName].filter(Boolean).join(' ')
  return name || customer.email
}

export function formatWhen(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return new Intl.DateTimeFormat('en-GB', { dateStyle: 'medium', timeStyle: 'short' }).format(date)
}

export function orderTotal(lines: ShopOrderLine[]) {
  return lines.reduce((sum, line) => sum + line.price * line.quantity, 0)
}
