import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { Component, type ReactNode } from 'react'
import { Toaster } from '@/components/ui/sonner'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { AuthProvider, useAuth } from './contexts/AuthContext'
import Home from './pages/Home'
import TenantIdentify from './pages/tenant/TenantIdentify'
import TenantUpload from './pages/tenant/TenantUpload'
import TenantSuccess from './pages/tenant/TenantSuccess'
import LandlordLogin from './pages/landlord/LandlordLogin'
import LandlordDashboard from './pages/landlord/LandlordDashboard'

class ErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null }
  static getDerivedStateFromError(e: Error) { return { error: e } }
  render() {
    if (this.state.error) {
      const msg = (this.state.error as Error).message
      return (
        <div style={{ padding: 40, fontFamily: 'monospace', color: '#dc2626' }}>
          <h2>App failed to start</h2>
          <pre style={{ marginTop: 12, whiteSpace: 'pre-wrap' }}>{msg}</pre>
        </div>
      )
    }
    return this.props.children
  }
}

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
    <ErrorBoundary>
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
    </ErrorBoundary>
  )
}
