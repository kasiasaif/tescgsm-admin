type BrandMarkProps = {
  size?: number
}

export function BrandMark({ size = 64 }: BrandMarkProps) {
  return (
    <img
      className="brand-mark"
      src="/logo.png"
      alt="tescgsm"
      width={size}
      height={size}
    />
  )
}
