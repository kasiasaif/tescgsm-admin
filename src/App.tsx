import { Navigate, Route, Routes } from 'react-router-dom'
import { useAuth } from './auth.tsx'
import { AppShell } from './components/AppShell.tsx'
import { ComingSoon } from './pages/ComingSoon.tsx'
import { Dashboard } from './pages/Dashboard.tsx'
import { Login } from './pages/Login.tsx'
import { Products } from './pages/Products.tsx'
import { Settings } from './pages/Settings.tsx'

export default function App() {
  const { token } = useAuth()

  if (!token) return <Login />

  return (
    <Routes>
      <Route element={<AppShell />}>
        <Route path="/" element={<Dashboard />} />
        <Route path="/products" element={<Products />} />
        <Route
          path="/orders"
          element={<ComingSoon title="Orders" body="Orders will land here when checkout is live. The catalog already saves to MySQL." />}
        />
        <Route
          path="/customers"
          element={<ComingSoon title="Customers" body="Customer accounts are not set up yet. This menu stays so the CRM layout is ready." />}
        />
        <Route path="/settings" element={<Settings />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  )
}
