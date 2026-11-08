-- Migration: Configurable quick-pick amounts for paid vendor registration
--
-- The paid vendor form shows tappable amount buttons so collectors can answer
-- "Amount Paid" in one tap. These options are configured per edition from
-- Settings → Standard Vendor Fees instead of being hard-coded in the UI.

ALTER TABLE public.market_days
ADD COLUMN IF NOT EXISTS paid_vendor_quick_amounts JSONB DEFAULT '[150000, 250000]'::jsonb;

-- Backfill existing editions so every form has usable quick-pick options.
UPDATE public.market_days
SET paid_vendor_quick_amounts = '[150000, 250000]'::jsonb
WHERE paid_vendor_quick_amounts IS NULL;

COMMENT ON COLUMN public.market_days.paid_vendor_quick_amounts IS
  'JSON array of quick-pick UGX amounts shown on the paid vendor registration form (e.g. [150000, 250000]).';
