import React, { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { toast } from 'sonner'
import { UploadCloud, File, AlertCircle, ChevronDown, ChevronUp } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import { tenantApi } from '@/lib/api'

interface TenantPayment {
  id: string
  status: string
  amount_expected: number
  common_expenses_expected: number
  amount_received: number | null
  due_date: string
  period_month: number
  period_year: number
  property: {
    address: string
    city: string
    monthly_rent: number
    due_day: number
    currency: string
  }
}

const MONTHS: Record<number, string> = {
  1: 'Ene', 2: 'Feb', 3: 'Mar', 4: 'Abr',
  5: 'May', 6: 'Jun', 7: 'Jul', 8: 'Ago',
  9: 'Sep', 10: 'Oct', 11: 'Nov', 12: 'Dic'
}

const CURRENCY_SYMBOL: Record<string, string> = {
  EUR: '€', USD: '$', UYU: '$U', PYG: '₲', GBP: '£'
}

type ReceiptType = 'both' | 'rent' | 'common'

export default function TenantUpload() {
  const { tenantId } = useParams()
  const navigate = useNavigate()
  const [file, setFile] = useState<File | null>(null)
  const [notes, setNotes] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [receiptType, setReceiptType] = useState<ReceiptType>('both')
  const [showDetails, setShowDetails] = useState(false)

  const { data, isLoading, error } = useQuery({
    queryKey: ['tenant-payment', tenantId],
    queryFn: async () => {
      const res = await tenantApi.get(`/api/payments/tenant/${tenantId}`)
      return res.data as { pending_payments: TenantPayment[]; history: TenantPayment[] }
    },
    enabled: !!tenantId,
    retry: false,
    staleTime: 0,
    refetchOnMount: true
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

  const pendingPayments = data?.pending_payments || []
  const oldestPending = pendingPayments[0] || null
  const currency = oldestPending?.property?.currency || 'EUR'
  const currencySymbol = CURRENCY_SYMBOL[currency] || '€'

  const grandTotal = pendingPayments.reduce(
    (sum, p) => sum + Number(p.amount_expected) + Number(p.common_expenses_expected || 0),
    0
  )
  const hasCommonExpenses = pendingPayments.some(p => Number(p.common_expenses_expected || 0) > 0)
  const showDetailsToggle = pendingPayments.length > 1 || hasCommonExpenses

  const isOverdue = oldestPending
    ? oldestPending.status === 'overdue' || (oldestPending.status === 'pending' && new Date(oldestPending.due_date) < new Date())
    : false

  const daysOverdue = oldestPending && isOverdue
    ? Math.floor((new Date().getTime() - new Date(oldestPending.due_date).getTime()) / (1000 * 60 * 60 * 24))
    : 0

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
    if (!oldestPending) {
      toast.error('No hay pagos pendientes')
      return
    }

    setIsSubmitting(true)
    try {
      const formData = new FormData()
      formData.append('receipt', file)
      formData.append('receipt_type', receiptType)
      if (notes) formData.append('notes', notes)

      await tenantApi.post(`/api/payments/${oldestPending.id}/receipt`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      })
      navigate('/pay/success')
    } catch {
      toast.error('Error al enviar el comprobante. Intenta de nuevo.')
      setIsSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen flex flex-col pt-8 md:pt-16 pb-12 px-5 md:items-center">
      <div className="w-full max-w-md">

        <div className="mb-8">
          <button onClick={() => navigate('/pay')} className="text-slate-400 hover:text-slate-900 transition-colors mb-4 inline-flex items-center text-sm font-medium">
             ← Volver
          </button>
          <h1 className="text-2xl font-bold tracking-tight mb-1">Subir Comprobante</h1>
          {oldestPending && (
            <p className="text-slate-500 text-sm">{oldestPending.property?.address}</p>
          )}
        </div>

        <div className="flex flex-col gap-5">
          <Card className="p-5 border-slate-100 shadow-sm rounded-2xl">
            <h3 className="text-xs uppercase tracking-wider font-semibold text-slate-400 mb-4">Detalle del Pago</h3>

            <div className="space-y-4">
              {oldestPending ? (
                <>
                  <div className={`p-4 rounded-2xl border ${isOverdue ? 'bg-red-50 border-red-200' : 'bg-indigo-50 border-indigo-100'}`}>
                    <div className="flex justify-between items-center mb-2">
                      <span className={`text-[10px] font-bold uppercase ${isOverdue ? 'text-red-600' : 'text-indigo-600'}`}>
                        Total a reportar
                      </span>
                      <span className={`text-[10px] ${isOverdue ? 'text-red-400' : 'text-indigo-400'}`}>
                        {pendingPayments.length > 1 ? `${pendingPayments.length} meses` : `${MONTHS[oldestPending.period_month]} ${oldestPending.period_year}`}
                      </span>
                    </div>
                    <div className={`text-2xl font-black underline decoration-4 ${isOverdue ? 'text-red-900 decoration-red-200' : 'text-indigo-900 decoration-indigo-200'}`}>
                      {currencySymbol}{grandTotal.toLocaleString('es-ES')}
                    </div>
                    {hasCommonExpenses && (
                      <div className={`mt-2 flex flex-col gap-0.5 text-[10px] ${isOverdue ? 'text-red-600' : 'text-indigo-600'}`}>
                        <div className="flex justify-between">
                          <span>Alquiler</span>
                          <span>{currencySymbol}{pendingPayments.reduce((s, p) => s + Number(p.amount_expected), 0).toLocaleString('es-ES')}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Gastos comunes</span>
                          <span>{currencySymbol}{pendingPayments.reduce((s, p) => s + Number(p.common_expenses_expected || 0), 0).toLocaleString('es-ES')}</span>
                        </div>
                      </div>
                    )}
                    <div className={`text-[10px] mt-2 ${isOverdue ? 'text-red-500' : 'text-indigo-500'}`}>
                      Vencimiento: {new Date(oldestPending.due_date).toLocaleDateString('es-ES', { day: '2-digit', month: 'short' })}
                    </div>

                    {isOverdue && (
                      <div className="flex items-center gap-1.5 mt-3">
                        <AlertCircle className="w-3 h-3 text-red-500" />
                        <span className="text-[10px] font-bold uppercase tracking-wider text-red-500">
                          Vencido hace {daysOverdue} {daysOverdue === 1 ? 'día' : 'días'}
                        </span>
                      </div>
                    )}
                    {!isOverdue && (
                      <div className="flex items-center gap-1.5 mt-3">
                        <div className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                        <span className="text-[10px] font-bold uppercase tracking-wider text-amber-500">Pendiente</span>
                      </div>
                    )}
                  </div>

                  {showDetailsToggle && (
                    <button
                      type="button"
                      onClick={() => setShowDetails(v => !v)}
                      className="w-full flex items-center justify-between text-xs font-semibold text-slate-500 hover:text-slate-800 transition-colors py-1"
                    >
                      <span>Ver desglose</span>
                      {showDetails ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    </button>
                  )}

                  {showDetails && (
                    <div className="overflow-hidden rounded-xl border border-slate-100">
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="bg-slate-50 text-slate-400 text-[10px] uppercase tracking-wider">
                            <th className="text-left p-2.5 font-semibold">Período</th>
                            <th className="text-right p-2.5 font-semibold">Alquiler</th>
                            {hasCommonExpenses && <th className="text-right p-2.5 font-semibold">Gastos comunes</th>}
                            <th className="text-right p-2.5 font-semibold">Total</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {pendingPayments.map(p => {
                            const rowTotal = Number(p.amount_expected) + Number(p.common_expenses_expected || 0)
                            return (
                              <tr key={p.id} className="bg-white">
                                <td className="p-2.5 text-slate-700 font-medium">{MONTHS[p.period_month]} {p.period_year}</td>
                                <td className="p-2.5 text-right text-slate-600">{currencySymbol}{Number(p.amount_expected).toLocaleString('es-ES')}</td>
                                {hasCommonExpenses && (
                                  <td className="p-2.5 text-right text-slate-500">{currencySymbol}{Number(p.common_expenses_expected || 0).toLocaleString('es-ES')}</td>
                                )}
                                <td className="p-2.5 text-right font-bold text-slate-800">{currencySymbol}{rowTotal.toLocaleString('es-ES')}</td>
                              </tr>
                            )
                          })}
                        </tbody>
                        <tfoot>
                          <tr className="bg-slate-50 border-t border-slate-200">
                            <td className="p-2.5 text-[10px] font-bold uppercase text-slate-400">Total</td>
                            <td className="p-2.5 text-right font-bold text-slate-700">
                              {currencySymbol}{pendingPayments.reduce((s, p) => s + Number(p.amount_expected), 0).toLocaleString('es-ES')}
                            </td>
                            {hasCommonExpenses && (
                              <td className="p-2.5 text-right font-bold text-slate-600">
                                {currencySymbol}{pendingPayments.reduce((s, p) => s + Number(p.common_expenses_expected || 0), 0).toLocaleString('es-ES')}
                              </td>
                            )}
                            <td className="p-2.5 text-right font-black text-indigo-700">
                              {currencySymbol}{grandTotal.toLocaleString('es-ES')}
                            </td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                  )}
                </>
              ) : (
                <div className="bg-emerald-50 text-emerald-700 p-4 rounded-xl border border-emerald-100 font-medium text-sm flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-emerald-500" />
                  Estás al día con tus pagos
                </div>
              )}
            </div>
          </Card>

          {oldestPending && (
            <>
              {/* Receipt type selector */}
              <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200">
                <h3 className="text-sm font-bold text-slate-800 mb-3">¿Qué cubre este comprobante?</h3>
                <div className="flex gap-2">
                  {([
                    { value: 'both', label: 'Alquiler + Gastos comunes' },
                    { value: 'rent', label: 'Solo alquiler' },
                    { value: 'common', label: 'Solo gastos' },
                  ] as { value: ReceiptType; label: string }[]).map(opt => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => setReceiptType(opt.value)}
                      className={`flex-1 py-2 px-2 rounded-xl text-[10px] font-bold border transition-colors ${
                        receiptType === opt.value
                          ? 'bg-indigo-600 text-white border-indigo-600'
                          : 'bg-white text-slate-500 border-slate-200 hover:border-slate-300'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* File upload */}
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
                disabled={!file || isSubmitting}
                onClick={handleSubmit}
                className="w-full bg-indigo-600 hover:bg-indigo-700 text-white py-4 rounded-2xl font-bold text-sm shadow-lg shadow-indigo-200 active:scale-95 transition-transform h-auto mt-2"
              >
                {isSubmitting ? 'Enviando...' : 'Enviar comprobante'}
              </Button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
