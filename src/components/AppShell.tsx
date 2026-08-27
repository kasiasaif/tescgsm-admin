import { useState } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '../auth'
import { Sidebar } from './Sidebar'

const titles: Record<string, string> = {
  '/': 'Dashboard',
  '/products': 'Products',
  '/orders': 'Orders',
  '/customers': 'Customers',
  '/settings': 'Settings',
}

export function AppShell() {
  const { logout } = useAuth()
  const { pathname } = useLocation()
  const [open, setOpen] = useState(false)
  const title = titles[pathname] ?? 'tescgsm'

  return (
    <div className="crm">
      <Sidebar open={open} onClose={() => setOpen(false)} onLogout={() => void logout()} />
      {open ? <button className="sidebar-scrim" type="button" aria-label="Close menu" onClick={() => setOpen(false)} /> : null}
      <div className="crm-main">
        <header className="crm-top">
          <button className="menu-btn" type="button" aria-label="Open menu" onClick={() => setOpen(true)}>
            Menu
          </button>
          <div>
            <p className="crumb">tescgsm CRM</p>
            <h1>{title}</h1>
          </div>
          <div className="user-chip">
            <span>AD</span>
            <div>
              <strong>Admin</strong>
              <small>hello@tescgsm.es</small>
            </div>
          </div>
        </header>
        <div className="crm-body">
          <Outlet />
        </div>
      </div>
    </div>
  )
}
