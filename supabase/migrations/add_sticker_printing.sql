-- Migration: Sticker printing (super-admin only)
--
-- Adds table-number stickers for paid vendors. A vendor's `tables` count (already
-- added by add_vendor_tables.sql, 1..5) is the single source of truth for how many
-- stickers they need. `stickers_printed` records how many have been completed.
-- Remaining = tables - stickers_printed.
--
-- Safe to run on existing data: `stickers_printed` backfills to 0 (DEFAULT), the
-- new tables are created empty, and the two templates are seeded once. Idempotent.

-- ---------------------------------------------------------------------------
-- 1. Progress column on paid vendor registrations
-- ---------------------------------------------------------------------------
ALTER TABLE public.vendor_registrations
  ADD COLUMN IF NOT EXISTS stickers_printed INTEGER NOT NULL DEFAULT 0;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'vendor_registrations_stickers_printed_check'
  ) THEN
    ALTER TABLE public.vendor_registrations
      ADD CONSTRAINT vendor_registrations_stickers_printed_check
      CHECK (stickers_printed >= 0);
  END IF;
END $$;

-- Backfill any pre-existing rows that bypassed the DEFAULT.
UPDATE public.vendor_registrations
   SET stickers_printed = 0
 WHERE stickers_printed IS NULL;

-- ---------------------------------------------------------------------------
-- 2. Super-admin helper for RLS (mirrors public.is_admin_or_super())
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.is_super_admin()
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.user_profiles
    WHERE user_id = auth.uid()
    AND role = 'super_admin'
  );
$function$;

-- ---------------------------------------------------------------------------
-- 3. Column guard: `stickers_printed` may only be changed by the server
--
-- The `vendor_registrations` table keeps its existing permissive UPDATE policy
-- (the gate check-in flow writes check_in_time straight from the browser). To
-- keep the *printed count* trustworthy, this trigger rejects any change to
-- stickers_printed unless the write comes from the service-role server client
-- used by the super-admin-checked API routes. The browser (anon/authenticated)
-- is therefore unable to edit the count directly.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.enforce_stickers_printed_server_only()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.stickers_printed IS DISTINCT FROM OLD.stickers_printed
     AND current_user NOT IN ('service_role', 'postgres', 'supabase_admin') THEN
    RAISE EXCEPTION 'stickers_printed can only be changed by the server'
      USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_enforce_stickers_printed_server_only ON public.vendor_registrations;
CREATE TRIGGER trg_enforce_stickers_printed_server_only
  BEFORE UPDATE ON public.vendor_registrations
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_stickers_printed_server_only();

-- ---------------------------------------------------------------------------
-- 4. sticker_templates — editable layout settings, one row per preset
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.sticker_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  preset_key TEXT NOT NULL UNIQUE,
  preset_name TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT false,
  page_width_mm NUMERIC NOT NULL DEFAULT 210,
  page_height_mm NUMERIC NOT NULL DEFAULT 297,
  columns INTEGER NOT NULL DEFAULT 3 CHECK (columns >= 1),
  rows INTEGER NOT NULL DEFAULT 10 CHECK (rows >= 1),
  sticker_width_mm NUMERIC NOT NULL DEFAULT 70,
  sticker_height_mm NUMERIC NOT NULL DEFAULT 25,
  margin_top_mm NUMERIC NOT NULL DEFAULT 10,
  margin_left_mm NUMERIC NOT NULL DEFAULT 10,
  gap_x_mm NUMERIC NOT NULL DEFAULT 0,
  gap_y_mm NUMERIC NOT NULL DEFAULT 0,
  inner_padding_mm NUMERIC NOT NULL DEFAULT 2,
  cut_lines BOOLEAN NOT NULL DEFAULT true,
  business_font_size NUMERIC NOT NULL DEFAULT 12,
  ticket_font_size NUMERIC NOT NULL DEFAULT 10,
  table_font_size NUMERIC NOT NULL DEFAULT 16,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Only one preset may be active at a time.
CREATE UNIQUE INDEX IF NOT EXISTS uq_sticker_templates_single_active
  ON public.sticker_templates (is_active)
  WHERE is_active = true;

-- Seed the two switchable presets. Same grid defaults (3 x 10, 70 x 25 mm);
-- only the cut-line behaviour differs out of the box.
INSERT INTO public.sticker_templates (
  preset_key, preset_name, is_active,
  columns, rows, sticker_width_mm, sticker_height_mm,
  margin_top_mm, margin_left_mm, gap_x_mm, gap_y_mm,
  inner_padding_mm, cut_lines,
  business_font_size, ticket_font_size, table_font_size
) VALUES
  ('precut_label', 'Pre-cut label sheet', true, 3, 10, 70, 25, 10, 10, 0, 0, 2, false, 12, 10, 16),
  ('plain_paper',  'Plain paper',         false, 3, 10, 70, 25, 10, 10, 0, 0, 2, true,  12, 10, 16)
ON CONFLICT (preset_key) DO NOTHING;

CREATE OR REPLACE FUNCTION public.set_sticker_templates_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_sticker_templates_updated_at ON public.sticker_templates;
CREATE TRIGGER trg_sticker_templates_updated_at
  BEFORE UPDATE ON public.sticker_templates
  FOR EACH ROW
  EXECUTE FUNCTION public.set_sticker_templates_updated_at();

-- ---------------------------------------------------------------------------
-- 5. sticker_print_batches — audit trail of every generated batch
--
-- `items` is the list of stickers in the batch, grouped per vendor:
--   [ { registration_id: uuid, table_numbers: [1, 2] }, ... ]
-- A batch is created when the PDF is generated (unconfirmed) and only updates
-- `stickers_printed` once the super admin confirms it printed. `kind` records
-- whether the batch was a normal print or a reprint (reprints never change counts).
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.sticker_print_batches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  market_day_id UUID REFERENCES public.market_days(id) ON DELETE SET NULL,
  kind TEXT NOT NULL DEFAULT 'print' CHECK (kind IN ('print', 'reprint')),
  sticker_count INTEGER NOT NULL DEFAULT 0 CHECK (sticker_count >= 0),
  start_position INTEGER NOT NULL DEFAULT 1 CHECK (start_position >= 1),
  template_id UUID REFERENCES public.sticker_templates(id) ON DELETE SET NULL,
  items JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  confirmed_at TIMESTAMPTZ,
  confirmed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL
);

-- Forward-compatible for databases where the table already existed without
-- the reproducability columns.
ALTER TABLE public.sticker_print_batches
  ADD COLUMN IF NOT EXISTS start_position INTEGER NOT NULL DEFAULT 1;
ALTER TABLE public.sticker_print_batches
  ADD COLUMN IF NOT EXISTS template_id UUID REFERENCES public.sticker_templates(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_sticker_print_batches_market_day
  ON public.sticker_print_batches (market_day_id, created_at DESC);

-- ---------------------------------------------------------------------------
-- 6. Row Level Security — super admins only
-- ---------------------------------------------------------------------------
ALTER TABLE public.sticker_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sticker_print_batches ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Super admins manage sticker_templates" ON public.sticker_templates;
CREATE POLICY "Super admins manage sticker_templates"
  ON public.sticker_templates FOR ALL
  TO authenticated
  USING (public.is_super_admin())
  WITH CHECK (public.is_super_admin());

DROP POLICY IF EXISTS "Super admins manage sticker_print_batches" ON public.sticker_print_batches;
CREATE POLICY "Super admins manage sticker_print_batches"
  ON public.sticker_print_batches FOR ALL
  TO authenticated
  USING (public.is_super_admin())
  WITH CHECK (public.is_super_admin());

-- Defense in depth: RLS with no matching policy already denies non-super-admins;
-- these explicit policies make the intent readable in the schema.

NOTIFY pgrst, 'reload schema';
