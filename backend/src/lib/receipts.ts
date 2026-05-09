import { supabaseAdmin } from './supabase'
import { generateReceiptPdf } from './receipt-generator'
import { uploadReceiptPdf } from './upload-receipt'

export async function triggerReceiptGeneration(paymentId: string): Promise<void> {
  // Fetch all data needed for the receipt in one query
  const { data: payment, error } = await supabaseAdmin
    .from('payments')
    .select(`
      id, period_month, period_year, amount_expected, amount_received,
      paid_date, due_date, payment_method, owner_id,
      tenant:tenants(full_name, id_document, email),
      property:properties(address, city, currency),
      owner:owners(full_name, company_name, email, iban)
    `)
    .eq('id', paymentId)
    .single()

  if (error || !payment) {
    console.error(`[Receipt] Payment ${paymentId} not found:`, error?.message)
    return
  }

  // Type narrowing for joined records
  type TenantRow = { full_name: string; id_document: string; email?: string }
  type PropertyRow = { address: string; city: string; currency?: string }
  type OwnerRow = { full_name?: string; company_name?: string; email: string; iban?: string }

  const tenant = (Array.isArray(payment.tenant) ? payment.tenant[0] : payment.tenant) as TenantRow
  const property = (Array.isArray(payment.property) ? payment.property[0] : payment.property) as PropertyRow
  const owner = (Array.isArray(payment.owner) ? payment.owner[0] : payment.owner) as OwnerRow

  if (!tenant || !property || !owner) {
    console.error(`[Receipt] Missing related data for payment ${paymentId}`)
    return
  }

  try {
    const pdfBuffer = await generateReceiptPdf({
      paymentId: payment.id,
      periodMonth: payment.period_month,
      periodYear: payment.period_year,
      amountExpected: Number(payment.amount_expected),
      amountReceived: Number(payment.amount_received || payment.amount_expected),
      paidDate: payment.paid_date,
      dueDate: payment.due_date,
      currency: property.currency || 'EUR',
      paymentMethod: payment.payment_method || undefined,
      tenantName: tenant.full_name,
      tenantDocument: tenant.id_document,
      tenantEmail: tenant.email || undefined,
      propertyAddress: property.address,
      propertyCity: property.city,
      ownerName: owner.full_name || 'Propietario',
      ownerEmail: owner.email,
      ownerIban: owner.iban || undefined,
      ownerCompany: owner.company_name || undefined
    })

    const { path, signedUrl } = await uploadReceiptPdf(
      payment.owner_id,
      payment.id,
      payment.period_month,
      payment.period_year,
      pdfBuffer
    )

    const { error: pdfUpdateError } = await supabaseAdmin
      .from('payments')
      .update({ receipt_pdf_url: signedUrl })
      .eq('id', paymentId)

    if (pdfUpdateError) {
      console.error(`[Receipt] Failed to save PDF URL for ${paymentId}:`, pdfUpdateError.message)
    }

    console.log(`[Receipt] Generated for payment ${paymentId} → ${path}`)
  } catch (err) {
    console.error(`[Receipt] Generation failed for payment ${paymentId}:`, err)
    // Non-fatal: payment is still approved, receipt can be regenerated manually
  }
}
