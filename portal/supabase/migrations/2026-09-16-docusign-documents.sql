-- 2026-09-16 — Documents move to DocuSign; updates and investor uploads added.
--
-- Investors execute their documents in DocuSign; the completed PDFs are
-- uploaded to the portal from the back office. This migration:
--
--   1. Drops the in-portal signature records and the PDFs they generated.
--      Those were typed-name signatures rendered onto document text that has
--      since been superseded — keeping them would leave two conflicting
--      records of what an investor agreed to. DocuSign is the record now.
--   2. Creates investor_documents: the filing cabinet, with an optional
--      signature request per document and room for investor-uploaded files.
--   3. Creates investor_updates: progress reports, posted to everyone or to
--      one investor, as a file, a written note, or both.
--   4. Drops the shared project-document library. The project website is a
--      hardcoded button in the room now.
--
-- It does NOT touch auth.users, the investors table, or any password. Every
-- existing login keeps working exactly as it does today.
--
-- Run once in the Supabase SQL editor. Safe to re-run.

-- ---------------------------------------------------------------------------
-- 1. Remove the in-portal signing records
-- ---------------------------------------------------------------------------
drop table if exists public.signatures cascade;

delete from storage.objects where bucket_id = 'signed-documents';
delete from storage.buckets where id = 'signed-documents';

-- ---------------------------------------------------------------------------
-- 2. Investor documents
-- ---------------------------------------------------------------------------
create table if not exists public.investor_documents (
  id            uuid primary key default gen_random_uuid(),
  investor_id   uuid not null references public.investors (id) on delete cascade,
  title         text not null,
  -- Free-text label (Promissory Note, Guaranty, Wire Instructions…).
  -- Deliberately unconstrained: the document set is decided in DocuSign.
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
  -- Optional in-portal acknowledgment. Off by default. This is NOT a
  -- signature: there is no field placement and the stored PDF is never
  -- written to, so it records only that the investor opened the document and
  -- confirmed receipt, with their typed name, time and device. Anything that
  -- needs a real signature goes through DocuSign.
  acknowledgment_requested boolean not null default false,
  acknowledged_name       text,
  acknowledged_at         timestamptz,
  acknowledged_ip         text,
  acknowledged_user_agent text,
  -- Reserved for a future DocuSign Connect integration; unused today.
  envelope_id   text,
  uploaded_at   timestamptz not null default now(),
  sort          integer not null default 0
);

-- Adds the columns on a database where an earlier cut of this table exists.
alter table public.investor_documents
  add column if not exists uploaded_by text not null default 'admin',
  add column if not exists acknowledgment_requested boolean not null default false,
  add column if not exists acknowledged_name text,
  add column if not exists acknowledged_at timestamptz,
  add column if not exists acknowledged_ip text,
  add column if not exists acknowledged_user_agent text;

create index if not exists investor_documents_investor_idx
  on public.investor_documents (investor_id, sort, uploaded_at);

alter table public.investor_documents enable row level security;

-- An investor may read only their own documents.
drop policy if exists "investor documents: own or admin" on public.investor_documents;
create policy "investor documents: own or admin" on public.investor_documents
  for select using (
    public.is_admin()
    or investor_id in (select id from public.investors where auth_user_id = auth.uid())
  );

-- ---------------------------------------------------------------------------
-- 3. Investor updates
-- ---------------------------------------------------------------------------
-- A null investor_id means the update goes to every investor. One row, one
-- file, no duplication across the roster.
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

alter table public.investor_updates enable row level security;

drop policy if exists "investor updates: shared, own, or admin" on public.investor_updates;
create policy "investor updates: shared, own, or admin" on public.investor_updates
  for select using (
    public.is_admin()
    or investor_id is null
    or investor_id in (select id from public.investors where auth_user_id = auth.uid())
  );

-- ---------------------------------------------------------------------------
-- 4. Storage
-- ---------------------------------------------------------------------------
-- All writes go through the server with the service role after an explicit
-- identity check; files are served by short-lived signed URLs. The policies
-- below are defence in depth for anyone reaching a bucket with their own JWT.

insert into storage.buckets (id, name, public)
values ('investor-documents', 'investor-documents', false)
on conflict (id) do nothing;

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

-- Updates filed under all/ go to every investor; the rest sit in the target
-- investor's own folder.
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

-- ---------------------------------------------------------------------------
-- 5. Drop the shared project-document library
-- ---------------------------------------------------------------------------
-- The seeded rows named files that were never correct. The project website is
-- a hardcoded button in the room now, and everything an investor receives is
-- filed to their own folder.
drop table if exists public.project_documents cascade;

delete from storage.objects where bucket_id = 'project-documents';
delete from storage.buckets where id = 'project-documents';
