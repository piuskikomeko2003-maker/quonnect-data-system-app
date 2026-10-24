-- Migration: let regular admins print stickers
--
-- Printing (vendor list, batches, PDFs, confirmation) is an admin operation.
-- Sticker design/template editing stays super-admin only. The API enforces this
-- with requireAdmin vs requireSuperAdmin; these policies keep the database
-- rules aligned even though the routes use the service-role client.
--
-- Safe to run repeatedly.

-- Helper fallback if public.is_admin_or_super does not exist.
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

-- ---------------------------------------------------------------------------
-- 1. sticker_templates — admins may read the resolved design; only super
--    admins may create/update/delete presets.
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "Admins can read sticker_templates" ON public.sticker_templates;
CREATE POLICY "Admins can read sticker_templates"
  ON public.sticker_templates FOR SELECT
  TO authenticated
  USING (public.is_admin_or_super());

-- ---------------------------------------------------------------------------
-- 2. sticker_print_batches — admins may create, read and confirm batches.
--    Deleting the audit trail remains super-admin only.
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "Admins can read sticker_print_batches" ON public.sticker_print_batches;
CREATE POLICY "Admins can read sticker_print_batches"
  ON public.sticker_print_batches FOR SELECT
  TO authenticated
  USING (public.is_admin_or_super());

DROP POLICY IF EXISTS "Admins can create sticker_print_batches" ON public.sticker_print_batches;
CREATE POLICY "Admins can create sticker_print_batches"
  ON public.sticker_print_batches FOR INSERT
  TO authenticated
  WITH CHECK (public.is_admin_or_super());

DROP POLICY IF EXISTS "Admins can confirm sticker_print_batches" ON public.sticker_print_batches;
CREATE POLICY "Admins can confirm sticker_print_batches"
  ON public.sticker_print_batches FOR UPDATE
  TO authenticated
  USING (public.is_admin_or_super())
  WITH CHECK (public.is_admin_or_super());

NOTIFY pgrst, 'reload schema';
