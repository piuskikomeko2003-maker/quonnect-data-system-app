-- Migration: Add concurrent-safe paid vendor registration function with advisory locking
--
-- Purpose: Ensures that even when 300+ paid vendors register simultaneously at the
-- exact same millisecond:
-- 1. Each single-use link is atomically checked and expired (FOR UPDATE lock)
-- 2. Ticket numbers are sequentially generated without race conditions or duplicates
--    using PostgreSQL transaction-level advisory locking per event edition.

CREATE OR REPLACE FUNCTION public.register_paid_vendor(
  p_token TEXT,
  p_edition_id UUID,
  p_phone TEXT,
  p_contact_name TEXT,
  p_business_name TEXT,
  p_category TEXT,
  p_email TEXT DEFAULT '',
  p_amount_paid NUMERIC DEFAULT 0,
  p_payment_status TEXT DEFAULT 'paid'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_link RECORD;
  v_vendor_id UUID;
  v_earlier_count INT;
  v_ticket_number INT;
  v_ticket_code TEXT;
  v_reg_id UUID;
  v_existing_reg RECORD;
  v_now TIMESTAMPTZ := now();
BEGIN
  -- 1. Atomic row-lock on the single-use form link to prevent concurrent double-use
  SELECT * INTO v_link
  FROM public.form_links
  WHERE token = p_token
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Invalid registration link.';
  END IF;

  IF v_link.expires_at IS NOT NULL AND v_link.expires_at <= v_now THEN
    RAISE EXCEPTION 'This registration link has already been used and is closed.';
  END IF;

  -- 2. Advisory lock on the edition to guarantee strict serial ordering of ticket numbers
  -- This prevents race conditions when 300+ requests arrive at the same millisecond!
  PERFORM pg_advisory_xact_lock(hashtext(p_edition_id::text));

  -- 3. Upsert vendor record
  SELECT id INTO v_vendor_id
  FROM public.vendors
  WHERE phone = p_phone
  LIMIT 1;

  IF v_vendor_id IS NOT NULL THEN
    UPDATE public.vendors
    SET
      contact_name = COALESCE(NULLIF(p_contact_name, ''), contact_name),
      business_name = COALESCE(NULLIF(p_business_name, ''), business_name),
      email = COALESCE(NULLIF(p_email, ''), email),
      category = COALESCE(NULLIF(p_category, ''), category),
      is_active = true
    WHERE id = v_vendor_id;
  ELSE
    INSERT INTO public.vendors (
      contact_name,
      business_name,
      phone,
      email,
      category,
      is_active
    ) VALUES (
      p_contact_name,
      COALESCE(NULLIF(p_business_name, ''), p_contact_name, 'Unknown Vendor'),
      p_phone,
      p_email,
      p_category,
      true
    ) RETURNING id INTO v_vendor_id;
  END IF;

  -- 4. Check if vendor already has a registration for this edition
  SELECT id, stall_number INTO v_existing_reg
  FROM public.vendor_registrations
  WHERE vendor_id = v_vendor_id AND market_day_id = p_edition_id
  LIMIT 1;

  IF v_existing_reg.id IS NOT NULL THEN
    v_reg_id := v_existing_reg.id;
    v_ticket_number := COALESCE(substring(v_existing_reg.stall_number from '\d+')::int, 1);
    v_ticket_code := lpad(v_ticket_number::text, 3, '0');
  ELSE
    -- Count existing registrations under the advisory lock (guaranteed atomic!)
    SELECT count(*) INTO v_earlier_count
    FROM public.vendor_registrations
    WHERE market_day_id = p_edition_id;

    v_ticket_number := v_earlier_count + 1;
    v_ticket_code := lpad(v_ticket_number::text, 3, '0');

    INSERT INTO public.vendor_registrations (
      market_day_id,
      vendor_id,
      amount_paid,
      payment_status,
      stall_number,
      notes
    ) VALUES (
      p_edition_id,
      v_vendor_id,
      p_amount_paid,
      p_payment_status,
      v_ticket_code,
      'Ticket #' || v_ticket_number
    ) RETURNING id INTO v_reg_id;
  END IF;

  -- 5. Mark the link as used / expired immediately
  UPDATE public.form_links
  SET
    expires_at = v_now
  WHERE token = p_token;

  -- 6. Return ticket details
  RETURN jsonb_build_object(
    'registration_id', v_reg_id,
    'vendor_id', v_vendor_id,
    'ticket_number', v_ticket_number,
    'ticket_code', v_ticket_code,
    'registered_at', v_now
  );
END;
$$;
