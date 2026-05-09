import { Router, Request, Response } from 'express'
import { requireOwner } from '../middleware/auth'
import { supabaseAdmin } from '../lib/supabase'
import { getCurrentMonthYear } from '../lib/payments'
import { syncStripeQuantity } from '../lib/stripe'

const router = Router()
router.use(requireOwner)

// GET /api/properties — all active properties with tenant count and current month stats
router.get('/', async (req: Request, res: Response): Promise<void> => {
  const { month, year } = getCurrentMonthYear()

  const { data: properties, error } = await supabaseAdmin
    .from('properties')
    .select('*')
    .eq('owner_id', req.ownerId!)
    .eq('is_active', true)
    .order('created_at', { ascending: false })

  if (error) {
    res.status(500).json({ error: 'Error fetching properties', code: 500 })
    return
  }

  const enriched = await Promise.all((properties || []).map(async (p) => {
    const [{ count: tenantCount }, { data: payments }] = await Promise.all([
      supabaseAdmin.from('tenants').select('*', { count: 'exact', head: true })
        .eq('property_id', p.id).eq('is_active', true),
      supabaseAdmin.from('payments').select('status')
        .eq('property_id', p.id).eq('period_month', month).eq('period_year', year)
    ])

    const stats = (payments || []).reduce(
      (acc, pay) => {
        acc[pay.status as string] = (acc[pay.status as string] || 0) + 1
        return acc
      },
      {} as Record<string, number>
    )

    return {
      ...p,
      active_tenants_count: tenantCount || 0,
      current_month_stats: {
        paid: stats['paid'] || 0,
        pending: stats['pending'] || 0,
        overdue: stats['overdue'] || 0,
        to_verify: stats['to_verify'] || 0
      }
    }
  }))

  res.json(enriched)
})

// GET /api/properties/:id — single property with tenants and current month payments
router.get('/:id', async (req: Request, res: Response): Promise<void> => {
  const { month, year } = getCurrentMonthYear()

  const { data: property, error } = await supabaseAdmin
    .from('properties')
    .select('*')
    .eq('id', req.params.id)
    .eq('owner_id', req.ownerId!)
    .single()

  if (error || !property) {
    res.status(404).json({ error: 'Property not found', code: 404 })
    return
  }

  const [{ data: tenants }, { data: payments }] = await Promise.all([
    supabaseAdmin.from('tenants').select('*').eq('property_id', property.id).eq('is_active', true),
    supabaseAdmin.from('payments').select('*, tenant:tenants(full_name, id_document)')
      .eq('property_id', property.id).eq('period_month', month).eq('period_year', year)
  ])

  res.json({ ...property, tenants: tenants || [], current_month_payments: payments || [] })
})

// POST /api/properties — create property
router.post('/', async (req: Request, res: Response): Promise<void> => {
  const { address, city, postal_code, door_number, country, monthly_rent, currency, common_expenses, due_day, notes } = req.body

  if (!address?.trim() || !city?.trim()) {
    res.status(400).json({ error: 'address and city are required', code: 400 })
    return
  }
  if (!door_number?.trim()) {
    res.status(400).json({ error: 'door_number is required', code: 400 })
    return
  }
  if (!monthly_rent || Number(monthly_rent) <= 0) {
    res.status(400).json({ error: 'monthly_rent must be greater than 0', code: 400 })
    return
  }
  if (due_day && (Number(due_day) < 1 || Number(due_day) > 28)) {
    res.status(400).json({ error: 'due_day must be between 1 and 28', code: 400 })
    return
  }

  const { data: property, error } = await supabaseAdmin
    .from('properties')
    .insert({
      owner_id: req.ownerId!,
      address: address.trim(),
      city: city.trim(),
      postal_code: postal_code?.trim(),
      door_number: door_number.trim(),
      country: country || 'ES',
      monthly_rent: Number(monthly_rent),
      currency: currency || 'EUR',
      common_expenses: Number(common_expenses) || 0,
      due_day: Number(due_day) || 1,
      notes: notes?.trim()
    })
    .select()
    .single()

  if (error) {
    res.status(500).json({ error: 'Error creating property', code: 500 })
    return
  }

  syncStripeQuantity(req.ownerId!).catch(err => console.error('[Stripe] syncQuantity error:', err))

  res.status(201).json(property)
})

// PATCH /api/properties/:id — partial update
router.patch('/:id', async (req: Request, res: Response): Promise<void> => {
  const allowed = ['address', 'city', 'postal_code', 'door_number', 'country', 'monthly_rent', 'currency', 'common_expenses', 'due_day', 'notes']
  const updates: Record<string, unknown> = {}
  for (const key of allowed) {
    if (req.body[key] !== undefined) updates[key] = req.body[key]
  }

  if (!Object.keys(updates).length) {
    res.status(400).json({ error: 'No valid fields to update', code: 400 })
    return
  }

  const { data, error } = await supabaseAdmin
    .from('properties')
    .update(updates)
    .eq('id', req.params.id)
    .eq('owner_id', req.ownerId!)
    .select()
    .single()

  if (error || !data) {
    res.status(404).json({ error: 'Property not found', code: 404 })
    return
  }

  res.json(data)
})

// DELETE /api/properties/:id — soft delete
router.delete('/:id', async (req: Request, res: Response): Promise<void> => {
  const { data, error } = await supabaseAdmin
    .from('properties')
    .update({ is_active: false })
    .eq('id', req.params.id)
    .eq('owner_id', req.ownerId!)
    .select('id')
    .single()

  if (error || !data) {
    res.status(404).json({ error: 'Property not found', code: 404 })
    return
  }

  syncStripeQuantity(req.ownerId!).catch(err => console.error('[Stripe] syncQuantity error:', err))

  res.json({ success: true, id: data.id })
})

export default router
