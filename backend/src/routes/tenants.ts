import { Router, Request, Response } from 'express'
import { requireOwner } from '../middleware/auth'
import { uploadContract } from '../middleware/upload'
import { supabaseAdmin } from '../lib/supabase'
import { getCurrentMonthYear, createMonthlyPayments } from '../lib/payments'

const router = Router()
router.use(requireOwner)

// GET /api/tenants — all active tenants with property and current payment status
router.get('/', async (req: Request, res: Response): Promise<void> => {
  const { month, year } = getCurrentMonthYear()

  const { data: tenants, error } = await supabaseAdmin
    .from('tenants')
    .select('*, property:properties(id, address, city, monthly_rent, due_day, currency)')
    .eq('owner_id', req.ownerId!)
    .eq('is_active', true)
    .order('full_name', { ascending: true })

  if (error) {
    res.status(500).json({ error: 'Error fetching tenants', code: 500 })
    return
  }

  const enriched = await Promise.all((tenants || []).map(async (t) => {
    const { data: payment } = await supabaseAdmin
      .from('payments')
      .select('id, status, amount_expected, amount_received, due_date, receipt_url, period_month, period_year')
      .eq('tenant_id', t.id)
      .eq('period_month', month)
      .eq('period_year', year)
      .maybeSingle()

    return { ...t, current_payment: payment || null }
  }))

  res.json(enriched)
})

// GET /api/tenants/:id — single tenant with full data, property, payment history
// ?history=all → returns every payment from lease start; default → last 12 months
router.get('/:id', async (req: Request, res: Response): Promise<void> => {
  const { data: tenant, error } = await supabaseAdmin
    .from('tenants')
    .select('*, property:properties(*)')
    .eq('id', req.params.id)
    .eq('owner_id', req.ownerId!)
    .single()

  if (error || !tenant) {
    res.status(404).json({ error: 'Tenant not found', code: 404 })
    return
  }

  let paymentsQuery = supabaseAdmin
    .from('payments')
    .select('*')
    .eq('tenant_id', tenant.id)
    .order('period_year', { ascending: false })
    .order('period_month', { ascending: false })

  if (req.query.history !== 'all') {
    const now = new Date()
    const sinceYear = now.getFullYear() - 1
    const sinceMonth = now.getMonth() + 1
    paymentsQuery = paymentsQuery
      .or(`period_year.gt.${sinceYear},and(period_year.eq.${sinceYear},period_month.gte.${sinceMonth})`)
      .limit(12)
  }

  const { data: payments } = await paymentsQuery

  const onTime = (payments || []).filter(p => p.status === 'paid' && p.paid_date && p.paid_date <= p.due_date).length
  const late = (payments || []).filter(p => p.status === 'paid' && p.paid_date && p.paid_date > p.due_date).length

  res.json({
    ...tenant,
    payment_history: payments || [],
    payment_stats: { on_time: onTime, late, total: (payments || []).length }
  })
})

// POST /api/tenants — create tenant and generate current month payment
router.post('/', async (req: Request, res: Response): Promise<void> => {
  const { full_name, id_document, email, phone_whatsapp, property_id, preferred_language, lease_start, lease_end, notes, rent_override, common_expenses_override } = req.body

  if (!full_name?.trim() || !id_document?.trim() || !property_id || !lease_start) {
    res.status(400).json({ error: 'full_name, id_document, property_id, and lease_start are required', code: 400 })
    return
  }

  // Verify property belongs to this owner
  const { data: property } = await supabaseAdmin
    .from('properties')
    .select('id')
    .eq('id', property_id)
    .eq('owner_id', req.ownerId!)
    .single()

  if (!property) {
    res.status(404).json({ error: 'Property not found', code: 404 })
    return
  }

  const { data: tenant, error } = await supabaseAdmin
    .from('tenants')
    .insert({
      owner_id: req.ownerId!,
      property_id,
      full_name: full_name.trim(),
      id_document: id_document.trim(),
      email: email?.trim(),
      phone_whatsapp: phone_whatsapp?.trim(),
      preferred_language: preferred_language || 'es',
      lease_start,
      lease_end: lease_end || null,
      notes: notes?.trim(),
      rent_override: rent_override != null ? Number(rent_override) : null,
      common_expenses_override: common_expenses_override != null ? Number(common_expenses_override) : null
    })
    .select()
    .single()

  if (error) {
    if (error.code === '23505') {
      res.status(409).json({ error: 'A tenant with this document ID already exists', code: 409 })
      return
    }
    res.status(500).json({ error: 'Error creating tenant', code: 500 })
    return
  }

  // Create current month payment automatically
  const { month, year } = getCurrentMonthYear()
  await createMonthlyPayments(req.ownerId!, month, year)

  res.status(201).json(tenant)
})

// PATCH /api/tenants/:id — partial update
router.patch('/:id', async (req: Request, res: Response): Promise<void> => {
  const allowed = ['full_name', 'email', 'phone_whatsapp', 'preferred_language', 'lease_start', 'lease_end', 'notes', 'property_id', 'rent_override', 'common_expenses_override']
  const updates: Record<string, unknown> = {}
  for (const key of allowed) {
    if (req.body[key] !== undefined) updates[key] = req.body[key]
  }

  if (!Object.keys(updates).length) {
    res.status(400).json({ error: 'No valid fields to update', code: 400 })
    return
  }

  const { data, error } = await supabaseAdmin
    .from('tenants')
    .update(updates)
    .eq('id', req.params.id)
    .eq('owner_id', req.ownerId!)
    .select()
    .single()

  if (error || !data) {
    res.status(404).json({ error: 'Tenant not found', code: 404 })
    return
  }

  res.json(data)
})

// DELETE /api/tenants/:id — soft delete
router.delete('/:id', async (req: Request, res: Response): Promise<void> => {
  const { data, error } = await supabaseAdmin
    .from('tenants')
    .update({ is_active: false })
    .eq('id', req.params.id)
    .eq('owner_id', req.ownerId!)
    .select('id')
    .single()

  if (error || !data) {
    res.status(404).json({ error: 'Tenant not found', code: 404 })
    return
  }

  res.json({ success: true, id: data.id })
})

// POST /api/tenants/:id/backfill — create historical payments for past months
router.post('/:id/backfill', async (req: Request, res: Response): Promise<void> => {
  const { months } = req.body as {
    months: Array<{
      period_month: number
      period_year: number
      status: 'paid' | 'pending' | 'overdue'
      paid_date?: string
      receipt_url?: string
    }>
  }

  if (!Array.isArray(months) || months.length === 0) {
    res.status(400).json({ error: 'months array is required', code: 400 })
    return
  }

  // Verify tenant belongs to this owner and get property/rent info
  const { data: tenant } = await supabaseAdmin
    .from('tenants')
    .select('id, owner_id, property_id, rent_override, common_expenses_override, property:properties(monthly_rent, due_day, common_expenses)')
    .eq('id', req.params.id)
    .eq('owner_id', req.ownerId!)
    .single()

  if (!tenant) {
    res.status(404).json({ error: 'Tenant not found', code: 404 })
    return
  }

  const property = (tenant.property as unknown as { monthly_rent: number; due_day: number; common_expenses: number } | null)
  const amountExpected = tenant.rent_override ?? property?.monthly_rent ?? 0
  const commonExpected = tenant.common_expenses_override ?? property?.common_expenses ?? 0

  let created = 0
  let skipped = 0

  for (const m of months) {
    const { data: existing } = await supabaseAdmin
      .from('payments')
      .select('id')
      .eq('tenant_id', tenant.id)
      .eq('period_month', m.period_month)
      .eq('period_year', m.period_year)
      .maybeSingle()

    if (existing) { skipped++; continue }

    const daysInMonth = new Date(m.period_year, m.period_month, 0).getDate()
    const dueDay = Math.min(property?.due_day ?? 1, daysInMonth)
    const dueDate = `${m.period_year}-${String(m.period_month).padStart(2, '0')}-${String(dueDay).padStart(2, '0')}`

    const { error } = await supabaseAdmin.from('payments').insert({
      owner_id: req.ownerId!,
      property_id: tenant.property_id,
      tenant_id: tenant.id,
      period_month: m.period_month,
      period_year: m.period_year,
      amount_expected: amountExpected,
      common_expenses_expected: commonExpected,
      due_date: dueDate,
      status: m.status,
      paid_date: m.paid_date || null,
      receipt_url: m.receipt_url || null,
      ...(m.status === 'paid' ? { verified_by: 'owner' as const } : {})
    })

    if (!error) created++
  }

  res.json({ created, skipped })
})

// POST /api/tenants/:id/contract — upload PDF to Supabase Storage
router.post('/:id/contract', uploadContract.single('contract'), async (req: Request, res: Response): Promise<void> => {
  if (!req.file) {
    res.status(400).json({ error: 'No contract file provided', code: 400 })
    return
  }

  const { data: tenant } = await supabaseAdmin
    .from('tenants')
    .select('id')
    .eq('id', req.params.id)
    .eq('owner_id', req.ownerId!)
    .single()

  if (!tenant) {
    res.status(404).json({ error: 'Tenant not found', code: 404 })
    return
  }

  const path = `${req.ownerId}/${req.params.id}/contract.pdf`
  const { error: uploadError } = await supabaseAdmin.storage
    .from('contracts')
    .upload(path, req.file.buffer, {
      contentType: 'application/pdf',
      upsert: true
    })

  if (uploadError) {
    res.status(500).json({ error: 'Error uploading contract', code: 500 })
    return
  }

  const { data: { publicUrl } } = supabaseAdmin.storage.from('contracts').getPublicUrl(path)

  await supabaseAdmin
    .from('tenants')
    .update({ contract_url: path })
    .eq('id', req.params.id)

  res.json({ success: true, contract_url: path, public_url: publicUrl })
})

export default router
