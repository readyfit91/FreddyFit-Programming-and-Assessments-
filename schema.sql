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

-- ── SMS (Twilio) ─────────────────────────────────────────────────────────────
-- Run this whole section in the Supabase SQL editor before deploying the SMS code.
-- Uses IF EXISTS / IF NOT EXISTS throughout so it's safe to re-run and safe even if
-- your live schema has already drifted from the rest of this file.

create table if not exists sms_messages (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid references leads(id) on delete set null,
  direction text not null check (direction in ('outbound','inbound')),
  from_number text not null,
  to_number text not null,
  body text not null default '',
  status text,
  twilio_sid text,
  created_at timestamptz not null default now()
);

create index if not exists sms_messages_to_number_idx on sms_messages (to_number);
create index if not exists sms_messages_from_number_idx on sms_messages (from_number);

alter table sms_messages enable row level security;
create policy "allow all" on sms_messages for all using (true) with check (true);

-- Lets a client's own phone travel with their profile (used for SMS session confirmations).
alter table if exists clients add column if not exists phone text;

-- Lets a booked session carry the client's phone for that specific booking.
alter table if exists sessions add column if not exists client_phone text;
