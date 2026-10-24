-- Migration: Add weekly vendor marketing-power ratings
--
-- Lets admins rate every vendor once per week (Mon-Sun) leading up to a market
-- day, building a rating history/trend until the event date.
--
-- 1. Creates public.vendor_weekly_ratings
--    - one row per (vendor, edition, week_start)
--    - rating 1..10, week_start is always the Monday of the week
-- 2. RLS: read for authenticated/anon, write for admins & super admins
-- 3. Summary view with latest / average weekly rating per vendor+edition

CREATE TABLE IF NOT EXISTS public.vendor_weekly_ratings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_id UUID NOT NULL REFERENCES public.vendors(id) ON DELETE CASCADE,
  edition_id UUID NOT NULL REFERENCES public.market_days(id) ON DELETE CASCADE,
  week_start DATE NOT NULL,
  rating SMALLINT NOT NULL,
  note TEXT,
  rated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT vendor_weekly_ratings_rating_check CHECK (rating >= 0 AND rating <= 10),
  CONSTRAINT vendor_weekly_ratings_vendor_edition_week_key
    UNIQUE (vendor_id, edition_id, week_start)
);

CREATE INDEX IF NOT EXISTS idx_vendor_weekly_ratings_edition
  ON public.vendor_weekly_ratings(edition_id, week_start);
CREATE INDEX IF NOT EXISTS idx_vendor_weekly_ratings_vendor
  ON public.vendor_weekly_ratings(vendor_id, week_start DESC);
CREATE INDEX IF NOT EXISTS idx_vendor_weekly_ratings_rating
  ON public.vendor_weekly_ratings(rating);

ALTER TABLE public.vendor_weekly_ratings ENABLE ROW LEVEL SECURITY;

-- Fallback helper for role checking if not exists
CREATE OR REPLACE FUNCTION public.is_admin_or_super()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_profiles
    WHERE user_id = auth.uid()
    AND role IN ('admin', 'super_admin')
  );
$$;

DROP POLICY IF EXISTS "vendor_weekly_ratings_select" ON public.vendor_weekly_ratings;
CREATE POLICY "vendor_weekly_ratings_select" ON public.vendor_weekly_ratings
  FOR SELECT TO authenticated
  USING (true);

DROP POLICY IF EXISTS "vendor_weekly_ratings_select_anon" ON public.vendor_weekly_ratings;
CREATE POLICY "vendor_weekly_ratings_select_anon" ON public.vendor_weekly_ratings
  FOR SELECT TO anon
  USING (true);

DROP POLICY IF EXISTS "vendor_weekly_ratings_admin_write" ON public.vendor_weekly_ratings;
CREATE POLICY "vendor_weekly_ratings_admin_write" ON public.vendor_weekly_ratings
  FOR ALL TO authenticated
  USING (public.is_admin_or_super())
  WITH CHECK (public.is_admin_or_super());

-- Per vendor+edition summary: latest weekly score, average and number of weeks
CREATE OR REPLACE VIEW public.vendor_weekly_ratings_summary AS
SELECT
  vendor_id,
  edition_id,
  ROUND(AVG(rating)::numeric, 1) AS avg_weekly_rating,
  COUNT(*)::integer AS weeks_rated,
  MAX(week_start) AS latest_week_start,
  (ARRAY_AGG(rating ORDER BY week_start DESC))[1] AS latest_rating
FROM public.vendor_weekly_ratings
GROUP BY vendor_id, edition_id;

-- Backfill existing edition ratings into the week they were recorded, so the
-- weekly view starts with continuity instead of an empty current week.
INSERT INTO public.vendor_weekly_ratings
  (vendor_id, edition_id, week_start, rating, note, rated_by, created_at, updated_at)
SELECT
  vendor_id,
  edition_id,
  (date_trunc('week', COALESCE(created_at, now())))::date,
  rating,
  note,
  rated_by,
  created_at,
  updated_at
FROM public.vendor_ratings
WHERE rating IS NOT NULL
ON CONFLICT (vendor_id, edition_id, week_start) DO NOTHING;

NOTIFY pgrst, 'reload schema';
