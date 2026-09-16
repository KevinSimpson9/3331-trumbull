-- 2026-09-16 — Documents move to DocuSign.
--
-- The portal no longer generates or witnesses signatures. Investors execute
-- their documents in DocuSign; the completed PDFs are uploaded to the portal
-- from the back office. This migration:
--
--   1. Drops the in-portal signature records and the PDFs they generated.
--      Those were typed-name signatures rendered onto document text that has
--      since been superseded — keeping them would leave two conflicting
--      records of what an investor agreed to. DocuSign is the record now.
--   2. Creates investor_documents + a private per-investor storage bucket.
--   3. Clears the seeded shared library so the corrected files can be
--      uploaded from the admin back office.
--
-- Run once in the Supabase SQL editor. Safe to re-run.

-- ---------------------------------------------------------------------------
-- 1. Remove the in-portal signing records
-- ---------------------------------------------------------------------------
drop table if exists public.signatures cascade;

delete from storage.objects where bucket_id = 'signed-documents';
delete from storage.buckets where id = 'signed-documents';

-- ---------------------------------------------------------------------------
-- 2. Executed documents, uploaded per investor
-- ---------------------------------------------------------------------------
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

alter table public.investor_documents enable row level security;

-- An investor may read only their own documents. All writes go through the
-- server with the service role after an explicit admin check — no client-side
-- insert/update/delete policies on purpose.
drop policy if exists "investor documents: own or admin" on public.investor_documents;
create policy "investor documents: own or admin" on public.investor_documents
  for select using (
    public.is_admin()
    or investor_id in (select id from public.investors where auth_user_id = auth.uid())
  );

-- Private bucket. Files are served through short-lived signed URLs minted by
-- the app after an ownership check; the storage policy below is defence in
-- depth for anyone reaching the bucket with an investor's own JWT.
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

-- ---------------------------------------------------------------------------
-- 3. Clear the seeded shared library
-- ---------------------------------------------------------------------------
-- The seeded rows named files that were never correct (and in most cases were
-- never uploaded). The library keeps one card: the public site, where investor
-- updates are posted. Everything else an investor receives is filed
-- per-investor, not shared.
delete from public.project_documents;

-- The shared library holds one card for now: the public site, which is where
-- investor updates are posted. Everything else an investor receives is filed
-- per-investor, not shared.
insert into public.project_documents (title, description, badge, href, storage_path, sort)
select 'Investor Updates', 'trumbullnorth.com · Project news and progress reports', 'WEB',
       'https://trumbullnorth.com', null, 1
where not exists (select 1 from public.project_documents where href = 'https://trumbullnorth.com');
