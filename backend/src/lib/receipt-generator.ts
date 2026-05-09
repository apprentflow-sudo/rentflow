import puppeteer from 'puppeteer'

interface ReceiptData {
  paymentId: string
  periodMonth: number
  periodYear: number
  amountExpected: number
  amountReceived: number
  paidDate: string
  dueDate: string
  currency: string
  paymentMethod?: string
  // Tenant
  tenantName: string
  tenantDocument: string
  tenantEmail?: string
  // Property
  propertyAddress: string
  propertyCity: string
  // Owner
  ownerName: string
  ownerEmail: string
  ownerIban?: string
  ownerCompany?: string
}

const MONTH_NAMES: Record<number, string> = {
  1: 'Enero', 2: 'Febrero', 3: 'Marzo', 4: 'Abril',
  5: 'Mayo', 6: 'Junio', 7: 'Julio', 8: 'Agosto',
  9: 'Septiembre', 10: 'Octubre', 11: 'Noviembre', 12: 'Diciembre'
}

function formatAmount(amount: number, currency: string): string {
  return new Intl.NumberFormat('es-ES', { style: 'currency', currency }).format(amount)
}

function formatDate(dateStr: string): string {
  const [year, month, day] = dateStr.split('-')
  return `${day}/${month}/${year}`
}

function buildHtml(data: ReceiptData): string {
  const period = `${MONTH_NAMES[data.periodMonth]} ${data.periodYear}`
  const generatedAt = new Date().toLocaleDateString('es-ES', {
    day: '2-digit', month: '2-digit', year: 'numeric'
  })
  const ownerLabel = data.ownerCompany || data.ownerName

  return `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;
    font-size: 13px;
    color: #1a1a1a;
    background: #fff;
    padding: 48px 56px;
  }

  /* Header */
  .header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    padding-bottom: 32px;
    border-bottom: 2px solid #4F46E5;
    margin-bottom: 36px;
  }
  .header-left h1 {
    font-size: 22px;
    font-weight: 700;
    color: #4F46E5;
    letter-spacing: -0.3px;
  }
  .header-left .subtitle {
    font-size: 13px;
    color: #6B7280;
    margin-top: 4px;
  }
  .header-right {
    text-align: right;
  }
  .receipt-number {
    font-size: 12px;
    color: #9CA3AF;
    margin-bottom: 4px;
  }
  .receipt-id {
    font-family: 'Courier New', monospace;
    font-size: 11px;
    color: #6B7280;
  }

  /* Amount hero */
  .amount-hero {
    background: #F5F3FF;
    border-radius: 12px;
    padding: 28px 36px;
    margin-bottom: 36px;
    text-align: center;
  }
  .amount-label {
    font-size: 12px;
    text-transform: uppercase;
    letter-spacing: 1px;
    color: #6B7280;
    margin-bottom: 8px;
  }
  .amount-value {
    font-size: 48px;
    font-weight: 700;
    color: #4F46E5;
    letter-spacing: -1px;
  }
  .amount-period {
    font-size: 15px;
    color: #374151;
    margin-top: 8px;
  }
  .paid-badge {
    display: inline-block;
    background: #D1FAE5;
    color: #065F46;
    font-size: 12px;
    font-weight: 600;
    padding: 4px 14px;
    border-radius: 20px;
    margin-top: 12px;
    letter-spacing: 0.5px;
  }

  /* Details grid */
  .details-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 24px;
    margin-bottom: 36px;
  }
  .detail-block h3 {
    font-size: 10px;
    text-transform: uppercase;
    letter-spacing: 1px;
    color: #9CA3AF;
    margin-bottom: 12px;
  }
  .detail-row {
    display: flex;
    justify-content: space-between;
    padding: 7px 0;
    border-bottom: 1px solid #F3F4F6;
    font-size: 12.5px;
  }
  .detail-row:last-child { border-bottom: none; }
  .detail-row .label { color: #6B7280; }
  .detail-row .value { font-weight: 500; color: #1a1a1a; text-align: right; max-width: 55%; }

  /* Property section */
  .property-section {
    background: #F9FAFB;
    border-radius: 8px;
    padding: 18px 24px;
    margin-bottom: 36px;
  }
  .property-section h3 {
    font-size: 10px;
    text-transform: uppercase;
    letter-spacing: 1px;
    color: #9CA3AF;
    margin-bottom: 10px;
  }
  .property-address {
    font-size: 14px;
    font-weight: 600;
    color: #1a1a1a;
  }
  .property-city {
    font-size: 12px;
    color: #6B7280;
    margin-top: 2px;
  }

  /* Footer */
  .footer {
    margin-top: 48px;
    padding-top: 20px;
    border-top: 1px solid #E5E7EB;
    display: flex;
    justify-content: space-between;
    align-items: center;
  }
  .footer-left {
    font-size: 11px;
    color: #9CA3AF;
  }
  .footer-right {
    font-size: 11px;
    color: #9CA3AF;
    text-align: right;
  }
  .footer-brand {
    font-size: 11px;
    color: #C4B5FD;
    font-weight: 500;
  }
</style>
</head>
<body>

<div class="header">
  <div class="header-left">
    <h1>RECIBO DE ALQUILER</h1>
    <div class="subtitle">${ownerLabel}</div>
  </div>
  <div class="header-right">
    <div class="receipt-number">Recibo</div>
    <div class="receipt-id">${data.paymentId.split('-')[0].toUpperCase()}</div>
  </div>
</div>

<div class="amount-hero">
  <div class="amount-label">Total pagado</div>
  <div class="amount-value">${formatAmount(data.amountReceived || data.amountExpected, data.currency)}</div>
  <div class="amount-period">${period}</div>
  <div class="paid-badge">PAGADO</div>
</div>

<div class="details-grid">
  <div class="detail-block">
    <h3>Inquilino</h3>
    <div class="detail-row">
      <span class="label">Nombre</span>
      <span class="value">${data.tenantName}</span>
    </div>
    <div class="detail-row">
      <span class="label">DNI / NIE</span>
      <span class="value">${data.tenantDocument}</span>
    </div>
    ${data.tenantEmail ? `<div class="detail-row">
      <span class="label">Email</span>
      <span class="value">${data.tenantEmail}</span>
    </div>` : ''}
  </div>

  <div class="detail-block">
    <h3>Pago</h3>
    <div class="detail-row">
      <span class="label">Fecha de pago</span>
      <span class="value">${formatDate(data.paidDate)}</span>
    </div>
    <div class="detail-row">
      <span class="label">Vencimiento</span>
      <span class="value">${formatDate(data.dueDate)}</span>
    </div>
    ${data.paymentMethod ? `<div class="detail-row">
      <span class="label">Método</span>
      <span class="value">${data.paymentMethod}</span>
    </div>` : ''}
    <div class="detail-row">
      <span class="label">Importe mensual</span>
      <span class="value">${formatAmount(data.amountExpected, data.currency)}</span>
    </div>
  </div>
</div>

<div class="property-section">
  <h3>Inmueble</h3>
  <div class="property-address">${data.propertyAddress}</div>
  <div class="property-city">${data.propertyCity}</div>
</div>

<div class="detail-block">
  <h3>Propietario</h3>
  <div class="detail-row">
    <span class="label">Nombre</span>
    <span class="value">${data.ownerName}</span>
  </div>
  <div class="detail-row">
    <span class="label">Email</span>
    <span class="value">${data.ownerEmail}</span>
  </div>
  ${data.ownerIban ? `<div class="detail-row">
    <span class="label">IBAN</span>
    <span class="value">${data.ownerIban.replace(/(.{4})/g, '$1 ').trim()}</span>
  </div>` : ''}
</div>

<div class="footer">
  <div class="footer-left">
    Generado el ${generatedAt}<br>
    Este documento acredita el pago del alquiler correspondiente al período indicado.
  </div>
  <div class="footer-right">
    <div class="footer-brand">RentFlow</div>
    <div>Gestión de alquileres</div>
  </div>
</div>

</body>
</html>`
}

export async function generateReceiptPdf(data: ReceiptData): Promise<Buffer> {
  const browser = await puppeteer.launch({
    headless: true,
    executablePath: process.env.PUPPETEER_EXECUTABLE_PATH,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-gpu']
  })

  try {
    const page = await browser.newPage()
    await page.setContent(buildHtml(data), { waitUntil: 'networkidle0' })

    const pdf = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: { top: '0', right: '0', bottom: '0', left: '0' }
    })

    return Buffer.from(pdf)
  } finally {
    await browser.close()
  }
}

export type { ReceiptData }
