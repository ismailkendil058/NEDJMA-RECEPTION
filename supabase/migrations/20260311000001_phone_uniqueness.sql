-- Clean up existing duplicates in waiting or in_cabinet status for the same session
DELETE FROM public.queue_entries a USING public.queue_entries b
WHERE a.id < b.id 
  AND a.phone = b.phone 
  AND a.status IN ('waiting', 'in_cabinet')
  AND b.status IN ('waiting', 'in_cabinet');

-- Add Partial Unique Index for active entries only
CREATE UNIQUE INDEX queue_entries_phone_active_idx ON public.queue_entries (phone) 
WHERE (status IN ('waiting', 'in_cabinet'));

-- Update completed_clients foreign key to SET NULL on delete
ALTER TABLE public.completed_clients DROP CONSTRAINT IF EXISTS completed_clients_queue_entry_id_fkey;
ALTER TABLE public.completed_clients 
  ADD CONSTRAINT completed_clients_queue_entry_id_fkey 
  FOREIGN KEY (queue_entry_id) 
  REFERENCES public.queue_entries(id) 
  ON DELETE SET NULL;
