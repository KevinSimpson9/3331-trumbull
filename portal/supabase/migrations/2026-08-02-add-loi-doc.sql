-- Adds the Non-Binding Letter of Intent (commitment letter) as a signable
-- document. Run once in the Supabase SQL editor for databases created from
-- the original schema.sql (fresh installs already include 'loi').

alter table public.signatures drop constraint if exists signatures_doc_key_check;
alter table public.signatures add constraint signatures_doc_key_check
  check (doc_key in ('loi', 'note', 'guarantee', 'accreditation'));
