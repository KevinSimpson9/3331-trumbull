-- 3331 Trumbull Investor Portal — database schema
-- Run once in the Supabase SQL editor (Dashboard → SQL → New query → paste → Run).
--
-- Documents are executed in DocuSign and uploaded to the portal from the admin
-- back office. The portal stores and serves them; it does not generate or
-- witness signatures.

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
  -- how interest is paid out (shown on the investor's position stats)
  payment_schedule text not null default 'quarterly'
    check (payment_schedule in ('monthly', 'quarterly', 'annual', 'maturity')),
  -- set by the admin: 'invited' until the position is executed and funded
  status        text not null default 'invited' check (status in ('invited', 'active')),
  created_at    timestamptz not null default now()
);

-- Executed documents, uploaded per investor after DocuSign completion.
create table if not exists public.investor_documents (
  id            uuid primary key default gen_random_uuid(),
  investor_id   uuid not null references public.investors (id) on delete cascade,
  title         text not null,
  -- Free-text label for the kind of document (Promissory Note, Personal
  -- Guarantee, Subscription Agreement…). Deliberately unconstrained: the
  -- document set is decided in DocuSign, not in this schema.
  doc_type      text not null default 'Other',
  file_name     text not null,
  storage_path  text not null unique,
  content_type  text,
  file_size     bigint,
  -- Date the document was executed in DocuSign (not the upload date).
  executed_on   date,
  -- Reserved for a future DocuSign Connect integration; unused today.
  envelope_id   text,
  uploaded_at   timestamptz not null default now(),
  sort          integer not null default 0
);

create index if not exists investor_documents_investor_idx
  on public.investor_documents (investor_id, sort, uploaded_at);

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
-- their own documents, and their own message thread.
-- ---------------------------------------------------------------------------
alter table public.investors          enable row level security;
alter table public.investor_documents enable row level security;
alter table public.messages           enable row level security;
alter table public.project_documents  enable row level security;

drop policy if exists "investors: own row or admin" on public.investors;
create policy "investors: own row or admin" on public.investors
  for select using (auth_user_id = auth.uid() or public.is_admin());

-- All investor and document writes go through the server with the service
-- role after an explicit admin check; no client-side insert/update/delete
-- policies on purpose.

drop policy if exists "investor documents: own or admin" on public.investor_documents;
create policy "investor documents: own or admin" on public.investor_documents
  for select using (
    public.is_admin()
    or investor_id in (select id from public.investors where auth_user_id = auth.uid())
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
-- Storage. Both buckets are private; files are served through short-lived
-- signed URLs minted by the app after an ownership check.
-- ---------------------------------------------------------------------------

-- Shared library, visible to every signed-in investor.
insert into storage.buckets (id, name, public)
values ('project-documents', 'project-documents', false)
on conflict (id) do nothing;

-- Executed documents, filed under <investor_id>/ and readable only by that
-- investor. The storage policy is defence in depth behind the app's own check.
insert into storage.buckets (id, name, public)
values ('investor-documents', 'investor-documents', false)
on conflict (id) do nothing;

drop policy if exists "investor documents: own folder or admin" on storage.objects;
create policy "investor documents: own folder or admin" on storage.objects
  for select using (
    bucket_id = 'investor-documents'
    and (
      public.is_admin()
      or (storage.foldername(name))[1] in (
        select id::text from public.investors where auth_user_id = auth.uid()
      )
    )
  );

-- The shared library starts empty on purpose — upload the real files from the
-- admin back office (Project document library card) rather than seeding names
-- for files that may not exist yet.
