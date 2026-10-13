-- Migration: Sticker sheet layout v2 — orientation, bleed, fit mode, 4 margins
--
-- Replaces the "page width / page height are free numbers" model with a real
-- A4 orientation, and moves the layout maths into ONE shared function
-- (src/lib/stickers/pageLayout.ts). Adds:
--   orientation     portrait | landscape  (landscape = 297 x 210)
--   margin_right_mm / margin_bottom_mm    (so all four margins are editable)
--   bleed_mm        bleed around each slot, clipped so it never overlaps
--   fit_mode        exact | contain | cover
--   lock_aspect     keep the design image's ratio when changing sticker size
--
-- It also self-heals columns that an earlier migration may have skipped
-- (auto_center, image_*, design) so a template row always normalizes cleanly.
--
-- Existing CUSTOM templates keep their geometry and their text positions; they
-- only receive sensible defaults for the new columns. The two built-in presets
-- are reset to the new defaults (landscape 3 x 3, 89 x 59 mm, 6 mm gaps).
--
-- Safe to run more than once. Idempotent.

-- ---------------------------------------------------------------------------
-- 1. Missing columns from earlier migrations (self-heal)
-- ---------------------------------------------------------------------------
ALTER TABLE public.sticker_templates
  ADD COLUMN IF NOT EXISTS auto_center BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE public.sticker_templates
  ADD COLUMN IF NOT EXISTS image_path TEXT;
ALTER TABLE public.sticker_templates
  ADD COLUMN IF NOT EXISTS image_width_px INTEGER;
ALTER TABLE public.sticker_templates
  ADD COLUMN IF NOT EXISTS image_height_px INTEGER;
ALTER TABLE public.sticker_templates
  ADD COLUMN IF NOT EXISTS design JSONB;

-- ---------------------------------------------------------------------------
-- 2. New layout columns
-- ---------------------------------------------------------------------------
ALTER TABLE public.sticker_templates
  ADD COLUMN IF NOT EXISTS orientation TEXT;
ALTER TABLE public.sticker_templates
  ADD COLUMN IF NOT EXISTS margin_right_mm NUMERIC;
ALTER TABLE public.sticker_templates
  ADD COLUMN IF NOT EXISTS margin_bottom_mm NUMERIC;
ALTER TABLE public.sticker_templates
  ADD COLUMN IF NOT EXISTS bleed_mm NUMERIC;
ALTER TABLE public.sticker_templates
  ADD COLUMN IF NOT EXISTS fit_mode TEXT;
ALTER TABLE public.sticker_templates
  ADD COLUMN IF NOT EXISTS lock_aspect BOOLEAN;

-- ---------------------------------------------------------------------------
-- 3. Backfill existing rows, inferring orientation from the stored page size
-- ---------------------------------------------------------------------------
UPDATE public.sticker_templates
   SET orientation = CASE
         WHEN page_width_mm > page_height_mm THEN 'landscape'
         ELSE 'portrait'
       END
 WHERE orientation IS NULL;

UPDATE public.sticker_templates
   SET margin_right_mm = margin_left_mm
 WHERE margin_right_mm IS NULL;

UPDATE public.sticker_templates
   SET margin_bottom_mm = margin_top_mm
 WHERE margin_bottom_mm IS NULL;

UPDATE public.sticker_templates SET bleed_mm = 1 WHERE bleed_mm IS NULL;
UPDATE public.sticker_templates SET fit_mode = 'exact' WHERE fit_mode IS NULL;
UPDATE public.sticker_templates SET lock_aspect = true WHERE lock_aspect IS NULL;

-- ---------------------------------------------------------------------------
-- 4. Lock in defaults + NOT NULL for future rows
-- ---------------------------------------------------------------------------
ALTER TABLE public.sticker_templates
  ALTER COLUMN orientation SET DEFAULT 'landscape',
  ALTER COLUMN orientation SET NOT NULL,
  ALTER COLUMN margin_right_mm SET DEFAULT 9,
  ALTER COLUMN margin_right_mm SET NOT NULL,
  ALTER COLUMN margin_bottom_mm SET DEFAULT 10.5,
  ALTER COLUMN margin_bottom_mm SET NOT NULL,
  ALTER COLUMN bleed_mm SET DEFAULT 1,
  ALTER COLUMN bleed_mm SET NOT NULL,
  ALTER COLUMN fit_mode SET DEFAULT 'exact',
  ALTER COLUMN fit_mode SET NOT NULL,
  ALTER COLUMN lock_aspect SET DEFAULT true,
  ALTER COLUMN lock_aspect SET NOT NULL;

-- ---------------------------------------------------------------------------
-- 5. Reset the two built-in presets to the new defaults.
--    The design (text positions) and the uploaded image are intentionally left
--    untouched so existing text placement keeps working.
-- ---------------------------------------------------------------------------
UPDATE public.sticker_templates
   SET orientation      = 'landscape',
       page_width_mm    = 297,
       page_height_mm   = 210,
       columns          = 3,
       rows             = 3,
       sticker_width_mm = 89,
       sticker_height_mm = 59,
       gap_x_mm         = 6,
       gap_y_mm         = 6,
       margin_left_mm   = 9,     -- (297 - 3*89 - 2*6) / 2
       margin_right_mm  = 9,
       margin_top_mm    = 10.5,  -- (210 - 3*59 - 2*6) / 2
       margin_bottom_mm = 10.5,
       inner_padding_mm = 2,
       bleed_mm         = 1,
       fit_mode         = 'exact',
       lock_aspect      = true,
       auto_center      = true,
       cut_lines        = (preset_key = 'plain_paper')
 WHERE preset_key IN ('precut_label', 'plain_paper');

NOTIFY pgrst, 'reload schema';
