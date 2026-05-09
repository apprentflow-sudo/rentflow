import React, { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { toast } from 'sonner'
import { UploadCloud, File, AlertCircle } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import { tenantApi } from '@/lib/api'

interface TenantPayment {
  id: string
  status: string
  amount_expected: number
  amount_received: number | null
  due_date: string
  period_month: number
  period_year: number
  currency: string
  property: {
    address: string
    city: string
    monthly_rent: number
    due_day: number
  }
}

const MONTHS: Record<number, string> = {
  1: 'Enero', 2: 'Febrero', 3: 'Marzo', 4: 'Abril',
  5: 'Mayo', 6: 'Junio', 7: 'Julio', 8: 'Agosto',
  9: 'Septiembre', 10: 'Octubre', 11: 'Noviembre', 12: 'Diciembre'
}

export default function TenantUpload() {
  const { tenantId } = useParams()
  const navigate = useNavigate()
  const [file, setFile] = useState<File | null>(null)
  const [notes, setNotes] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  const { data, isLoading, error } = useQuery({
    queryKey: ['tenant-payment', tenantId],
    queryFn: async () => {
      const res = await tenantApi.get(`/api/payments/tenant/${tenantId}`)
      return res.data as { current_payment: TenantPayment | null }
    },
    enabled: !!tenantId,
    retry: false
  })

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6 text-center">
        <div>
          <h1 className="text-xl font-medium mb-4">No se pudo cargar tu información</h1>
          <Button onClick={() => navigate('/pay')} variant="outline">Volver</Button>
        </div>
      </div>
    )
  }

  const payment = data?.current_payment

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.[0]) setFile(e.target.files[0])
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    if (e.dataTransfer.files?.[0]) setFile(e.dataTransfer.files[0])
  }

  const handleSubmit = async () => {
    if (!file) {
      toast.error('Sube un comprobante para continuar')
      return
    }
    if (!payment) {
      toast.error('No hay un pago pendiente este mes')
      return
    }

    setIsSubmitting(true)
    try {
      const formData = new FormData()
      formData.append('receipt', file)
      if (notes) formData.append('notes', notes)

      await tenantApi.post(`/api/payments/${payment.id}/receipt`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      })
      navigate('/pay/success')
    } catch {
      toast.error('Error al enviar el comprobante. Intenta de nuevo.')
      setIsSubmitting(false)
    }
  }

  const periodLabel = payment
    ? `${MONTHS[payment.period_month]} ${payment.period_year}`
    : ''

  const isOverdue = payment
    ? payment.status === 'overdue' || (payment.status === 'pending' && new Date(payment.due_date) < new Date())
    : false

  const daysOverdue = payment && isOverdue
    ? Math.floor((new Date().getTime() - new Date(payment.due_date).getTime()) / (1000 * 60 * 60 * 24))
    : 0

  return (
    <div className="min-h-screen flex flex-col pt-8 md:pt-16 pb-12 px-5 md:items-center">
      <div className="w-full max-w-md">

        <div className="mb-8">
          <button onClick={() => navigate('/pay')} className="text-slate-400 hover:text-slate-900 transition-colors mb-4 inline-flex items-center text-sm font-medium">
             ← Volver
          </button>
          <h1 className="text-2xl font-bold tracking-tight mb-1">Subir Comprobante</h1>
          {payment && (
            <p className="text-slate-500 text-sm">{payment.property?.address}</p>
          )}
        </div>

        <div className="flex flex-col gap-5">
          <Card className="p-5 border-slate-100 shadow-sm rounded-2xl">
            <h3 className="text-xs uppercase tracking-wider font-semibold text-slate-400 mb-4">Detalle del Pago</h3>

            <div className="space-y-4">
              {payment ? (
                <div className={`p-4 rounded-2xl border ${isOverdue ? 'bg-red-50 border-red-200' : 'bg-indigo-50 border-indigo-100'}`}>
                  <div className="flex justify-between items-center mb-2">
                    <span className={`text-[10px] font-bold uppercase ${isOverdue ? 'text-red-600' : 'text-indigo-600'}`}>Total a reportar</span>
                    <span className={`text-[10px] ${isOverdue ? 'text-red-400' : 'text-indigo-400'}`}>Mes: {periodLabel}</span>
                  </div>
                  <div className={`text-2xl font-black underline decoration-4 ${isOverdue ? 'text-red-900 decoration-red-200' : 'text-indigo-900 decoration-indigo-200'}`}>
                    {payment.currency === 'EUR' ? '€' : '$'}{Number(payment.amount_expected).toLocaleString('es-ES')}
                  </div>
                  <div className={`text-[10px] mt-1 ${isOverdue ? 'text-red-500' : 'text-indigo-500'}`}>
                    Venció: {new Date(payment.due_date).toLocaleDateString('es-ES', { day: '2-digit', month: 'short' })}
                  </div>

                  <div className="flex items-center gap-1.5 mt-3">
                    {isOverdue ? (
                      <AlertCircle className="w-3 h-3 text-red-500" />
                    ) : (
                      <div className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                    )}
                    <span className={`text-[10px] font-bold uppercase tracking-wider ${isOverdue ? 'text-red-500' : 'text-amber-500'}`}>
                      {isOverdue
                        ? `Vencido hace ${daysOverdue} ${daysOverdue === 1 ? 'día' : 'días'}`
                        : 'Pendiente'}
                    </span>
                  </div>
                </div>
              ) : (
                <div className="bg-emerald-50 text-emerald-700 p-4 rounded-xl border border-emerald-100 font-medium text-sm flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-emerald-500" />
                  Estás al día con tus pagos
                </div>
              )}
            </div>
          </Card>

          <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200">
            <h3 className="text-sm font-bold text-slate-800 mb-4">Adjuntar archivo</h3>

            {!file ? (
              <label
                onDragOver={e => e.preventDefault()}
                onDrop={handleDrop}
                className="flex flex-col items-center justify-center border-2 border-dashed border-slate-200 rounded-2xl p-8 bg-slate-50 hover:bg-slate-100 hover:border-slate-300 transition-all cursor-pointer group"
              >
                <div className="w-12 h-12 bg-white group-hover:bg-indigo-50 rounded-full flex items-center justify-center mb-4 transition-colors shadow-sm">
                  <UploadCloud className="w-6 h-6 text-slate-400 group-hover:text-indigo-600 transition-colors" />
                </div>
                <p className="text-[10px] font-bold text-slate-600 uppercase tracking-widest mb-1">Tocar para subir</p>
                <p className="text-[10px] text-slate-400">JPG, PNG o PDF - Máx 5MB</p>
                <input type="file" className="hidden" accept="image/jpeg,image/png,image/webp,application/pdf" onChange={handleFileChange} />
              </label>
            ) : (
              <div className="border border-indigo-100 rounded-2xl p-4 flex items-center justify-between bg-indigo-50/50">
                <div className="flex items-center gap-3 overflow-hidden">
                  <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center shrink-0 shadow-sm border border-indigo-100">
                    <File className="w-5 h-5 text-indigo-600" />
                  </div>
                  <div className="truncate">
                    <p className="text-sm font-bold text-indigo-900 truncate">{file.name}</p>
                    <p className="text-xs text-indigo-500">{(file.size / 1024 / 1024).toFixed(2)} MB</p>
                  </div>
                </div>
                <button onClick={() => setFile(null)} className="p-2 text-indigo-400 hover:text-indigo-600 transition-colors">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                </button>
              </div>
            )}

            <div className="mt-6">
              <label className="block text-xs font-bold text-slate-700 mb-2">Comentario adicional (Opcional)</label>
              <textarea
                value={notes}
                onChange={e => setNotes(e.target.value)}
                className="w-full text-sm p-3 border border-slate-200 bg-slate-50 rounded-2xl resize-none h-20 outline-none focus:border-indigo-300 focus:bg-white transition-colors"
                placeholder="Ej: Pago de alquiler + gastos comunes"
              />
            </div>
          </div>

          <Button
            disabled={!file || isSubmitting || !payment}
            onClick={handleSubmit}
            className="w-full bg-indigo-600 hover:bg-indigo-700 text-white py-4 rounded-2xl font-bold text-sm shadow-lg shadow-indigo-200 active:scale-95 transition-transform h-auto mt-2"
          >
            {isSubmitting ? 'Enviando...' : 'Enviar comprobante'}
          </Button>
        </div>
      </div>
    </div>
  )
}
