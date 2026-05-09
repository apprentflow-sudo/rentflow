import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { Toaster } from '@/components/ui/sonner'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { AuthProvider, useAuth } from './contexts/AuthContext'
import Home from './pages/Home'
import TenantIdentify from './pages/tenant/TenantIdentify'
import TenantUpload from './pages/tenant/TenantUpload'
import TenantSuccess from './pages/tenant/TenantSuccess'
import LandlordLogin from './pages/landlord/LandlordLogin'
import LandlordDashboard from './pages/landlord/LandlordDashboard'

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1, staleTime: 30_000 } }
})

function OwnerGuard({ children }: { children: React.ReactNode }) {
  const { ownerToken, isOwnerLoading } = useAuth()
  if (isOwnerLoading) return null
  if (!ownerToken) return <Navigate to="/admin" replace />
  return <>{children}</>
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />

      {/* Tenant routes — /pay/success MUST come before /pay/:tenantId */}
      <Route path="/pay" element={<TenantIdentify />} />
      <Route path="/pay/success" element={<TenantSuccess />} />
      <Route path="/pay/:tenantId" element={<TenantUpload />} />

      {/* Owner routes */}
      <Route path="/admin" element={<LandlordLogin />} />
      <Route path="/admin/dashboard" element={<OwnerGuard><LandlordDashboard /></OwnerGuard>} />
    </Routes>
  )
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <AuthProvider>
          <div className="min-h-screen bg-slate-50 text-slate-900 font-sans selection:bg-slate-200">
            <AppRoutes />
          </div>
          <Toaster position="top-center" />
        </AuthProvider>
      </BrowserRouter>
    </QueryClientProvider>
  )
}
