-- OPTIONAL — run only when you want an investor's documents reset so they can
-- re-sign with the corrected wording (e.g. your own test signatures, which
-- captured the old "Borrower: AK Capital Investments LLC" text). Deletes the
-- signature records AND the executed PDFs for the investor with this email.
-- Edit the email if resetting someone else, then run in the SQL editor.

delete from public.signatures
  where investor_id in (
    select id from public.investors where email = 'kevin.m.simpson9@gmail.com'
  );

delete from storage.objects
  where bucket_id = 'signed-documents'
  and name like (
    select id::text || '/%'
    from public.investors
    where email = 'kevin.m.simpson9@gmail.com'
  );
