import { Router, Request, Response } from 'express'
import { requireOwner } from '../middleware/auth'
import { supabaseAdmin } from '../lib/supabase'
import { stripe } from '../lib/stripe'

const router = Router()

// GET /api/billing/status — subscription state for the dashboard
router.get('/status', requireOwner, async (req: Request, res: Response): Promise<void> => {
  const { data: owner } = await supabaseAdmin
    .from('owners')
    .select('stripe_customer_id, stripe_subscription_id, subscription_status')
    .eq('id', req.ownerId!)
    .single()

  if (!owner?.stripe_subscription_id) {
    res.json({ status: 'inactive' })
    return
  }

  try {
    const sub = await stripe.subscriptions.retrieve(owner.stripe_subscription_id)
    const item = sub.items.data[0] as unknown as { id: string; quantity: number; current_period_end: number; price: { unit_amount: number | null } }
    res.json({
      status: sub.status,
      quantity: item?.quantity ?? 0,
      unit_amount: (item?.price?.unit_amount ?? 0) / 100,
      current_period_end: item?.current_period_end,
      trial_end: sub.trial_end,
      cancel_at_period_end: sub.cancel_at_period_end
    })
  } catch {
    res.json({ status: owner.subscription_status ?? 'inactive' })
  }
})

// POST /api/billing/checkout — start subscription via Stripe Checkout
router.post('/checkout', requireOwner, async (req: Request, res: Response): Promise<void> => {
  const { data: owner } = await supabaseAdmin
    .from('owners')
    .select('id, email, full_name, stripe_customer_id')
    .eq('id', req.ownerId!)
    .single()

  if (!owner) {
    res.status(404).json({ error: 'Owner not found', code: 404 })
    return
  }

  const { count: propertyCount } = await supabaseAdmin
    .from('properties')
    .select('*', { count: 'exact', head: true })
    .eq('owner_id', req.ownerId!)
    .eq('is_active', true)

  const quantity = Math.max(propertyCount || 1, 1)

  let customerId = owner.stripe_customer_id
  if (!customerId) {
    const customer = await stripe.customers.create({
      email: owner.email,
      name: owner.full_name || undefined,
      metadata: { owner_id: owner.id }
    })
    customerId = customer.id
    await supabaseAdmin.from('owners').update({ stripe_customer_id: customerId }).eq('id', owner.id)
  }

  const session = await stripe.checkout.sessions.create({
    customer: customerId,
    payment_method_types: ['card'],
    line_items: [{ price: process.env.STRIPE_PRICE_ID!, quantity }],
    mode: 'subscription',
    subscription_data: {
      trial_period_days: 7,
      metadata: { owner_id: owner.id }
    },
    success_url: `${process.env.FRONTEND_URL}/dashboard?billing=success`,
    cancel_url: `${process.env.FRONTEND_URL}/dashboard?billing=canceled`,
    allow_promotion_codes: true
  })

  res.json({ url: session.url })
})

// POST /api/billing/portal — open Stripe Customer Portal
router.post('/portal', requireOwner, async (req: Request, res: Response): Promise<void> => {
  const { data: owner } = await supabaseAdmin
    .from('owners')
    .select('stripe_customer_id')
    .eq('id', req.ownerId!)
    .single()

  if (!owner?.stripe_customer_id) {
    res.status(400).json({ error: 'No subscription found', code: 400 })
    return
  }

  const session = await stripe.billingPortal.sessions.create({
    customer: owner.stripe_customer_id,
    return_url: `${process.env.FRONTEND_URL}/dashboard`
  })

  res.json({ url: session.url })
})

// POST /api/billing/webhook — Stripe events (raw body required, registered before express.json())
router.post('/webhook', async (req: Request, res: Response): Promise<void> => {
  const sig = req.headers['stripe-signature'] as string

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let event: any
  try {
    event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET!)
  } catch {
    res.status(400).json({ error: 'Invalid webhook signature' })
    return
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object
        if (session.subscription && session.customer) {
          const sub = await stripe.subscriptions.retrieve(session.subscription as string)
          const ownerId = sub.metadata?.owner_id
          if (ownerId) {
            await supabaseAdmin.from('owners').update({
              stripe_customer_id: session.customer as string,
              stripe_subscription_id: session.subscription as string,
              subscription_status: sub.status
            }).eq('id', ownerId)
            console.log(`[Stripe] Subscription activated for owner ${ownerId} — status: ${sub.status}`)
          }
        }
        break
      }

      case 'customer.subscription.updated': {
        const sub = event.data.object
        const ownerId = sub.metadata?.owner_id
        if (ownerId) {
          await supabaseAdmin.from('owners')
            .update({ subscription_status: sub.status })
            .eq('id', ownerId)
          console.log(`[Stripe] Subscription updated for owner ${ownerId} — status: ${sub.status}`)
        }
        break
      }

      case 'customer.subscription.deleted': {
        const sub = event.data.object
        const ownerId = sub.metadata?.owner_id
        if (ownerId) {
          await supabaseAdmin.from('owners')
            .update({ subscription_status: 'canceled', stripe_subscription_id: null })
            .eq('id', ownerId)
          console.log(`[Stripe] Subscription canceled for owner ${ownerId}`)
        }
        break
      }

      case 'invoice.payment_failed': {
        const invoice = event.data.object
        const subId = invoice.parent?.subscription_details?.subscription ?? invoice.subscription
        if (subId) {
          const sub = await stripe.subscriptions.retrieve(subId as string)
          const ownerId = sub.metadata?.owner_id
          if (ownerId) {
            await supabaseAdmin.from('owners')
              .update({ subscription_status: 'past_due' })
              .eq('id', ownerId)
            console.log(`[Stripe] Payment failed for owner ${ownerId}`)
          }
        }
        break
      }

      case 'invoice.payment_succeeded': {
        const invoice = event.data.object
        const subId = invoice.parent?.subscription_details?.subscription ?? invoice.subscription
        if (subId) {
          const sub = await stripe.subscriptions.retrieve(subId as string)
          const ownerId = sub.metadata?.owner_id
          if (ownerId) {
            await supabaseAdmin.from('owners')
              .update({ subscription_status: sub.status })
              .eq('id', ownerId)
          }
        }
        break
      }
    }
  } catch (err) {
    console.error('[Stripe] Webhook handler error:', err)
  }

  res.json({ received: true })
})

export default router
