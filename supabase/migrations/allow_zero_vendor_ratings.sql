-- Migration: Allow a zero (0) marketing-power rating
--
-- 0 means "Failed" — the vendor did not market on their platform. It is
-- different from NULL, which means "Unrated".
--
-- Applies to both the weekly ratings table and the legacy per-edition table
-- (which is kept in sync with the latest weekly score).

ALTER TABLE public.vendor_ratings
  DROP CONSTRAINT IF EXISTS vendor_ratings_rating_check;

ALTER TABLE public.vendor_ratings
  ADD CONSTRAINT vendor_ratings_rating_check
  CHECK (rating IS NULL OR (rating >= 0 AND rating <= 10));

ALTER TABLE public.vendor_weekly_ratings
  DROP CONSTRAINT IF EXISTS vendor_weekly_ratings_rating_check;

ALTER TABLE public.vendor_weekly_ratings
  ADD CONSTRAINT vendor_weekly_ratings_rating_check
  CHECK (rating >= 0 AND rating <= 10);

NOTIFY pgrst, 'reload schema';
