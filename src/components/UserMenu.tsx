import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../auth'

export function UserMenu() {
  const navigate = useNavigate()
  const { denyManage } = useAuth()
  const [open, setOpen] = useState(false)
  const root = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function onPointer(event: MouseEvent) {
      if (!root.current?.contains(event.target as Node)) setOpen(false)
    }
    function onKey(event: KeyboardEvent) {
      if (event.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onPointer)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onPointer)
      document.removeEventListener('keydown', onKey)
    }
  }, [])

  function go(path: string) {
    setOpen(false)
    if (denyManage()) return
    navigate(path)
  }

  return (
    <div
      className="kebab"
      ref={root}
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
    >
      <button
        className="kebab-btn"
        type="button"
        title="Account options"
        aria-label="Account options"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
      >
        <span />
        <span />
        <span />
      </button>
      {open ? (
        <div className="kebab-menu" role="menu">
          <button
            type="button"
            role="menuitem"
            onClick={() => go('/account?edit=1')}
          >
            Edit
          </button>
          <button
            type="button"
            role="menuitem"
            onClick={() => go('/account?password=1')}
          >
            Change password
          </button>
        </div>
      ) : null}
    </div>
  )
}
