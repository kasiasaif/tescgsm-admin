type BinButtonProps = {
  onClick: () => void
  label?: string
}

export function BinButton({ onClick, label = 'Delete' }: BinButtonProps) {
  return (
    <button className="bin-btn" type="button" aria-label={label} title={label} onClick={onClick}>
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M4 7h16M10 4h4M6 7l1.1 13h9.8L18 7M10 11v6M14 11v6"
        />
      </svg>
    </button>
  )
}
