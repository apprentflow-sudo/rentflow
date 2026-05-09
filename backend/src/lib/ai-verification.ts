import Anthropic from '@anthropic-ai/sdk'
import { supabaseAdmin } from './supabase'
import type { ReceiptOCRData } from './types'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

export type VerificationDecision = 'auto_approved' | 'needs_review' | 'auto_rejected'

export interface VerificationResult {
  decision: VerificationDecision
  extracted: ReceiptOCRData
  confidence: number
  amount_diff_pct: number | null
  reason: string
}

const SUPPORTED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp']
const MAX_FILE_SIZE_BYTES = 4 * 1024 * 1024 // 4MB

export async function verifyPaymentReceipt(params: {
  receiptPath: string
  expectedAmount: number
  ownerIban?: string
}): Promise<VerificationResult> {
  const { receiptPath, expectedAmount, ownerIban } = params

  const { data: blob, error } = await supabaseAdmin.storage
    .from('receipts')
    .download(receiptPath)

  if (error || !blob) {
    console.error('[AI] Storage download error:', error)
    return fallback('Could not download receipt from storage')
  }

  const mediaType = blob.type || 'image/jpeg'

  if (!SUPPORTED_IMAGE_TYPES.includes(mediaType)) {
    return fallback(`File type "${mediaType}" cannot be processed by AI — routed to manual review`)
  }

  const arrayBuffer = await blob.arrayBuffer()

  if (arrayBuffer.byteLength > MAX_FILE_SIZE_BYTES) {
    return fallback('File too large for AI processing — routed to manual review')
  }

  const base64 = Buffer.from(arrayBuffer).toString('base64')

  const prompt = `You are analyzing a bank transfer receipt or proof of payment.

Extract the following in JSON format:
- amount: number (the exact transferred amount as shown in the document, no conversion)
- currency: string (the ISO currency code AS SHOWN in the document — e.g. "EUR", "USD", "UYU", "ARS", "GBP". Look for currency symbols: € = EUR, $ alone is ambiguous so note the country context, U$S or USD = USD, $ UYU or pesos uruguayos = UYU, $ ARS or pesos argentinos = ARS. Be precise — do NOT assume EUR.)
- date: string (ISO date YYYY-MM-DD if visible, else null)
- destination_iban: string (IBAN receiving the funds, if visible, else null)
- sender_name: string (sender's name, if visible, else null)
- reference: string (transfer reference/concept, if visible, else null)
- document_type: string ("bank_transfer", "bizum", "paypal", or "other")
- is_readable: boolean (can you clearly read amounts and key details?)
- confidence_score: number 0-100 (confidence in the extracted amount AND currency)

Context: expected amount €${expectedAmount} EUR${ownerIban ? `, expected destination IBAN: ${ownerIban}` : ''}.

Respond ONLY with valid JSON, no explanation or markdown.`

  try {
    const response = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 400,
      messages: [{
        role: 'user',
        content: [
          {
            type: 'image',
            source: {
              type: 'base64',
              media_type: mediaType as 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp',
              data: base64
            }
          },
          { type: 'text', text: prompt }
        ]
      }]
    })

    const rawText = response.content[0].type === 'text' ? response.content[0].text : ''
    const jsonMatch = rawText.match(/\{[\s\S]*\}/)
    if (!jsonMatch) return fallback('AI response was not valid JSON')

    const extracted: ReceiptOCRData = JSON.parse(jsonMatch[0])
    return makeDecision(extracted, expectedAmount)

  } catch (err) {
    console.error('[AI] Claude API error:', err)
    return fallback('Claude API error — routed to manual review')
  }
}

const EXPECTED_CURRENCY = 'EUR'

function makeDecision(extracted: ReceiptOCRData, expectedAmount: number): VerificationResult {
  const confidence = extracted.confidence_score ?? 0
  const extractedAmount = extracted.amount
  const extractedCurrency = (extracted.currency ?? '').toUpperCase().trim()

  if (!extracted.is_readable || !extractedAmount) {
    return {
      decision: 'needs_review',
      extracted,
      confidence,
      amount_diff_pct: null,
      reason: 'Document unreadable or amount not extracted — manual review required'
    }
  }

  // Currency mismatch — never compare amounts across currencies
  if (extractedCurrency && extractedCurrency !== EXPECTED_CURRENCY) {
    return {
      decision: 'needs_review',
      extracted,
      confidence,
      amount_diff_pct: null,
      reason: `Currency mismatch: document shows ${extractedCurrency} ${extractedAmount}, expected ${EXPECTED_CURRENCY} ${expectedAmount} — manual review required`
    }
  }

  const diffPct = Math.abs(extractedAmount - expectedAmount) / expectedAmount * 100

  // Auto-approve only when highly confident and amount matches closely
  if (confidence >= 70 && diffPct <= 2) {
    return {
      decision: 'auto_approved',
      extracted,
      confidence,
      amount_diff_pct: diffPct,
      reason: `${EXPECTED_CURRENCY} ${extractedAmount} matches expected ${EXPECTED_CURRENCY} ${expectedAmount} (${diffPct.toFixed(1)}% diff, ${confidence}% confidence)`
    }
  }

  // Everything else goes to the owner for review — AI never auto-rejects
  const reasonParts: string[] = []
  if (diffPct > 2) reasonParts.push(`amount difference ${diffPct.toFixed(1)}%: document shows ${extractedCurrency || EXPECTED_CURRENCY} ${extractedAmount}, expected ${EXPECTED_CURRENCY} ${expectedAmount}`)
  if (confidence < 70) reasonParts.push(`low confidence (${confidence}%)`)

  return {
    decision: 'needs_review',
    extracted,
    confidence,
    amount_diff_pct: diffPct,
    reason: reasonParts.join(' · ') + ' — manual review required'
  }
}

function fallback(reason: string): VerificationResult {
  return {
    decision: 'needs_review',
    extracted: { is_readable: false },
    confidence: 0,
    amount_diff_pct: null,
    reason
  }
}

const toPaymentMethod = (t?: string): 'transfer' | 'cash' | 'other' => {
  if (t === 'bank_transfer' || t === 'bizum') return 'transfer'
  if (t === 'cash') return 'cash'
  return 'other'
}

export async function processVerificationResult(paymentId: string, result: VerificationResult): Promise<void> {
  const { decision, extracted, reason, confidence, amount_diff_pct } = result

  console.log(`[AI] processVerificationResult START — payment=${paymentId} decision=${decision}`)
  console.log(`[AI] Extracted:`, JSON.stringify(extracted))
  console.log(`[AI] Reason: ${reason}`)

  let statusUpdate: Record<string, unknown>

  if (decision === 'auto_approved') {
    statusUpdate = {
      status: 'paid',
      amount_received: extracted.amount,
      paid_date: extracted.date || new Date().toISOString().split('T')[0],
      payment_method: toPaymentMethod(extracted.document_type),
      receipt_data: extracted,
      verified_by: 'agent',
      verification_note: reason
    }
    console.log(`[AI] statusUpdate payment_method: ${toPaymentMethod(extracted.document_type)}`)
  } else {
    // needs_review — keep receipt visible, owner decides
    statusUpdate = {
      status: 'to_verify',
      receipt_data: extracted,
      verification_note: reason
    }
  }

  console.log(`[AI] Sending DB update for payment ${paymentId}...`)
  const { error: updateError } = await supabaseAdmin
    .from('payments').update(statusUpdate).eq('id', paymentId)

  if (updateError) {
    console.error(`[AI] DB update FAILED for payment ${paymentId}:`, updateError.message, updateError.code, updateError.details)
    return
  }

  console.log(`[AI] Payment ${paymentId}: ${decision} — ${reason}`)

  const { data: payment } = await supabaseAdmin
    .from('payments').select('owner_id').eq('id', paymentId).single()

  if (payment) {
    const actionType = decision === 'auto_approved' ? 'payment_auto_verified' : 'payment_flagged'
    await supabaseAdmin.from('agent_actions_log').insert({
      owner_id: payment.owner_id,
      action_type: actionType,
      description: reason,
      metadata: { payment_id: paymentId, decision, confidence, amount_diff_pct, extracted_amount: extracted.amount }
    }).then(({ error }) => {
      if (error) console.error(`[AI] Log insert failed:`, error.message)
    })
  }

  if (decision === 'auto_approved') {
    try {
      const { triggerReceiptGeneration } = await import('./receipts')
      await triggerReceiptGeneration(paymentId)
    } catch (err) {
      console.error(`[AI] Receipt generation threw for payment ${paymentId}:`, err)
    }
  }
}
