-- Migration: void paid vendor registrations instead of hard-deleting them
--
-- Why: deleting a `vendor_registrations` row cascades to its `vendor_tickets`
-- rows, but the per-day / per-edition ticket counters never go backwards. The
-- used number then disappears from every list ("missing 005"), which looks like
-- a failed registration even though the vendor registered successfully.
--
-- This migration:
--   1. Adds void metadata to vendor_registrations.
--   2. Adds an append-only audit table for voids/restores.
--   3. Adds a function the server uses to void a registration atomically.
--   4. Blocks direct hard deletes of paid/voided registrations, so ticket
--      numbers stay explainable instead of silently turning into gaps.
--
-- Idempotent. Safe to re-run.

BEGIN;

-- ---------------------------------------------------------------------------
-- 1. Void metadata
-- ---------------------------------------------------------------------------

ALTER TABLE public.vendor_registrations
  ADD COLUMN IF NOT EXISTS voided_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS voided_by UUID,
  ADD COLUMN IF NOT EXISTS void_reason TEXT;

CREATE INDEX IF NOT EXISTS idx_vendor_registrations_voided
  ON public.vendor_registrations (market_day_id, voided_at);

-- ---------------------------------------------------------------------------
-- 2. Append-only audit log
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.vendor_registration_audit (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  registration_id UUID NOT NULL,
  market_day_id UUID,
  vendor_id UUID,
  action TEXT NOT NULL CHECK (action IN ('voided', 'restored')),
  reason TEXT,
  performed_by UUID,
  ticket_numbers JSONB NOT NULL DEFAULT '[]'::jsonb,
  snapshot JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_vendor_registration_audit_registration
  ON public.vendor_registration_audit (registration_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_vendor_registration_audit_edition
  ON public.vendor_registration_audit (market_day_id, created_at DESC);

ALTER TABLE public.vendor_registration_audit ENABLE ROW LEVEL SECURITY;

-- ---------------------------------------------------------------------------
-- 3. Audit trigger
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.audit_vendor_registration_void()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_tickets JSONB;
  v_actor UUID;
BEGIN
  IF NEW.payment_status IS NOT DISTINCT FROM OLD.payment_status
     AND NEW.voided_at IS NOT DISTINCT FROM OLD.voided_at THEN
    RETURN NEW;
  END IF;

  IF NEW.payment_status = 'voided' AND OLD.payment_status IS DISTINCT FROM 'voided' THEN
    NULL;
  ELSIF OLD.payment_status = 'voided' AND NEW.payment_status IS DISTINCT FROM 'voided' THEN
    NULL;
  ELSE
    RETURN NEW;
  END IF;

  SELECT COALESCE(
           jsonb_agg(
             jsonb_build_object(
               'ticket_id', id,
               'ticket_number', ticket_number,
               'ticket_code', ticket_code,
               'edition_day_id', edition_day_id,
               'tables', tables,
               'stickers_printed', stickers_printed
             )
             ORDER BY ticket_number
           ),
           '[]'::jsonb
         )
    INTO v_tickets
    FROM public.vendor_tickets
   WHERE registration_id = NEW.id;

  BEGIN
    v_actor := NULLIF(current_setting('app.actor_id', true), '')::UUID;
  EXCEPTION WHEN others THEN
    v_actor := NULL;
  END;

  INSERT INTO public.vendor_registration_audit
    (registration_id, market_day_id, vendor_id, action, reason, performed_by, ticket_numbers, snapshot)
  VALUES
    (NEW.id,
     NEW.market_day_id,
     NEW.vendor_id,
     CASE WHEN NEW.payment_status = 'voided' THEN 'voided' ELSE 'restored' END,
     NEW.void_reason,
     COALESCE(v_actor, NEW.voided_by),
     v_tickets,
     to_jsonb(NEW) || jsonb_build_object('tickets', v_tickets));

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_audit_vendor_registration_void ON public.vendor_registrations;
CREATE TRIGGER trg_audit_vendor_registration_void
  AFTER UPDATE OF payment_status, voided_at, void_reason ON public.vendor_registrations
  FOR EACH ROW
  EXECUTE FUNCTION public.audit_vendor_registration_void();

-- ---------------------------------------------------------------------------
-- 4. Server-only void function
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.void_vendor_registration(
  p_registration_id UUID,
  p_reason TEXT DEFAULT NULL,
  p_performed_by UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_reg public.vendor_registrations%rowtype;
  v_reason TEXT := NULLIF(btrim(COALESCE(p_reason, '')), '');
BEGIN
  SELECT * INTO v_reg
    FROM public.vendor_registrations
   WHERE id = p_registration_id
   FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Vendor registration not found.' USING ERRCODE = 'P0002';
  END IF;

  IF v_reg.payment_status = 'voided' THEN
    RETURN jsonb_build_object(
      'success', TRUE,
      'alreadyVoided', TRUE,
      'registration_id', v_reg.id,
      'voided_at', v_reg.voided_at
    );
  END IF;

  PERFORM set_config('app.actor_id', COALESCE(p_performed_by::TEXT, ''), TRUE);

  UPDATE public.vendor_registrations
     SET payment_status = 'voided',
         voided_at = now(),
         voided_by = p_performed_by,
         void_reason = v_reason,
         updated_at = now()
   WHERE id = p_registration_id;

  RETURN jsonb_build_object(
    'success', TRUE,
    'alreadyVoided', FALSE,
    'registration_id', p_registration_id,
    'voided_at', now()
  );
END;
$$;

REVOKE ALL ON FUNCTION public.void_vendor_registration(UUID, TEXT, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.void_vendor_registration(UUID, TEXT, UUID) TO service_role;

-- ---------------------------------------------------------------------------
-- 5. Block hard deletes of paid / voided registrations
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.prevent_paid_registration_hard_delete()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF OLD.payment_status IN ('paid', 'voided') THEN
    RAISE EXCEPTION
      'Paid vendor registrations cannot be deleted (registration %). Void it instead so its ticket numbers stay accountable.',
      OLD.id
      USING ERRCODE = 'P0001';
  END IF;
  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_paid_registration_hard_delete ON public.vendor_registrations;
CREATE TRIGGER trg_prevent_paid_registration_hard_delete
  BEFORE DELETE ON public.vendor_registrations
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_paid_registration_hard_delete();

-- ---------------------------------------------------------------------------
-- 6. Finance view must ignore voided revenue
-- ---------------------------------------------------------------------------

CREATE OR REPLACE VIEW public.edition_finance_summaries AS
SELECT
  m.id AS market_day_id,
  m.region_id,
  m.name AS edition_name,
  m.edition AS edition_title,
  m.event_date,
  m.status AS edition_status,
  COALESCE(vr.vendor_revenue, 0)::numeric AS vendor_revenue,
  COALESCE(fi.other_income, 0)::numeric AS other_income,
  (COALESCE(vr.vendor_revenue, 0) + COALESCE(fi.other_income, 0))::numeric AS total_revenue,
  COALESCE(fe.total_expenses, 0)::numeric AS total_expenses,
  ((COALESCE(vr.vendor_revenue, 0) + COALESCE(fi.other_income, 0)) - COALESCE(fe.total_expenses, 0))::numeric AS net_balance,
  CASE
    WHEN (COALESCE(vr.vendor_revenue, 0) + COALESCE(fi.other_income, 0)) > 0
    THEN ROUND((COALESCE(fe.total_expenses, 0) / (COALESCE(vr.vendor_revenue, 0) + COALESCE(fi.other_income, 0)) * 100)::numeric, 2)
    ELSE NULL
  END AS spend_rate_pct
FROM public.market_days m
LEFT JOIN (
  SELECT market_day_id, SUM(amount_paid) AS vendor_revenue
  FROM public.vendor_registrations
  WHERE amount_paid IS NOT NULL AND amount_paid > 0
    AND payment_status <> 'voided'
  GROUP BY market_day_id
) vr ON vr.market_day_id = m.id
LEFT JOIN (
  SELECT market_day_id, SUM(amount) AS other_income
  FROM public.finance_incomes
  GROUP BY market_day_id
) fi ON fi.market_day_id = m.id
LEFT JOIN (
  SELECT market_day_id, SUM(amount) AS total_expenses
  FROM public.finance_expenses
  GROUP BY market_day_id
) fe ON fe.market_day_id = m.id;

NOTIFY pgrst, 'reload schema';

COMMIT;
