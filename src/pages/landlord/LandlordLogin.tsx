import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useAuth } from '@/src/contexts/AuthContext'
import { toast } from 'sonner'

export default function LandlordLogin() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const { signInOwner } = useAuth()
  const navigate = useNavigate()

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    try {
      await signInOwner(email, password)
      navigate('/admin/dashboard')
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error al iniciar sesión'
      toast.error(msg)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-slate-50">
      <div className="w-full max-w-sm bg-white p-8 rounded-2xl shadow-sm border border-slate-200">
        <div className="mb-8">
          <button onClick={() => navigate('/')} className="text-slate-400 hover:text-slate-900 transition-colors inline-flex items-center text-sm font-medium">
             ← Volver al inicio
          </button>
        </div>

        <div className="mb-10 text-center">
          <div className="w-12 h-12 bg-indigo-600 rounded-xl flex items-center justify-center mx-auto mb-6 shadow-md shadow-indigo-200">
             <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 14v20l4-2 4 2V14M4 6h16a2 2 0 012 2v12a2 2 0 01-2 2H4a2 2 0 01-2-2V8a2 2 0 012-2z"></path></svg>
          </div>
          <h1 className="text-2xl font-bold tracking-tight mb-2 text-slate-800">RentFlow Admin</h1>
          <p className="text-slate-500 text-sm">Gestiona tus alquileres de forma sencilla</p>
        </div>

        <form onSubmit={handleLogin} className="space-y-5">
          <div className="space-y-2">
            <label className="text-sm font-bold text-slate-700">Email</label>
            <Input
              type="email"
              required
              placeholder="tu@email.com"
              value={email}
              onChange={e => setEmail(e.target.value)}
              className="h-12 rounded-xl border-slate-200 focus-visible:ring-indigo-600"
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-bold text-slate-700">Contraseña</label>
            <Input
              type="password"
              required
              placeholder="••••••••"
              value={password}
              onChange={e => setPassword(e.target.value)}
              className="h-12 rounded-xl border-slate-200 focus-visible:ring-indigo-600"
            />
          </div>
          <Button
            type="submit"
            disabled={loading}
            className="w-full bg-indigo-600 hover:bg-indigo-700 text-white py-4 rounded-xl font-bold text-sm shadow-lg shadow-indigo-200 active:scale-95 transition-transform h-auto mt-4"
          >
            {loading ? 'Ingresando...' : 'Ingresar'}
          </Button>
        </form>
      </div>
    </div>
  )
}
