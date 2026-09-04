import { NavLink } from 'react-router-dom'
import { useAuth } from '../auth'
import { shopUrl } from '../config'
import { routePermission } from '../data/permissions'
import { BrandMark } from './BrandMark'

const nav = [
  {
    label: 'Overview',
    items: [
      { to: '/', label: 'Dashboard' },
      { to: '/products', label: 'Products' },
      { to: '/categories', label: 'Categories' },
      { to: '/banners', label: 'Banners' },
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
    items: [
      { to: '/staff', label: 'Staff' },
      { to: '/settings', label: 'Settings' },
    ],
  },
]

type SidebarProps = {
  open: boolean
  onClose: () => void
  onLogout: () => void
}

export function Sidebar({ open, onClose, onLogout }: SidebarProps) {
  const { can } = useAuth()
  const groups = nav
    .map((group) => ({
      ...group,
      items: group.items.filter((item) => can(routePermission[item.to])),
    }))
    .filter((group) => group.items.length > 0)

  return (
    <aside className={open ? 'sidebar is-open' : 'sidebar'}>
      <div className="sidebar-brand">
        <BrandMark />
        <div>
          <strong>tescgsm</strong>
          <small>Admin CRM</small>
        </div>
      </div>

      <nav className="sidebar-nav" aria-label="CRM">
        {groups.map((group) => (
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
