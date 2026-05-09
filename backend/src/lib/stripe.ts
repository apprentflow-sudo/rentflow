import Stripe from 'stripe'
import { supabaseAdmin } from './supabase'

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2026-04-22.dahlia'
})

export async function syncStripeQuantity(ownerId: string): Promise<void> {
  const { data: owner } = await supabaseAdmin
    .from('owners')
    .select('stripe_subscription_id, subscription_status')
    .eq('id', ownerId)
    .single()

  if (!owner?.stripe_subscription_id) return
  if (!['active', 'trialing'].includes(owner.subscription_status || '')) return

  const { count } = await supabaseAdmin
    .from('properties')
    .select('*', { count: 'exact', head: true })
    .eq('owner_id', ownerId)
    .eq('is_active', true)

  const quantity = Math.max(count || 1, 1)

  try {
    const sub = await stripe.subscriptions.retrieve(owner.stripe_subscription_id)
    const itemId = sub.items.data[0]?.id
    if (itemId && sub.items.data[0]?.quantity !== quantity) {
      await stripe.subscriptions.update(owner.stripe_subscription_id, {
        items: [{ id: itemId, quantity }],
        proration_behavior: 'create_prorations'
      })
    }
  } catch (err) {
    console.error('[Stripe] Failed to sync quantity:', err)
  }
}
