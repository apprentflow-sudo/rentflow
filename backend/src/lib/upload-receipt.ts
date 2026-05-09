import { supabaseAdmin } from './supabase'

const BUCKET = 'receipts'
const SIGNED_URL_TTL = 365 * 24 * 60 * 60 // 365 days in seconds

export async function uploadReceiptPdf(
  ownerId: string,
  paymentId: string,
  periodMonth: number,
  periodYear: number,
  pdfBuffer: Buffer
): Promise<{ path: string; signedUrl: string }> {
  const period = `${periodYear}_${String(periodMonth).padStart(2, '0')}`
  const path = `${ownerId}/receipts/${paymentId}/recibo_${period}.pdf`

  const { error: uploadError } = await supabaseAdmin.storage
    .from(BUCKET)
    .upload(path, pdfBuffer, {
      contentType: 'application/pdf',
      upsert: true
    })

  if (uploadError) {
    throw new Error(`Storage upload failed: ${uploadError.message}`)
  }

  const { data: signedData, error: signError } = await supabaseAdmin.storage
    .from(BUCKET)
    .createSignedUrl(path, SIGNED_URL_TTL)

  if (signError || !signedData?.signedUrl) {
    throw new Error(`Failed to generate signed URL: ${signError?.message}`)
  }

  return { path, signedUrl: signedData.signedUrl }
}
