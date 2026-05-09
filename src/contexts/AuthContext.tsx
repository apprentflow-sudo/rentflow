import { createContext, useContext, useState, useEffect } from 'react'
import { createClient } from '@supabase/supabase-js'
import { tenantApi } from '@/lib/api'

const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
)

interface AuthContextType {
  ownerToken: string | null
  tenantId: string | null
  isOwnerLoading: boolean
  signInOwner: (email: string, password: string) => Promise<void>
  signOutOwner: () => Promise<void>
  signInTenant: (idDocument: string) => Promise<string>
  signOutTenant: () => void
}

const AuthContext = createContext<AuthContextType | null>(null)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [ownerToken, setOwnerToken] = useState<string | null>(
    () => localStorage.getItem('owner_token')
  )
  const [tenantId, setTenantId] = useState<string | null>(
    () => sessionStorage.getItem('tenant_id')
  )
  const [isOwnerLoading, setIsOwnerLoading] = useState(true)

  useEffect(() => {
    // Restore session from Supabase on mount
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.access_token) {
        setOwnerToken(session.access_token)
        localStorage.setItem('owner_token', session.access_token)
      } else {
        localStorage.removeItem('owner_token')
        setOwnerToken(null)
      }
      setIsOwnerLoading(false)
    })

    // Keep token fresh when Supabase refreshes the session
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.access_token) {
        setOwnerToken(session.access_token)
        localStorage.setItem('owner_token', session.access_token)
      } else {
        localStorage.removeItem('owner_token')
        setOwnerToken(null)
      }
    })

    return () => subscription.unsubscribe()
  }, [])

  const signInOwner = async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) throw new Error(error.message)
    setOwnerToken(data.session.access_token)
    localStorage.setItem('owner_token', data.session.access_token)
  }

  const signOutOwner = async () => {
    await supabase.auth.signOut()
    localStorage.removeItem('owner_token')
    setOwnerToken(null)
  }

  const signInTenant = async (idDocument: string): Promise<string> => {
    const { data } = await tenantApi.post('/api/auth/tenant', { id_document: idDocument })
    sessionStorage.setItem('tenant_token', data.token)
    sessionStorage.setItem('tenant_id', data.tenant_id)
    setTenantId(data.tenant_id)
    return data.tenant_id
  }

  const signOutTenant = () => {
    sessionStorage.removeItem('tenant_token')
    sessionStorage.removeItem('tenant_id')
    setTenantId(null)
  }

  return (
    <AuthContext.Provider value={{ ownerToken, tenantId, isOwnerLoading, signInOwner, signOutOwner, signInTenant, signOutTenant }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider')
  return ctx
}
