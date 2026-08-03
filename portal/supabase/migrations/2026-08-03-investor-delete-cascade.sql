-- Guarantees that deleting an investor also deletes their signatures and
-- messages, even on databases created before these cascades existed. Run once
-- in the Supabase SQL editor (Dashboard → SQL → New query → paste → Run).
-- The app also deletes dependents explicitly before removing the investor,
-- so this is belt-and-braces.

alter table public.signatures drop constraint if exists signatures_investor_id_fkey;
alter table public.signatures add constraint signatures_investor_id_fkey
  foreign key (investor_id) references public.investors (id) on delete cascade;

alter table public.messages drop constraint if exists messages_investor_id_fkey;
alter table public.messages add constraint messages_investor_id_fkey
  foreign key (investor_id) references public.investors (id) on delete cascade;
