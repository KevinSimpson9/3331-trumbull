-- Per-investor payout schedule, selected when the admin adds/edits an investor.
-- Flows into the LOI and promissory note wording.
-- Run in the Supabase SQL editor (Dashboard → SQL → New query → paste → Run).

alter table public.investors
  add column if not exists payment_schedule text not null default 'quarterly'
  check (payment_schedule in ('monthly', 'quarterly', 'annual', 'maturity'));
