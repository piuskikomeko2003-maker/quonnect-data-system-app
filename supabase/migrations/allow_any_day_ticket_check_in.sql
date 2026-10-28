-- Remove the "ticket can only be checked in on its own day" rule.
--
-- The day-of restriction was risky at the gate: if anything misbehaved on the
-- day itself (timezone drift, late setup, a clock issue), staff had no way to
-- mark entry and no time to fix it. Entry marks are now allowed for any day of
-- the edition at any time. Undo (p_check_in = false) was always allowed.
--
-- Run this on any database that already applied add_multi_day_editions.sql.

CREATE OR REPLACE FUNCTION public.check_in_vendor_ticket(
  p_ticket_id UUID,
  p_check_in BOOLEAN
)
RETURNS TABLE(
  ticket_id UUID,
  check_in_time TIMESTAMPTZ,
  edition_day_id UUID,
  event_date DATE
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_ticket public.vendor_tickets%rowtype;
  v_day public.edition_days%rowtype;
  v_time TIMESTAMPTZ;
BEGIN
  -- Approved staff can call directly; the API route calls with the service
  -- role after verifying an approved cookie session.
  IF NOT (
    public.is_approved_user()
    OR COALESCE(current_setting('request.jwt.claims', true)::jsonb->>'role', '') = 'service_role'
  ) THEN
    RAISE EXCEPTION 'Insufficient permissions' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_ticket FROM public.vendor_tickets WHERE id = p_ticket_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Ticket not found' USING ERRCODE = 'P0001';
  END IF;

  SELECT * INTO v_day FROM public.edition_days WHERE id = v_ticket.edition_day_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Edition day not found' USING ERRCODE = 'P0001';
  END IF;

  -- No day-of check: any day's ticket may be marked at any time.

  v_time := CASE WHEN p_check_in THEN now() ELSE NULL END;

  UPDATE public.vendor_tickets
     SET check_in_time = v_time,
         check_out_time = CASE WHEN p_check_in THEN NULL ELSE check_out_time END
   WHERE id = p_ticket_id;

  RETURN QUERY SELECT v_ticket.id, v_time, v_ticket.edition_day_id, v_day.event_date;
END;
$$;

GRANT EXECUTE ON FUNCTION public.check_in_vendor_ticket(UUID, BOOLEAN)
  TO authenticated, service_role;
