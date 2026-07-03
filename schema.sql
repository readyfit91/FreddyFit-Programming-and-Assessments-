-- FreddyFit Database Schema

create table if not exists clients (
  id text primary key,
  name text not null,
  goal text,
  dob text,
  equipment text,
  trainer_notes text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists assessments (
  id uuid primary key default gen_random_uuid(),
  client_id text references clients(id) on delete cascade,
  assessment_type text not null,
  answers jsonb not null default '{}',
  summary text,
  completed_at timestamptz default now()
);

create table if not exists programs (
  id uuid primary key default gen_random_uuid(),
  client_id text references clients(id) on delete cascade,
  phases jsonb not null default '{}',
  generated_at timestamptz default now()
);

create table if not exists workouts (
  id uuid primary key default gen_random_uuid(),
  client_id text references clients(id) on delete cascade,
  content text not null,
  prompt text,
  generated_at timestamptz default now()
);

create table if not exists weight_logs (
  id uuid primary key default gen_random_uuid(),
  client_id text references clients(id) on delete cascade,
  logged_at timestamptz not null default now(),
  weight numeric,
  body_fat numeric,
  rating text check (rating in ('good', 'bad')),
  behavior_notes text
);

-- Allow all operations (single user app, no auth needed)
alter table clients enable row level security;
alter table assessments enable row level security;
alter table programs enable row level security;
alter table workouts enable row level security;

create policy "allow all" on clients for all using (true) with check (true);
create policy "allow all" on assessments for all using (true) with check (true);
create policy "allow all" on programs for all using (true) with check (true);
create policy "allow all" on workouts for all using (true) with check (true);

alter table weight_logs enable row level security;
create policy "allow all" on weight_logs for all using (true) with check (true);

-- ── CRM LEADS ────────────────────────────────────────────────────────────────

create table if not exists leads (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  phone text,
  email text,
  source text,
  goal text,
  status text default 'New Lead' check (status in ('New Lead','Contacted','Follow Up','Booked','Client','Cold')),
  date_added date not null default current_date,
  last_contact_date date,
  notes text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table leads enable row level security;
create policy "allow all" on leads for all using (true) with check (true);

-- ── SESSIONS (calendar bookings) ────────────────────────────────────────────

create table if not exists sessions (
  id uuid primary key default gen_random_uuid(),
  client_id text references clients(id) on delete set null,
  client_name text not null default '',
  client_email text default '',
  client_phone text default '',
  date date not null,
  time text not null,
  session_type text default 'FIT60',
  duration integer default 60,
  recurring boolean default false,
  notes text default '',
  link text default '',
  exceptions jsonb not null default '[]',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Safe to run against an existing sessions table that predates this file.
alter table sessions add column if not exists client_email text default '';
alter table sessions add column if not exists client_phone text default '';

alter table sessions enable row level security;
drop policy if exists "allow all" on sessions;
create policy "allow all" on sessions for all using (true) with check (true);
