-- Platform admin tests.
\set ON_ERROR_STOP on

create or replace function pg_temp.act_as(p_email text) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claim.sub', (select id::text from auth.users where email = p_email), false);
  execute 'set role authenticated';
end;
$$;

create or replace function pg_temp.fails(p_sql text) returns text language plpgsql as $$
begin
  execute p_sql;
  raise exception 'expected failure but succeeded: %', p_sql;
exception when others then
  if sqlerrm like 'expected failure%' then raise; end if;
  return sqlerrm;
end;
$$;

insert into auth.users (email, raw_user_meta_data) values
  ('boss@test.lb', '{"full_name":"Platform Boss"}'),
  ('owner@test.lb', '{"full_name":"Gym Owner"}');
insert into public.platform_admins (user_id) select id from public.profiles where email = 'boss@test.lb';

select pg_temp.act_as('owner@test.lb');
select public.create_gym('Some Gym');
select pg_temp.fails('select * from public.admin_gym_overview()') as owner_admin \gset
\echo gym owner is not a platform admin: :owner_admin
select pg_temp.fails('select * from public.platform_admins') as owner_table \gset
\echo admin list is hidden: :owner_table
do $$ begin assert not public.is_platform_admin(), 'owner not admin'; end $$;
reset role;

select pg_temp.act_as('boss@test.lb');
do $$
declare r record;
begin
  assert public.is_platform_admin(), 'boss is admin';
  select * into r from public.admin_gym_overview();
  assert r.name = 'Some Gym' and r.owner_email = 'owner@test.lb' and r.staff = 1, 'overview row';
  -- No member-data access through RLS.
  assert (select count(*) from public.gyms) = 0, 'admin cannot read gyms table directly';
  assert (select count(*) from public.members) = 0, 'admin cannot read members';
end $$;
reset role;

\echo 'ALL ADMIN TESTS PASSED'
