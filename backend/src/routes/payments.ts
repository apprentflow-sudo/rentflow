import { Router, Request, Response } from 'express'
import { requireOwner, requireTenant } from '../middleware/auth'
import { uploadReceipt } from '../middleware/upload'
import { supabaseAdmin } from '../lib/supabase'
import { getCurrentMonthYear, formatMonthName } from '../lib/payments'
import { triggerReceiptGeneration } from '../lib/receipts'
import { verifyPaymentReceipt, processVerificationResult } from '../lib/ai-verification'

const router = Router()

// ─── TENANT ROUTES (public, JWT auth) ───────────────────────────────────────

// GET /api/payments/tenant/:tenant_id — all pending/overdue payments + 6-month history
router.get('/tenant/:tenant_id', requireTenant, async (req: Request, res: Response): Promise<void> => {
  // Tenant can only access their own data
  if (req.params.tenant_id !== req.tenantId) {
    res.status(403).json({ error: 'Access denied', code: 403 })
    return
  }

  const [{ data: pending }, { data: history }] = await Promise.all([
    // All unpaid months, oldest first so the oldest debt is at index 0
    supabaseAdmin.from('payments')
      .select('*, property:properties(address, city, monthly_rent, due_day, currency)')
      .eq('tenant_id', req.tenantId!)
      .in('status', ['pending', 'overdue'])
      .order('period_year', { ascending: true })
      .order('period_month', { ascending: true }),
    supabaseAdmin.from('payments')
      .select('id, status, amount_expected, amount_received, common_expenses_expected, period_month, period_year, due_date, paid_date, payment_method, receipt_pdf_url')
      .eq('tenant_id', req.tenantId!)
      .order('period_year', { ascending: false })
      .order('period_month', { ascending: false })
      .limit(6)
  ])

  res.json({ pending_payments: pending || [], history: history || [] })
})

// POST /api/payments/:payment_id/receipt — tenant uploads proof of payment
router.post('/:payment_id/receipt', requireTenant, uploadReceipt.single('receipt'), async (req: Request, res: Response): Promise<void> => {
  if (!req.file) {
    res.status(400).json({ error: 'No receipt file provided', code: 400 })
    return
  }

  // Verify this payment belongs to the authenticated tenant
  const { data: payment, error: payError } = await supabaseAdmin
    .from('payments')
    .select('id, tenant_id, owner_id, status, amount_expected')
    .eq('id', req.params.payment_id)
    .eq('tenant_id', req.tenantId!)
    .single()

  if (payError || !payment) {
    res.status(404).json({ error: 'Payment not found', code: 404 })
    return
  }

  if (payment.status === 'paid') {
    res.status(400).json({ error: 'This payment is already confirmed', code: 400 })
    return
  }

  const ext = req.file.mimetype === 'application/pdf' ? 'pdf' : req.file.mimetype.split('/')[1]
  const timestamp = Date.now()
  const path = `${payment.owner_id}/${payment.id}/receipt_${timestamp}.${ext}`

  const { error: uploadError } = await supabaseAdmin.storage
    .from('receipts')
    .upload(path, req.file.buffer, {
      contentType: req.file.mimetype,
      upsert: true
    })

  if (uploadError) {
    console.error('Storage upload error:', uploadError)
    res.status(500).json({ error: 'Error uploading receipt', code: 500 })
    return
  }

  const receiptType = (req.body?.receipt_type as string) || 'both'

  await supabaseAdmin
    .from('payments')
    .update({
      receipt_url: path,
      status: 'to_verify',
      receipt_data: { receipt_type: receiptType } as Record<string, unknown>,
      verification_note: null,
      verified_by: null
    })
    .eq('id', payment.id)

  // Respond immediately, run AI verification in background
  res.json({ success: true, message: 'Comprobante recibido. Será verificado en breve.' })

  setImmediate(async () => {
    try {
      const result = await verifyPaymentReceipt({
        receiptPath: path,
        expectedAmount: Number(payment.amount_expected)
      })
      await processVerificationResult(payment.id, result)
    } catch (err) {
      console.error(`[AI] Verification failed for payment ${payment.id}:`, err)
    }
  })
})

// ─── OWNER ROUTES (session auth) ─────────────────────────────────────────────

// GET /api/payments/dashboard — summary for current month
router.get('/dashboard', requireOwner, async (req: Request, res: Response): Promise<void> => {
  const { month, year } = getCurrentMonthYear()

  const { data: payments, error } = await supabaseAdmin
    .from('payments')
    .select(`
      *,
      tenant:tenants(id, full_name, email, phone_whatsapp, id_document, lease_start, lease_end),
      property:properties(id, address, city, monthly_rent, due_day)
    `)
    .eq('owner_id', req.ownerId!)
    .eq('period_month', month)
    .eq('period_year', year)
    .order('created_at', { ascending: false })

  if (error) {
    res.status(500).json({ error: 'Error fetching dashboard', code: 500 })
    return
  }

  const list = payments || []
  const totalExpected = list.reduce((sum, p) => sum + Number(p.amount_expected), 0)
  const totalReceived = list.filter(p => p.status === 'paid').reduce((sum, p) => sum + Number(p.amount_received || p.amount_expected), 0)

  const propertyIds = new Set(list.map(p => p.property_id)).size

  res.json({
    current_month: formatMonthName(month, year),
    stats: {
      total_properties: propertyIds,
      total_expected: totalExpected,
      total_received: totalReceived,
      paid_count: list.filter(p => p.status === 'paid').length,
      pending_count: list.filter(p => p.status === 'pending').length,
      overdue_count: list.filter(p => p.status === 'overdue').length,
      to_verify_count: list.filter(p => p.status === 'to_verify').length,
      partial_count: list.filter(p => p.status === 'partial').length
    },
    payments: list
  })
})

// GET /api/payments — filtered list
router.get('/', requireOwner, async (req: Request, res: Response): Promise<void> => {
  const { month, year, status, property_id, tenant_id } = req.query
  const { month: currentMonth, year: currentYear } = getCurrentMonthYear()

  let query = supabaseAdmin
    .from('payments')
    .select('*, tenant:tenants(full_name, id_document), property:properties(address, city)')
    .eq('owner_id', req.ownerId!)
    .eq('period_month', month ? Number(month) : currentMonth)
    .eq('period_year', year ? Number(year) : currentYear)
    .order('created_at', { ascending: false })

  if (status) query = query.eq('status', status as string)
  if (property_id) query = query.eq('property_id', property_id as string)
  if (tenant_id) query = query.eq('tenant_id', tenant_id as string)

  const { data, error } = await query

  if (error) {
    res.status(500).json({ error: 'Error fetching payments', code: 500 })
    return
  }

  res.json(data || [])
})

// GET /api/payments/:id — single payment with notification history
router.get('/:id', requireOwner, async (req: Request, res: Response): Promise<void> => {
  const [{ data: payment, error }, { data: notifications }] = await Promise.all([
    supabaseAdmin.from('payments')
      .select('*, tenant:tenants(*), property:properties(*)')
      .eq('id', req.params.id)
      .eq('owner_id', req.ownerId!)
      .single(),
    supabaseAdmin.from('notifications_log')
      .select('*')
      .eq('payment_id', req.params.id)
      .order('sent_at', { ascending: false })
  ])

  if (error || !payment) {
    res.status(404).json({ error: 'Payment not found', code: 404 })
    return
  }

  res.json({ ...payment, notifications: notifications || [] })
})

// PATCH /api/payments/:id/verify — owner approves or rejects a payment
router.patch('/:id/verify', requireOwner, async (req: Request, res: Response): Promise<void> => {
  const { action, note } = req.body

  if (!action || !['approve', 'reject'].includes(action)) {
    res.status(400).json({ error: 'action must be "approve" or "reject"', code: 400 })
    return
  }

  const { data: payment, error: fetchError } = await supabaseAdmin
    .from('payments')
    .select('id, tenant_id, owner_id, status, amount_expected, receipt_url')
    .eq('id', req.params.id)
    .eq('owner_id', req.ownerId!)
    .single()

  if (fetchError || !payment) {
    res.status(404).json({ error: 'Payment not found', code: 404 })
    return
  }

  if (payment.status !== 'to_verify') {
    res.status(400).json({ error: `Cannot verify a payment with status "${payment.status}"`, code: 400 })
    return
  }

  let updates: Record<string, unknown>

  if (action === 'approve') {
    updates = {
      status: 'paid',
      amount_received: payment.amount_expected,
      paid_date: new Date().toISOString().split('T')[0],
      verified_by: 'owner',
      verification_note: note || null
    }
  } else {
    updates = {
      status: 'pending',
      receipt_url: null,
      verification_note: note || null
    }
  }

  const { data: updated, error: updateError } = await supabaseAdmin
    .from('payments')
    .update(updates)
    .eq('id', payment.id)
    .select()
    .single()

  if (updateError) {
    res.status(500).json({ error: 'Error updating payment', code: 500 })
    return
  }

  res.json(updated)

  // Generate receipt and notify tenant in background
  setImmediate(async () => {
    if (action === 'approve') {
      await triggerReceiptGeneration(payment.id)
      console.log(`[NOTIFY] TODO: Send WhatsApp to tenant ${payment.tenant_id} — payment approved`)
    } else {
      console.log(`[NOTIFY] TODO: Send WhatsApp to tenant ${payment.tenant_id} — payment rejected. Note: ${note}`)
    }
  })
})

// POST /api/payments/:id/re-verify — owner manually re-triggers AI on stuck receipt
router.post('/:id/re-verify', requireOwner, async (req: Request, res: Response): Promise<void> => {
  const { data: payment, error } = await supabaseAdmin
    .from('payments')
    .select('id, owner_id, amount_expected, receipt_url')
    .eq('id', req.params.id)
    .eq('owner_id', req.ownerId!)
    .single()

  if (error || !payment) {
    res.status(404).json({ error: 'Payment not found', code: 404 })
    return
  }

  if (!payment.receipt_url) {
    res.status(400).json({ error: 'No receipt uploaded yet', code: 400 })
    return
  }

  res.json({ success: true, message: 'Re-verification started' })

  setImmediate(async () => {
    try {
      const result = await verifyPaymentReceipt({
        receiptPath: payment.receipt_url,
        expectedAmount: Number(payment.amount_expected)
      })
      await processVerificationResult(payment.id, result)
    } catch (err) {
      console.error(`[AI] Re-verification failed for payment ${payment.id}:`, err)
    }
  })
})

export default router
