-- Migration 003: tenant improvements
-- Run in Supabase SQL Editor

-- Properties: door number (unit identifier) + common expenses
ALTER TABLE properties
  ADD COLUMN IF NOT EXISTS door_number text,
  ADD COLUMN IF NOT EXISTS common_expenses numeric(10,2) NOT NULL DEFAULT 0;

-- Tenants: per-tenant rent + common expenses override
-- NULL = use property value; set to override for this specific tenant
ALTER TABLE tenants
  ADD COLUMN IF NOT EXISTS rent_override numeric(10,2),
  ADD COLUMN IF NOT EXISTS common_expenses_override numeric(10,2);

-- Payments: track common expenses separately from rent
ALTER TABLE payments
  ADD COLUMN IF NOT EXISTS common_expenses_expected numeric(10,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS common_expenses_received numeric(10,2);
