export interface Owner {
  id: string
  auth_user_id: string
  full_name: string
  email: string
  phone?: string
  iban?: string
  company_name?: string
  logo_url?: string
  created_at: string
  updated_at: string
}

export interface Property {
  id: string
  owner_id: string
  address: string
  city: string
  postal_code?: string
  door_number?: string
  country: string
  monthly_rent: number
  currency: string
  common_expenses: number
  due_day: number
  notes?: string
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface Tenant {
  id: string
  owner_id: string
  property_id?: string
  full_name: string
  id_document: string
  email?: string
  phone_whatsapp?: string
  preferred_language: string
  lease_start: string
  lease_end?: string
  rent_override?: number
  common_expenses_override?: number
  currency_override?: string
  contract_url?: string
  is_active: boolean
  notes?: string
  created_at: string
  updated_at: string
}

export type PaymentStatus = 'pending' | 'to_verify' | 'paid' | 'overdue' | 'partial'

export interface ReceiptOCRData {
  amount?: number
  currency?: string
  date?: string
  destination_iban?: string
  sender_name?: string
  reference?: string
  document_type?: string
  is_readable?: boolean
  confidence_score?: number
  raw_text?: string
}

export interface Payment {
  id: string
  owner_id: string
  property_id?: string
  tenant_id: string
  period_month: number
  period_year: number
  amount_expected: number
  amount_received?: number
  common_expenses_expected: number
  common_expenses_received?: number
  due_date: string
  paid_date?: string
  status: PaymentStatus
  payment_method?: string
  receipt_url?: string
  receipt_data?: ReceiptOCRData
  verification_note?: string
  verified_by?: 'agent' | 'owner'
  receipt_pdf_url?: string
  created_at: string
  updated_at: string
}

export type NotificationChannel = 'whatsapp' | 'email' | 'sms' | 'call'
export type NotificationStatus = 'sent' | 'delivered' | 'failed'

export type NotificationType =
  | 'welcome'
  | 'reminder_3_days'
  | 'reminder_due_today'
  | 'overdue_day_1'
  | 'overdue_day_3'
  | 'overdue_day_7'
  | 'overdue_day_14'
  | 'payment_confirmed'
  | 'payment_rejected'
  | 'needs_review_owner'
  | 'auto_verified_owner'
  | 'daily_report_owner'
  | 'lease_expiry_90'
  | 'lease_expiry_30'

export interface NotificationLog {
  id: string
  owner_id?: string
  tenant_id?: string
  payment_id?: string
  channel: NotificationChannel
  type: NotificationType
  message_body?: string
  status?: NotificationStatus
  external_id?: string
  sent_at: string
}

export type AgentActionType =
  | 'payment_auto_verified'
  | 'payment_flagged'
  | 'payment_auto_rejected'
  | 'escalation_triggered'
  | 'report_sent'
  | 'reminder_sent'
  | 'monthly_payments_created'
  | 'status_updated_overdue'

export interface AgentActionLog {
  id: string
  owner_id?: string
  action_type: AgentActionType
  description?: string
  metadata?: Record<string, unknown>
  created_at: string
}

