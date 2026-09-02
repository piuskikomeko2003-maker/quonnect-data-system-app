-- Migration: Add standard_fee to market_days and fee_source to vendor_registrations

-- 1. Add standard_fee column to market_days (edition level default vendor fee)
ALTER TABLE public.market_days
ADD COLUMN IF NOT EXISTS standard_fee NUMERIC DEFAULT 0;

-- 2. Add fee_source column to vendor_registrations to track 'standard' vs 'override'
ALTER TABLE public.vendor_registrations
ADD COLUMN IF NOT EXISTS fee_source TEXT DEFAULT 'standard';

-- 3. Add check constraint for fee_source if not already present
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'vendor_registrations_fee_source_check'
  ) THEN
    ALTER TABLE public.vendor_registrations
    ADD CONSTRAINT vendor_registrations_fee_source_check
    CHECK (fee_source IN ('standard', 'override'));
  END IF;
END $$;

-- 4. Backfill existing records: default fee_source to 'standard'
UPDATE public.vendor_registrations
SET fee_source = 'standard'
WHERE fee_source IS NULL;
