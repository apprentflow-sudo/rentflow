import { supabaseAdmin } from './supabase'

export async function createMonthlyPayments(
  ownerId: string,
  month: number,
  year: number
): Promise<{ created: number; skipped: number }> {
  let created = 0
  let skipped = 0

  const { data: properties, error: propError } = await supabaseAdmin
    .from('properties')
    .select('id, monthly_rent, due_day, currency')
    .eq('owner_id', ownerId)
    .eq('is_active', true)

  if (propError || !properties?.length) return { created, skipped }

  for (const property of properties) {
    const { data: tenants } = await supabaseAdmin
      .from('tenants')
      .select('id')
      .eq('property_id', property.id)
      .eq('is_active', true)

    if (!tenants?.length) continue

    for (const tenant of tenants) {
      const { data: existing } = await supabaseAdmin
        .from('payments')
        .select('id')
        .eq('property_id', property.id)
        .eq('tenant_id', tenant.id)
        .eq('period_month', month)
        .eq('period_year', year)
        .maybeSingle()

      if (existing) {
        skipped++
        continue
      }

      // Clamp due_day to last day of the month (handles months with < 28 days)
      const daysInMonth = new Date(year, month, 0).getDate()
      const dueDay = Math.min(property.due_day, daysInMonth)
      const dueDate = `${year}-${String(month).padStart(2, '0')}-${String(dueDay).padStart(2, '0')}`

      const { error: insertError } = await supabaseAdmin
        .from('payments')
        .insert({
          owner_id: ownerId,
          property_id: property.id,
          tenant_id: tenant.id,
          period_month: month,
          period_year: year,
          amount_expected: property.monthly_rent,
          due_date: dueDate,
          status: 'pending'
        })

      if (!insertError) created++
    }
  }

  return { created, skipped }
}

export function getCurrentMonthYear(): { month: number; year: number } {
  const now = new Date()
  return { month: now.getMonth() + 1, year: now.getFullYear() }
}

export function formatMonthName(month: number, year: number): string {
  const MONTHS = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
    'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre']
  return `${MONTHS[month - 1]} ${year}`
}
