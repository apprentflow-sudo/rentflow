import React, { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { useAuth } from '@/src/contexts/AuthContext'
import { useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { toast } from 'sonner'
import { CheckCircle2, AlertCircle, Clock, FileText, Search, ChevronDown, ChevronUp, Mail, Phone, MapPin, UploadCloud, LogOut, UserPlus, Building2 } from 'lucide-react'

// ── Types ──────────────────────────────────────────────────────────────────

type PaymentStatus = 'pending' | 'paid' | 'overdue' | 'to_verify' | 'partial'

interface DashboardPayment {
  id: string
  tenant_id: string
  period_month: number
  period_year: number
  amount_expected: number
  amount_received: number | null
  status: PaymentStatus
  due_date: string
  paid_date: string | null
  receipt_url: string | null
  receipt_pdf_url: string | null
  payment_method: string | null
  verification_note: string | null
  verified_by: string | null
  receipt_data: {
    amount?: number
    currency?: string
    document_type?: string
    confidence_score?: number
    is_readable?: boolean
  } | null
  tenant: {
    id: string
    full_name: string
    email: string
    phone_whatsapp: string
    id_document: string
    lease_start: string
    lease_end: string | null
  }
  property: {
    id: string
    address: string
    city: string
    monthly_rent: number
    due_day: number
  }
}

interface DashboardData {
  current_month: string
  stats: {
    total_properties: number
    total_expected: number
    total_received: number
    paid_count: number
    pending_count: number
    overdue_count: number
    to_verify_count: number
    partial_count: number
  }
  payments: DashboardPayment[]
}

interface Property {
  id: string
  address: string
  city: string
  monthly_rent: number
  due_day: number
  currency: string
  active_tenants_count: number
}

interface TenantDetail {
  id: string
  full_name: string
  email: string
  phone_whatsapp: string
  id_document: string
  lease_start: string
  lease_end: string | null
  contract_url: string | null
  property: { address: string; city: string; monthly_rent: number }
  payment_history: Array<{
    id: string
    status: string
    amount_expected: number
    amount_received: number | null
    period_month: number
    period_year: number
    due_date: string
    paid_date: string | null
    payment_method: string | null
    receipt_pdf_url: string | null
  }>
  payment_stats: { on_time: number; late: number; total: number }
}

// ── Helpers ────────────────────────────────────────────────────────────────

const MONTHS: Record<number, string> = {
  1: 'Ene', 2: 'Feb', 3: 'Mar', 4: 'Abr', 5: 'May', 6: 'Jun',
  7: 'Jul', 8: 'Ago', 9: 'Sep', 10: 'Oct', 11: 'Nov', 12: 'Dic'
}

function effectiveStatus(payment: DashboardPayment): string {
  if (payment.status === 'pending' && new Date(payment.due_date) < new Date()) return 'overdue'
  return payment.status
}

function daysOverdue(dueDate: string): number {
  return Math.floor((new Date().getTime() - new Date(dueDate).getTime()) / (1000 * 60 * 60 * 24))
}

function getStatusBadge(status: string) {
  switch (status) {
    case 'paid':
      return <span className="px-2 py-1 bg-green-100 text-green-700 text-[10px] font-bold rounded-full uppercase tracking-wider">PAGADO</span>
    case 'to_verify':
      return <span className="px-2 py-1 bg-amber-100 text-amber-700 text-[10px] font-bold rounded-full uppercase tracking-wider">POR VERIFICAR</span>
    case 'pending':
      return <span className="px-2 py-1 bg-slate-100 text-slate-600 text-[10px] font-bold rounded-full uppercase tracking-wider">PENDIENTE</span>
    case 'overdue':
      return <span className="px-2 py-1 bg-red-100 text-red-700 text-[10px] font-bold rounded-full uppercase tracking-wider">VENCIDO</span>
    case 'partial':
      return <span className="px-2 py-1 bg-orange-100 text-orange-700 text-[10px] font-bold rounded-full uppercase tracking-wider">PARCIAL</span>
    default:
      return <span className="px-2 py-1 bg-slate-100 text-slate-700 text-[10px] font-bold rounded-full uppercase tracking-wider">{status}</span>
  }
}

// ── Expanded tenant row ────────────────────────────────────────────────────

function TenantDetail({ tenantId, historyMonths }: { tenantId: string; historyMonths: number }) {
  const allHistory = historyMonths === 0
  const { data, isLoading } = useQuery<TenantDetail>({
    queryKey: ['tenant', tenantId, allHistory ? 'all' : historyMonths],
    queryFn: async () => {
      const url = allHistory ? `/api/tenants/${tenantId}?history=all` : `/api/tenants/${tenantId}`
      const res = await api.get(url)
      return res.data
    },
    staleTime: 5 * 60_000
  })

  if (isLoading) {
    return <div className="py-6 text-center text-xs text-slate-500">Cargando historial...</div>
  }

  if (!data) return null

  const history = allHistory ? data.payment_history : data.payment_history.slice(0, historyMonths)

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      {/* Contact card */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
        <h4 className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-4 border-b border-slate-100 pb-2">Información del Inquilino</h4>
        <div className="space-y-3">
          <div className="flex items-center gap-3 text-sm text-slate-600">
            <Phone className="w-4 h-4 text-slate-400" />
            <span className="font-medium">{data.phone_whatsapp || '—'}</span>
          </div>
          <div className="flex items-center gap-3 text-sm text-slate-600">
            <Mail className="w-4 h-4 text-slate-400" />
            <span className="font-medium">{data.email || '—'}</span>
          </div>
          <div className="pt-3 mt-3 border-t border-slate-100">
            <div className="text-[10px] font-bold uppercase text-slate-400 mb-1">Período de alquiler</div>
            <p className="text-sm font-medium text-slate-800">
              {new Date(data.lease_start).toLocaleDateString('es-ES', { month: 'short', year: 'numeric' })}
              {data.lease_end ? ` — ${new Date(data.lease_end).toLocaleDateString('es-ES', { month: 'short', year: 'numeric' })}` : ' — Indefinido'}
            </p>
          </div>
          <div className="pt-2">
            {data.contract_url ? (
              <div className="flex items-center gap-2 text-sm text-indigo-600 font-medium p-2 bg-indigo-50 border border-indigo-100 rounded-lg cursor-pointer hover:bg-indigo-100 transition-colors">
                <FileText className="w-4 h-4" />
                Contrato_Alquiler.pdf
              </div>
            ) : (
              <label className="flex items-center justify-center gap-2 text-xs font-bold text-slate-500 p-3 border-2 border-dashed border-slate-200 rounded-xl cursor-pointer hover:bg-slate-50 transition-colors">
                <UploadCloud className="w-4 h-4" />
                Subir contrato PDF
                <input type="file" className="hidden" />
              </label>
            )}
          </div>
        </div>
      </div>

      {/* Property card */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
        <h4 className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-4 border-b border-slate-100 pb-2">Detalle de Propiedad</h4>
        <div className="flex items-start gap-3 text-sm text-slate-600">
          <MapPin className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
          <div>
            <p className="font-medium text-slate-800 mb-1">{data.property?.address}</p>
            <p>{data.property?.city}</p>
            <p className="text-sm font-bold text-indigo-600 mt-2">
              €{Number(data.property?.monthly_rent).toLocaleString('es-ES')} / mes
            </p>
          </div>
        </div>
        <div className="mt-4 pt-4 border-t border-slate-100 grid grid-cols-3 gap-2 text-center">
          <div>
            <p className="text-lg font-bold text-slate-800">{data.payment_stats.total}</p>
            <p className="text-[10px] text-slate-400 uppercase font-semibold">Total</p>
          </div>
          <div>
            <p className="text-lg font-bold text-green-600">{data.payment_stats.on_time}</p>
            <p className="text-[10px] text-slate-400 uppercase font-semibold">A tiempo</p>
          </div>
          <div>
            <p className="text-lg font-bold text-red-500">{data.payment_stats.late}</p>
            <p className="text-[10px] text-slate-400 uppercase font-semibold">Con retraso</p>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Main component ──────────────────────────────────────────────────────────

export default function LandlordDashboard() {
  const [search, setSearch] = useState('')
  const [selectedPayment, setSelectedPayment] = useState<DashboardPayment | null>(null)
  const [isReceiptOpen, setIsReceiptOpen] = useState(false)
  const [expandedTenantId, setExpandedTenantId] = useState<string | null>(null)
  const [historyMonths, setHistoryMonths] = useState(3)
  const [rejectNote, setRejectNote] = useState('')

  // ── Add tenant modal state ─────────────────────────────────────────────────
  const [isAddTenantOpen, setIsAddTenantOpen] = useState(false)
  const [propertyMode, setPropertyMode] = useState<'existing' | 'new'>('existing')
  const [selectedPropertyId, setSelectedPropertyId] = useState('')
  const [tenantForm, setTenantForm] = useState({
    full_name: '', id_document: '', email: '', phone_whatsapp: '', lease_start: '', lease_end: '', indefinite: false
  })
  const [newPropertyForm, setNewPropertyForm] = useState({
    address: '', city: '', door_number: '', postal_code: '', monthly_rent: '', common_expenses: '0', currency: 'EUR', due_day: '1'
  })
  const [existingRentOverride, setExistingRentOverride] = useState('')
  const [existingCommonOverride, setExistingCommonOverride] = useState('')
  const [existingCurrencyOverride, setExistingCurrencyOverride] = useState('')

  // Backfill modal state (shown after creating a tenant with a past lease_start)
  const [backfillTenantId, setBackfillTenantId] = useState<string | null>(null)
  const [backfillMonths, setBackfillMonths] = useState<Array<{
    period_month: number; period_year: number; label: string
    status: 'paid' | 'pending' | 'overdue'; paid_date: string; receipt_file: File | null
  }>>([])
  const [isBackfillOpen, setIsBackfillOpen] = useState(false)
  const [backfillLoading, setBackfillLoading] = useState(false)

  const { signOutOwner } = useAuth()
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  // ── Data ─────────────────────────────────────────────────────────────────

  const { data, isLoading, error } = useQuery<DashboardData>({
    queryKey: ['dashboard'],
    queryFn: async () => {
      const res = await api.get('/api/payments/dashboard')
      return res.data
    },
    refetchInterval: 30_000
  })

  const verifyMutation = useMutation({
    mutationFn: async ({ paymentId, action, note }: { paymentId: string; action: 'approve' | 'reject'; note?: string }) => {
      const res = await api.patch(`/api/payments/${paymentId}/verify`, { action, note })
      return res.data
    },
    onSuccess: (_data, vars) => {
      queryClient.invalidateQueries({ queryKey: ['dashboard'] })
      if (vars.action === 'approve') {
        toast.success('Pago aprobado. Se generará el recibo en breve.')
      } else {
        toast.error('Comprobante rechazado. Marcado como pendiente.')
      }
      setIsReceiptOpen(false)
      setSelectedPayment(null)
      setRejectNote('')
    },
    onError: () => {
      toast.error('Error al procesar la verificación')
    }
  })

  const { data: propertiesList = [] } = useQuery<Property[]>({
    queryKey: ['properties'],
    queryFn: async () => {
      const res = await api.get('/api/properties')
      return res.data
    },
    enabled: isAddTenantOpen,
    staleTime: 60_000
  })

  const resetAddTenantForm = () => {
    setTenantForm({ full_name: '', id_document: '', email: '', phone_whatsapp: '', lease_start: '', lease_end: '', indefinite: false })
    setNewPropertyForm({ address: '', city: '', door_number: '', postal_code: '', monthly_rent: '', common_expenses: '0', currency: 'EUR', due_day: '1' })
    setExistingRentOverride('')
    setExistingCommonOverride('')
    setExistingCurrencyOverride('')
    setPropertyMode('existing')
    setSelectedPropertyId('')
  }

  const addTenantMutation = useMutation({
    mutationFn: async () => {
      let propertyId = selectedPropertyId

      if (propertyMode === 'new') {
        if (!newPropertyForm.address.trim() || !newPropertyForm.city.trim() || !newPropertyForm.monthly_rent || !newPropertyForm.door_number.trim()) {
          throw new Error('Dirección, ciudad, número de puerta y alquiler mensual son obligatorios')
        }
        const propRes = await api.post('/api/properties', {
          address: newPropertyForm.address.trim(),
          city: newPropertyForm.city.trim(),
          door_number: newPropertyForm.door_number.trim(),
          postal_code: newPropertyForm.postal_code.trim() || undefined,
          monthly_rent: Number(newPropertyForm.monthly_rent),
          common_expenses: Number(newPropertyForm.common_expenses) || 0,
          currency: newPropertyForm.currency,
          due_day: Number(newPropertyForm.due_day) || 1,
        })
        propertyId = propRes.data.id
      }

      if (!propertyId) throw new Error('Selecciona o crea una propiedad')

      const res = await api.post('/api/tenants', {
        full_name: tenantForm.full_name.trim(),
        id_document: tenantForm.id_document.trim(),
        email: tenantForm.email.trim() || undefined,
        phone_whatsapp: tenantForm.phone_whatsapp.trim() || undefined,
        lease_start: tenantForm.lease_start,
        lease_end: tenantForm.indefinite ? undefined : (tenantForm.lease_end || undefined),
        property_id: propertyId,
        rent_override: existingRentOverride ? Number(existingRentOverride) : undefined,
        common_expenses_override: existingCommonOverride ? Number(existingCommonOverride) : undefined,
        currency_override: existingCurrencyOverride || undefined,
      })
      return { tenantId: res.data.id, leaseStart: tenantForm.lease_start }
    },
    onSuccess: ({ tenantId, leaseStart }) => {
      queryClient.invalidateQueries({ queryKey: ['dashboard'] })
      queryClient.invalidateQueries({ queryKey: ['properties'] })
      setIsAddTenantOpen(false)
      resetAddTenantForm()

      // Check if contract started in a past month → offer backfill
      const start = new Date(leaseStart)
      const now = new Date()
      const firstOfThisMonth = new Date(now.getFullYear(), now.getMonth(), 1)
      if (start < firstOfThisMonth) {
        const months: typeof backfillMonths = []
        const cursor = new Date(start.getFullYear(), start.getMonth(), 1)
        while (cursor < firstOfThisMonth) {
          months.push({
            period_month: cursor.getMonth() + 1,
            period_year: cursor.getFullYear(),
            label: cursor.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' }),
            status: 'pending',
            paid_date: '',
            receipt_file: null,
          })
          cursor.setMonth(cursor.getMonth() + 1)
        }
        setBackfillTenantId(tenantId)
        setBackfillMonths(months)
        setIsBackfillOpen(true)
      } else {
        toast.success('Inquilino añadido. El pago de este mes se ha generado automáticamente.')
      }
    },
    onError: (err: unknown) => {
      const msg = (err as { response?: { data?: { error?: string } }; message?: string })?.response?.data?.error
        || (err as { message?: string })?.message
        || 'Error al crear el inquilino'
      toast.error(msg)
    }
  })

  const handleBackfillSubmit = async () => {
    if (!backfillTenantId) return
    setBackfillLoading(true)
    try {
      // Upload any receipt files first
      const monthsWithUrls = await Promise.all(backfillMonths.map(async (m) => {
        if (m.receipt_file && m.status === 'paid') {
          const formData = new FormData()
          formData.append('receipt', m.receipt_file)
          // Upload to comprobantes bucket via payment receipt endpoint — use a placeholder payment id for now
          // We send the file directly and get back a URL
          try {
            const uploadRes = await api.post(`/api/tenants/${backfillTenantId}/backfill-receipt`, formData, {
              headers: { 'Content-Type': 'multipart/form-data' }
            })
            return { ...m, receipt_url: uploadRes.data.url }
          } catch {
            return { ...m, receipt_url: undefined }
          }
        }
        return { ...m, receipt_url: undefined }
      }))

      await api.post(`/api/tenants/${backfillTenantId}/backfill`, {
        months: monthsWithUrls.map(m => ({
          period_month: m.period_month,
          period_year: m.period_year,
          status: m.status,
          paid_date: m.paid_date || undefined,
          receipt_url: m.receipt_url,
        }))
      })

      queryClient.invalidateQueries({ queryKey: ['dashboard'] })
      queryClient.invalidateQueries({ queryKey: ['tenant', backfillTenantId], exact: false })
      toast.success('Inquilino añadido con historial registrado.')
    } catch {
      toast.error('Error al registrar meses anteriores. Puedes intentarlo más tarde.')
    } finally {
      setBackfillLoading(false)
      setIsBackfillOpen(false)
      setBackfillTenantId(null)
      setBackfillMonths([])
    }
  }

  // ── Computed ──────────────────────────────────────────────────────────────

  const payments = data?.payments ?? []
  const stats = data?.stats

  const todayStr = new Date().toISOString().split('T')[0]
  const effectiveOverdueCount = payments.filter(
    p => p.status === 'overdue' || (p.status === 'pending' && p.due_date < todayStr)
  ).length
  const effectivePendingCount = payments.filter(
    p => p.status === 'pending' && p.due_date >= todayStr
  ).length

  // Always derive from live query so modal shows fresh AI data after refetch
  const selectedPaymentLive = selectedPayment
    ? (payments.find(p => p.id === selectedPayment.id) ?? selectedPayment)
    : null

  const filteredPayments = payments.filter(p =>
    p.tenant.full_name.toLowerCase().includes(search.toLowerCase()) ||
    p.property.address.toLowerCase().includes(search.toLowerCase())
  )

  // ── Handlers ──────────────────────────────────────────────────────────────

  const handleApprove = () => {
    if (!selectedPayment) return
    verifyMutation.mutate({ paymentId: selectedPayment.id, action: 'approve' })
  }

  const handleReject = () => {
    if (!selectedPayment) return
    verifyMutation.mutate({ paymentId: selectedPayment.id, action: 'reject', note: rejectNote })
  }

  const handleSignOut = async () => {
    await signOutOwner()
    navigate('/admin')
  }

  // ── Render ────────────────────────────────────────────────────────────────

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#f7f8f9]">
        <div className="w-8 h-8 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#f7f8f9] p-6 text-center">
        <div>
          <p className="text-slate-600 mb-4">Error cargando el dashboard</p>
          <Button onClick={() => queryClient.invalidateQueries({ queryKey: ['dashboard'] })}>Reintentar</Button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#f7f8f9]">
      <header className="h-16 border-b border-slate-200 bg-white flex items-center justify-between px-8 sticky top-0 z-10">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center">
            <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 14v20l4-2 4 2V14M4 6h16a2 2 0 012 2v12a2 2 0 01-2 2H4a2 2 0 01-2-2V8a2 2 0 012-2z"></path></svg>
          </div>
          <span className="text-xl font-bold tracking-tight text-slate-800">RentFlow</span>
        </div>
        <div className="flex items-center gap-4">
          <div className="hidden md:flex gap-6 text-sm font-medium text-slate-500">
            <a href="#" className="text-indigo-600 border-b-2 border-indigo-600 h-16 inline-flex items-center">Dashboard</a>
          </div>
          <button
            onClick={handleSignOut}
            className="flex items-center gap-2 text-sm text-slate-500 hover:text-slate-800 transition-colors"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 md:px-6 py-8">

        <div className="mb-8 flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 mb-1">Visión General</h1>
            <p className="text-sm text-slate-500">Estado de tus cobros — {data?.current_month}</p>
          </div>
          <Button
            onClick={() => setIsAddTenantOpen(true)}
            className="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-sm rounded-xl shadow-md shadow-indigo-100 flex items-center gap-2 h-10 px-5"
          >
            <UserPlus className="w-4 h-4" />
            Añadir inquilino
          </Button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-1">Propiedades</p>
            <p className="text-2xl font-bold text-slate-900">{stats?.total_properties ?? 0}</p>
          </div>

          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
            <p className="text-xs font-semibold text-emerald-600 uppercase tracking-widest mb-1">Cobrado</p>
            <p className="text-2xl font-bold text-slate-900">€{(stats?.total_received ?? 0).toLocaleString('es-ES')}</p>
            <p className="text-[10px] text-emerald-500 font-medium tracking-wide">{stats?.paid_count ?? 0} inquilinos al día</p>
          </div>

          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
            <p className="text-xs font-semibold text-amber-500 uppercase tracking-widest mb-1">Por verificar</p>
            <p className="text-2xl font-bold text-slate-900">{stats?.to_verify_count ?? 0}</p>
            <p className="text-[10px] text-amber-500 font-medium tracking-wide">{effectivePendingCount} pendientes</p>
          </div>

          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
            <p className="text-xs font-semibold text-red-500 uppercase tracking-widest mb-1">Vencido</p>
            <p className="text-2xl font-bold text-slate-900">{effectiveOverdueCount}</p>
            <p className="text-[10px] text-red-500 font-medium tracking-wide">Revisión urgente</p>
          </div>
        </div>

        {/* Table */}
        <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden flex flex-col">
          <div className="p-4 border-b border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-50/50">
            <div className="relative max-w-sm w-full">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <Input
                placeholder="Buscar inquilino o dirección..."
                className="pl-9 h-9 w-full bg-white border-slate-200 rounded-lg text-sm"
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
            </div>
          </div>

          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="border-slate-100 hover:bg-transparent">
                  <TableHead className="text-[10px] uppercase text-slate-400 font-bold px-6 py-3 h-auto">Inquilino / Propiedad</TableHead>
                  <TableHead className="text-[10px] uppercase text-slate-400 font-bold py-3 h-auto">Monto / Período</TableHead>
                  <TableHead className="text-[10px] uppercase text-slate-400 font-bold py-3 h-auto">Vencimiento</TableHead>
                  <TableHead className="text-[10px] uppercase text-slate-400 font-bold py-3 h-auto">Estado</TableHead>
                  <TableHead className="text-[10px] uppercase text-slate-400 font-bold text-right px-6 py-3 h-auto">Acción</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredPayments.map(payment => {
                  const isExpanded = expandedTenantId === payment.tenant.id
                  const period = `${MONTHS[payment.period_month]} ${payment.period_year}`

                  return (
                    <React.Fragment key={payment.id}>
                      <TableRow
                        className={`border-slate-50 cursor-pointer ${isExpanded ? 'bg-indigo-50/50 hover:bg-indigo-50/80' : 'hover:bg-slate-50/50'} transition-colors`}
                        onClick={() => setExpandedTenantId(isExpanded ? null : payment.tenant.id)}
                      >
                        <TableCell className="px-6 py-4 flex items-center gap-3">
                          <div className={`p-1.5 rounded-md ${isExpanded ? 'bg-indigo-100 text-indigo-600' : 'bg-slate-100 text-slate-400'}`}>
                            {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                          </div>
                          <div>
                            <div className="font-semibold text-sm">{payment.tenant.full_name}</div>
                            <div className="text-xs text-slate-500">{payment.property.address}</div>
                          </div>
                        </TableCell>
                        <TableCell className="py-4">
                          <div className="font-semibold text-sm">€{Number(payment.amount_expected).toLocaleString('es-ES')}</div>
                          <div className="text-xs text-slate-500">{period}</div>
                        </TableCell>
                        <TableCell className="py-4 text-sm text-slate-500 font-medium">
                          {payment.due_date
                            ? new Date(payment.due_date).toLocaleDateString('es-ES', { day: '2-digit', month: 'short' })
                            : '—'}
                        </TableCell>
                        <TableCell className="py-4">
                          {getStatusBadge(effectiveStatus(payment))}
                          {payment.receipt_url && payment.status === 'to_verify' && (
                            <div className="text-[10px] text-slate-500 mt-1 flex items-center gap-1 font-medium">
                              <FileText className="w-3 h-3" /> Comprobante recibido
                            </div>
                          )}
                          {effectiveStatus(payment) === 'overdue' && payment.status === 'pending' && (
                            <div className="text-[10px] text-red-500 mt-1 font-bold">
                              {daysOverdue(payment.due_date)} {daysOverdue(payment.due_date) === 1 ? 'día' : 'días'} de retraso
                            </div>
                          )}
                        </TableCell>
                        <TableCell className="px-6 py-4 text-right">
                          {effectiveStatus(payment) === 'to_verify' ? (
                            <Button
                              variant="default"
                              size="sm"
                              className="text-white bg-indigo-600 hover:bg-indigo-700 font-medium text-xs"
                              onClick={e => {
                                e.stopPropagation()
                                setSelectedPayment(payment)
                                setIsReceiptOpen(true)
                              }}
                            >
                              Revisar
                            </Button>
                          ) : (
                            <Button
                              variant="outline"
                              size="sm"
                              className="text-indigo-600 font-medium text-xs hover:text-indigo-700 bg-white border-slate-200"
                              onClick={e => {
                                e.stopPropagation()
                                setExpandedTenantId(isExpanded ? null : payment.tenant.id)
                              }}
                            >
                              {isExpanded ? 'Ver Menos' : 'Ver Detalle'}
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>

                      {isExpanded && (
                        <TableRow>
                          <TableCell colSpan={5} className="p-0 border-b border-slate-100">
                            <div className="bg-slate-50 px-8 py-6 flex flex-col gap-6 shadow-inner">
                              <TenantDetail tenantId={payment.tenant.id} historyMonths={historyMonths} />

                              {/* Payment history */}
                              <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
                                <div className="flex items-center justify-between mb-4 border-b border-slate-100 pb-2">
                                  <h4 className="text-xs font-bold uppercase tracking-widest text-slate-400">Historial de Pagos</h4>
                                  <select
                                    className="text-xs font-bold text-slate-600 bg-slate-50 border border-slate-200 rounded-lg px-2 py-1 outline-none"
                                    value={historyMonths}
                                    onChange={e => setHistoryMonths(Number(e.target.value))}
                                  >
                                    <option value={3}>Últimos 3 meses</option>
                                    <option value={6}>Últimos 6 meses</option>
                                    <option value={12}>Últimos 12 meses</option>
                                    <option value={0}>Contrato entero</option>
                                  </select>
                                </div>

                                <HistoryList tenantId={payment.tenant.id} historyMonths={historyMonths} />
                              </div>
                            </div>
                          </TableCell>
                        </TableRow>
                      )}
                    </React.Fragment>
                  )
                })}

                {filteredPayments.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-12 text-slate-500">
                      {payments.length === 0 ? 'No hay pagos este mes. Añade un inquilino para empezar.' : 'No se encontraron resultados.'}
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </div>
      </main>

      {/* Add tenant modal */}
      <Dialog open={isAddTenantOpen} onOpenChange={open => { setIsAddTenantOpen(open); if (!open) resetAddTenantForm() }}>
        <DialogContent className="max-w-lg w-full p-0 overflow-hidden rounded-2xl gap-0 border-slate-200 shadow-2xl">
          <DialogHeader className="p-6 pb-4 border-b border-slate-100 bg-white">
            <DialogTitle className="text-xl font-bold text-slate-800">Añadir Inquilino</DialogTitle>
            <DialogDescription className="text-xs text-slate-500 mt-1">
              El inquilino podrá acceder al portal usando su número de identificación.
            </DialogDescription>
          </DialogHeader>

          <div className="p-6 bg-slate-50 space-y-6 max-h-[70vh] overflow-y-auto">

            {/* Tenant fields */}
            <div>
              <h3 className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-3">Datos del Inquilino</h3>
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2">
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Nombre completo *</label>
                  <Input
                    value={tenantForm.full_name}
                    onChange={e => setTenantForm(f => ({ ...f, full_name: e.target.value }))}
                    placeholder="Ana García López"
                    className="bg-white border-slate-200 rounded-lg text-sm h-9"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Número de identificación *</label>
                  <Input
                    value={tenantForm.id_document}
                    onChange={e => setTenantForm(f => ({ ...f, id_document: e.target.value }))}
                    placeholder="12345678A"
                    className="bg-white border-slate-200 rounded-lg text-sm h-9"
                  />
                  <p className="text-[10px] text-slate-400 mt-1">El inquilino usará este número para acceder al portal de pagos.</p>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Teléfono (WhatsApp)</label>
                  <Input
                    value={tenantForm.phone_whatsapp}
                    onChange={e => setTenantForm(f => ({ ...f, phone_whatsapp: e.target.value }))}
                    placeholder="+34 600 000 000"
                    className="bg-white border-slate-200 rounded-lg text-sm h-9"
                  />
                </div>
                <div className="col-span-2">
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Email</label>
                  <Input
                    type="email"
                    value={tenantForm.email}
                    onChange={e => setTenantForm(f => ({ ...f, email: e.target.value }))}
                    placeholder="ana@email.com"
                    className="bg-white border-slate-200 rounded-lg text-sm h-9"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Inicio de contrato *</label>
                  <Input
                    type="date"
                    value={tenantForm.lease_start}
                    onChange={e => setTenantForm(f => ({ ...f, lease_start: e.target.value }))}
                    className="bg-white border-slate-200 rounded-lg text-sm h-9"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Fin de contrato</label>
                  <Input
                    type="date"
                    value={tenantForm.lease_end}
                    onChange={e => setTenantForm(f => ({ ...f, lease_end: e.target.value }))}
                    disabled={tenantForm.indefinite}
                    className="bg-white border-slate-200 rounded-lg text-sm h-9 disabled:opacity-40"
                  />
                </div>
                <div className="col-span-2 flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="indefinite"
                    checked={tenantForm.indefinite}
                    onChange={e => setTenantForm(f => ({ ...f, indefinite: e.target.checked, lease_end: e.target.checked ? '' : f.lease_end }))}
                    className="w-4 h-4 accent-indigo-600"
                  />
                  <label htmlFor="indefinite" className="text-xs font-semibold text-slate-600 cursor-pointer">Contrato indefinido</label>
                </div>
              </div>
            </div>

            {/* Property section */}
            <div>
              <h3 className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-3">Propiedad</h3>

              {/* Mode toggle */}
              <div className="flex gap-2 mb-4">
                <button
                  type="button"
                  onClick={() => setPropertyMode('existing')}
                  className={`flex-1 py-2 px-3 rounded-lg text-xs font-bold border transition-colors ${
                    propertyMode === 'existing'
                      ? 'bg-indigo-600 text-white border-indigo-600'
                      : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300'
                  }`}
                >
                  Propiedad existente
                </button>
                <button
                  type="button"
                  onClick={() => setPropertyMode('new')}
                  className={`flex-1 py-2 px-3 rounded-lg text-xs font-bold border transition-colors ${
                    propertyMode === 'new'
                      ? 'bg-indigo-600 text-white border-indigo-600'
                      : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300'
                  }`}
                >
                  Nueva propiedad
                </button>
              </div>

              {propertyMode === 'existing' ? (
                propertiesList.length === 0 ? (
                  <div className="p-4 text-center text-xs text-slate-500 bg-white rounded-xl border border-dashed border-slate-200">
                    No tienes propiedades todavía. Crea una nueva.
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div className="space-y-2">
                      {propertiesList.map(p => (
                        <button
                          key={p.id}
                          type="button"
                          onClick={() => {
                            setSelectedPropertyId(p.id)
                            setExistingRentOverride(String(p.monthly_rent))
                            setExistingCommonOverride('0')
                            setExistingCurrencyOverride('')
                          }}
                          className={`w-full flex items-center justify-between p-3 rounded-xl border text-left transition-colors ${
                            selectedPropertyId === p.id
                              ? 'border-indigo-400 bg-indigo-50 ring-1 ring-indigo-300'
                              : 'border-slate-200 bg-white hover:border-slate-300'
                          }`}
                        >
                          <div className="flex items-center gap-3">
                            <Building2 className={`w-4 h-4 ${selectedPropertyId === p.id ? 'text-indigo-600' : 'text-slate-400'}`} />
                            <div>
                              <p className="text-sm font-semibold text-slate-800">{p.address}</p>
                              <p className="text-xs text-slate-500">{p.city}</p>
                            </div>
                          </div>
                          <div className="text-right shrink-0">
                            <p className="text-sm font-bold text-indigo-700">€{Number(p.monthly_rent).toLocaleString('es-ES')}</p>
                            <p className="text-[10px] text-slate-400">Día {p.due_day}</p>
                          </div>
                        </button>
                      ))}
                    </div>
                    {selectedPropertyId && (
                      <div className="bg-white rounded-xl border border-slate-200 p-3 space-y-3">
                        <p className="text-[10px] font-bold uppercase text-slate-400">Ajustar para este inquilino</p>
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label className="block text-xs font-semibold text-slate-600 mb-1">Renta mensual</label>
                            <Input
                              type="number"
                              value={existingRentOverride}
                              onChange={e => setExistingRentOverride(e.target.value)}
                              className="bg-slate-50 border-slate-200 rounded-lg text-sm h-9"
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-semibold text-slate-600 mb-1">Gastos comunes</label>
                            <Input
                              type="number"
                              value={existingCommonOverride}
                              onChange={e => setExistingCommonOverride(e.target.value)}
                              placeholder="0"
                              className="bg-slate-50 border-slate-200 rounded-lg text-sm h-9"
                            />
                          </div>
                          <div className="col-span-2">
                            <label className="block text-xs font-semibold text-slate-600 mb-1">Moneda de pago</label>
                            <select
                              value={existingCurrencyOverride}
                              onChange={e => setExistingCurrencyOverride(e.target.value)}
                              className="w-full bg-slate-50 border border-slate-200 rounded-lg text-sm h-9 px-2 outline-none focus:ring-1 focus:ring-indigo-400"
                            >
                              <option value="">Misma que la propiedad ({propertiesList.find(p => p.id === selectedPropertyId)?.currency || 'EUR'})</option>
                              <option value="EUR">EUR €</option>
                              <option value="USD">USD $</option>
                              <option value="UYU">UYU $U</option>
                              <option value="PYG">PYG ₲</option>
                              <option value="GBP">GBP £</option>
                            </select>
                          </div>
                        </div>
                        <p className="text-[10px] text-slate-400">Solo afecta a este inquilino. La propiedad no se modifica.</p>
                      </div>
                    )}
                  </div>
                )
              ) : (
                <div className="grid grid-cols-2 gap-3">
                  <div className="col-span-2">
                    <label className="block text-xs font-semibold text-slate-600 mb-1">Dirección *</label>
                    <Input
                      value={newPropertyForm.address}
                      onChange={e => setNewPropertyForm(f => ({ ...f, address: e.target.value }))}
                      placeholder="Calle Mayor 12"
                      className="bg-white border-slate-200 rounded-lg text-sm h-9"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1">Número de puerta *</label>
                    <Input
                      value={newPropertyForm.door_number}
                      onChange={e => setNewPropertyForm(f => ({ ...f, door_number: e.target.value }))}
                      placeholder="3ºB, Puerta 5"
                      className="bg-white border-slate-200 rounded-lg text-sm h-9"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1">Ciudad *</label>
                    <Input
                      value={newPropertyForm.city}
                      onChange={e => setNewPropertyForm(f => ({ ...f, city: e.target.value }))}
                      placeholder="Madrid"
                      className="bg-white border-slate-200 rounded-lg text-sm h-9"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1">Código postal</label>
                    <Input
                      value={newPropertyForm.postal_code}
                      onChange={e => setNewPropertyForm(f => ({ ...f, postal_code: e.target.value }))}
                      placeholder="28001"
                      className="bg-white border-slate-200 rounded-lg text-sm h-9"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1">Moneda</label>
                    <select
                      value={newPropertyForm.currency}
                      onChange={e => setNewPropertyForm(f => ({ ...f, currency: e.target.value }))}
                      className="w-full bg-white border border-slate-200 rounded-lg text-sm h-9 px-2 outline-none focus:ring-1 focus:ring-indigo-400"
                    >
                      <option value="EUR">EUR €</option>
                      <option value="USD">USD $</option>
                      <option value="UYU">UYU $U</option>
                      <option value="PYG">PYG ₲</option>
                      <option value="GBP">GBP £</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1">Alquiler mensual *</label>
                    <Input
                      type="number"
                      value={newPropertyForm.monthly_rent}
                      onChange={e => setNewPropertyForm(f => ({ ...f, monthly_rent: e.target.value }))}
                      placeholder="1200"
                      min="1"
                      className="bg-white border-slate-200 rounded-lg text-sm h-9"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1">Gastos comunes</label>
                    <Input
                      type="number"
                      value={newPropertyForm.common_expenses}
                      onChange={e => setNewPropertyForm(f => ({ ...f, common_expenses: e.target.value }))}
                      placeholder="0"
                      min="0"
                      className="bg-white border-slate-200 rounded-lg text-sm h-9"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1">Día de vencimiento</label>
                    <Input
                      type="number"
                      value={newPropertyForm.due_day}
                      onChange={e => setNewPropertyForm(f => ({ ...f, due_day: e.target.value }))}
                      placeholder="1"
                      min="1"
                      max="28"
                      className="bg-white border-slate-200 rounded-lg text-sm h-9"
                    />
                  </div>
                </div>
              )}
            </div>
          </div>

          <DialogFooter className="p-6 pt-4 bg-white border-t border-slate-100 flex gap-3 sm:justify-end items-center">
            <Button
              variant="outline"
              onClick={() => { setIsAddTenantOpen(false); resetAddTenantForm() }}
              className="rounded-xl font-bold text-xs h-auto py-2 px-4 border-slate-200 text-slate-600"
            >
              Cancelar
            </Button>
            <Button
              onClick={() => addTenantMutation.mutate()}
              disabled={
                addTenantMutation.isPending ||
                !tenantForm.full_name.trim() ||
                !tenantForm.id_document.trim() ||
                !tenantForm.lease_start ||
                (propertyMode === 'existing' && !selectedPropertyId) ||
                (propertyMode === 'new' && (!newPropertyForm.address.trim() || !newPropertyForm.city.trim() || !newPropertyForm.monthly_rent || !newPropertyForm.door_number.trim()))
              }
              className="bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold text-xs shadow-md shadow-indigo-200 h-auto py-2 px-6 disabled:opacity-50"
            >
              {addTenantMutation.isPending ? 'Guardando...' : 'Añadir inquilino'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Verify modal */}
      <Dialog open={isReceiptOpen} onOpenChange={open => { setIsReceiptOpen(open); if (!open) { setSelectedPayment(null); setRejectNote('') } }}>
        <DialogContent className="max-w-md w-full p-0 overflow-hidden rounded-2xl gap-0 border-slate-200 shadow-2xl">
          <DialogHeader className="p-6 pb-4 border-b border-slate-100 bg-white">
            <DialogTitle className="text-xl font-bold text-slate-800">Revisar Pago</DialogTitle>
            <DialogDescription className="text-xs text-slate-500 mt-1">
              Verifica el comprobante enviado por el inquilino.
            </DialogDescription>
          </DialogHeader>

          <div className="p-6 bg-slate-50">
            {selectedPaymentLive && (
              <div className="space-y-4">
                <div className="flex justify-between items-start bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
                  <div>
                    <p className="text-[10px] text-slate-400 uppercase tracking-widest font-bold mb-1">Inquilino</p>
                    <p className="font-bold text-sm text-slate-800">{selectedPaymentLive.tenant.full_name}</p>
                    <p className="text-[10px] text-slate-500 mt-0.5">{selectedPaymentLive.property.address}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-[10px] text-slate-400 uppercase tracking-widest font-bold mb-1">Monto esperado</p>
                    <p className="font-black text-lg text-indigo-900 border-b-2 border-indigo-200">€{Number(selectedPaymentLive.amount_expected).toLocaleString('es-ES')}</p>
                  </div>
                </div>

                <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm space-y-3">
                  <p className="text-[10px] text-slate-400 uppercase tracking-widest font-bold">Comprobante recibido</p>
                  <div className="flex items-center gap-2 text-sm text-slate-700">
                    <FileText className="w-4 h-4 text-indigo-500" />
                    <span className="font-medium">Archivo recibido</span>
                    <span className="text-[10px] text-slate-400 ml-auto">
                      {MONTHS[selectedPaymentLive.period_month]} {selectedPaymentLive.period_year}
                    </span>
                  </div>

                  {/* AI extraction results */}
                  <div className="mt-2 pt-3 border-t border-slate-100 space-y-2">
                    <p className="text-[10px] text-slate-400 uppercase tracking-widest font-bold">Lectura del agente IA</p>
                    {selectedPaymentLive.receipt_data ? (
                      <>
                        <div className="grid grid-cols-2 gap-2">
                          <div className="bg-slate-50 rounded-lg p-2">
                            <p className="text-[10px] text-slate-400 uppercase font-bold mb-0.5">Monto detectado</p>
                            <p className="text-sm font-bold text-slate-800">
                              {selectedPaymentLive.receipt_data.currency || '?'} {selectedPaymentLive.receipt_data.amount?.toLocaleString('es-ES') ?? '—'}
                            </p>
                          </div>
                          <div className="bg-slate-50 rounded-lg p-2">
                            <p className="text-[10px] text-slate-400 uppercase font-bold mb-0.5">Confianza</p>
                            <p className="text-sm font-bold text-slate-800">{selectedPaymentLive.receipt_data.confidence_score ?? '—'}%</p>
                          </div>
                        </div>
                        {selectedPaymentLive.verification_note && (
                          <div className="bg-amber-50 border border-amber-100 rounded-lg p-2.5 flex gap-2">
                            <AlertCircle className="w-3.5 h-3.5 text-amber-500 shrink-0 mt-0.5" />
                            <p className="text-[11px] text-amber-700 font-medium leading-relaxed">{selectedPaymentLive.verification_note}</p>
                          </div>
                        )}
                      </>
                    ) : (
                      <div className="flex items-center gap-2 text-xs text-slate-400 py-1">
                        <div className="w-3 h-3 border border-slate-300 border-t-indigo-500 rounded-full animate-spin" />
                        Verificando comprobante...
                      </div>
                    )}
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-2">Nota (opcional, visible al rechazar)</label>
                  <textarea
                    value={rejectNote}
                    onChange={e => setRejectNote(e.target.value)}
                    className="w-full text-sm p-3 border border-slate-200 bg-white rounded-xl resize-none h-16 outline-none focus:border-indigo-300 transition-colors"
                    placeholder="Ej: El monto no coincide con el alquiler"
                  />
                </div>
              </div>
            )}
          </div>

          <DialogFooter className="p-6 pt-4 bg-white border-t border-slate-100 flex gap-3 sm:justify-between items-center">
            <Button
              variant="ghost"
              onClick={handleReject}
              disabled={verifyMutation.isPending}
              className="text-red-600 hover:text-red-700 hover:bg-red-50 text-xs font-bold rounded-xl px-4 py-2 h-auto"
            >
              Rechazar
            </Button>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setIsReceiptOpen(false)} className="rounded-xl font-bold text-xs h-auto py-2 px-4 border-slate-200 text-slate-600">
                Cancelar
              </Button>
              <Button
                onClick={handleApprove}
                disabled={verifyMutation.isPending}
                className="bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold text-xs shadow-md shadow-indigo-200 h-auto py-2 px-6"
              >
                {verifyMutation.isPending ? 'Procesando...' : 'Aprobar Pago'}
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Backfill modal — shown after creating a tenant with a past lease_start */}
      <Dialog open={isBackfillOpen} onOpenChange={open => { if (!open) { setIsBackfillOpen(false); toast.success('Inquilino añadido correctamente.') } }}>
        <DialogContent className="max-w-lg w-full p-0 overflow-hidden rounded-2xl gap-0 border-slate-200 shadow-2xl">
          <DialogHeader className="p-6 pb-4 border-b border-slate-100 bg-white">
            <DialogTitle className="text-xl font-bold text-slate-800">¿Qué pasó con los meses anteriores?</DialogTitle>
            <DialogDescription className="text-xs text-slate-500 mt-1">
              El contrato comienza antes de este mes. Puedes registrar el estado de cada período o simplemente omitirlo.
            </DialogDescription>
          </DialogHeader>
          <div className="p-6 bg-slate-50 space-y-3 max-h-[60vh] overflow-y-auto">
            {backfillMonths.map((m, i) => (
              <div key={`${m.period_year}-${m.period_month}`} className="bg-white rounded-xl border border-slate-200 p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-bold text-slate-800 capitalize">{m.label}</p>
                  <div className="flex gap-1">
                    {(['paid', 'pending', 'overdue'] as const).map(s => (
                      <button
                        key={s}
                        type="button"
                        onClick={() => setBackfillMonths(prev => prev.map((x, j) => j === i ? { ...x, status: s } : x))}
                        className={`px-2 py-1 rounded-lg text-[10px] font-bold uppercase transition-colors ${
                          m.status === s
                            ? s === 'paid' ? 'bg-green-100 text-green-700' : s === 'overdue' ? 'bg-red-100 text-red-700' : 'bg-slate-200 text-slate-700'
                            : 'bg-white text-slate-400 border border-slate-200 hover:border-slate-300'
                        }`}
                      >
                        {s === 'paid' ? 'Pagado' : s === 'overdue' ? 'Vencido' : 'Pendiente'}
                      </button>
                    ))}
                  </div>
                </div>
                {m.status === 'paid' && (
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-slate-600 mb-1">Fecha de pago <span className="font-normal text-slate-400">(opcional)</span></label>
                      <Input
                        type="date"
                        value={m.paid_date}
                        onChange={e => setBackfillMonths(prev => prev.map((x, j) => j === i ? { ...x, paid_date: e.target.value } : x))}
                        className="bg-slate-50 border-slate-200 rounded-lg text-xs h-8"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-600 mb-1">Comprobante (opcional)</label>
                      <label className="flex items-center gap-1.5 text-xs font-medium text-slate-500 p-2 border border-dashed border-slate-200 rounded-lg cursor-pointer hover:bg-slate-50 transition-colors">
                        <UploadCloud className="w-3.5 h-3.5" />
                        {m.receipt_file ? m.receipt_file.name : 'Adjuntar archivo'}
                        <input
                          type="file"
                          accept="image/*,application/pdf"
                          className="hidden"
                          onChange={e => {
                            const file = e.target.files?.[0] || null
                            setBackfillMonths(prev => prev.map((x, j) => j === i ? { ...x, receipt_file: file } : x))
                          }}
                        />
                      </label>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
          <DialogFooter className="p-6 pt-4 bg-white border-t border-slate-100 flex gap-3 sm:justify-end">
            <Button
              variant="outline"
              onClick={() => { setIsBackfillOpen(false); toast.success('Inquilino añadido correctamente.') }}
              className="rounded-xl font-bold text-xs h-auto py-2 px-4 border-slate-200 text-slate-600"
            >
              Omitir
            </Button>
            <Button
              onClick={handleBackfillSubmit}
              disabled={backfillLoading}
              className="bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold text-xs shadow-md shadow-indigo-200 h-auto py-2 px-6"
            >
              {backfillLoading ? 'Registrando...' : 'Registrar meses'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

// ── History list sub-component ─────────────────────────────────────────────

function HistoryList({ tenantId, historyMonths }: { tenantId: string; historyMonths: number }) {
  const allHistory = historyMonths === 0
  const { data } = useQuery<TenantDetail>({
    queryKey: ['tenant', tenantId, allHistory ? 'all' : historyMonths],
    queryFn: async () => {
      const url = allHistory ? `/api/tenants/${tenantId}?history=all` : `/api/tenants/${tenantId}`
      const res = await api.get(url)
      return res.data
    },
    staleTime: 5 * 60_000
  })

  const history = allHistory ? (data?.payment_history ?? []) : (data?.payment_history?.slice(0, historyMonths) ?? [])

  if (history.length === 0) {
    return <div className="text-center py-4 text-xs font-medium text-slate-500">No hay pagos registrados.</div>
  }

  return (
    <div className="space-y-3">
      {history.map(hist => (
        <div key={hist.id} className="flex flex-col sm:flex-row sm:items-center justify-between p-3 border border-slate-100 rounded-xl hover:bg-slate-50 transition-colors">
          <div className="flex items-center gap-4">
            <div className="w-10 text-center">
              <p className="text-xs font-bold uppercase text-slate-400 leading-none">{MONTHS[hist.period_month]}</p>
              <p className="text-[10px] text-slate-500">{hist.period_year}</p>
            </div>
            <div>
              {getStatusBadge(hist.status)}
            </div>
          </div>

          <div className="flex items-center justify-between gap-4 mt-2 sm:mt-0">
            <div className="text-right">
              <p className="text-sm font-bold text-slate-800">€{Number(hist.amount_expected).toLocaleString('es-ES')}</p>
              <p className="text-[10px] text-slate-400">
                {hist.payment_method || 'Transferencia'}
                {hist.paid_date ? ` · ${new Date(hist.paid_date).toLocaleDateString('es-ES', { day: '2-digit', month: 'short' })}` : ''}
              </p>
            </div>

            {hist.receipt_pdf_url ? (
              <a
                href={hist.receipt_pdf_url}
                target="_blank"
                rel="noopener noreferrer"
                onClick={e => e.stopPropagation()}
                className="h-8 px-3 text-xs font-bold rounded-lg shadow-sm bg-slate-100 hover:bg-slate-200 text-slate-700 flex items-center transition-colors"
              >
                Recibo
              </a>
            ) : (
              <div className="w-16 text-center text-[10px] text-slate-400 font-bold uppercase">N/A</div>
            )}
          </div>
        </div>
      ))}
    </div>
  )
}
