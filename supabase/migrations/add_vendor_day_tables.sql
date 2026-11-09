-- Migration: Track tables per paid day, not per registration
--
-- A multi-day edition may sell different table counts on different days:
--   Day 1: 2 tables
--   Day 2: 3 tables
--
-- The per-day ticket row (`vendor_tickets`) is the source of truth. Its new
-- `tables` column says how many tables the vendor owns on that specific day.
--
-- Backwards compatibility:
--   * Existing day tickets inherit the old registration-level `tables` count,
--     which matches what the app displayed/printed before this migration.
--   * `vendor_registrations.tables` stays populated as a legacy mirror of the
--     registration's first owned day, so single-day editions and older
--     clients keep working. A trigger keeps the mirror in sync automatically.
--   * Single-day editions therefore behave exactly as before.
--
-- Idempotent and safe to re-run.

-- ---------------------------------------------------------------------------
-- 1. Per-day table count
-- ---------------------------------------------------------------------------

ALTER TABLE public.vendor_tickets
  ADD COLUMN IF NOT EXISTS tables INTEGER NOT NULL DEFAULT 1;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'vendor_tickets_tables_check'
  ) THEN
    ALTER TABLE public.vendor_tickets
      ADD CONSTRAINT vendor_tickets_tables_check
      CHECK (tables >= 1 AND tables <= 5);
  END IF;
END $$;

-- Backfill every existing day ticket from its registration. Before this
-- migration the registration count applied to every day the vendor owned.
UPDATE public.vendor_tickets vt
   SET tables = GREATEST(1, LEAST(5, COALESCE(vr.tables, 1)))
  FROM public.vendor_registrations vr
 WHERE vt.registration_id = vr.id
   AND COALESCE(vr.tables, 1) <> 1
   AND vt.tables = 1;

-- ---------------------------------------------------------------------------
-- 2. Keep the legacy registration mirror in sync
--
-- The "primary" day is the lowest-numbered day the registration owns. This is
-- the safest mirror for legacy code that assumes a single tables number.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.sync_registration_tables_from_primary_ticket()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_registration_id UUID;
  v_tables INTEGER;
BEGIN
  v_registration_id := COALESCE(NEW.registration_id, OLD.registration_id);

  SELECT vt.tables
    INTO v_tables
    FROM public.vendor_tickets vt
    JOIN public.edition_days ed ON ed.id = vt.edition_day_id
   WHERE vt.registration_id = v_registration_id
   ORDER BY ed.day_number
   LIMIT 1;

  UPDATE public.vendor_registrations vr
     SET tables = COALESCE(v_tables, 1),
         tables_updated_at = now()
   WHERE vr.id = v_registration_id
     AND vr.tables IS DISTINCT FROM COALESCE(v_tables, 1);

  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_registration_tables_from_primary_ticket ON public.vendor_tickets;
CREATE TRIGGER trg_sync_registration_tables_from_primary_ticket
  AFTER INSERT OR UPDATE OF tables OR DELETE ON public.vendor_tickets
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_registration_tables_from_primary_ticket();

-- Refresh the mirror for any rows whose ticket counts already differ.
UPDATE public.vendor_registrations vr
   SET tables = COALESCE((
        SELECT vt.tables
          FROM public.vendor_tickets vt
          JOIN public.edition_days ed ON ed.id = vt.edition_day_id
         WHERE vt.registration_id = vr.id
         ORDER BY ed.day_number
         LIMIT 1
       ), 1),
       tables_updated_at = now()
 WHERE EXISTS (
   SELECT 1 FROM public.vendor_tickets vt
   WHERE vt.registration_id = vr.id
 )
   AND vr.tables IS DISTINCT FROM COALESCE((
        SELECT vt.tables
          FROM public.vendor_tickets vt
          JOIN public.edition_days ed ON ed.id = vt.edition_day_id
         WHERE vt.registration_id = vr.id
         ORDER BY ed.day_number
         LIMIT 1
       ), 1);

-- The API writes with the service role, which bypasses RLS. This trigger is a
-- last line of defence if a browser-side UPDATE policy is ever added.
CREATE OR REPLACE FUNCTION public.enforce_ticket_tables_server_only()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NEW.tables IS DISTINCT FROM OLD.tables
     AND current_user NOT IN ('service_role', 'postgres', 'supabase_admin') THEN
    RAISE EXCEPTION 'tables can only be changed through the admin API'
      USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_ticket_tables_server_only ON public.vendor_tickets;
CREATE TRIGGER trg_enforce_ticket_tables_server_only
  BEFORE UPDATE ON public.vendor_tickets
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_ticket_tables_server_only();

NOTIFY pgrst, 'reload schema';
