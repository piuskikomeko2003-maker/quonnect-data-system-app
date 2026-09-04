-- Migration: Add walk-in attendance estimates per edition
--
-- Purpose: Track the official "estimated total attendance" figure per edition
-- (used for funding reports and the dashboard headline) separately from the
-- smaller dataset of individually-logged walk-in personal-info records in the
-- `walkins` table. Both coexist — the estimate is never added to or replaced by
-- the logged records.

CREATE TABLE IF NOT EXISTS public.walkin_estimates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  market_day_id uuid NOT NULL REFERENCES public.market_days (id) ON DELETE CASCADE,
  month text,
  estimated_total integer NOT NULL,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT walkin_estimates_market_day_id_key UNIQUE (market_day_id),
  CONSTRAINT walkin_estimates_estimated_total_check CHECK (estimated_total >= 0)
);

CREATE INDEX IF NOT EXISTS idx_walkin_estimates_market_day_id
  ON public.walkin_estimates (market_day_id);

ALTER TABLE public.walkin_estimates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "allow_read_all" ON public.walkin_estimates;
CREATE POLICY "allow_read_all"
  ON public.walkin_estimates FOR SELECT
  TO anon, authenticated
  USING (true);

DROP POLICY IF EXISTS "allow_insert_walkin_estimates" ON public.walkin_estimates;
CREATE POLICY "allow_insert_walkin_estimates"
  ON public.walkin_estimates FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

DROP POLICY IF EXISTS "allow_update_walkin_estimates" ON public.walkin_estimates;
CREATE POLICY "allow_update_walkin_estimates"
  ON public.walkin_estimates FOR UPDATE
  TO anon, authenticated
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS "allow_delete_walkin_estimates" ON public.walkin_estimates;
CREATE POLICY "allow_delete_walkin_estimates"
  ON public.walkin_estimates FOR DELETE
  TO anon, authenticated
  USING (true);

-- Optional backfill of Kampala edition estimates (name-based, idempotent).
-- July has no corresponding market_days row, so it is intentionally omitted.

INSERT INTO public.walkin_estimates (market_day_id, month, estimated_total)
SELECT md.id, 'April', 6000
FROM public.market_days md
JOIN public.regions r ON r.id = md.region_id
WHERE r.slug = 'kampala' AND md.name = 'Kampala April 2026'
ON CONFLICT (market_day_id) DO NOTHING;

INSERT INTO public.walkin_estimates (market_day_id, month, estimated_total)
SELECT md.id, 'May', 5000
FROM public.market_days md
JOIN public.regions r ON r.id = md.region_id
WHERE r.slug = 'kampala' AND md.name = 'Kampala May 2026'
ON CONFLICT (market_day_id) DO NOTHING;

INSERT INTO public.walkin_estimates (market_day_id, month, estimated_total)
SELECT md.id, 'June', 5000
FROM public.market_days md
JOIN public.regions r ON r.id = md.region_id
WHERE r.slug = 'kampala' AND md.name = 'Kampala June 2026'
ON CONFLICT (market_day_id) DO NOTHING;

INSERT INTO public.walkin_estimates (market_day_id, month, estimated_total)
SELECT md.id, 'August', 6000
FROM public.market_days md
JOIN public.regions r ON r.id = md.region_id
WHERE r.slug = 'kampala' AND md.name = 'Kampala August 2026'
ON CONFLICT (market_day_id) DO NOTHING;
