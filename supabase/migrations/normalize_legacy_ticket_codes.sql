-- Migration: Normalize legacy ticket codes from "TKT-###" to zero-padded "###"
--
-- Ticket codes are now stored as plain sequential numbers (001, 002, 003).
-- This backfills existing rows that still carry the legacy "TKT-" prefix so
-- stored data, the paid vendor list, and printed tickets all render consistently.

UPDATE public.vendor_registrations
SET stall_number = lpad(substring(stall_number from '\d+'), 3, '0')
WHERE stall_number ~ '^TKT-?\d+$';

UPDATE public.vendor_registrations
SET notes = 'Ticket #' || substring(notes from '\d+')
WHERE notes ~ '^Ticket #\d+ \(TKT-?\d+\)$';

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'vendor_registrations'
      AND column_name = 'ticket_number'
  ) THEN
    UPDATE public.vendor_registrations
    SET ticket_number = lpad(substring(ticket_number from '\d+'), 3, '0')
    WHERE ticket_number ~ '^TKT-?\d+$';
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'form_links'
      AND column_name = 'ticket_number'
  ) THEN
    UPDATE public.form_links
    SET ticket_number = lpad(substring(ticket_number from '\d+'), 3, '0')
    WHERE ticket_number ~ '^TKT-?\d+$';
  END IF;
END $$;
