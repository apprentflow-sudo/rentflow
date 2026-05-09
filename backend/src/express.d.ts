// Extend Express Request with RentFlow auth context
declare namespace Express {
  interface Request {
    ownerId?: string
    tenantId?: string
    propertyId?: string
  }
}
