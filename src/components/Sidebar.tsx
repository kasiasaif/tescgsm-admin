import { NavLink } from 'react-router-dom'
import { shopUrl } from '../config'

const nav = [
  {
    label: 'Overview',
    items: [
      { to: '/', label: 'Dashboard' },
      { to: '/products', label: 'Products' },
    ],
  },
  {
    label: 'Sales',
    items: [
      { to: '/orders', label: 'Orders' },
      { to: '/customers', label: 'Customers' },
    ],
  },
  {
    label: 'System',
    items: [{ to: '/settings', label: 'Settings' }],
  },
]

type SidebarProps = {
  open: boolean
  onClose: () => void
  onLogout: () => void
}

export function Sidebar({ open, onClose, onLogout }: SidebarProps) {
  return (
    <aside className={open ? 'sidebar is-open' : 'sidebar'}>
      <div className="sidebar-brand">
        <span className="sidebar-mark">t</span>
        <div>
          <strong>tescgsm</strong>
          <small>Admin CRM</small>
        </div>
      </div>

      <nav className="sidebar-nav" aria-label="CRM">
        {nav.map((group) => (
          <div key={group.label} className="nav-group">
            <p className="nav-label">{group.label}</p>
            {group.items.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.to === '/'}
                className={({ isActive }) => (isActive ? 'nav-item is-active' : 'nav-item')}
                onClick={onClose}
              >
                {item.label}
              </NavLink>
            ))}
          </div>
        ))}
      </nav>

      <div className="sidebar-foot">
        <a className="nav-item" href={shopUrl} target="_blank" rel="noreferrer">
          Open shop
        </a>
        <button className="nav-item nav-logout" type="button" onClick={onLogout}>
          Sign out
        </button>
      </div>
    </aside>
  )
}
