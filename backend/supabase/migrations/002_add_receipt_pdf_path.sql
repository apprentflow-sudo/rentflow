-- Add storage path column to payments for receipt PDF regeneration
ALTER TABLE payments ADD COLUMN IF NOT EXISTS receipt_pdf_path text;
