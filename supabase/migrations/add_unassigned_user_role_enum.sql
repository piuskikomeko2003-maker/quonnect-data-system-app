-- =============================================================================
-- Migration: Add 'unassigned' to the user_role enum
-- =============================================================================
-- Kept separate from the approval-flow migration because Postgres cannot use a
-- newly-added enum value within the same transaction that added it.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type t
    JOIN pg_enum e ON t.oid = e.enumtypid
    WHERE t.typname = 'user_role' AND e.enumlabel = 'unassigned'
  ) THEN
    ALTER TYPE public.user_role ADD VALUE 'unassigned';
  END IF;
END $$;
