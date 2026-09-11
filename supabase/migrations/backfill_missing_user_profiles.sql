-- Backfill user_profiles for any auth.users missing a profile row.
-- Ensures every signed-up account appears in User Management as Pending Approval.
INSERT INTO public.user_profiles (user_id, email, role, created_at, updated_at)
SELECT u.id, u.email, 'unassigned'::public.user_role, u.created_at, NOW()
FROM auth.users u
LEFT JOIN public.user_profiles p ON p.user_id = u.id
WHERE p.id IS NULL
ON CONFLICT (user_id) DO NOTHING;
