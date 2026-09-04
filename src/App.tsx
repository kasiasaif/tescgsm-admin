import { Navigate, Route, Routes } from 'react-router-dom'
import { useAuth } from './auth.tsx'
import { AppShell } from './components/AppShell.tsx'
import { Banners } from './pages/Banners.tsx'
import { Categories } from './pages/Categories.tsx'
import { ComingSoon } from './pages/ComingSoon.tsx'
import { Dashboard } from './pages/Dashboard.tsx'
import { Login } from './pages/Login.tsx'
import { Products } from './pages/Products.tsx'
import { Settings } from './pages/Settings.tsx'
import { Staff } from './pages/Staff.tsx'
import { type Permission } from './data/permissions.ts'

function Guard({ permission, children }: { permission: Permission; children: React.ReactNode }) {
  const { user, can, homePath } = useAuth()
  if (!user) return null
  if (!can(permission)) return <Navigate to={homePath} replace />
  return children
}

export default function App() {
  const { token, user } = useAuth()

  if (!token) return <Login />
  if (!user) {
    return (
      <div className="login-main">
        <p className="muted">Loading…</p>
      </div>
    )
  }

  return (
    <Routes>
      <Route element={<AppShell />}>
        <Route path="/" element={<Guard permission="dashboard"><Dashboard /></Guard>} />
        <Route path="/products" element={<Guard permission="products"><Products /></Guard>} />
        <Route path="/categories" element={<Guard permission="categories"><Categories /></Guard>} />
        <Route path="/banners" element={<Guard permission="banners"><Banners /></Guard>} />
        <Route
          path="/orders"
          element={
            <Guard permission="orders">
              <ComingSoon title="Orders" body="Orders will land here when checkout is live. The catalog already saves to MySQL." />
            </Guard>
          }
        />
        <Route
          path="/customers"
          element={
            <Guard permission="customers">
              <ComingSoon title="Customers" body="Customer accounts are not set up yet. This menu stays so the CRM layout is ready." />
            </Guard>
          }
        />
        <Route path="/settings" element={<Guard permission="settings"><Settings /></Guard>} />
        <Route path="/staff" element={<Guard permission="staff"><Staff /></Guard>} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  )
}
