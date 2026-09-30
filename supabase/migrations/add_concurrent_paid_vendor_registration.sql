-- Migration: Atomic, idempotent paid-vendor ticket issuance
--
-- Guarantees that even when 500+ vendors register simultaneously across many
-- editions/regions:
--   1. Each single-use link is validated and consumed atomically (FOR UPDATE).
--   2. Ticket numbers are unique and strictly sequential per edition via a
--      transaction-level advisory lock + monotonic counter.
--   3. Re-submitting an already-registered vendor returns their original ticket
--      (idempotent) instead of creating a duplicate.
--
-- The application calls both functions via PostgREST RPC.

-- 1. Link-based registration (public single-use links)
CREATE OR REPLACE FUNCTION public.register_paid_vendor(
  p_token TEXT,
  p_edition_id UUID,
  p_phone TEXT,
  p_contact_name TEXT,
  p_business_name TEXT,
  p_category TEXT,
  p_email TEXT,
  p_amount_paid NUMERIC,
  p_payment_status TEXT
)
RETURNS TABLE(ticket_number INTEGER, ticket_code TEXT, registered_at TIMESTAMPTZ)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_link           public.form_links%rowtype;
  v_vendor_id      UUID;
  v_existing       public.vendor_registrations%rowtype;
  v_ticket_number  INTEGER;
  v_ticket_code    TEXT;
  v_now            TIMESTAMPTZ := now();
  v_phone          TEXT := NULLIF(btrim(COALESCE(p_phone, '')), '');
BEGIN
  IF p_token IS NULL OR btrim(p_token) = '' THEN
    RAISE EXCEPTION 'Invalid registration link.' USING errcode = 'P0001';
  END IF;
  IF p_edition_id IS NULL THEN
    RAISE EXCEPTION 'Missing event edition.' USING errcode = 'P0001';
  END IF;
  IF v_phone IS NULL THEN
    RAISE EXCEPTION 'Phone number is required.' USING errcode = 'P0001';
  END IF;

  -- Per-edition advisory lock. Editions in different regions never contend.
  PERFORM pg_advisory_xact_lock(hashtext('register_paid_vendor'), hashtext(p_edition_id::text));

  SELECT * INTO v_link FROM public.form_links WHERE token = p_token FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Invalid registration link.' USING errcode = 'P0001';
  END IF;
  IF v_link.form_slug <> 'paid_vendor_registration' THEN
    RAISE EXCEPTION 'Invalid registration link.' USING errcode = 'P0001';
  END IF;

  SELECT id INTO v_vendor_id FROM public.vendors WHERE phone = v_phone LIMIT 1;
  IF v_vendor_id IS NULL THEN
    INSERT INTO public.vendors (business_name, contact_name, phone, email, category, is_active)
    VALUES (
      COALESCE(NULLIF(btrim(COALESCE(p_business_name, '')), ''),
               NULLIF(btrim(COALESCE(p_contact_name, '')), ''),
               'Unknown Vendor'),
      NULLIF(btrim(COALESCE(p_contact_name, '')), ''),
      v_phone,
      NULLIF(btrim(COALESCE(p_email, '')), ''),
      NULLIF(btrim(COALESCE(p_category, '')), ''),
      true
    )
    RETURNING id INTO v_vendor_id;
  ELSE
    UPDATE public.vendors
       SET business_name = COALESCE(NULLIF(btrim(COALESCE(p_business_name, '')), ''), business_name),
           contact_name  = COALESCE(NULLIF(btrim(COALESCE(p_contact_name, '')), ''), contact_name),
           email         = COALESCE(NULLIF(btrim(COALESCE(p_email, '')), ''), email),
           category      = COALESCE(NULLIF(btrim(COALESCE(p_category, '')), ''), category),
           is_active     = true
     WHERE id = v_vendor_id;
  END IF;

  -- Idempotency: return the existing ticket if this vendor already registered.
  SELECT * INTO v_existing
    FROM public.vendor_registrations
   WHERE market_day_id = p_edition_id AND vendor_id = v_vendor_id
   LIMIT 1;

  IF FOUND THEN
    v_ticket_number := v_existing.ticket_number;
    IF v_ticket_number IS NULL AND v_existing.stall_number ~ '^[0-9]+$' THEN
      v_ticket_number := v_existing.stall_number::int;
    END IF;
    IF v_ticket_number IS NULL THEN
      INSERT INTO public.edition_ticket_counters (edition_id, last_number)
      VALUES (p_edition_id, 1)
      ON CONFLICT (edition_id) DO UPDATE
        SET last_number = public.edition_ticket_counters.last_number + 1,
            updated_at = now()
      RETURNING last_number INTO v_ticket_number;

      UPDATE public.vendor_registrations vr
         SET ticket_number = v_ticket_number,
             stall_number  = COALESCE(NULLIF(vr.stall_number, ''), lpad(v_ticket_number::text, 3, '0'))
       WHERE vr.id = v_existing.id;
    END IF;

    v_ticket_code := lpad(v_ticket_number::text, 3, '0');

    UPDATE public.form_links fl
       SET used_at           = COALESCE(fl.used_at, v_now),
           ticket_number     = COALESCE(fl.ticket_number, v_ticket_code),
           used_by_vendor_id = COALESCE(fl.used_by_vendor_id, v_vendor_id)
     WHERE fl.token = p_token;

    RETURN QUERY SELECT v_ticket_number, v_ticket_code, COALESCE(v_existing.created_at, v_now);
    RETURN;
  END IF;

  -- New registration: enforce single-use only after the idempotency check.
  IF v_link.expires_at IS NOT NULL AND v_link.expires_at <= v_now THEN
    RAISE EXCEPTION 'This registration link has already been used and is closed.' USING errcode = 'P0001';
  END IF;

  INSERT INTO public.edition_ticket_counters (edition_id, last_number)
  VALUES (p_edition_id, 1)
  ON CONFLICT (edition_id) DO UPDATE
    SET last_number = public.edition_ticket_counters.last_number + 1,
        updated_at = now()
  RETURNING last_number INTO v_ticket_number;

  v_ticket_code := lpad(v_ticket_number::text, 3, '0');

  BEGIN
    INSERT INTO public.vendor_registrations
      (market_day_id, vendor_id, amount_paid, payment_status, stall_number, ticket_number, notes)
    VALUES
      (p_edition_id, v_vendor_id, COALESCE(p_amount_paid, 0),
       COALESCE(NULLIF(btrim(COALESCE(p_payment_status, '')), ''), 'paid'),
       v_ticket_code, v_ticket_number, 'Ticket #' || v_ticket_number);
  EXCEPTION WHEN unique_violation THEN
    SELECT * INTO v_existing
      FROM public.vendor_registrations
     WHERE market_day_id = p_edition_id AND vendor_id = v_vendor_id
     LIMIT 1;
    v_ticket_number := COALESCE(
      v_existing.ticket_number,
      NULLIF(regexp_replace(v_existing.stall_number, '\D', '', 'g'), '')::int
    );
    v_ticket_code := lpad(v_ticket_number::text, 3, '0');
    RETURN QUERY SELECT v_ticket_number, v_ticket_code, COALESCE(v_existing.created_at, v_now);
    RETURN;
  END;

  UPDATE public.form_links fl
     SET expires_at        = v_now,
         used_at           = COALESCE(fl.used_at, v_now),
         ticket_number     = v_ticket_code,
         used_by_vendor_id = v_vendor_id
   WHERE fl.token = p_token;

  RETURN QUERY SELECT v_ticket_number, v_ticket_code, v_now;
END;
$$;

-- 2. Admin/desk registration (no token required, same atomic allocator)
CREATE OR REPLACE FUNCTION public.register_paid_vendor_admin(
  p_edition_id UUID,
  p_phone TEXT,
  p_contact_name TEXT,
  p_business_name TEXT,
  p_category TEXT,
  p_email TEXT,
  p_amount_paid NUMERIC,
  p_payment_status TEXT
)
RETURNS TABLE(ticket_number INTEGER, ticket_code TEXT, registered_at TIMESTAMPTZ)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_vendor_id      UUID;
  v_existing       public.vendor_registrations%rowtype;
  v_ticket_number  INTEGER;
  v_ticket_code    TEXT;
  v_now            TIMESTAMPTZ := now();
  v_phone          TEXT := NULLIF(btrim(COALESCE(p_phone, '')), '');
BEGIN
  IF p_edition_id IS NULL THEN
    RAISE EXCEPTION 'Missing event edition.' USING errcode = 'P0001';
  END IF;
  IF v_phone IS NULL THEN
    RAISE EXCEPTION 'Phone number is required.' USING errcode = 'P0001';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtext('register_paid_vendor'), hashtext(p_edition_id::text));

  SELECT id INTO v_vendor_id FROM public.vendors WHERE phone = v_phone LIMIT 1;
  IF v_vendor_id IS NULL THEN
    INSERT INTO public.vendors (business_name, contact_name, phone, email, category, is_active)
    VALUES (
      COALESCE(NULLIF(btrim(COALESCE(p_business_name, '')), ''),
               NULLIF(btrim(COALESCE(p_contact_name, '')), ''),
               'Unknown Vendor'),
      NULLIF(btrim(COALESCE(p_contact_name, '')), ''),
      v_phone,
      NULLIF(btrim(COALESCE(p_email, '')), ''),
      NULLIF(btrim(COALESCE(p_category, '')), ''),
      true
    )
    RETURNING id INTO v_vendor_id;
  ELSE
    UPDATE public.vendors v
       SET business_name = COALESCE(NULLIF(btrim(COALESCE(p_business_name, '')), ''), v.business_name),
           contact_name  = COALESCE(NULLIF(btrim(COALESCE(p_contact_name, '')), ''), v.contact_name),
           email         = COALESCE(NULLIF(btrim(COALESCE(p_email, '')), ''), v.email),
           category      = COALESCE(NULLIF(btrim(COALESCE(p_category, '')), ''), v.category),
           is_active     = true
     WHERE v.id = v_vendor_id;
  END IF;

  SELECT * INTO v_existing
    FROM public.vendor_registrations
   WHERE market_day_id = p_edition_id AND vendor_id = v_vendor_id
   LIMIT 1;

  IF FOUND THEN
    UPDATE public.vendor_registrations vr
       SET amount_paid    = COALESCE(p_amount_paid, vr.amount_paid),
           payment_status = COALESCE(NULLIF(btrim(COALESCE(p_payment_status, '')), ''), vr.payment_status)
     WHERE vr.id = v_existing.id;

    v_ticket_number := COALESCE(
      v_existing.ticket_number,
      NULLIF(regexp_replace(v_existing.stall_number, '\D', '', 'g'), '')::int
    );
    IF v_ticket_number IS NULL THEN
      INSERT INTO public.edition_ticket_counters (edition_id, last_number)
      VALUES (p_edition_id, 1)
      ON CONFLICT (edition_id) DO UPDATE
        SET last_number = public.edition_ticket_counters.last_number + 1,
            updated_at = now()
      RETURNING last_number INTO v_ticket_number;

      UPDATE public.vendor_registrations vr
         SET ticket_number = v_ticket_number,
             stall_number  = COALESCE(NULLIF(vr.stall_number, ''), lpad(v_ticket_number::text, 3, '0'))
       WHERE vr.id = v_existing.id;
    END IF;

    v_ticket_code := lpad(v_ticket_number::text, 3, '0');
    RETURN QUERY SELECT v_ticket_number, v_ticket_code, COALESCE(v_existing.created_at, v_now);
    RETURN;
  END IF;

  INSERT INTO public.edition_ticket_counters (edition_id, last_number)
  VALUES (p_edition_id, 1)
  ON CONFLICT (edition_id) DO UPDATE
    SET last_number = public.edition_ticket_counters.last_number + 1,
        updated_at = now()
  RETURNING last_number INTO v_ticket_number;

  v_ticket_code := lpad(v_ticket_number::text, 3, '0');

  BEGIN
    INSERT INTO public.vendor_registrations
      (market_day_id, vendor_id, amount_paid, payment_status, stall_number, ticket_number, notes)
    VALUES
      (p_edition_id, v_vendor_id, COALESCE(p_amount_paid, 0),
       COALESCE(NULLIF(btrim(COALESCE(p_payment_status, '')), ''), 'paid'),
       v_ticket_code, v_ticket_number, 'Ticket #' || v_ticket_number);
  EXCEPTION WHEN unique_violation THEN
    SELECT * INTO v_existing
      FROM public.vendor_registrations
     WHERE market_day_id = p_edition_id AND vendor_id = v_vendor_id
     LIMIT 1;
    v_ticket_number := COALESCE(
      v_existing.ticket_number,
      NULLIF(regexp_replace(v_existing.stall_number, '\D', '', 'g'), '')::int
    );
    v_ticket_code := lpad(v_ticket_number::text, 3, '0');
    RETURN QUERY SELECT v_ticket_number, v_ticket_code, COALESCE(v_existing.created_at, v_now);
    RETURN;
  END;

  RETURN QUERY SELECT v_ticket_number, v_ticket_code, v_now;
END;
$$;

-- 3. Public single-use links must be redeemable by the public client.
GRANT EXECUTE ON FUNCTION public.register_paid_vendor(
  TEXT, UUID, TEXT, TEXT, TEXT, TEXT, TEXT, NUMERIC, TEXT
) TO anon, authenticated, service_role;

GRANT EXECUTE ON FUNCTION public.register_paid_vendor_admin(
  UUID, TEXT, TEXT, TEXT, TEXT, TEXT, NUMERIC, TEXT
) TO anon, authenticated, service_role;
