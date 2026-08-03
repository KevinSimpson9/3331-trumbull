-- 3331 Trumbull Investor Portal — database schema
-- Run once in the Supabase SQL editor (Dashboard → SQL → New query → paste → Run).

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- Admin check. Must match the ADMIN_EMAIL env var in the Next.js app.
-- ---------------------------------------------------------------------------
create or replace function public.is_admin()
returns boolean
language sql
stable
as $$
  select coalesce(lower(auth.jwt() ->> 'email'), '') = 'kevin@akcapital.fund'
$$;

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------
create table if not exists public.investors (
  id            uuid primary key default gen_random_uuid(),
  auth_user_id  uuid unique references auth.users (id) on delete set null,
  legal_name    text not null,
  email         text not null unique,
  principal     numeric not null check (principal > 0),
  rate          numeric not null default 20,
  term_months   integer not null default 20,
  -- how interest is paid out (flows into the LOI / note wording)
  payment_schedule text not null default 'quarterly'
    check (payment_schedule in ('monthly', 'quarterly', 'annual', 'maturity')),
  status        text not null default 'invited' check (status in ('invited', 'active')),
  created_at    timestamptz not null default now()
);

create table if not exists public.signatures (
  id           uuid primary key default gen_random_uuid(),
  investor_id  uuid not null references public.investors (id) on delete cascade,
  doc_key      text not null check (doc_key in ('loi', 'note', 'guarantee')),
  signer_name  text not null,
  signed_at    timestamptz not null default now(),
  user_agent   text,
  ip           text,
  unique (investor_id, doc_key)
);

create table if not exists public.messages (
  id           uuid primary key default gen_random_uuid(),
  investor_id  uuid not null references public.investors (id) on delete cascade,
  sender       text not null check (sender in ('admin', 'investor')),
  body         text not null,
  sent_at      timestamptz not null default now(),
  read_at      timestamptz
);

create index if not exists messages_investor_sent_idx on public.messages (investor_id, sent_at);

-- Shared project document library (one list, visible to every signed-in investor).
create table if not exists public.project_documents (
  id            uuid primary key default gen_random_uuid(),
  title         text not null,
  description   text,
  badge         text not null default 'PDF',
  href          text,          -- external link (e.g. the public project site)
  storage_path  text,          -- object path inside the 'project-documents' bucket
  sort          integer not null default 0
);

-- ---------------------------------------------------------------------------
-- Row-level security. CRITICAL: an investor may only ever see their own row,
-- their own signatures, and their own message thread.
-- ---------------------------------------------------------------------------
alter table public.investors         enable row level security;
alter table public.signatures        enable row level security;
alter table public.messages          enable row level security;
alter table public.project_documents enable row level security;

drop policy if exists "investors: own row or admin" on public.investors;
create policy "investors: own row or admin" on public.investors
  for select using (auth_user_id = auth.uid() or public.is_admin());

-- All investor writes go through the server with the service role after an
-- explicit admin check; no client-side insert/update/delete policies on purpose.

drop policy if exists "signatures: own or admin" on public.signatures;
create policy "signatures: own or admin" on public.signatures
  for select using (
    public.is_admin()
    or investor_id in (select id from public.investors where auth_user_id = auth.uid())
  );

drop policy if exists "signatures: investor signs own docs" on public.signatures;
create policy "signatures: investor signs own docs" on public.signatures
  for insert with check (
    investor_id in (select id from public.investors where auth_user_id = auth.uid())
  );

drop policy if exists "messages: own thread or admin" on public.messages;
create policy "messages: own thread or admin" on public.messages
  for select using (
    public.is_admin()
    or investor_id in (select id from public.investors where auth_user_id = auth.uid())
  );

drop policy if exists "messages: investor writes own thread" on public.messages;
create policy "messages: investor writes own thread" on public.messages
  for insert with check (
    sender = 'investor'
    and investor_id in (select id from public.investors where auth_user_id = auth.uid())
  );

drop policy if exists "messages: admin writes any thread" on public.messages;
create policy "messages: admin writes any thread" on public.messages
  for insert with check (public.is_admin() and sender = 'admin');

drop policy if exists "project documents: any signed-in user" on public.project_documents;
create policy "project documents: any signed-in user" on public.project_documents
  for select using (auth.role() = 'authenticated');

-- ---------------------------------------------------------------------------
-- Storage bucket for the shared project document library (private; files are
-- served through short-lived signed URLs created by the app).
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('project-documents', 'project-documents', false)
on conflict (id) do nothing;

-- ---------------------------------------------------------------------------
-- Seed the shared document library (edit titles/paths freely; upload matching
-- files to the 'project-documents' bucket to make the cards downloadable).
-- ---------------------------------------------------------------------------
insert into public.project_documents (title, description, badge, href, storage_path, sort)
select * from (values
  ('Investor Overview Deck', 'Capital stack, returns, timeline & risk mitigation', 'PDF',  null, 'investor-overview-deck.pdf', 1),
  ('Independent Appraisal',  'Certified appraisal · Q2 2026',                      'PDF',  null, 'independent-appraisal.pdf',  2),
  ('Senior Loan Term Sheet', 'Construction financing · committed',                 'PDF',  null, 'senior-loan-term-sheet.pdf', 3),
  ('Detailed Build Budget',  'Line-item hard & soft costs',                        'XLSX', null, 'detailed-build-budget.xlsx', 4),
  ('Architectural Plans',    'Site plan · Unit floor plans · Renderings',          'PDF',  null, 'architectural-plans.pdf',    5),
  ('Project Website',        'trumbullnorth.com · Public-facing site',             'WEB',  'https://trumbullnorth.com', null, 6)
) as seed(title, description, badge, href, storage_path, sort)
where not exists (select 1 from public.project_documents);
