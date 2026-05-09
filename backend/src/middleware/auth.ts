import { Request, Response, NextFunction } from 'express'
import jwt from 'jsonwebtoken'
import { supabaseAdmin } from '../lib/supabase'

export async function requireOwner(req: Request, res: Response, next: NextFunction): Promise<void> {
  const authHeader = req.headers.authorization
  if (!authHeader?.startsWith('Bearer ')) {
    res.status(401).json({ error: 'No token provided', code: 401 })
    return
  }

  const token = authHeader.split(' ')[1]

  try {
    const { data: { user }, error } = await supabaseAdmin.auth.getUser(token)

    if (error || !user) {
      res.status(401).json({ error: 'Invalid or expired token', code: 401 })
      return
    }

    const { data: owner, error: ownerError } = await supabaseAdmin
      .from('owners')
      .select('id')
      .eq('auth_user_id', user.id)
      .single()

    if (ownerError || !owner) {
      res.status(403).json({ error: 'Owner profile not found', code: 403 })
      return
    }

    req.ownerId = owner.id
    next()
  } catch {
    res.status(401).json({ error: 'Authentication failed', code: 401 })
  }
}

interface TenantTokenPayload {
  tenant_id: string
  owner_id: string
  property_id?: string
}

export function requireTenant(req: Request, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization
  if (!authHeader?.startsWith('Bearer ')) {
    res.status(401).json({ error: 'No token provided', code: 401 })
    return
  }

  const token = authHeader.split(' ')[1]

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET!) as TenantTokenPayload
    req.tenantId = payload.tenant_id
    req.ownerId = payload.owner_id
    req.propertyId = payload.property_id
    next()
  } catch {
    res.status(401).json({ error: 'Invalid or expired token', code: 401 })
  }
}
