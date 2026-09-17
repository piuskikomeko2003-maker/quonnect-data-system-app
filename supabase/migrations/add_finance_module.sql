-- =============================================================================
-- Migration: Add Finance Module (Categories, Expenses, Incomes, Summary View)
-- =============================================================================

-- 1. Create finance_categories table
CREATE TABLE IF NOT EXISTS public.finance_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('expense', 'income')),
  description TEXT,
  is_default BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Unique constraint on (name, type) to prevent duplicate categories of same type
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'finance_categories_name_type_key'
  ) THEN
    ALTER TABLE public.finance_categories ADD CONSTRAINT finance_categories_name_type_key UNIQUE (name, type);
  END IF;
END $$;

-- Seed default categories
INSERT INTO public.finance_categories (name, type, description, is_default)
VALUES
  ('Employees & Wages', 'expense', 'Staff payments, daily wages, and allowances', true),
  ('Transportation', 'expense', 'Logistics, fuel, vehicle hire, and transport', true),
  ('Management & Supervision', 'expense', 'Managerial fees, coordination and oversight', true),
  ('Ushers & Stewards', 'expense', 'Ground ushers, ticket checks, crowd managers', true),
  ('Food & Refreshments', 'expense', 'Team meals, water, and crew catering', true),
  ('Venue & Permits', 'expense', 'Grounds hire, local authority licenses and permits', true),
  ('Marketing & Publicity', 'expense', 'Flyers, social media ads, radio, banners, print', true),
  ('Equipment & Sound', 'expense', 'Tents, chairs, PA system, lighting, generator', true),
  ('Miscellaneous', 'expense', 'Incidental and unforeseen minor expenses', true),
  ('Sponsorships', 'income', 'Corporate sponsors, brand activations and endorsements', true),
  ('Donations & Grants', 'income', 'Community donations, institutional support and grants', true),
  ('Gate / Entry Fees', 'income', 'Attendee ticket fees or gate entrance charges', true),
  ('Merchandise Sales', 'income', 'Branded items, t-shirts, caps, and souvenirs', true),
  ('Other Income', 'income', 'Miscellaneous non-vendor receipts', true)
ON CONFLICT (name, type) DO NOTHING;

-- 2. Create finance_expenses table
CREATE TABLE IF NOT EXISTS public.finance_expenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  market_day_id UUID NOT NULL REFERENCES public.market_days(id) ON DELETE CASCADE,
  category_id UUID REFERENCES public.finance_categories(id) ON DELETE SET NULL,
  category_name TEXT NOT NULL,
  description TEXT NOT NULL,
  amount NUMERIC(14, 2) NOT NULL CHECK (amount >= 0),
  date_incurred DATE NOT NULL DEFAULT CURRENT_DATE,
  receipt_url TEXT,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_by_email TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_finance_expenses_market_day_id ON public.finance_expenses(market_day_id);
CREATE INDEX IF NOT EXISTS idx_finance_expenses_date_incurred ON public.finance_expenses(date_incurred);
CREATE INDEX IF NOT EXISTS idx_finance_expenses_category_id ON public.finance_expenses(category_id);

-- 3. Create finance_incomes table
CREATE TABLE IF NOT EXISTS public.finance_incomes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  market_day_id UUID NOT NULL REFERENCES public.market_days(id) ON DELETE CASCADE,
  source_category_id UUID REFERENCES public.finance_categories(id) ON DELETE SET NULL,
  source_category_name TEXT NOT NULL,
  description TEXT NOT NULL,
  amount NUMERIC(14, 2) NOT NULL CHECK (amount >= 0),
  date_received DATE NOT NULL DEFAULT CURRENT_DATE,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_by_email TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_finance_incomes_market_day_id ON public.finance_incomes(market_day_id);
CREATE INDEX IF NOT EXISTS idx_finance_incomes_date_received ON public.finance_incomes(date_received);
CREATE INDEX IF NOT EXISTS idx_finance_incomes_source_category_id ON public.finance_incomes(source_category_id);

-- 4. Enable Row Level Security
ALTER TABLE public.finance_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.finance_expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.finance_incomes ENABLE ROW LEVEL SECURITY;

-- Helper fallback if public.is_admin_or_super does not exist
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

CREATE OR REPLACE FUNCTION public.is_approved_user()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_profiles
    WHERE user_id = auth.uid()
    AND role IN ('user', 'admin', 'super_admin')
  );
$$;

-- RLS: finance_categories
DROP POLICY IF EXISTS "finance_categories_select" ON public.finance_categories;
CREATE POLICY "finance_categories_select" ON public.finance_categories
  FOR SELECT TO authenticated
  USING (true);

DROP POLICY IF EXISTS "finance_categories_modify" ON public.finance_categories;
CREATE POLICY "finance_categories_modify" ON public.finance_categories
  FOR ALL TO authenticated
  USING (public.is_admin_or_super())
  WITH CHECK (public.is_admin_or_super());

-- RLS: finance_expenses
DROP POLICY IF EXISTS "finance_expenses_select" ON public.finance_expenses;
CREATE POLICY "finance_expenses_select" ON public.finance_expenses
  FOR SELECT TO authenticated
  USING (public.is_approved_user());

DROP POLICY IF EXISTS "finance_expenses_insert" ON public.finance_expenses;
CREATE POLICY "finance_expenses_insert" ON public.finance_expenses
  FOR INSERT TO authenticated
  WITH CHECK (public.is_admin_or_super());

DROP POLICY IF EXISTS "finance_expenses_update" ON public.finance_expenses;
CREATE POLICY "finance_expenses_update" ON public.finance_expenses
  FOR UPDATE TO authenticated
  USING (public.is_admin_or_super())
  WITH CHECK (public.is_admin_or_super());

DROP POLICY IF EXISTS "finance_expenses_delete" ON public.finance_expenses;
CREATE POLICY "finance_expenses_delete" ON public.finance_expenses
  FOR DELETE TO authenticated
  USING (public.is_admin_or_super());

-- RLS: finance_incomes
DROP POLICY IF EXISTS "finance_incomes_select" ON public.finance_incomes;
CREATE POLICY "finance_incomes_select" ON public.finance_incomes
  FOR SELECT TO authenticated
  USING (public.is_approved_user());

DROP POLICY IF EXISTS "finance_incomes_insert" ON public.finance_incomes;
CREATE POLICY "finance_incomes_insert" ON public.finance_incomes
  FOR INSERT TO authenticated
  WITH CHECK (public.is_admin_or_super());

DROP POLICY IF EXISTS "finance_incomes_update" ON public.finance_incomes;
CREATE POLICY "finance_incomes_update" ON public.finance_incomes
  FOR UPDATE TO authenticated
  USING (public.is_admin_or_super())
  WITH CHECK (public.is_admin_or_super());

DROP POLICY IF EXISTS "finance_incomes_delete" ON public.finance_incomes;
CREATE POLICY "finance_incomes_delete" ON public.finance_incomes
  FOR DELETE TO authenticated
  USING (public.is_admin_or_super());

-- 5. Storage bucket for receipt uploads
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'finance_receipts',
  'finance_receipts',
  true,
  5242880, -- 5MB limit
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'application/pdf']
)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for finance_receipts bucket
DROP POLICY IF EXISTS "finance_receipts_public_view" ON storage.objects;
CREATE POLICY "finance_receipts_public_view" ON storage.objects
  FOR SELECT TO public
  USING (bucket_id = 'finance_receipts');

DROP POLICY IF EXISTS "finance_receipts_admin_upload" ON storage.objects;
CREATE POLICY "finance_receipts_admin_upload" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'finance_receipts' AND public.is_admin_or_super());

DROP POLICY IF EXISTS "finance_receipts_admin_delete" ON storage.objects;
CREATE POLICY "finance_receipts_admin_delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'finance_receipts' AND public.is_admin_or_super());

-- 6. Comprehensive Edition Finance Summary View
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

-- 7. Realtime publications
DO $$
BEGIN
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.finance_expenses;
  EXCEPTION WHEN others THEN
    NULL;
  END;
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.finance_incomes;
  EXCEPTION WHEN others THEN
    NULL;
  END;
END $$;

-- 8. Notify PostgREST to reload schema
NOTIFY pgrst, 'reload schema';
