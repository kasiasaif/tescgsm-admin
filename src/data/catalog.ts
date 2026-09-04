export type Category = number

export type Brand = string

export type CategoryRecord = {
  id: number
  name: string
  active: boolean
  sortOrder: number
}

export type Product = {
  id: number
  name: string
  category: Category
  brand: Brand
  model: string
  spec: string
  price: number
  previousPrice?: number
  image: string
  active: boolean
}

export const seedCategories: CategoryRecord[] = [
  { id: 1, name: 'Batteries', active: true, sortOrder: 0 },
  { id: 2, name: 'LCD', active: true, sortOrder: 1 },
]

export const brands = ['Apple', 'Samsung'] as const

export const categories: Category[] = seedCategories.map((item) => item.id)

export function labelForCategory(id: number | string, list: CategoryRecord[] = seedCategories): string {
  if (id === 'All' || id === 0) return 'All'
  const numeric = Number(id)
  return list.find((item) => item.id === numeric)?.name ?? String(id)
}

export const seedProducts: Product[] = [
  {
    id: 1,
    name: 'Battery for iPhone 11',
    category: 1,
    brand: 'Apple',
    model: 'iPhone 11',
    spec: '3520 mAh · increased capacity',
    price: 18,
    previousPrice: 22,
    image: 'images/battery-apple.png',
    active: true,
  },
  {
    id: 2,
    name: 'Battery for iPhone 12',
    category: 1,
    brand: 'Apple',
    model: 'iPhone 12',
    spec: '2815 mAh',
    price: 19,
    image: 'images/battery-apple.png',
    active: true,
  },
  {
    id: 3,
    name: 'Battery for iPhone 13',
    category: 1,
    brand: 'Apple',
    model: 'iPhone 13',
    spec: '3227 mAh',
    price: 21,
    image: 'images/battery-apple.png',
    active: true,
  },
  {
    id: 4,
    name: 'Battery for Galaxy A15 5G',
    category: 1,
    brand: 'Samsung',
    model: 'Galaxy A15 5G (A156B)',
    spec: '5000 mAh',
    price: 14,
    image: 'images/battery-samsung.png',
    active: true,
  },
  {
    id: 5,
    name: 'LCD screen for iPhone 11',
    category: 2,
    brand: 'Apple',
    model: 'iPhone 11',
    spec: 'In-cell FHD · black · changeable IC',
    price: 29,
    previousPrice: 34,
    image: 'images/lcd-apple.png',
    active: true,
  },
  {
    id: 6,
    name: 'LCD screen for iPhone 12',
    category: 2,
    brand: 'Apple',
    model: 'iPhone 12',
    spec: 'In-cell FHD · black',
    price: 38,
    image: 'images/lcd-apple.png',
    active: true,
  },
  {
    id: 7,
    name: 'LCD screen for iPhone 13',
    category: 2,
    brand: 'Apple',
    model: 'iPhone 13',
    spec: 'In-cell FHD · black',
    price: 42,
    image: 'images/lcd-apple.png',
    active: true,
  },
  {
    id: 8,
    name: 'LCD screen for Galaxy A15 5G',
    category: 2,
    brand: 'Samsung',
    model: 'Galaxy A15 5G (A156B)',
    spec: 'Service pack · black',
    price: 36,
    image: 'images/lcd-samsung.png',
    active: true,
  },
  {
    id: 9,
    name: 'LCD screen for Galaxy A14 4G',
    category: 2,
    brand: 'Samsung',
    model: 'Galaxy A14 4G (A145F)',
    spec: 'Service pack · black',
    price: 27,
    image: 'images/lcd-samsung.png',
    active: true,
  },
  {
    id: 10,
    name: 'Battery for Galaxy S22',
    category: 1,
    brand: 'Samsung',
    model: 'Galaxy S22',
    spec: '3700 mAh',
    price: 17,
    image: 'images/battery-samsung.png',
    active: true,
  },
]
