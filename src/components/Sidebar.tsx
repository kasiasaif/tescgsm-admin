import { NavLink } from 'react-router-dom'
import { useAuth } from '../auth'
import { shopUrl } from '../config'
import { routePermission } from '../data/permissions'
import { BrandMark } from './BrandMark'

const nav = [
  {
    label: 'Menu',
    items: [
      { to: '/', label: 'Dashboard', icon: 'home' },
      { to: '/products', label: 'Products', icon: 'box' },
      { to: '/stock', label: 'Stock', icon: 'bars' },
      { to: '/categories', label: 'Categories', icon: 'grid' },
      { to: '/banners', label: 'Banners', icon: 'image' },
    ],
  },
  {
    label: 'Sales',
    items: [
      { to: '/orders', label: 'Orders', icon: 'bag' },
      { to: '/customers', label: 'Customers', icon: 'users' },
    ],
  },
  {
    label: 'System',
    items: [
      { to: '/account', label: 'Account', icon: 'user' },
      { to: '/staff', label: 'Staff', icon: 'users' },
      { to: '/settings', label: 'Settings', icon: 'gear' },
    ],
  },
]

const paths: Record<string, string> = {
  home: 'M4 10.5 12 4l8 6.5V20a1 1 0 0 1-1 1h-5.2v-6.2H10.2V21H5a1 1 0 0 1-1-1z',
  box: 'M3.6 8.2 12 4l8.4 4.2v7.6L12 20l-8.4-4.2zM3.6 8.2 12 12.4l8.4-4.2M12 12.4V20',
  bars: 'M5 19V10M12 19V5M19 19v-7',
  grid: 'M4.5 4.5h6.2v6.2H4.5zM13.3 4.5h6.2v6.2h-6.2zM4.5 13.3h6.2v6.2H4.5zM13.3 13.3h6.2v6.2h-6.2z',
  image: 'M5 5h14a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1zM8.2 10.2a1.3 1.3 0 1 0 0-2.6 1.3 1.3 0 0 0 0 2.6zM4.8 16.5l4.4-4.2 2.6 2.4 3.3-3.3 4.1 5.1',
  bag: 'M6.5 8.5h11l.8 11.2a1 1 0 0 1-1 1.1H6.7a1 1 0 0 1-1-1.1L6.5 8.5zM9 8.5V7.2A3 3 0 0 1 12 4.2 3 3 0 0 1 15 7.2v1.3',
  users: 'M15.8 18.8v-1.2a3.2 3.2 0 0 0-3.2-3.2H7.4A3.2 3.2 0 0 0 4.2 17.6v1.2M9.6 11.2A2.8 2.8 0 1 0 9.6 5.6a2.8 2.8 0 0 0 0 5.6zM19.8 18.8v-1.2a3 3 0 0 0-2.2-2.9M16.4 5.8a2.6 2.6 0 0 1 0 5',
  user: 'M18.5 19.2v-1.4A3.4 3.4 0 0 0 15.1 14.4H8.9A3.4 3.4 0 0 0 5.5 17.8v1.4M12 11.4A2.9 2.9 0 1 0 12 5.6a2.9 2.9 0 0 0 0 5.8z',
  gear: 'M12 15.3A3.3 3.3 0 1 0 12 8.7a3.3 3.3 0 0 0 0 6.6zM12 3.4v1.8M12 18.8v1.8M4.9 7.1l1.5 1M17.6 16l1.5 1M4.9 16.9l1.5-1M17.6 8.1l1.5-1M3.4 12h1.8M18.8 12h1.8',
  shop: 'M5 9.2 6.2 5h11.6L19 9.2M5 9.2v9.4h14V9.2M9.2 13.4h5.6',
  out: 'M10 12h9M16.2 8.8 19.5 12l-3.3 3.2M14 19.4H6.6A1.6 1.6 0 0 1 5 17.8V6.2A1.6 1.6 0 0 1 6.6 4.6H14',
}

function NavIcon({ name }: { name: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden="true">
      <path d={paths[name]} />
    </svg>
  )
}

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
      items: group.items.filter(
        (item) => item.to === '/account' || can(routePermission[item.to]),
      ),
    }))
    .filter((group) => group.items.length > 0)

  return (
    <aside className={open ? 'sidebar is-open' : 'sidebar'}>
      <div className="sidebar-brand">
        <BrandMark />
        <strong>tescgsm</strong>
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
                <NavIcon name={item.icon} />
                {item.label}
              </NavLink>
            ))}
          </div>
        ))}
      </nav>

      <div className="sidebar-foot">
        <a className="nav-item" href={shopUrl} target="_blank" rel="noreferrer">
          <NavIcon name="shop" />
          Open shop
        </a>
        <button className="nav-item nav-logout" type="button" onClick={onLogout}>
          <NavIcon name="out" />
          Sign out
        </button>
      </div>
    </aside>
  )
}
