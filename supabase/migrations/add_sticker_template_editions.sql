-- Migration: Per-edition sticker designs
--
-- Mirrors ticket_templates: an edition may own one custom sticker template.
-- When an edition has no custom template (edition_id IS NULL or no row), the
-- globally active template is used as the fallback.
--
-- Existing rows are the global presets and keep edition_id = NULL, so the
-- current active design remains the default for every edition. Idempotent.

ALTER TABLE public.sticker_templates
  ADD COLUMN IF NOT EXISTS edition_id UUID REFERENCES public.market_days(id) ON DELETE CASCADE;

-- At most one sticker template per edition. Global presets (edition_id NULL)
-- are unaffected and may still have their own unique preset_key.
CREATE UNIQUE INDEX IF NOT EXISTS uq_sticker_templates_edition
  ON public.sticker_templates (edition_id)
  WHERE edition_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_sticker_templates_edition
  ON public.sticker_templates (edition_id);

NOTIFY pgrst, 'reload schema';
