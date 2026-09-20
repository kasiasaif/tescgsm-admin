import { useState } from 'react'
import { Link, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '../auth'
import { roleLabel } from '../data/permissions'
import { BrandMark } from './BrandMark'
import { Sidebar } from './Sidebar'
import { UserMenu } from './UserMenu'

const titles: Record<string, string> = {
  '/': 'Dashboard',
  '/products': 'Products',
  '/categories': 'Categories',
  '/banners': 'Banners',
  '/orders': 'Orders',
  '/customers': 'Customers',
  '/settings': 'Settings',
  '/account': 'Account',
  '/staff': 'Staff',
}

export function AppShell() {
  const { logout, user } = useAuth()
  const { pathname } = useLocation()
  const [open, setOpen] = useState(false)
  const title = titles[pathname] ?? 'tescgsm'
  const initials = (user?.username ?? 'AD').slice(0, 2).toUpperCase()

  return (
    <div className="crm">
      <Sidebar open={open} onClose={() => setOpen(false)} onLogout={() => void logout()} />
      {open ? <button className="sidebar-scrim" type="button" aria-label="Close menu" onClick={() => setOpen(false)} /> : null}
      <div className="crm-main">
        <header className="crm-top">
          <button className="menu-btn" type="button" aria-label="Open menu" onClick={() => setOpen(true)}>
            Menu
          </button>
          <BrandMark />
          <div>
            <p className="crumb">tescgsm CRM</p>
            <h1>{title}</h1>
          </div>
          <div className="user-slot">
            <Link className="user-chip" to="/account" aria-label="Account">
              {user?.photo ? <img src={user.photo} alt="" /> : <span>{initials}</span>}
              <div>
                <strong>{user?.username ?? 'Admin'}</strong>
                <small>{user ? roleLabel[user.role] : 'Staff'}</small>
              </div>
            </Link>
            {pathname === '/account' ? <UserMenu /> : null}
          </div>
        </header>
        <div className="crm-body">
          <Outlet />
        </div>
      </div>
    </div>
  )
}
