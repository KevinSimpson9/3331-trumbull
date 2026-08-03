-- Records the investor's accredited / non-accredited selection on the
-- Accredited Investor Verification form (both are acceptable under 506(b)).
-- Run in the Supabase SQL editor (Dashboard → SQL → New query → paste → Run).

alter table public.signatures
  add column if not exists accreditation_status text
  check (accreditation_status in ('accredited', 'non_accredited'));
