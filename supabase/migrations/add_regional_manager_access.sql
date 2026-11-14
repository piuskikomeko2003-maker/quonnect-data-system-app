-- =============================================================================
-- Migration: Regional Manager region + section access
-- =============================================================================
-- A Regional Manager is scoped to exactly one region and may only open the
-- sections an Admin/Super Admin grants them. Section permissions are stored as
-- a JSON map so a section can be "view" or "manage" (null/absent = no access):
--
--   { "overview": "view", "paid-vendors": "manage", "finance": "view" }
--
-- Allowed section ids are validated in the API (`/api/users` PATCH) and mirrored
-- in src/lib/auth/permissions.ts (REGION_SECTIONS).

ALTER TABLE public.user_profiles
  ADD COLUMN IF NOT EXISTS managed_region_id UUID REFERENCES public.regions(id) ON DELETE SET NULL;

ALTER TABLE public.user_profiles
  ADD COLUMN IF NOT EXISTS section_permissions JSONB NOT NULL DEFAULT '{}'::jsonb;

CREATE INDEX IF NOT EXISTS idx_user_profiles_managed_region
  ON public.user_profiles (managed_region_id);

-- Regional Managers are approved staff, so they must pass the shared RLS
-- helper used by other modules (finance, ratings, stickers, etc.).
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
    AND role IN ('user', 'regional_manager', 'admin', 'super_admin')
  );
$$;

-- Helper for RLS policies that need the caller's assigned region.
CREATE OR REPLACE FUNCTION public.get_current_managed_region()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT managed_region_id FROM public.user_profiles
  WHERE user_id = auth.uid() LIMIT 1;
$$;

-- Read a section access level for the current user ('view' | 'manage' | null).
CREATE OR REPLACE FUNCTION public.get_current_section_access(section_key text)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT NULLIF(section_permissions ->> section_key, '')
  FROM public.user_profiles
  WHERE user_id = auth.uid()
  LIMIT 1;
$$;

-- Reload PostgREST so the new columns are immediately queryable.
NOTIFY pgrst, 'reload schema';
