-- The Accredited Investor Verification document has been removed from the
-- portal entirely. Delete any existing accreditation signatures and their
-- stored PDF files so no trace remains.
-- Run in the Supabase SQL editor (Dashboard → SQL → New query → paste → Run).

delete from public.signatures where doc_key = 'accreditation';

delete from storage.objects
  where bucket_id = 'signed-documents'
  and name like '%/accreditation.pdf';
