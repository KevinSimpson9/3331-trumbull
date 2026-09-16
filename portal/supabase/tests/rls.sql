-- Row-level security regression test.
--
-- Run against a THROWAWAY database, never production — it inserts and deletes
-- its own fixtures. Against a local Postgres you also need stubs for the
-- Supabase-managed auth and storage schemas; see the header comment in
-- supabase/schema.sql for what this file assumes exists.
--
--   psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/tests/rls.sql
--
-- Guards the property the whole portal rests on: an investor reaches their own
-- row, their own documents, their own thread, and updates either addressed to
-- them or shared with everyone. Nothing else. A signed-out caller reaches
-- nothing at all.
--
-- That last case is not hypothetical. A first cut of the updates policy read
--   `public.is_admin() or investor_id is null or investor_id in (...)`
-- which is TRUE for anonymous callers, and the anon key ships in the browser
-- bundle — every broadcast update was readable straight off the REST API.

begin;

create temporary table rls_result (label text, got bigint, want bigint);

do $$
declare
  marcus_auth uuid := gen_random_uuid();
  dana_auth   uuid := gen_random_uuid();
  marcus_id   uuid;
  dana_id     uuid;
  r record;
begin
  insert into auth.users (id, email) values
    (marcus_auth, 'rls-marcus@test.invalid'), (dana_auth, 'rls-dana@test.invalid');

  insert into public.investors (auth_user_id, legal_name, email, principal)
  values (marcus_auth, 'RLS Marcus', 'rls-marcus@test.invalid', 1000) returning id into marcus_id;
  insert into public.investors (auth_user_id, legal_name, email, principal)
  values (dana_auth, 'RLS Dana', 'rls-dana@test.invalid', 1000) returning id into dana_id;

  insert into public.investor_documents (investor_id, title, file_name, storage_path)
  values (marcus_id, 'RLS Marcus doc', 'm.pdf', marcus_id || '/m.pdf'),
         (dana_id,   'RLS Dana doc',   'd.pdf', dana_id   || '/d.pdf');

  insert into public.investor_updates (investor_id, title) values
    (null, 'RLS shared update'), (marcus_id, 'RLS Marcus-only update');

  insert into public.messages (investor_id, sender, body)
  values (marcus_id, 'admin', 'RLS fixture message');

  -- RLS does not apply to the table owner, so the checks below run as the
  -- unprivileged role a real session uses. Results are collected into a
  -- record first because the temp table is not writable under that role.
  execute 'set local role authenticated';

  perform set_config('test.uid', marcus_auth::text, true);
  perform set_config('test.jwt', '{"email":"rls-marcus@test.invalid"}', true);
  select
    (select count(*) from public.investor_documents where title = 'RLS Marcus doc')          as a,
    (select count(*) from public.investor_documents where title = 'RLS Dana doc')            as b,
    (select count(*) from public.investor_updates   where title = 'RLS shared update')       as c,
    (select count(*) from public.investor_updates   where title = 'RLS Marcus-only update')  as d
  into r;
  execute 'reset role';
  insert into rls_result values
    ('marcus sees own document',        r.a, 1),
    ('marcus cannot see dana document', r.b, 0),
    ('marcus sees shared update',       r.c, 1),
    ('marcus sees own update',          r.d, 1);

  execute 'set local role authenticated';
  perform set_config('test.uid', dana_auth::text, true);
  perform set_config('test.jwt', '{"email":"rls-dana@test.invalid"}', true);
  select
    (select count(*) from public.investor_documents where title = 'RLS Marcus doc')           as a,
    (select count(*) from public.investor_updates   where title = 'RLS Marcus-only update')   as b,
    (select count(*) from public.investor_updates   where title = 'RLS shared update')        as c,
    (select count(*) from public.messages           where body  = 'RLS fixture message')      as d
  into r;
  execute 'reset role';
  insert into rls_result values
    ('dana cannot see marcus document', r.a, 0),
    ('dana cannot see marcus update',   r.b, 0),
    ('dana sees shared update',         r.c, 1),
    ('dana cannot see marcus messages', r.d, 0);

  -- Signed out. Every count must be zero, the shared update included.
  execute 'set local role authenticated';
  perform set_config('test.uid', '', true);
  perform set_config('test.jwt', '{}', true);
  select
    (select count(*) from public.investors          where email like 'rls-%@test.invalid') as a,
    (select count(*) from public.investor_documents where title like 'RLS %')              as b,
    (select count(*) from public.investor_updates   where title like 'RLS %')              as c,
    (select count(*) from public.messages           where body  = 'RLS fixture message')   as d
  into r;
  execute 'reset role';
  insert into rls_result values
    ('anon sees no investors', r.a, 0),
    ('anon sees no documents', r.b, 0),
    ('anon sees no updates',   r.c, 0),
    ('anon sees no messages',  r.d, 0);
end $$;

select case when got = want then 'PASS' else 'FAIL' end as result, label, got, want
from rls_result order by (got = want), label;

do $$
declare failures int;
begin
  select count(*) into failures from rls_result where got is distinct from want;
  if failures > 0 then
    raise exception 'RLS regression: % check(s) failed', failures;
  end if;
  raise notice 'RLS: all checks passed';
end $$;

rollback;
