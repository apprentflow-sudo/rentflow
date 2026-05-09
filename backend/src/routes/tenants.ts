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

// GET /api/tenants/:id — single tenant with full data, property, 12-month history
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

  const now = new Date()
  const sinceYear = now.getFullYear() - 1
  const sinceMonth = now.getMonth() + 1

  const { data: payments } = await supabaseAdmin
    .from('payments')
    .select('*')
    .eq('tenant_id', tenant.id)
    .or(`period_year.gt.${sinceYear},and(period_year.eq.${sinceYear},period_month.gte.${sinceMonth})`)
    .order('period_year', { ascending: false })
    .order('period_month', { ascending: false })
    .limit(12)

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
  const { full_name, id_document, email, phone_whatsapp, property_id, preferred_language, lease_start, lease_end, notes } = req.body

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
      notes: notes?.trim()
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
  const allowed = ['full_name', 'email', 'phone_whatsapp', 'preferred_language', 'lease_start', 'lease_end', 'notes', 'property_id']
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
