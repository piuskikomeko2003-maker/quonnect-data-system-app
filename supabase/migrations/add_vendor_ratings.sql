-- Migration: Add vendor marketing-power ratings per edition
--
-- 1. Creates public.vendor_ratings table
--    - rating: smallint nullable, checked between 1 and 10
--    - edition_id: FK to public.market_days(id)
--    - vendor_id: FK to public.vendors(id)
--    - UNIQUE (vendor_id, edition_id)
-- 2. Sets up RLS policies (admin only for write)
-- 3. Creates summary and edition rating views for reporting

-- 1. Table creation
CREATE TABLE IF NOT EXISTS public.vendor_ratings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_id UUID NOT NULL REFERENCES public.vendors(id) ON DELETE CASCADE,
  edition_id UUID NOT NULL REFERENCES public.market_days(id) ON DELETE CASCADE,
  rating SMALLINT,
  note TEXT,
  rated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT vendor_ratings_rating_check CHECK (rating IS NULL OR (rating >= 0 AND rating <= 10)),
  CONSTRAINT vendor_ratings_vendor_edition_key UNIQUE (vendor_id, edition_id)
);

-- 2. Indexes for fast lookup and filtering
CREATE INDEX IF NOT EXISTS idx_vendor_ratings_vendor_id ON public.vendor_ratings(vendor_id);
CREATE INDEX IF NOT EXISTS idx_vendor_ratings_edition_id ON public.vendor_ratings(edition_id);
CREATE INDEX IF NOT EXISTS idx_vendor_ratings_rating ON public.vendor_ratings(rating);

-- 3. Enable RLS
ALTER TABLE public.vendor_ratings ENABLE ROW LEVEL SECURITY;

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

-- RLS: Read allows authenticated users
DROP POLICY IF EXISTS "vendor_ratings_select" ON public.vendor_ratings;
CREATE POLICY "vendor_ratings_select" ON public.vendor_ratings
  FOR SELECT TO authenticated
  USING (true);

-- Allow public read if client uses anon key
DROP POLICY IF EXISTS "vendor_ratings_select_anon" ON public.vendor_ratings;
CREATE POLICY "vendor_ratings_select_anon" ON public.vendor_ratings
  FOR SELECT TO anon
  USING (true);

-- RLS: Write is restricted to admins and super_admins only
DROP POLICY IF EXISTS "vendor_ratings_admin_write" ON public.vendor_ratings;
CREATE POLICY "vendor_ratings_admin_write" ON public.vendor_ratings
  FOR ALL TO authenticated
  USING (public.is_admin_or_super())
  WITH CHECK (public.is_admin_or_super());

-- 4. Views:
-- Summary view: average rating and count of rated editions per vendor across all editions
CREATE OR REPLACE VIEW public.vendor_ratings_summary AS
SELECT
  vendor_id,
  ROUND(AVG(rating)::numeric, 1) AS avg_rating,
  COUNT(rating)::integer AS rated_editions_count
FROM public.vendor_ratings
WHERE rating IS NOT NULL
GROUP BY vendor_id;

-- Combined view: vendor rating for each edition with their overall average
CREATE OR REPLACE VIEW public.vendor_edition_ratings_view AS
SELECT
  vr.id,
  vr.vendor_id,
  vr.edition_id,
  vr.rating,
  vr.note,
  vr.rated_by,
  vr.created_at,
  vr.updated_at,
  COALESCE(s.avg_rating, vr.rating::numeric) AS avg_rating,
  COALESCE(s.rated_editions_count, CASE WHEN vr.rating IS NOT NULL THEN 1 ELSE 0 END) AS rated_editions_count
FROM public.vendor_ratings vr
LEFT JOIN public.vendor_ratings_summary s ON s.vendor_id = vr.vendor_id;

NOTIFY pgrst, 'reload schema';
