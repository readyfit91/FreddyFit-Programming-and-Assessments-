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

-- Allow all operations (single user app, no auth needed)
alter table clients enable row level security;
alter table assessments enable row level security;
alter table programs enable row level security;
alter table workouts enable row level security;

create policy "allow all" on clients for all using (true) with check (true);
create policy "allow all" on assessments for all using (true) with check (true);
create policy "allow all" on programs for all using (true) with check (true);
create policy "allow all" on workouts for all using (true) with check (true);

-- ── SIGN-IN SHEETS ──────────────────────────────────────────────────────────

create table if not exists checkins (
  id uuid primary key default gen_random_uuid(),
  client_id text references clients(id) on delete cascade,
  session_date date not null default current_date,
  time_in timestamptz not null default now(),
  time_out timestamptz,
  session_type text default 'Training',
  notes text,
  created_at timestamptz default now()
);

alter table checkins enable row level security;
create policy "allow all" on checkins for all using (true) with check (true);
