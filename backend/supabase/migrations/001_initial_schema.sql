-- ============================================================
-- RentFlow — Initial Schema v1
-- Run this in Supabase: SQL Editor > New query > paste > Run
-- ============================================================

-- ============================================================
-- TABLES
-- ============================================================

CREATE TABLE owners (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  auth_user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
  full_name text NOT NULL DEFAULT '',
  email text NOT NULL UNIQUE,
  phone text,
  iban text,
  company_name text,
  logo_url text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE properties (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL REFERENCES owners(id) ON DELETE CASCADE,
  address text NOT NULL,
  city text NOT NULL,
  postal_code text,
  country text DEFAULT 'ES',
  monthly_rent numeric(10,2) NOT NULL,
  currency text DEFAULT 'EUR',
  due_day integer NOT NULL DEFAULT 1 CHECK (due_day BETWEEN 1 AND 28),
  notes text,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE tenants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL REFERENCES owners(id) ON DELETE CASCADE,
  property_id uuid REFERENCES properties(id) ON DELETE SET NULL,
  full_name text NOT NULL,
  id_document text NOT NULL,
  email text,
  phone_whatsapp text,
  preferred_language text DEFAULT 'es',
  lease_start date NOT NULL,
  lease_end date,
  contract_url text,
  is_active boolean DEFAULT true,
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(owner_id, id_document)
);

CREATE TABLE payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL REFERENCES owners(id) ON DELETE CASCADE,
  property_id uuid REFERENCES properties(id),
  tenant_id uuid REFERENCES tenants(id),
  period_month integer NOT NULL CHECK (period_month BETWEEN 1 AND 12),
  period_year integer NOT NULL,
  amount_expected numeric(10,2) NOT NULL,
  amount_received numeric(10,2),
  due_date date NOT NULL,
  paid_date date,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'to_verify', 'paid', 'overdue', 'partial')),
  payment_method text CHECK (payment_method IN ('transfer', 'cash', 'other')),
  receipt_url text,
  receipt_data jsonb,
  verification_note text,
  verified_by text CHECK (verified_by IN ('agent', 'owner')),
  receipt_pdf_url text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(property_id, tenant_id, period_month, period_year)
);

CREATE TABLE notifications_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid REFERENCES owners(id),
  tenant_id uuid REFERENCES tenants(id),
  payment_id uuid REFERENCES payments(id),
  channel text NOT NULL CHECK (channel IN ('whatsapp', 'email', 'sms', 'call')),
  type text NOT NULL,
  message_body text,
  status text CHECK (status IN ('sent', 'delivered', 'failed')),
  external_id text,
  sent_at timestamptz DEFAULT now()
);

CREATE TABLE agent_actions_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid REFERENCES owners(id),
  action_type text NOT NULL,
  description text,
  metadata jsonb,
  created_at timestamptz DEFAULT now()
);

-- ============================================================
-- UPDATED_AT TRIGGER
-- ============================================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_owners_updated_at
  BEFORE UPDATE ON owners
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_properties_updated_at
  BEFORE UPDATE ON properties
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_tenants_updated_at
  BEFORE UPDATE ON tenants
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_payments_updated_at
  BEFORE UPDATE ON payments
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================
-- AUTO-CREATE OWNER PROFILE ON AUTH SIGNUP
-- ============================================================

CREATE OR REPLACE FUNCTION handle_new_owner()
RETURNS trigger AS $$
BEGIN
  INSERT INTO owners (auth_user_id, email, full_name)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', '')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_owner();

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================

ALTER TABLE owners ENABLE ROW LEVEL SECURITY;
ALTER TABLE properties ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_actions_log ENABLE ROW LEVEL SECURITY;

-- Owners: each user sees only their own row
CREATE POLICY "owners_select_own" ON owners
  FOR SELECT USING (auth.uid() = auth_user_id);

CREATE POLICY "owners_update_own" ON owners
  FOR UPDATE USING (auth.uid() = auth_user_id);

-- Helper function: verify that owner_id belongs to the current auth user
CREATE OR REPLACE FUNCTION is_my_owner_id(check_owner_id uuid)
RETURNS boolean AS $$
  SELECT EXISTS (
    SELECT 1 FROM owners
    WHERE id = check_owner_id AND auth_user_id = auth.uid()
  )
$$ LANGUAGE sql SECURITY DEFINER;

-- Properties
CREATE POLICY "properties_select_own" ON properties
  FOR SELECT USING (is_my_owner_id(owner_id));
CREATE POLICY "properties_insert_own" ON properties
  FOR INSERT WITH CHECK (is_my_owner_id(owner_id));
CREATE POLICY "properties_update_own" ON properties
  FOR UPDATE USING (is_my_owner_id(owner_id));
CREATE POLICY "properties_delete_own" ON properties
  FOR DELETE USING (is_my_owner_id(owner_id));

-- Tenants
CREATE POLICY "tenants_select_own" ON tenants
  FOR SELECT USING (is_my_owner_id(owner_id));
CREATE POLICY "tenants_insert_own" ON tenants
  FOR INSERT WITH CHECK (is_my_owner_id(owner_id));
CREATE POLICY "tenants_update_own" ON tenants
  FOR UPDATE USING (is_my_owner_id(owner_id));
CREATE POLICY "tenants_delete_own" ON tenants
  FOR DELETE USING (is_my_owner_id(owner_id));

-- Payments
CREATE POLICY "payments_select_own" ON payments
  FOR SELECT USING (is_my_owner_id(owner_id));
CREATE POLICY "payments_insert_own" ON payments
  FOR INSERT WITH CHECK (is_my_owner_id(owner_id));
CREATE POLICY "payments_update_own" ON payments
  FOR UPDATE USING (is_my_owner_id(owner_id));
CREATE POLICY "payments_delete_own" ON payments
  FOR DELETE USING (is_my_owner_id(owner_id));

-- Notifications log
CREATE POLICY "notifications_select_own" ON notifications_log
  FOR SELECT USING (is_my_owner_id(owner_id));
CREATE POLICY "notifications_insert_own" ON notifications_log
  FOR INSERT WITH CHECK (is_my_owner_id(owner_id));

-- Agent actions log
CREATE POLICY "agent_actions_select_own" ON agent_actions_log
  FOR SELECT USING (is_my_owner_id(owner_id));
CREATE POLICY "agent_actions_insert_own" ON agent_actions_log
  FOR INSERT WITH CHECK (is_my_owner_id(owner_id));

-- ============================================================
-- STORAGE BUCKETS
-- Run these separately in Supabase dashboard if SQL editor
-- doesn't support storage commands, or use the UI:
-- Storage > New bucket > name + private
-- ============================================================
-- INSERT INTO storage.buckets (id, name, public) VALUES ('receipts', 'receipts', false);
-- INSERT INTO storage.buckets (id, name, public) VALUES ('contracts', 'contracts', false);
-- INSERT INTO storage.buckets (id, name, public) VALUES ('comprobantes', 'comprobantes', false);
