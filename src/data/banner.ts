export type Banner = {
  id: number
  title: string
  body: string
  ctaLabel: string
  ctaHref: string
  image: string
  active: boolean
  sortOrder: number
}

export const headerBannerFonts = [
  'Plus Jakarta Sans',
  'Inter',
  'Arial',
  'Georgia',
  'Times New Roman',
  'Verdana',
  'Courier New',
  'Impact',
] as const

export type HeaderBannerFont = (typeof headerBannerFonts)[number]

export type HeaderBanner = {
  id: number
  text: string
  background: string
  backgroundOpacity: number
  color: string
  font: HeaderBannerFont
  bold: boolean
  active: boolean
  sortOrder: number
}

export function parseOpacity(value: unknown): number {
  const n = Math.round(Number(value))
  if (!Number.isFinite(n)) return 100
  return Math.min(100, Math.max(0, n))
}

export function withOpacity(hex: string, opacity: number) {
  const raw = hex.replace('#', '')
  if (!/^[0-9a-fA-F]{6}$/.test(raw)) return hex
  const n = Number.parseInt(raw, 16)
  return `rgb(${(n >> 16) & 255} ${(n >> 8) & 255} ${n & 255} / ${parseOpacity(opacity)}%)`
}

export function parseHeaderBannerFont(value: unknown): HeaderBannerFont {
  const raw = String(value ?? '')
  return headerBannerFonts.includes(raw as HeaderBannerFont) ? (raw as HeaderBannerFont) : 'Plus Jakarta Sans'
}

export function headerBannerFontStack(font: string) {
  switch (font) {
    case 'Inter':
      return 'Inter, "Segoe UI", sans-serif'
    case 'Arial':
      return 'Arial, Helvetica, sans-serif'
    case 'Georgia':
      return 'Georgia, "Times New Roman", serif'
    case 'Times New Roman':
      return '"Times New Roman", Times, serif'
    case 'Verdana':
      return 'Verdana, Geneva, sans-serif'
    case 'Courier New':
      return '"Courier New", Courier, monospace'
    case 'Impact':
      return 'Impact, Haettenschweiler, sans-serif'
    default:
      return '"Plus Jakarta Sans", "Segoe UI", sans-serif'
  }
}

export const seedBanners: Banner[] = [
  {
    id: 1,
    title: 'Batteries and LCD for phone repair',
    body: 'Parts for workshops in Spain. Shop by model and get the screen or battery you need.',
    ctaLabel: 'Shop now',
    ctaHref: '/shop',
    image: 'images/banner-home.png',
    active: true,
    sortOrder: 0,
  },
  {
    id: 2,
    title: 'LCD screens in stock',
    body: 'Replacement displays matched to the model. Built for repair counters, not retail phones.',
    ctaLabel: 'Shop LCD',
    ctaHref: '/shop?category=2',
    image: 'images/banner-lcd.png',
    active: true,
    sortOrder: 1,
  },
  {
    id: 3,
    title: 'Batteries ready to fit',
    body: 'Capacity-matched packs for Apple and Samsung. Order the part, fit the phone.',
    ctaLabel: 'Shop batteries',
    ctaHref: '/shop?category=1',
    image: 'images/banner-batteries.png',
    active: true,
    sortOrder: 2,
  },
]
