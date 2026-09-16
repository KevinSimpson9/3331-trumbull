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
  -- Date the document was executed in DocuSign. Null for anything unsigned,
  -- such as wire instructions or a bank statement.
  executed_on   date,
  -- Who put the file here. Investors upload their own banking details for
  -- ACH/wire setup; everything else is filed by the admin.
  uploaded_by   text not null default 'admin' check (uploaded_by in ('admin', 'investor')),
  -- Optional in-portal signature. Off by default: DocuSign is the norm, this
  -- is the exception for a document that needs a signature without an envelope.
  signature_requested boolean not null default false,
  signed_name       text,
  signed_at         timestamptz,
  signed_ip         text,
  signed_user_agent text,
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

-- Progress reports. A null investor_id means the update goes to every
-- investor: one row, one file, no duplication across the roster.
create table if not exists public.investor_updates (
  id            uuid primary key default gen_random_uuid(),
  investor_id   uuid references public.investors (id) on delete cascade,
  title         text not null,
  body          text,
  file_name     text,
  storage_path  text,
  content_type  text,
  file_size     bigint,
  posted_at     timestamptz not null default now()
);

create index if not exists investor_updates_posted_idx
  on public.investor_updates (posted_at desc);

-- ---------------------------------------------------------------------------
-- Row-level security. CRITICAL: an investor may only ever see their own row,
-- their own documents, and their own message thread.
-- ---------------------------------------------------------------------------
alter table public.investors          enable row level security;
alter table public.investor_documents enable row level security;
alter table public.investor_updates   enable row level security;
alter table public.messages           enable row level security;

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

drop policy if exists "investor updates: shared, own, or admin" on public.investor_updates;
create policy "investor updates: shared, own, or admin" on public.investor_updates
  for select using (
    public.is_admin()
    or investor_id is null
    or investor_id in (select id from public.investors where auth_user_id = auth.uid())
  );

-- ---------------------------------------------------------------------------
-- Storage. Both buckets are private; files are served through short-lived
-- signed URLs minted by the app after an ownership check. The policies are
-- defence in depth behind that check.
-- ---------------------------------------------------------------------------

-- Executed documents, wire instructions and investor-uploaded banking details,
-- filed under <investor_id>/ and readable only by that investor.
insert into storage.buckets (id, name, public)
values ('investor-documents', 'investor-documents', false)
on conflict (id) do nothing;

-- Progress reports. Anything under all/ goes to every investor; the rest sits
-- in the target investor's own folder.
insert into storage.buckets (id, name, public)
values ('investor-updates', 'investor-updates', false)
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

drop policy if exists "investor updates: shared folder or own" on storage.objects;
create policy "investor updates: shared folder or own" on storage.objects
  for select using (
    bucket_id = 'investor-updates'
    and (
      public.is_admin()
      or (storage.foldername(name))[1] = 'all'
      or (storage.foldername(name))[1] in (
        select id::text from public.investors where auth_user_id = auth.uid()
      )
    )
  );
