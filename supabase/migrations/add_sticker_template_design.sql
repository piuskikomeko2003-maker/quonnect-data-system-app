-- Migration: Sticker template visual design (super-admin only)
--
-- Adds an optional design image + the placed-field "design" to sticker_templates,
-- while leaving the existing sheet-geometry columns (columns, rows, sticker size,
-- margins, gaps, cut_lines, font sizes) untouched.
--
-- Design positions are stored as PERCENTAGES of the sticker box so that changing
-- the sticker size or the sheet grid never breaks the layout. `design` always
-- defines all three fields (business_name, ticket_number, table_label).
--
-- Safe on existing data: existing rows are backfilled with a sensible default
-- design, image columns stay NULL, and the PDF generator falls back to the old
-- text-only layout when no design image is present. Idempotent.

-- ---------------------------------------------------------------------------
-- 1. New columns on sticker_templates
-- ---------------------------------------------------------------------------
ALTER TABLE public.sticker_templates
  ADD COLUMN IF NOT EXISTS image_path TEXT;
ALTER TABLE public.sticker_templates
  ADD COLUMN IF NOT EXISTS image_width_px INTEGER;
ALTER TABLE public.sticker_templates
  ADD COLUMN IF NOT EXISTS image_height_px INTEGER;
ALTER TABLE public.sticker_templates
  ADD COLUMN IF NOT EXISTS design JSONB;

-- ---------------------------------------------------------------------------
-- 2. Backfill existing rows with the default 3-field design
-- ---------------------------------------------------------------------------
UPDATE public.sticker_templates
   SET design = '{
     "business_name": {"enabled": true, "x": 6,  "y": 8,  "width": 88, "height": 40, "fontFamily": "helvetica", "fontSizePct": 22, "bold": true,  "color": "#111827", "align": "left",   "vAlign": "top",    "autoShrink": true,  "wrap2": true},
     "ticket_number": {"enabled": true, "x": 6,  "y": 50, "width": 88, "height": 18, "fontFamily": "helvetica", "fontSizePct": 13, "bold": false, "color": "#111827", "align": "left",   "vAlign": "middle", "autoShrink": false, "wrap2": false},
     "table_label":   {"enabled": true, "x": 6,  "y": 72, "width": 88, "height": 22, "fontFamily": "helvetica", "fontSizePct": 20, "bold": true,  "color": "#0d0d0f", "align": "center", "vAlign": "bottom", "autoShrink": false, "wrap2": false}
   }'::jsonb
 WHERE design IS NULL;

-- ---------------------------------------------------------------------------
-- 3. Default + NOT NULL for future rows
-- ---------------------------------------------------------------------------
ALTER TABLE public.sticker_templates
  ALTER COLUMN design SET DEFAULT '{
     "business_name": {"enabled": true, "x": 6,  "y": 8,  "width": 88, "height": 40, "fontFamily": "helvetica", "fontSizePct": 22, "bold": true,  "color": "#111827", "align": "left",   "vAlign": "top",    "autoShrink": true,  "wrap2": true},
     "ticket_number": {"enabled": true, "x": 6,  "y": 50, "width": 88, "height": 18, "fontFamily": "helvetica", "fontSizePct": 13, "bold": false, "color": "#111827", "align": "left",   "vAlign": "middle", "autoShrink": false, "wrap2": false},
     "table_label":   {"enabled": true, "x": 6,  "y": 72, "width": 88, "height": 22, "fontFamily": "helvetica", "fontSizePct": 20, "bold": true,  "color": "#0d0d0f", "align": "center", "vAlign": "bottom", "autoShrink": false, "wrap2": false}
   }'::jsonb;

ALTER TABLE public.sticker_templates
  ALTER COLUMN design SET NOT NULL;

-- ---------------------------------------------------------------------------
-- 4. Private storage bucket: sticker-assets
--
-- PUBLIC = false. No storage.objects policies are added on purpose: the browser
-- never talks to this bucket directly. Uploads, signed preview URLs and the PDF
-- bytes all go through super-admin-checked server routes using the service-role
-- client, which bypasses RLS. This keeps design images readable ONLY by super
-- admins and the PDF server.
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'storage' AND table_name = 'buckets'
  ) THEN
    INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
    VALUES (
      'sticker-assets',
      'sticker-assets',
      false,
      10485760, -- 10MB
      ARRAY['image/png', 'image/jpeg', 'image/jpg']
    )
    ON CONFLICT (id) DO UPDATE SET
      public = false,
      file_size_limit = 10485760,
      allowed_mime_types = ARRAY['image/png', 'image/jpeg', 'image/jpg'];
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    -- Storage schema may differ across environments; ignore if already handled.
    NULL;
END $$;

NOTIFY pgrst, 'reload schema';
