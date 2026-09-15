-- Migration: Enable realtime for vendor_registrations
--
-- Powers the live "Checked In" counter and instant entry badges at the gate.
-- Supabase Realtime only streams changes for tables added to the publication.

ALTER PUBLICATION supabase_realtime ADD TABLE public.vendor_registrations;
