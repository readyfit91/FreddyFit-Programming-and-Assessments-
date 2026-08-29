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

-- ── PROGRAM FILE UPLOADS (Storage) ──────────────────────────────────────────
-- Uploaded program PDFs/images used to be embedded as base64 directly in trainer_notes,
-- which could push a client save past the ~4.5MB serverless request body limit and fail
-- with "Failed to save client (413)". They're now uploaded to Storage instead, and only a
-- small URL is stored in trainer_notes. Run this section in the Supabase SQL editor.

insert into storage.buckets (id, name, public)
values ('program-files', 'program-files', true)
on conflict (id) do nothing;

drop policy if exists "allow all read program-files" on storage.objects;
create policy "allow all read program-files" on storage.objects
  for select using (bucket_id = 'program-files');
drop policy if exists "allow all write program-files" on storage.objects;
create policy "allow all write program-files" on storage.objects
  for insert with check (bucket_id = 'program-files');
drop policy if exists "allow all delete program-files" on storage.objects;
create policy "allow all delete program-files" on storage.objects
  for delete using (bucket_id = 'program-files');

-- ── PROGRAM JOURNAL (per-entry table) ───────────────────────────────────────
-- Program journal data (weeks, phase notes, week order) used to live embedded inside
-- trainer_notes and get resent in full on every single edit. For clients with years of
-- logged history, that alone (no file needed) could exceed the ~4.5MB request body limit and
-- fail with "Failed to save client (413)". Each entry now gets its own row, so a save only
-- ever needs to send the one entry that changed. Run this section in the Supabase SQL editor.

create table if not exists program_journal_entries (
  client_id text not null references clients(id) on delete cascade,
  journal_key text not null,
  data jsonb not null default '{}',
  updated_at timestamptz not null default now(),
  primary key (client_id, journal_key)
);

alter table program_journal_entries enable row level security;
drop policy if exists "allow all" on program_journal_entries;
create policy "allow all" on program_journal_entries for all using (true) with check (true);
