-- The Accredited Investor Verification document has been removed from the
-- portal. Delete any existing accreditation signature records.
-- Run in the Supabase SQL editor (Dashboard → SQL → New query → paste → Run).

delete from public.signatures where doc_key = 'accreditation';

-- NOTE: the stored accreditation.pdf files cannot be deleted with SQL —
-- Supabase blocks direct deletes from storage tables (error 42501). Once the
-- signature rows above are gone the files are unreachable from the portal;
-- to remove them fully, open Dashboard → Storage → signed-documents and
-- delete accreditation.pdf inside each investor folder.
