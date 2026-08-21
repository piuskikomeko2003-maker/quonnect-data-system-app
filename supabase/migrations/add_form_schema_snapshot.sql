-- Migration: Add form_schema_snapshot column to survey_responses
--
-- Purpose: Stores a snapshot of the form questions (survey_questions rows)
-- at the time of submission. This enables "edit using original form" for
-- vendor submissions - if the form schema has changed since the vendor's
-- original submission, we can still render the form exactly as it was when
-- they first submitted.
--
-- The snapshot is a JSONB array of question objects with:
--   id, question_text, question_type, is_required, csv_column,
--   options, sort_order, section_id
--
-- For EXISTING submissions (before this migration), form_schema_snapshot
-- will be NULL. In that case, "edit using original form" falls back to
-- reconstructing the form from the submission's existing survey_answers
-- (only showing questions that were actually answered).

ALTER TABLE public.survey_responses
  ADD COLUMN IF NOT EXISTS form_schema_snapshot JSONB;
