-- Migration: Multi-day market day editions
--
-- An edition (`market_days`) can now contain any number of days. Each day has
-- its own date, fee, optional ticket template, ticket counter and ticket
-- numbers. A vendor still has ONE registration row per edition, but may own
-- one ticket row per day they paid for.
--
-- Backwards compatibility:
--   * Every existing edition is backfilled with a single Day 1.
--   * Every existing registration with a ticket is backfilled into vendor_tickets.
--   * Existing RPC signatures are preserved as wrappers over the new allocator.
--   * Legacy `vendor_registrations.ticket_number` is still populated for Day 1,
--     so the current paid vendor list, exports and sticker printing keep working.
--
-- Additive and idempotent. Run in the Supabase SQL editor (or supabase db push).

-- ---------------------------------------------------------------------------
-- 0. Compatibility columns
--
-- These are defined by earlier migrations in the repo, but this live database
-- was created through the dashboard and does not have all of them yet.
-- ---------------------------------------------------------------------------

ALTER TABLE public.market_days
  ADD COLUMN IF NOT EXISTS standard_fee NUMERIC DEFAULT 0;

ALTER TABLE public.vendor_registrations
  ADD COLUMN IF NOT EXISTS fee_source TEXT DEFAULT 'standard';

ALTER TABLE public.vendor_registrations
  ADD COLUMN IF NOT EXISTS check_out_time TIMESTAMPTZ;

-- ---------------------------------------------------------------------------
-- 1. Edition days
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.edition_days (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  edition_id UUID NOT NULL REFERENCES public.market_days(id) ON DELETE CASCADE,
  day_number INTEGER NOT NULL CHECK (day_number >= 1),
  event_date DATE NOT NULL,
  fee NUMERIC(12,2) NOT NULL DEFAULT 0,
  label TEXT,
  ticket_template_id UUID REFERENCES public.ticket_templates(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT edition_days_edition_day_number_key UNIQUE (edition_id, day_number)
);

CREATE INDEX IF NOT EXISTS idx_edition_days_edition
  ON public.edition_days (edition_id, day_number);

CREATE INDEX IF NOT EXISTS idx_edition_days_date
  ON public.edition_days (event_date);

-- Backfill Day 1 for every existing edition.
INSERT INTO public.edition_days (edition_id, day_number, event_date, fee, label)
SELECT
  md.id,
  1,
  COALESCE(md.event_date, md.created_at::date, CURRENT_DATE),
  COALESCE(md.standard_fee, 0),
  'Day 1'
FROM public.market_days md
WHERE NOT EXISTS (
  SELECT 1 FROM public.edition_days ed
  WHERE ed.edition_id = md.id AND ed.day_number = 1
)
ON CONFLICT (edition_id, day_number) DO NOTHING;

-- New editions created by the existing app (or by the concurrency test) get a
-- Day 1 automatically. The edition setup UI may update the fee/date afterwards.
CREATE OR REPLACE FUNCTION public.ensure_first_edition_day()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  INSERT INTO public.edition_days (edition_id, day_number, event_date, fee, label)
  VALUES (
    NEW.id,
    1,
    COALESCE(NEW.event_date, NEW.created_at::date, CURRENT_DATE),
    COALESCE(NEW.standard_fee, 0),
    'Day 1'
  )
  ON CONFLICT (edition_id, day_number) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_ensure_first_edition_day ON public.market_days;
CREATE TRIGGER trg_ensure_first_edition_day
  AFTER INSERT ON public.market_days
  FOR EACH ROW
  EXECUTE FUNCTION public.ensure_first_edition_day();

-- Keep updated_at truthful.
CREATE OR REPLACE FUNCTION public.touch_edition_day_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_touch_edition_day_updated_at ON public.edition_days;
CREATE TRIGGER trg_touch_edition_day_updated_at
  BEFORE UPDATE ON public.edition_days
  FOR EACH ROW
  EXECUTE FUNCTION public.touch_edition_day_updated_at();

-- ---------------------------------------------------------------------------
-- 2. Per-day ticket counters
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.edition_day_ticket_counters (
  edition_day_id UUID PRIMARY KEY REFERENCES public.edition_days(id) ON DELETE CASCADE,
  last_number INTEGER NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Seed from any existing registrations (backfill happens in section 3).
INSERT INTO public.edition_day_ticket_counters (edition_day_id, last_number)
SELECT ed.id, 0
FROM public.edition_days ed
ON CONFLICT (edition_day_id) DO NOTHING;

-- ---------------------------------------------------------------------------
-- 3. Tickets (one row per day per registration)
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.vendor_tickets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  registration_id UUID NOT NULL REFERENCES public.vendor_registrations(id) ON DELETE CASCADE,
  edition_id UUID NOT NULL REFERENCES public.market_days(id) ON DELETE CASCADE,
  edition_day_id UUID NOT NULL REFERENCES public.edition_days(id) ON DELETE CASCADE,
  ticket_number INTEGER NOT NULL CHECK (ticket_number > 0),
  ticket_code TEXT NOT NULL,
  fee NUMERIC(12,2) NOT NULL DEFAULT 0,
  check_in_time TIMESTAMPTZ,
  check_out_time TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT vendor_tickets_day_registration_key UNIQUE (edition_day_id, registration_id),
  CONSTRAINT vendor_tickets_day_number_key UNIQUE (edition_day_id, ticket_number)
);

CREATE INDEX IF NOT EXISTS idx_vendor_tickets_registration
  ON public.vendor_tickets (registration_id);

CREATE INDEX IF NOT EXISTS idx_vendor_tickets_edition
  ON public.vendor_tickets (edition_id, edition_day_id);

CREATE INDEX IF NOT EXISTS idx_vendor_tickets_check_in
  ON public.vendor_tickets (edition_day_id, check_in_time);

-- Backfill existing registrations into Day 1. Only rows that actually hold a
-- ticket number are included; unpaid/unregistered records stay ticketless.
INSERT INTO public.vendor_tickets
  (registration_id, edition_id, edition_day_id, ticket_number, ticket_code, fee,
   check_in_time, check_out_time, created_at)
SELECT
  vr.id,
  vr.market_day_id,
  ed.id,
  COALESCE(
    vr.ticket_number,
    NULLIF(regexp_replace(COALESCE(vr.stall_number, ''), '\D', '', 'g'), '')::int
  ),
  COALESCE(
    NULLIF(vr.stall_number, ''),
    lpad(COALESCE(
      vr.ticket_number,
      NULLIF(regexp_replace(COALESCE(vr.stall_number, ''), '\D', '', 'g'), '')::int
    )::text, 3, '0')
  ),
  COALESCE(md.standard_fee, 0),
  vr.check_in_time,
  vr.check_out_time,
  COALESCE(vr.created_at, now())
FROM public.vendor_registrations vr
JOIN public.market_days md ON md.id = vr.market_day_id
JOIN public.edition_days ed
  ON ed.edition_id = vr.market_day_id AND ed.day_number = 1
WHERE COALESCE(
    vr.ticket_number,
    NULLIF(regexp_replace(COALESCE(vr.stall_number, ''), '\D', '', 'g'), '')::int
  ) IS NOT NULL
ON CONFLICT (edition_day_id, registration_id) DO NOTHING;

-- Seed per-day counters from the highest ticket ever issued on that day.
INSERT INTO public.edition_day_ticket_counters (edition_day_id, last_number)
SELECT
  ed.id,
  GREATEST(
    COALESCE((
      SELECT MAX(vt.ticket_number)
      FROM public.vendor_tickets vt
      WHERE vt.edition_day_id = ed.id
    ), 0),
    COALESCE(etc.last_number, 0)
  )
FROM public.edition_days ed
LEFT JOIN public.edition_ticket_counters etc
  ON etc.edition_id = ed.edition_id AND ed.day_number = 1
ON CONFLICT (edition_day_id) DO UPDATE
  SET last_number = GREATEST(
        public.edition_day_ticket_counters.last_number,
        excluded.last_number
      ),
      updated_at = now();

-- ---------------------------------------------------------------------------
-- 4. Links carry the days the vendor actually paid for
-- ---------------------------------------------------------------------------

ALTER TABLE public.form_links
  ADD COLUMN IF NOT EXISTS allowed_day_ids UUID[] NOT NULL DEFAULT '{}';

CREATE OR REPLACE FUNCTION public.validate_form_link_allowed_days()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_bad UUID;
BEGIN
  IF NEW.allowed_day_ids IS NULL OR cardinality(NEW.allowed_day_ids) = 0 THEN
    RETURN NEW;
  END IF;

  IF NEW.edition_id IS NULL THEN
    RAISE EXCEPTION 'A paid-vendor link with allowed days must have an edition'
      USING ERRCODE = 'P0001';
  END IF;

  SELECT d INTO v_bad
  FROM unnest(NEW.allowed_day_ids) AS d
  WHERE NOT EXISTS (
    SELECT 1 FROM public.edition_days ed
    WHERE ed.id = d AND ed.edition_id = NEW.edition_id
  )
  LIMIT 1;

  IF v_bad IS NOT NULL THEN
    RAISE EXCEPTION 'Allowed day % does not belong to edition %', v_bad, NEW.edition_id
      USING ERRCODE = 'P0001';
  END IF;

  IF cardinality(NEW.allowed_day_ids) <> (
    SELECT count(DISTINCT d) FROM unnest(NEW.allowed_day_ids) AS d
  ) THEN
    RAISE EXCEPTION 'Allowed days must not contain duplicates'
      USING ERRCODE = 'P0001';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validate_form_link_allowed_days ON public.form_links;
CREATE TRIGGER trg_validate_form_link_allowed_days
  BEFORE INSERT OR UPDATE ON public.form_links
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_form_link_allowed_days();

-- ---------------------------------------------------------------------------
-- 5. Per-day ticket templates
-- ---------------------------------------------------------------------------

ALTER TABLE public.ticket_templates
  ADD COLUMN IF NOT EXISTS edition_day_id UUID REFERENCES public.edition_days(id) ON DELETE CASCADE;

-- The old unique rule (one template per edition) blocks multiple day templates.
DROP POLICY IF EXISTS "Allow public read on ticket_templates" ON public.ticket_templates;
CREATE POLICY "Allow public read on ticket_templates"
  ON public.ticket_templates FOR SELECT
  USING (true);

-- Drop any unique constraint/index that enforces one template per edition.
DO $$
DECLARE
  c RECORD;
BEGIN
  FOR c IN
    SELECT conname
    FROM pg_constraint
    WHERE conrelid = 'public.ticket_templates'::regclass
      AND contype = 'u'
      AND pg_get_constraintdef(oid) = 'UNIQUE (edition_id)'
  LOOP
    EXECUTE format('ALTER TABLE public.ticket_templates DROP CONSTRAINT %I', c.conname);
  END LOOP;
END $$;

DROP INDEX IF EXISTS public.uq_ticket_templates_edition;

CREATE UNIQUE INDEX IF NOT EXISTS uq_ticket_templates_edition_fallback
  ON public.ticket_templates (edition_id)
  WHERE edition_day_id IS NULL AND edition_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_ticket_templates_edition_day
  ON public.ticket_templates (edition_day_id)
  WHERE edition_day_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_ticket_templates_edition_day
  ON public.ticket_templates (edition_day_id);

-- Existing edition templates remain edition-level fallbacks for every day.

-- ---------------------------------------------------------------------------
-- 6. Ticket allocation helper
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.allocate_vendor_ticket(
  p_registration_id UUID,
  p_edition_id UUID,
  p_edition_day_id UUID
)
RETURNS public.vendor_tickets
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_existing public.vendor_tickets%rowtype;
  v_day public.edition_days%rowtype;
  v_number INTEGER;
  v_ticket public.vendor_tickets%rowtype;
BEGIN
  SELECT * INTO v_existing
  FROM public.vendor_tickets
  WHERE registration_id = p_registration_id
    AND edition_day_id = p_edition_day_id
  LIMIT 1;

  IF FOUND THEN
    RETURN v_existing;
  END IF;

  SELECT * INTO v_day
  FROM public.edition_days
  WHERE id = p_edition_day_id AND edition_id = p_edition_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Invalid edition day for this edition'
      USING ERRCODE = 'P0001';
  END IF;

  INSERT INTO public.edition_day_ticket_counters (edition_day_id, last_number)
  VALUES (p_edition_day_id, 1)
  ON CONFLICT (edition_day_id) DO UPDATE
    SET last_number = public.edition_day_ticket_counters.last_number + 1,
        updated_at = now()
  RETURNING last_number INTO v_number;

  INSERT INTO public.vendor_tickets
    (registration_id, edition_id, edition_day_id, ticket_number, ticket_code, fee)
  VALUES
    (p_registration_id, p_edition_id, p_edition_day_id, v_number,
     lpad(v_number::text, 3, '0'), COALESCE(v_day.fee, 0))
  RETURNING * INTO v_ticket;

  RETURN v_ticket;
END;
$$;

CREATE OR REPLACE FUNCTION public.tickets_json_for_registration(p_registration_id UUID)
RETURNS JSONB
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT COALESCE(jsonb_agg(
    jsonb_build_object(
      'ticket_id', vt.id,
      'day_id', ed.id,
      'day_number', ed.day_number,
      'day_label', COALESCE(NULLIF(ed.label, ''), 'Day ' || ed.day_number),
      'event_date', ed.event_date,
      'ticket_number', vt.ticket_number,
      'ticket_code', vt.ticket_code,
      'fee', vt.fee,
      'check_in_time', vt.check_in_time
    ) ORDER BY ed.day_number, vt.created_at
  ), '[]'::jsonb)
  FROM public.vendor_tickets vt
  JOIN public.edition_days ed ON ed.id = vt.edition_day_id
  WHERE vt.registration_id = p_registration_id;
$$;

-- ---------------------------------------------------------------------------
-- 7. Public link registration (multi-day)
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.register_paid_vendor_multi(
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
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_link public.form_links%rowtype;
  v_vendor_id UUID;
  v_registration_id UUID;
  v_registration_created_at TIMESTAMPTZ;
  v_now TIMESTAMPTZ := now();
  v_phone TEXT := NULLIF(btrim(COALESCE(p_phone, '')), '');
  v_allowed UUID[];
  v_day_id UUID;
  v_primary public.vendor_tickets%rowtype;
  v_tickets JSONB;
BEGIN
  IF p_token IS NULL OR btrim(p_token) = '' THEN
    RAISE EXCEPTION 'Invalid registration link.' USING ERRCODE = 'P0001';
  END IF;
  IF p_edition_id IS NULL THEN
    RAISE EXCEPTION 'Missing event edition.' USING ERRCODE = 'P0001';
  END IF;
  IF v_phone IS NULL THEN
    RAISE EXCEPTION 'Phone number is required.' USING ERRCODE = 'P0001';
  END IF;

  -- Per-edition advisory lock: editions in different regions never contend.
  PERFORM pg_advisory_xact_lock(hashtext('register_paid_vendor'), hashtext(p_edition_id::text));

  SELECT * INTO v_link FROM public.form_links WHERE token = p_token FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Invalid registration link.' USING ERRCODE = 'P0001';
  END IF;
  IF v_link.form_slug <> 'paid_vendor_registration' THEN
    RAISE EXCEPTION 'Invalid registration link.' USING ERRCODE = 'P0001';
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

  -- A consumed link can only ever be replayed by the same vendor.
  IF v_link.used_by_vendor_id IS NOT NULL AND v_link.used_by_vendor_id <> v_vendor_id THEN
    RAISE EXCEPTION 'This registration link has already been used and is closed.'
      USING ERRCODE = 'P0001';
  END IF;

  SELECT id, created_at INTO v_registration_id, v_registration_created_at
  FROM public.vendor_registrations
  WHERE market_day_id = p_edition_id AND vendor_id = v_vendor_id
  LIMIT 1;

  IF NOT FOUND THEN
    INSERT INTO public.vendor_registrations
      (market_day_id, vendor_id, amount_paid, payment_status, notes)
    VALUES
      (p_edition_id, v_vendor_id, COALESCE(p_amount_paid, 0),
       COALESCE(NULLIF(btrim(COALESCE(p_payment_status, '')), ''), 'paid'),
       NULL)
    RETURNING id, created_at INTO v_registration_id, v_registration_created_at;
  END IF;

  -- Expired links are rejected for new work. A vendor replaying their own
  -- already-used link may still recover/complete their existing tickets.
  IF v_link.expires_at IS NOT NULL AND v_link.expires_at <= v_now
     AND v_link.used_by_vendor_id IS NULL THEN
    RAISE EXCEPTION 'This registration link has already been used and is closed.'
      USING ERRCODE = 'P0001';
  END IF;

  -- Resolve paid days from the LINK only. Never trust client-provided days.
  IF v_link.allowed_day_ids IS NULL OR cardinality(v_link.allowed_day_ids) = 0 THEN
    SELECT array_agg(ed.id ORDER BY ed.day_number)
      INTO v_allowed
      FROM public.edition_days ed
     WHERE ed.edition_id = p_edition_id AND ed.day_number = 1;
  ELSE
    SELECT array_agg(ed.id ORDER BY ed.day_number)
      INTO v_allowed
      FROM public.edition_days ed
     WHERE ed.edition_id = p_edition_id
       AND ed.id = ANY(v_link.allowed_day_ids);
  END IF;

  IF v_allowed IS NULL OR cardinality(v_allowed) = 0 THEN
    RAISE EXCEPTION 'This edition has no payable days configured.'
      USING ERRCODE = 'P0001';
  END IF;

  FOREACH v_day_id IN ARRAY v_allowed LOOP
    PERFORM public.allocate_vendor_ticket(v_registration_id, p_edition_id, v_day_id);
  END LOOP;

  -- Mirror the lowest owned day into the legacy registration ticket fields,
  -- but only when that day is Day 1. Multi-day counters restart at 1 per day,
  -- so mirroring a Day 2 number into the edition-wide unique index would
  -- collide with Day 1 tickets.
  SELECT vt.* INTO v_primary
  FROM public.vendor_tickets vt
  JOIN public.edition_days ed ON ed.id = vt.edition_day_id
  WHERE vt.registration_id = v_registration_id
  ORDER BY ed.day_number
  LIMIT 1;

  IF v_primary.id IS NOT NULL THEN
    UPDATE public.vendor_registrations vr
       SET ticket_number = COALESCE(vr.ticket_number, v_primary.ticket_number),
           stall_number  = COALESCE(NULLIF(vr.stall_number, ''), v_primary.ticket_code),
           notes         = COALESCE(vr.notes, 'Ticket #' || v_primary.ticket_number),
           updated_at    = now()
     WHERE vr.id = v_registration_id
       AND (SELECT ed.day_number FROM public.edition_days ed WHERE ed.id = v_primary.edition_day_id) = 1;
  END IF;

  UPDATE public.form_links fl
     SET expires_at        = v_now,
         used_at           = COALESCE(fl.used_at, v_now),
         ticket_number     = COALESCE(fl.ticket_number, v_primary.ticket_code),
         used_by_vendor_id = COALESCE(fl.used_by_vendor_id, v_vendor_id)
   WHERE fl.token = p_token;

  v_tickets := public.tickets_json_for_registration(v_registration_id);

  RETURN jsonb_build_object(
    'registration_id', v_registration_id,
    'registered_at', COALESCE(v_registration_created_at, v_now),
    'primary_ticket_number', v_primary.ticket_number,
    'primary_ticket_code', v_primary.ticket_code,
    'tickets', v_tickets
  );
END;
$$;

-- Preserve the exact old public RPC signature and return type.
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
  v_result JSONB;
  v_number INTEGER;
  v_code TEXT;
  v_registered_at TIMESTAMPTZ;
BEGIN
  v_result := public.register_paid_vendor_multi(
    p_token, p_edition_id, p_phone, p_contact_name, p_business_name,
    p_category, p_email, p_amount_paid, p_payment_status
  );

  v_number := NULLIF(v_result->>'primary_ticket_number', '')::int;
  v_code := v_result->>'primary_ticket_code';
  v_registered_at := (v_result->>'registered_at')::timestamptz;

  IF v_number IS NULL THEN
    -- Extremely defensive fallback: a day-2-only registration has no legacy
    -- mirror. Return its first actual ticket so old clients still see a pass.
    SELECT (t->>'ticket_number')::int, t->>'ticket_code'
      INTO v_number, v_code
      FROM jsonb_array_elements(COALESCE(v_result->'tickets', '[]'::jsonb)) t
     LIMIT 1;
  END IF;

  RETURN QUERY SELECT v_number, v_code, COALESCE(v_registered_at, now());
END;
$$;

-- ---------------------------------------------------------------------------
-- 8. Admin registration / add-day tickets
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.register_paid_vendor_admin_multi(
  p_edition_id UUID,
  p_phone TEXT,
  p_contact_name TEXT,
  p_business_name TEXT,
  p_category TEXT,
  p_email TEXT,
  p_amount_paid NUMERIC,
  p_payment_status TEXT,
  p_day_ids UUID[] DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_vendor_id UUID;
  v_registration_id UUID;
  v_registration_created_at TIMESTAMPTZ;
  v_phone TEXT := NULLIF(btrim(COALESCE(p_phone, '')), '');
  v_allowed UUID[];
  v_day_id UUID;
  v_primary public.vendor_tickets%rowtype;
  v_tickets JSONB;
BEGIN
  IF p_edition_id IS NULL THEN
    RAISE EXCEPTION 'Missing event edition.' USING ERRCODE = 'P0001';
  END IF;
  IF v_phone IS NULL THEN
    RAISE EXCEPTION 'Phone number is required.' USING ERRCODE = 'P0001';
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

  SELECT id, created_at INTO v_registration_id, v_registration_created_at
  FROM public.vendor_registrations
  WHERE market_day_id = p_edition_id AND vendor_id = v_vendor_id
  LIMIT 1;

  IF NOT FOUND THEN
    INSERT INTO public.vendor_registrations
      (market_day_id, vendor_id, amount_paid, payment_status, fee_source, notes)
    VALUES
      (p_edition_id, v_vendor_id, COALESCE(p_amount_paid, 0),
       COALESCE(NULLIF(btrim(COALESCE(p_payment_status, '')), ''), 'paid'),
       'standard', NULL)
    RETURNING id, created_at INTO v_registration_id, v_registration_created_at;
  ELSE
    UPDATE public.vendor_registrations vr
       SET amount_paid    = COALESCE(p_amount_paid, vr.amount_paid),
           payment_status = COALESCE(NULLIF(btrim(COALESCE(p_payment_status, '')), ''), vr.payment_status),
           updated_at     = now()
     WHERE vr.id = v_registration_id;
  END IF;

  IF p_day_ids IS NULL OR cardinality(p_day_ids) = 0 THEN
    -- Legacy admin behaviour: one-day editions get Day 1; multi-day editions
    -- get every configured day (the operator can remove days in the UI).
    SELECT array_agg(ed.id ORDER BY ed.day_number)
      INTO v_allowed
      FROM public.edition_days ed
     WHERE ed.edition_id = p_edition_id;
  ELSE
    SELECT array_agg(ed.id ORDER BY ed.day_number)
      INTO v_allowed
      FROM public.edition_days ed
     WHERE ed.edition_id = p_edition_id
       AND ed.id = ANY(p_day_ids);
  END IF;

  IF v_allowed IS NULL OR cardinality(v_allowed) = 0 THEN
    RAISE EXCEPTION 'No valid edition days selected.' USING ERRCODE = 'P0001';
  END IF;

  FOREACH v_day_id IN ARRAY v_allowed LOOP
    PERFORM public.allocate_vendor_ticket(v_registration_id, p_edition_id, v_day_id);
  END LOOP;

  SELECT vt.* INTO v_primary
  FROM public.vendor_tickets vt
  JOIN public.edition_days ed ON ed.id = vt.edition_day_id
  WHERE vt.registration_id = v_registration_id
  ORDER BY ed.day_number
  LIMIT 1;

  IF v_primary.id IS NOT NULL THEN
    UPDATE public.vendor_registrations vr
       SET ticket_number = COALESCE(vr.ticket_number, v_primary.ticket_number),
           stall_number  = COALESCE(NULLIF(vr.stall_number, ''), v_primary.ticket_code),
           notes         = COALESCE(vr.notes, 'Ticket #' || v_primary.ticket_number),
           updated_at    = now()
     WHERE vr.id = v_registration_id
       AND (SELECT ed.day_number FROM public.edition_days ed WHERE ed.id = v_primary.edition_day_id) = 1;
  END IF;

  v_tickets := public.tickets_json_for_registration(v_registration_id);

  RETURN jsonb_build_object(
    'registration_id', v_registration_id,
    'registered_at', COALESCE(v_registration_created_at, now()),
    'primary_ticket_number', v_primary.ticket_number,
    'primary_ticket_code', v_primary.ticket_code,
    'tickets', v_tickets
  );
END;
$$;

-- Preserve the exact old admin RPC signature and return type.
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
  v_result JSONB;
  v_number INTEGER;
  v_code TEXT;
  v_registered_at TIMESTAMPTZ;
BEGIN
  v_result := public.register_paid_vendor_admin_multi(
    p_edition_id, p_phone, p_contact_name, p_business_name,
    p_category, p_email, p_amount_paid, p_payment_status, NULL
  );

  v_number := NULLIF(v_result->>'primary_ticket_number', '')::int;
  v_code := v_result->>'primary_ticket_code';
  v_registered_at := (v_result->>'registered_at')::timestamptz;

  IF v_number IS NULL THEN
    SELECT (t->>'ticket_number')::int, t->>'ticket_code'
      INTO v_number, v_code
      FROM jsonb_array_elements(COALESCE(v_result->'tickets', '[]'::jsonb)) t
     LIMIT 1;
  END IF;

  RETURN QUERY SELECT v_number, v_code, COALESCE(v_registered_at, now());
END;
$$;

-- Admin-only: add missing day tickets to an existing registration. Never
-- creates another vendor or registration row.
CREATE OR REPLACE FUNCTION public.add_vendor_day_tickets(
  p_registration_id UUID,
  p_day_ids UUID[]
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_reg public.vendor_registrations%rowtype;
  v_day_id UUID;
  v_primary public.vendor_tickets%rowtype;
  v_tickets JSONB;
BEGIN
  -- Authenticated admins may call this directly; the admin-checked API route
  -- calls it with the service role after verifying the cookie session.
  IF NOT (
    public.is_admin_or_super()
    OR COALESCE(current_setting('request.jwt.claims', true)::jsonb->>'role', '') = 'service_role'
  ) THEN
    RAISE EXCEPTION 'Insufficient permissions' USING ERRCODE = '42501';
  END IF;
  IF p_registration_id IS NULL OR p_day_ids IS NULL OR cardinality(p_day_ids) = 0 THEN
    RAISE EXCEPTION 'Registration and at least one day are required' USING ERRCODE = 'P0001';
  END IF;

  SELECT * INTO v_reg FROM public.vendor_registrations WHERE id = p_registration_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Registration not found' USING ERRCODE = 'P0001';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtext('register_paid_vendor'), hashtext(v_reg.market_day_id::text));

  IF NOT EXISTS (
    SELECT 1 FROM public.edition_days ed
    WHERE ed.edition_id = v_reg.market_day_id AND ed.id = ANY(p_day_ids)
  ) THEN
    RAISE EXCEPTION 'No valid edition days selected' USING ERRCODE = 'P0001';
  END IF;

  FOR v_day_id IN
    SELECT ed.id
    FROM public.edition_days ed
    WHERE ed.edition_id = v_reg.market_day_id AND ed.id = ANY(p_day_ids)
    ORDER BY ed.day_number
  LOOP
    PERFORM public.allocate_vendor_ticket(v_reg.id, v_reg.market_day_id, v_day_id);
  END LOOP;

  SELECT vt.* INTO v_primary
  FROM public.vendor_tickets vt
  JOIN public.edition_days ed ON ed.id = vt.edition_day_id
  WHERE vt.registration_id = v_reg.id
  ORDER BY ed.day_number
  LIMIT 1;

  IF v_primary.id IS NOT NULL THEN
    UPDATE public.vendor_registrations vr
       SET ticket_number = COALESCE(vr.ticket_number, v_primary.ticket_number),
           stall_number  = COALESCE(NULLIF(vr.stall_number, ''), v_primary.ticket_code),
           notes         = COALESCE(vr.notes, 'Ticket #' || v_primary.ticket_number),
           updated_at    = now()
     WHERE vr.id = v_reg.id
       AND (SELECT ed.day_number FROM public.edition_days ed WHERE ed.id = v_primary.edition_day_id) = 1;
  END IF;

  v_tickets := public.tickets_json_for_registration(v_reg.id);

  RETURN jsonb_build_object(
    'registration_id', v_reg.id,
    'tickets', v_tickets
  );
END;
$$;

-- ---------------------------------------------------------------------------
-- 9. Per-day gate check-in
-- ---------------------------------------------------------------------------

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

  -- Day-of rule intentionally not enforced: gate staff may mark any day's
  -- ticket at any time (late setup, backfills, early check-in).

  v_time := CASE WHEN p_check_in THEN now() ELSE NULL END;

  UPDATE public.vendor_tickets
     SET check_in_time = v_time,
         check_out_time = CASE WHEN p_check_in THEN NULL ELSE check_out_time END
   WHERE id = p_ticket_id;

  RETURN QUERY SELECT v_ticket.id, v_time, v_ticket.edition_day_id, v_day.event_date;
END;
$$;

-- ---------------------------------------------------------------------------
-- 10. RLS + grants
-- ---------------------------------------------------------------------------

ALTER TABLE public.edition_days ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.edition_day_ticket_counters ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vendor_tickets ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "allow_read_edition_days" ON public.edition_days;
CREATE POLICY "allow_read_edition_days"
  ON public.edition_days FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "allow_manage_edition_days" ON public.edition_days;
CREATE POLICY "allow_manage_edition_days"
  ON public.edition_days FOR ALL
  TO authenticated
  USING (public.is_approved_user())
  WITH CHECK (public.is_approved_user());

DROP POLICY IF EXISTS "allow_read_edition_day_ticket_counters" ON public.edition_day_ticket_counters;
CREATE POLICY "allow_read_edition_day_ticket_counters"
  ON public.edition_day_ticket_counters FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "allow_read_vendor_tickets" ON public.vendor_tickets;
CREATE POLICY "allow_read_vendor_tickets"
  ON public.vendor_tickets FOR SELECT
  TO anon, authenticated USING (true);

-- No direct INSERT/UPDATE/DELETE policy: tickets are written by SECURITY DEFINER
-- functions and the service-role API only. This keeps per-day numbering and
-- check-in writes unskippable from the browser.

GRANT SELECT ON public.edition_days TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.edition_days TO authenticated;
GRANT SELECT ON public.edition_day_ticket_counters TO anon, authenticated;
GRANT SELECT ON public.vendor_tickets TO anon, authenticated;

GRANT EXECUTE ON FUNCTION public.register_paid_vendor_multi(
  TEXT, UUID, TEXT, TEXT, TEXT, TEXT, TEXT, NUMERIC, TEXT
) TO anon, authenticated, service_role;

GRANT EXECUTE ON FUNCTION public.register_paid_vendor(
  TEXT, UUID, TEXT, TEXT, TEXT, TEXT, TEXT, NUMERIC, TEXT
) TO anon, authenticated, service_role;

GRANT EXECUTE ON FUNCTION public.register_paid_vendor_admin_multi(
  UUID, TEXT, TEXT, TEXT, TEXT, TEXT, NUMERIC, TEXT, UUID[]
) TO authenticated, service_role;

GRANT EXECUTE ON FUNCTION public.register_paid_vendor_admin(
  UUID, TEXT, TEXT, TEXT, TEXT, TEXT, NUMERIC, TEXT
) TO anon, authenticated, service_role;

GRANT EXECUTE ON FUNCTION public.add_vendor_day_tickets(UUID, UUID[])
  TO authenticated, service_role;

GRANT EXECUTE ON FUNCTION public.check_in_vendor_ticket(UUID, BOOLEAN)
  TO authenticated, service_role;

GRANT EXECUTE ON FUNCTION public.allocate_vendor_ticket(UUID, UUID, UUID)
  TO service_role;

GRANT EXECUTE ON FUNCTION public.tickets_json_for_registration(UUID)
  TO anon, authenticated, service_role;

NOTIFY pgrst, 'reload schema';
