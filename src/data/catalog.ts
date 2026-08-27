export type Category = 'Batteries' | 'LCD'

export type Brand = 'Apple' | 'Samsung'

export type Product = {
  id: string
  name: string
  category: Category
  brand: Brand
  model: string
  spec: string
  price: number
  previousPrice?: number
  image: string
}

export const categories: Category[] = ['Batteries', 'LCD']

export const categoryLabel: Record<Category | 'All', string> = {
  All: 'All',
  Batteries: 'Batteries',
  LCD: 'LCD',
}

export const seedProducts: Product[] = [
  {
    id: 'bat-iphone-11',
    name: 'Battery for iPhone 11',
    category: 'Batteries',
    brand: 'Apple',
    model: 'iPhone 11',
    spec: '3520 mAh · increased capacity',
    price: 18,
    previousPrice: 22,
    image: 'images/battery-apple.png',
  },
  {
    id: 'bat-iphone-12',
    name: 'Battery for iPhone 12',
    category: 'Batteries',
    brand: 'Apple',
    model: 'iPhone 12',
    spec: '2815 mAh',
    price: 19,
    image: 'images/battery-apple.png',
  },
  {
    id: 'bat-iphone-13',
    name: 'Battery for iPhone 13',
    category: 'Batteries',
    brand: 'Apple',
    model: 'iPhone 13',
    spec: '3227 mAh',
    price: 21,
    image: 'images/battery-apple.png',
  },
  {
    id: 'bat-a15',
    name: 'Battery for Galaxy A15 5G',
    category: 'Batteries',
    brand: 'Samsung',
    model: 'Galaxy A15 5G (A156B)',
    spec: '5000 mAh',
    price: 14,
    image: 'images/battery-samsung.png',
  },
  {
    id: 'lcd-iphone-11',
    name: 'LCD screen for iPhone 11',
    category: 'LCD',
    brand: 'Apple',
    model: 'iPhone 11',
    spec: 'In-cell FHD · black · changeable IC',
    price: 29,
    previousPrice: 34,
    image: 'images/lcd-apple.png',
  },
  {
    id: 'lcd-iphone-12',
    name: 'LCD screen for iPhone 12',
    category: 'LCD',
    brand: 'Apple',
    model: 'iPhone 12',
    spec: 'In-cell FHD · black',
    price: 38,
    image: 'images/lcd-apple.png',
  },
  {
    id: 'lcd-iphone-13',
    name: 'LCD screen for iPhone 13',
    category: 'LCD',
    brand: 'Apple',
    model: 'iPhone 13',
    spec: 'In-cell FHD · black',
    price: 42,
    image: 'images/lcd-apple.png',
  },
  {
    id: 'lcd-a15',
    name: 'LCD screen for Galaxy A15 5G',
    category: 'LCD',
    brand: 'Samsung',
    model: 'Galaxy A15 5G (A156B)',
    spec: 'Service pack · black',
    price: 36,
    image: 'images/lcd-samsung.png',
  },
  {
    id: 'lcd-a14',
    name: 'LCD screen for Galaxy A14 4G',
    category: 'LCD',
    brand: 'Samsung',
    model: 'Galaxy A14 4G (A145F)',
    spec: 'Service pack · black',
    price: 27,
    image: 'images/lcd-samsung.png',
  },
  {
    id: 'bat-s22',
    name: 'Battery for Galaxy S22',
    category: 'Batteries',
    brand: 'Samsung',
    model: 'Galaxy S22',
    spec: '3700 mAh',
    price: 17,
    image: 'images/battery-samsung.png',
  },
]
