-- Hands-on demo: the sample gym is built in full, is private to its sign-ins,
-- is left out of the admin list, and is found and removed once expired.
\set ON_ERROR_STOP on

create or replace function pg_temp.ok(p_cond boolean, p_msg text) returns void language plpgsql as $$
begin
  if p_cond is not true then raise exception 'assertion failed: %', p_msg; end if;
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

insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-00000000de01', 'owner-a@demo.gymix.invalid', '{"full_name":"Alex Demo"}'),
  ('00000000-0000-0000-0000-00000000de02', 'member-a@demo.gymix.invalid', '{"full_name":"Karim Aoun"}'),
  ('00000000-0000-0000-0000-00000000de03', 'visitor@test.lb', '{"full_name":"Someone Else"}');

-- Only the server can build one.
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000de03', false);
select pg_temp.ok(pg_temp.fails($q$select public.create_demo_gym('00000000-0000-0000-0000-00000000de03', '00000000-0000-0000-0000-00000000de03')$q$) like '%permission%', 'users cannot create demo gyms');
reset role;

set role service_role;
select public.create_demo_gym('00000000-0000-0000-0000-00000000de01', '00000000-0000-0000-0000-00000000de02') as gym \gset
reset role;

select pg_temp.ok((select demo_expires_at between now() + interval '23 hours' and now() + interval '25 hours' from public.gyms where id = :'gym'), 'expires in 24 hours');
select pg_temp.ok((select count(*) from public.members where gym_id = :'gym') = 25, '25 members');
select pg_temp.ok((select count(*) from public.memberships where gym_id = :'gym') = 24, '24 memberships');
select pg_temp.ok((select count(*) from public.checkins where gym_id = :'gym' and checked_in_at > now() - interval '75 minutes') = 9, 'nine people in now');
select pg_temp.ok((select count(*) from public.checkins where gym_id = :'gym' and not allowed) = 1, 'one refused entry');
select pg_temp.ok((select count(*) from public.classes where gym_id = :'gym') = 6, 'six classes');
select pg_temp.ok((select count(*) from public.products where gym_id = :'gym') = 8, 'eight products');
select pg_temp.ok((select count(*) from public.sales where gym_id = :'gym') = 26, '26 sales');
select pg_temp.ok((select count(*) from public.programs where gym_id = :'gym' and is_active) = 2, 'two active programs');
select pg_temp.ok((select role::text from public.gym_users where gym_id = :'gym' and user_id = '00000000-0000-0000-0000-00000000de02') = 'member', 'member sign-in linked');
select pg_temp.ok((select frozen_on is not null from public.memberships ms join public.members m on m.id = ms.member_id where m.gym_id = :'gym' and m.full_name = 'Lynn Tannous'), 'Lynn is paused');
select pg_temp.ok(current_setting('request.jwt.claim.sub', true) = '00000000-0000-0000-0000-00000000de03', 'claim restored to what it was');

-- Private: another user sees nothing of it.
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000de03', false);
select pg_temp.ok((select count(*) from public.members where gym_id = :'gym') = 0, 'other users see no members');
select pg_temp.ok(pg_temp.fails('select * from public.demo_users') like '%permission%', 'demo_users is server only');
reset role;

-- Left out of the super admin's gym list.
insert into public.platform_admins (user_id) values ('00000000-0000-0000-0000-00000000de03') on conflict do nothing;
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000de03', false);
select pg_temp.ok((select count(*) from public.admin_gym_overview() where gym_id = :'gym') = 0, 'not in the admin list');
reset role;

-- Expired: listed with both sign-ins; deleting the gym removes its data.
set role service_role;
select pg_temp.ok((select count(*) from public.expired_demo_gyms() where gym_id = :'gym') = 0, 'not expired yet');
reset role;
update public.gyms set demo_expires_at = now() - interval '1 minute' where id = :'gym';
set role service_role;
select pg_temp.ok((select cardinality(user_ids) from public.expired_demo_gyms() where gym_id = :'gym') = 2, 'expired with two sign-ins');
reset role;
delete from public.gyms where id = :'gym';
select pg_temp.ok((select count(*) from public.members where gym_id = :'gym') = 0, 'data removed');
select pg_temp.ok((select count(*) from public.demo_users where gym_id = :'gym') = 0, 'demo users rows removed');

\echo 'demo_test passed'
