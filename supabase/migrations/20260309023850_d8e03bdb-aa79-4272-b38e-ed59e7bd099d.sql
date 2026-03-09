
-- Tighten RLS policies: only receptionist/manager roles can modify data

-- Drop permissive policies
drop policy "Authenticated can insert sessions" on public.sessions;
drop policy "Authenticated can update sessions" on public.sessions;
drop policy "Authenticated can insert queue" on public.queue_entries;
drop policy "Authenticated can update queue" on public.queue_entries;
drop policy "Authenticated can delete queue" on public.queue_entries;
drop policy "Authenticated can insert completed" on public.completed_clients;

-- Sessions: only receptionist can create/update
create policy "Receptionist can insert sessions" on public.sessions for insert to authenticated
  with check (public.has_role(auth.uid(), 'receptionist') or public.has_role(auth.uid(), 'manager'));
create policy "Receptionist can update sessions" on public.sessions for update to authenticated
  using (public.has_role(auth.uid(), 'receptionist') or public.has_role(auth.uid(), 'manager'));

-- Queue: only receptionist can modify
create policy "Receptionist can insert queue" on public.queue_entries for insert to authenticated
  with check (public.has_role(auth.uid(), 'receptionist') or public.has_role(auth.uid(), 'manager'));
create policy "Receptionist can update queue" on public.queue_entries for update to authenticated
  using (public.has_role(auth.uid(), 'receptionist') or public.has_role(auth.uid(), 'manager'));
create policy "Receptionist can delete queue" on public.queue_entries for delete to authenticated
  using (public.has_role(auth.uid(), 'receptionist') or public.has_role(auth.uid(), 'manager'));

-- Completed: only receptionist can insert
create policy "Receptionist can insert completed" on public.completed_clients for insert to authenticated
  with check (public.has_role(auth.uid(), 'receptionist') or public.has_role(auth.uid(), 'manager'));
