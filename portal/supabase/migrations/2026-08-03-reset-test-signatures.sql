-- OPTIONAL — run only when you want an investor's documents reset so they can
-- re-sign with the corrected wording (e.g. your own test signatures, which
-- captured the old "Borrower: AK Capital Investments LLC" text). Deletes the
-- signature records for the investor with this email; their documents return
-- to "Review & sign" in the portal. Edit the email if resetting someone else.

delete from public.signatures
  where investor_id in (
    select id from public.investors where email = 'kevin.m.simpson9@gmail.com'
  );

-- NOTE: the old executed PDFs cannot be deleted with SQL — Supabase blocks
-- direct deletes from storage tables (error 42501). They are unreachable from
-- the portal once the rows above are gone, and re-signing overwrites them.
-- To remove them immediately, open Dashboard → Storage → signed-documents and
-- delete the investor's folder contents.
