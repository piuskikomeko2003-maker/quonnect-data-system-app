-- Migration: Add UNIQUE constraint on survey_responses (vendor_id, context_id)
--
-- Purpose: Enables the csvImport.ts upsert deduplication logic.
--   .upsert({...}, { onConflict: 'vendor_id,context_id', ignoreDuplicates: true })
-- Without this constraint, the upsert falls back to INSERT and re-importing the
-- same CSV creates duplicate survey_response rows that inflate all chart metrics.
--
-- Safe to run: pre-migration check confirmed 0 duplicate (vendor_id, context_id)
-- pairs in the current production data (309 responses, 0 duplicates as of 2026-07-28).
--
-- Run in Supabase Dashboard → SQL Editor, or via supabase db push.

ALTER TABLE public.survey_responses
  ADD CONSTRAINT survey_responses_vendor_edition_unique
  UNIQUE (vendor_id, context_id);
