import dotenv from 'dotenv'
dotenv.config()

// Allow self-signed / unverifiable certs in development (Windows SSL chain issue)
if (process.env.NODE_ENV !== 'production') {
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0'
}

import express, { Request, Response, NextFunction } from 'express'
import cors from 'cors'
import helmet from 'helmet'
import morgan from 'morgan'
import rateLimit from 'express-rate-limit'
import { supabaseAdmin } from './lib/supabase'

import authRoutes from './routes/auth'
import propertiesRoutes from './routes/properties'
import tenantsRoutes from './routes/tenants'
import paymentsRoutes from './routes/payments'
import billingRoutes from './routes/billing'

const app = express()

app.use(helmet())
app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'))

const allowedOrigins = process.env.NODE_ENV === 'production'
  ? [process.env.FRONTEND_URL!]
  : true // allow all origins in development

app.use(cors({
  origin: allowedOrigins,
  credentials: true,
  methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}))

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false
})
app.use(limiter)

// Raw body required for Stripe webhook signature verification — must be before express.json()
app.use('/api/billing/webhook', express.raw({ type: 'application/json' }))

app.use(express.json())

app.get('/health', (_req: Request, res: Response) => {
  res.json({ status: 'ok', timestamp: new Date() })
})

app.use('/api/auth', authRoutes)
app.use('/api/properties', propertiesRoutes)
app.use('/api/tenants', tenantsRoutes)
app.use('/api/payments', paymentsRoutes)
app.use('/api/billing', billingRoutes)

// Global error handler
// eslint-disable-next-line @typescript-eslint/no-unused-vars
app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  console.error(err.stack)
  res.status(500).json({ error: 'Internal server error', code: 500 })
})

async function ensureStorageBuckets() {
  const buckets = ['receipts', 'contracts', 'comprobantes']
  for (const bucket of buckets) {
    const { error } = await supabaseAdmin.storage.createBucket(bucket, { public: false })
    if (!error) {
      console.log(`[Storage] Created bucket '${bucket}'`)
    }
    // Silently skip if bucket already exists
  }
}

const PORT = Number(process.env.PORT) || 4000

const server = app.listen(PORT, async () => {
  console.log(`[RentFlow] Backend running on port ${PORT} — ${process.env.NODE_ENV}`)
  await ensureStorageBuckets()
})

process.on('SIGTERM', () => {
  console.log('[RentFlow] SIGTERM received, shutting down gracefully')
  server.close(() => {
    console.log('[RentFlow] Server closed')
    process.exit(0)
  })
})

export default server
