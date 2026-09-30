-- Migration: Single-use link tracking, atomic ticket counters, and ticket numbers
--
-- Purpose: Support single-use vendor registration links that atomically expire
-- on registration, and guarantee unique, sequential ticket numbers per event
-- edition. Safe to re-run (all statements are idempotent).

-- 1. Extend form_links for single-use token tracking
ALTER TABLE public.form_links
  ADD COLUMN IF NOT EXISTS is_single_use BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS used_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS ticket_number TEXT,
  ADD COLUMN IF NOT EXISTS used_by_vendor_id UUID REFERENCES public.vendors(id) ON DELETE SET NULL;

-- 2. Store the numeric ticket number on registrations. Kept as INTEGER so the
--    DB can enforce uniqueness per edition (legacy text codes stay in stall_number).
ALTER TABLE public.vendor_registrations
  ADD COLUMN IF NOT EXISTS ticket_number INTEGER;

-- 3. Per-edition monotonic ticket counter. Locking is per edition so different
--    editions/regions allocate tickets fully in parallel.
CREATE TABLE IF NOT EXISTS public.edition_ticket_counters (
  edition_id UUID PRIMARY KEY REFERENCES public.market_days(id) ON DELETE CASCADE,
  last_number INTEGER NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.edition_ticket_counters ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "allow_read_edition_ticket_counters" ON public.edition_ticket_counters;
CREATE POLICY "allow_read_edition_ticket_counters"
  ON public.edition_ticket_counters FOR SELECT
  TO anon, authenticated USING (true);

-- 4. Seed counters from any numeric stall numbers already present per edition.
INSERT INTO public.edition_ticket_counters (edition_id, last_number)
SELECT vr.market_day_id,
       COALESCE(MAX(NULLIF(regexp_replace(vr.stall_number, '\D', '', 'g'), '')::int), 0)
FROM public.vendor_registrations vr
WHERE vr.market_day_id IS NOT NULL
GROUP BY vr.market_day_id
ON CONFLICT (edition_id) DO UPDATE
  SET last_number = GREATEST(public.edition_ticket_counters.last_number, excluded.last_number),
      updated_at = now();

-- 5. Indexes
CREATE INDEX IF NOT EXISTS idx_vendor_registrations_ticket_number
  ON public.vendor_registrations (ticket_number);

CREATE INDEX IF NOT EXISTS idx_form_links_is_single_use
  ON public.form_links (is_single_use);

-- Uniqueness guard: no two registrations in the same edition share a ticket.
CREATE UNIQUE INDEX IF NOT EXISTS vendor_registrations_edition_ticket_uniq
  ON public.vendor_registrations (market_day_id, ticket_number)
  WHERE ticket_number IS NOT NULL;
