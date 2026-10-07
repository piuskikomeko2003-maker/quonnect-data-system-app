-- Migration: Track the number of tables booked on a paid vendor registration
--
-- A vendor who pays for more than one table under the same ticket is tracked
-- with a single `tables` count on their paid registration row. 1 is the
-- default and covers the vast majority of vendors. The count is capped at 5.
--
-- `tables` is the single source of truth; admin UI and reports read from it.
-- Only admins may change it. The DB CHECK below is the last line of defence,
-- and the admin-checked API route (src/app/api/vendors/tables/route.ts)
-- enforces the role before the write. `tables_updated_by` / `tables_updated_at`
-- are a lightweight audit trail of the last change.
--
-- Safe to run on existing data: existing rows become 1. Idempotent.

-- 1. The count itself. NOT NULL DEFAULT 1 backfills every existing row with 1.
ALTER TABLE public.vendor_registrations
  ADD COLUMN IF NOT EXISTS tables INTEGER NOT NULL DEFAULT 1;

-- 2. Enforce the 1..5 range. Guarded so re-running is safe.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'vendor_registrations_tables_check'
  ) THEN
    ALTER TABLE public.vendor_registrations
      ADD CONSTRAINT vendor_registrations_tables_check
      CHECK (tables >= 1 AND tables <= 5);
  END IF;
END $$;

-- 3. Lightweight audit of the last admin change.
ALTER TABLE public.vendor_registrations
  ADD COLUMN IF NOT EXISTS tables_updated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE public.vendor_registrations
  ADD COLUMN IF NOT EXISTS tables_updated_at TIMESTAMPTZ;

-- 4. Explicit backfill for any row added before the DEFAULT applied.
UPDATE public.vendor_registrations
   SET tables = 1
 WHERE tables IS NULL;

NOTIFY pgrst, 'reload schema';
