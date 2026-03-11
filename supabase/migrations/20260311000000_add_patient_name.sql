-- Add patient_name to queue_entries
ALTER TABLE public.queue_entries ADD COLUMN patient_name TEXT;
