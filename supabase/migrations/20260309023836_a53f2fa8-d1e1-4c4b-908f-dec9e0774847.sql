
-- Roles enum
create type public.app_role as enum ('receptionist', 'manager');

-- User roles table
create table public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  role app_role not null,
  unique (user_id, role)
);

-- Security definer function
create or replace function public.has_role(_user_id uuid, _role app_role)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.user_roles
    where user_id = _user_id
      and role = _role
  )
$$;

-- Profiles table
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  full_name text,
  created_at timestamptz default now()
);

-- Trigger to create profile on signup
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email)
  values (new.id, new.email);
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- Doctors table
create table public.doctors (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  initial char(1) not null unique,
  created_at timestamptz default now()
);

-- Sessions table (daily séances)
create table public.sessions (
  id uuid primary key default gen_random_uuid(),
  opened_by uuid references auth.users(id) not null,
  opened_at timestamptz default now(),
  closed_at timestamptz,
  is_active boolean default true,
  created_at timestamptz default now()
);

-- Queue entries
create table public.queue_entries (
  id uuid primary key default gen_random_uuid(),
  session_id uuid references public.sessions(id) on delete cascade not null,
  phone text not null,
  state text not null check (state in ('U', 'N', 'R')),
  doctor_id uuid references public.doctors(id) not null,
  state_number integer not null,
  client_id text not null,
  position integer not null,
  status text not null default 'waiting' check (status in ('waiting', 'in_progress', 'completed')),
  created_at timestamptz default now()
);

-- Completed clients
create table public.completed_clients (
  id uuid primary key default gen_random_uuid(),
  queue_entry_id uuid references public.queue_entries(id),
  session_id uuid references public.sessions(id) not null,
  client_name text not null,
  phone text not null,
  doctor_id uuid references public.doctors(id) not null,
  client_id text not null,
  state text not null,
  treatment text not null,
  total_amount numeric not null default 0,
  tranche_paid numeric not null default 0,
  receptionist_id uuid references auth.users(id) not null,
  completed_at timestamptz default now()
);

-- Enable RLS
alter table public.user_roles enable row level security;
alter table public.doctors enable row level security;
alter table public.sessions enable row level security;
alter table public.queue_entries enable row level security;
alter table public.completed_clients enable row level security;
alter table public.profiles enable row level security;

-- RLS: user_roles
create policy "Authenticated can read own roles" on public.user_roles for select to authenticated using (auth.uid() = user_id);

-- RLS: doctors (public read)
create policy "Anyone can read doctors" on public.doctors for select using (true);

-- RLS: sessions
create policy "Authenticated can read sessions" on public.sessions for select to authenticated using (true);
create policy "Authenticated can insert sessions" on public.sessions for insert to authenticated with check (true);
create policy "Authenticated can update sessions" on public.sessions for update to authenticated using (true);

-- RLS: queue_entries (public read for client interface)
create policy "Anyone can read queue" on public.queue_entries for select using (true);
create policy "Authenticated can insert queue" on public.queue_entries for insert to authenticated with check (true);
create policy "Authenticated can update queue" on public.queue_entries for update to authenticated using (true);
create policy "Authenticated can delete queue" on public.queue_entries for delete to authenticated using (true);

-- RLS: completed_clients
create policy "Authenticated can read completed" on public.completed_clients for select to authenticated using (true);
create policy "Authenticated can insert completed" on public.completed_clients for insert to authenticated with check (true);

-- RLS: profiles
create policy "Users can read own profile" on public.profiles for select to authenticated using (auth.uid() = id);
create policy "Users can update own profile" on public.profiles for update to authenticated using (auth.uid() = id);

-- Seed doctors
insert into public.doctors (name, initial) values
  ('Nassim', 'N'),
  ('Fatema', 'F'),
  ('Nouh', 'L'),
  ('Mohamed', 'M');

-- Enable realtime
alter publication supabase_realtime add table queue_entries;
alter publication supabase_realtime add table sessions;
