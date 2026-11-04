import { useState, type InputHTMLAttributes } from 'react'

function EyeIcon({ closed }: { closed: boolean }) {
  if (closed) {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M4.8 7.3Q12 0.7 19.2 7.3" />
        <path d="M2.2 10.6Q12 22.6 21.8 10.6" />
        <path d="M4.5 14.4 1.8 17.4" />
        <path d="M8 16.2 6.2 20.2" />
        <path d="M12 16.8V21" />
        <path d="M16 16.2 17.8 20.2" />
        <path d="M19.5 14.4 22.2 17.4" />
      </svg>
    )
  }

  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M1.2 12Q12 0 22.8 12Q12 24 1.2 12Z" />
      <circle cx="12" cy="11.6" r="5.2" />
      <circle cx="12" cy="11.6" r="2.3" style={{ fill: 'currentColor', stroke: 'none' }} />
    </svg>
  )
}

type PasswordFieldProps = Omit<InputHTMLAttributes<HTMLInputElement>, 'type'>

export function PasswordField(props: PasswordFieldProps) {
  const [visible, setVisible] = useState(false)

  return (
    <span className="password-field">
      <input {...props} type={visible ? 'text' : 'password'} />
      <button
        className="password-toggle"
        type="button"
        onClick={() => setVisible((current) => !current)}
        aria-label={visible ? 'Hide password' : 'Show password'}
        aria-pressed={visible}
      >
        <EyeIcon closed={visible} />
      </button>
    </span>
  )
}
