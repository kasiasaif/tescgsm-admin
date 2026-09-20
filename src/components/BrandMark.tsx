import logoUrl from '../assets/logo.svg?url'

type BrandMarkProps = {
  size?: number
}

export function BrandMark({ size = 36 }: BrandMarkProps) {
  return (
    <img
      className="brand-mark"
      src={logoUrl}
      alt="tescgsm"
      width={size}
      height={size}
    />
  )
}
