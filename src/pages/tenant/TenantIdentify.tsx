import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useAuth } from '@/src/contexts/AuthContext'
import { toast } from 'sonner'

export default function TenantIdentify() {
  const [documentId, setDocumentId] = useState('')
  const [loading, setLoading] = useState(false)
  const { signInTenant } = useAuth()
  const navigate = useNavigate()

  const handleContinue = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!documentId.trim()) return

    setLoading(true)
    try {
      const tenantId = await signInTenant(documentId.trim())
      navigate(`/pay/${tenantId}`)
    } catch {
      toast.error('Documento no encontrado. Verifica tu DNI o cédula.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex flex-col pt-12 md:pt-24 px-6 md:items-center bg-slate-50">
      <div className="w-full max-w-md">
        <div className="mb-8">
          <button onClick={() => navigate('/')} className="text-slate-400 hover:text-slate-900 transition-colors mb-4 inline-flex items-center text-sm font-medium">
             ← Volver
          </button>
        </div>
        <div className="mb-10 text-center">
          <div className="w-12 h-12 bg-indigo-600 rounded-xl flex items-center justify-center mx-auto mb-6 shadow-md shadow-indigo-200">
             <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 14v20l4-2 4 2V14M4 6h16a2 2 0 012 2v12a2 2 0 01-2 2H4a2 2 0 01-2-2V8a2 2 0 012-2z"></path></svg>
          </div>
          <h1 className="text-2xl font-bold tracking-tight mb-2 text-slate-800">RentFlow</h1>
          <p className="text-slate-500 text-sm">Gestiona el pago de tu alquiler fácilmente</p>
        </div>

        <form onSubmit={handleContinue} className="bg-white p-6 md:p-8 rounded-2xl shadow-sm border border-slate-200 flex flex-col gap-6">
          <div className="space-y-4">
            <label className="block text-sm font-bold text-slate-700">
              Ingresa tu documento de identidad
              <span className="block text-xs text-slate-400 mt-1 font-medium">Cédula, DNI o Pasaporte</span>
            </label>
            <Input
              autoFocus
              className="h-14 text-lg text-center rounded-xl border-slate-200 focus-visible:ring-indigo-600"
              placeholder="Ej: 12345678"
              value={documentId}
              onChange={e => setDocumentId(e.target.value)}
            />
          </div>

          <Button
            type="submit"
            disabled={loading}
            className="w-full bg-indigo-600 hover:bg-indigo-700 text-white py-4 rounded-2xl font-bold text-sm shadow-lg shadow-indigo-200 active:scale-95 transition-transform h-auto mt-2"
          >
            {loading ? 'Buscando...' : 'Continuar'}
          </Button>
        </form>
      </div>
    </div>
  )
}
