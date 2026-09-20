type BrandMarkProps = {
  size?: number
}

export function BrandMark({ size = 36 }: BrandMarkProps) {
  return (
    <img
      className="brand-mark"
      src="/logo.svg"
      alt="tescgsm"
      width={size}
      height={size}
    />
  )
}
