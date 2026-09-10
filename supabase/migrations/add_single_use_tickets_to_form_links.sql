-- Migration: Add single-use tracking and ticket numbers to form_links and vendor_registrations
--
-- Purpose: Support single-use vendor registration links that automatically expire
-- upon registration, and track the sequential ticket number issued to each vendor.

-- 1. Extend form_links table for single-use token tracking
ALTER TABLE public.form_links
  ADD COLUMN IF NOT EXISTS is_single_use BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS used_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS ticket_number TEXT,
  ADD COLUMN IF NOT EXISTS used_by_vendor_id UUID REFERENCES public.vendors(id) ON DELETE SET NULL;

-- 2. Extend vendor_registrations to store ticket numbers
ALTER TABLE public.vendor_registrations
  ADD COLUMN IF NOT EXISTS ticket_number TEXT;

-- 3. Create index for fast lookups by ticket_number
CREATE INDEX IF NOT EXISTS idx_vendor_registrations_ticket_number
  ON public.vendor_registrations (ticket_number);

CREATE INDEX IF NOT EXISTS idx_form_links_is_single_use
  ON public.form_links (is_single_use);
