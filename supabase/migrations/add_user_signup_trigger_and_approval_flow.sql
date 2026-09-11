-- =============================================================================
-- Migration: Add user signup trigger, unassigned role, and admin approval RLS
-- =============================================================================
-- NOTE: The 'unassigned' enum value is added in the earlier migration
-- `add_unassigned_user_role_enum.sql`. Postgres cannot use a newly-added enum
-- value in the same transaction that adds it, so it must be a separate step.

-- 2. Update default on user_profiles.role to 'unassigned'
ALTER TABLE public.user_profiles 
  ALTER COLUMN role SET DEFAULT 'unassigned'::public.user_role;

-- 3. Ensure unique constraint on user_profiles(user_id)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'user_profiles_user_id_key'
  ) THEN
    ALTER TABLE public.user_profiles ADD CONSTRAINT user_profiles_user_id_key UNIQUE (user_id);
  END IF;
END $$;

-- 4. Trigger function to auto-create user_profile on auth.users insert
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.user_profiles (user_id, email, role, created_at, updated_at)
  VALUES (
    NEW.id,
    NEW.email,
    'unassigned'::public.user_role,
    NOW(),
    NOW()
  )
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$$;

-- 5. Attach trigger to auth.users
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- 6. Backfill existing auth.users who are missing a profile row
INSERT INTO public.user_profiles (user_id, email, role, created_at, updated_at)
SELECT id, email, 'unassigned'::public.user_role, created_at, NOW()
FROM auth.users
WHERE id NOT IN (SELECT user_id FROM public.user_profiles WHERE user_id IS NOT NULL)
ON CONFLICT (user_id) DO NOTHING;

-- 7. Security Definer Helper Functions for RLS (avoids recursion)
CREATE OR REPLACE FUNCTION public.get_current_user_role()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role::text FROM public.user_profiles WHERE user_id = auth.uid() LIMIT 1;
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

-- 8. RLS Policies on user_profiles
ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "user_profiles_select_own" ON public.user_profiles;
CREATE POLICY "user_profiles_select_own" ON public.user_profiles
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "user_profiles_select_admin" ON public.user_profiles;
CREATE POLICY "user_profiles_select_admin" ON public.user_profiles
  FOR SELECT TO authenticated
  USING (public.is_admin_or_super());

DROP POLICY IF EXISTS "user_profiles_update_admin" ON public.user_profiles;
CREATE POLICY "user_profiles_update_admin" ON public.user_profiles
  FOR UPDATE TO authenticated
  USING (public.is_admin_or_super())
  WITH CHECK (public.is_admin_or_super());

-- Reload schema cache
NOTIFY pgrst, 'reload schema';
