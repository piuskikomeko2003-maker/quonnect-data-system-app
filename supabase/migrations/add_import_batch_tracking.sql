-- Migration: Add import_batch tracking for paid vendor CSV imports
--
-- Purpose: Enable per-batch delete of CSV imports. Each paid-vendor CSV import
-- is assigned a batch id (crypto.randomUUID) that is stamped onto every
-- vendor_registrations row (and name-only vendors) it creates. The import
-- history UI lists csv_import_log rows and deletes a batch by removing its
-- vendor_registrations (and orphaned name-only vendors).

ALTER TABLE public.vendor_registrations
  ADD COLUMN IF NOT EXISTS import_batch text;

ALTER TABLE public.vendors
  ADD COLUMN IF NOT EXISTS import_batch text;

CREATE INDEX IF NOT EXISTS idx_vendor_registrations_import_batch
  ON public.vendor_registrations (import_batch);

CREATE INDEX IF NOT EXISTS idx_vendors_import_batch
  ON public.vendors (import_batch);
