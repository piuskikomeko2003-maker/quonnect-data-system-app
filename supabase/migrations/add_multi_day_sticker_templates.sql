-- Migration: Per-day sticker templates and per-day sticker progress
--
-- Each day of an edition can own its own sticker design. Resolution order:
--   day template -> edition fallback template -> global active template.
--
-- Sticker printing can be generated per day. Each ticket row keeps its own
-- `stickers_printed` counter so printing Day 1 does not mark Day 2 as done.
--
-- Backwards compatible:
--   * Existing edition templates (edition_day_id IS NULL) stay as fallbacks.
--   * Existing registration-level `stickers_printed` is copied onto each
--     registration's Day 1 ticket, preserving current print progress.
--   * Batches without `edition_day_id` keep using registration-level counts.
--
-- Idempotent. Safe to re-run.

-- ---------------------------------------------------------------------------
-- 1. Day-scoped sticker templates
-- ---------------------------------------------------------------------------

ALTER TABLE public.sticker_templates
  ADD COLUMN IF NOT EXISTS edition_day_id UUID REFERENCES public.edition_days(id) ON DELETE CASCADE;

-- The old unique rule was one template per edition. That must become
-- "one edition fallback + one template per day".
DROP INDEX IF EXISTS public.uq_sticker_templates_edition;

CREATE UNIQUE INDEX IF NOT EXISTS uq_sticker_templates_edition_fallback
  ON public.sticker_templates (edition_id)
  WHERE edition_id IS NOT NULL AND edition_day_id IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_sticker_templates_edition_day
  ON public.sticker_templates (edition_day_id)
  WHERE edition_day_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_sticker_templates_edition_day
  ON public.sticker_templates (edition_day_id);

-- ---------------------------------------------------------------------------
-- 2. Per-day ticket sticker progress
-- ---------------------------------------------------------------------------

ALTER TABLE public.vendor_tickets
  ADD COLUMN IF NOT EXISTS stickers_printed INTEGER NOT NULL DEFAULT 0;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'vendor_tickets_stickers_printed_check'
  ) THEN
    ALTER TABLE public.vendor_tickets
      ADD CONSTRAINT vendor_tickets_stickers_printed_check
      CHECK (stickers_printed >= 0);
  END IF;
END $$;

-- Preserve existing edition-level progress on each registration's Day 1 ticket.
UPDATE public.vendor_tickets vt
   SET stickers_printed = GREATEST(0, COALESCE(vr.stickers_printed, 0))
  FROM public.vendor_registrations vr
  JOIN public.edition_days ed
    ON ed.edition_id = vr.market_day_id AND ed.day_number = 1
 WHERE vt.registration_id = vr.id
   AND vt.edition_day_id = ed.id
   AND vt.stickers_printed = 0
   AND COALESCE(vr.stickers_printed, 0) > 0;

-- Browser writes are already blocked by RLS (no UPDATE policy). This guard
-- keeps the count trustworthy even if a policy is added later.
CREATE OR REPLACE FUNCTION public.enforce_ticket_stickers_printed_server_only()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NEW.stickers_printed IS DISTINCT FROM OLD.stickers_printed
     AND current_user NOT IN ('service_role', 'postgres', 'supabase_admin') THEN
    RAISE EXCEPTION 'stickers_printed can only be changed by the server'
      USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_ticket_stickers_printed_server_only ON public.vendor_tickets;
CREATE TRIGGER trg_enforce_ticket_stickers_printed_server_only
  BEFORE UPDATE ON public.vendor_tickets
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_ticket_stickers_printed_server_only();

-- ---------------------------------------------------------------------------
-- 3. Batches remember which day they belong to
-- ---------------------------------------------------------------------------

ALTER TABLE public.sticker_print_batches
  ADD COLUMN IF NOT EXISTS edition_day_id UUID REFERENCES public.edition_days(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_sticker_print_batches_edition_day
  ON public.sticker_print_batches (market_day_id, edition_day_id, created_at DESC);

NOTIFY pgrst, 'reload schema';
