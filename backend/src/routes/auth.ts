import { Router, Request, Response } from 'express'
import jwt from 'jsonwebtoken'
import { supabaseAdmin } from '../lib/supabase'

const router = Router()

// POST /api/auth/tenant — authenticate tenant by document ID, returns JWT valid 24h
router.post('/tenant', async (req: Request, res: Response): Promise<void> => {
  const { id_document } = req.body

  if (!id_document?.trim()) {
    res.status(400).json({ error: 'id_document is required', code: 400 })
    return
  }

  try {
    const { data: tenant, error } = await supabaseAdmin
      .from('tenants')
      .select('id, owner_id, property_id, full_name, email, phone_whatsapp, preferred_language, lease_start, lease_end, is_active')
      .eq('id_document', id_document.trim())
      .eq('is_active', true)
      .single()

    if (error || !tenant) {
      res.status(404).json({ error: 'Tenant not found. Check your document ID.', code: 404 })
      return
    }

    const token = jwt.sign(
      {
        tenant_id: tenant.id,
        owner_id: tenant.owner_id,
        property_id: tenant.property_id
      },
      process.env.JWT_SECRET!,
      { expiresIn: '24h' }
    )

    res.json({
      token,
      tenant_id: tenant.id,
      tenant: {
        id: tenant.id,
        full_name: tenant.full_name,
        email: tenant.email,
        phone_whatsapp: tenant.phone_whatsapp,
        preferred_language: tenant.preferred_language,
        lease_start: tenant.lease_start,
        lease_end: tenant.lease_end
      }
    })
  } catch (err) {
    console.error('Tenant auth error:', err)
    res.status(500).json({ error: 'Authentication failed', code: 500 })
  }
})

export default router
