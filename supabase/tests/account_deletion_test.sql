-- Deleting your own account: personal data goes, the gym keeps its records, owners are blocked.
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

create or replace function pg_temp.ok(p_cond boolean, p_msg text) returns void language plpgsql as $$
begin
  if p_cond is not true then raise exception 'assertion failed: %', p_msg; end if;
end;
$$;

create or replace function pg_temp.v(p_key text) returns uuid language sql as $$
  select current_setting('t.' || p_key)::uuid
$$;

insert into auth.users (email, raw_user_meta_data) values
  ('ad-owner@test.lb', '{"full_name":"Owner Ad"}'),
  ('ad-nour@test.lb', '{"full_name":"Nour Ad"}'),
  ('ad-rami@test.lb', '{"full_name":"Rami Ad"}'),
  ('ad-desk@test.lb', '{"full_name":"Desk Ad"}');

select pg_temp.act_as('ad-owner@test.lb');
select set_config('t.gym', public.create_gym('Delete Gym')::text, false);
insert into public.invites (gym_id, email, role, invited_by) values (pg_temp.v('gym'), 'ad-desk@test.lb', 'front_desk', auth.uid());
reset role;
select pg_temp.act_as('ad-desk@test.lb'); select public.claim_my_invites(); reset role;

insert into public.members (gym_id, full_name, phone, user_id) values
  (pg_temp.v('gym'), 'Nour Ad', '70500001', (select id from auth.users where email = 'ad-nour@test.lb')),
  (pg_temp.v('gym'), 'Rami Ad', '70500002', (select id from auth.users where email = 'ad-rami@test.lb'));
insert into public.gym_users (gym_id, user_id, role)
select pg_temp.v('gym'), id, 'member' from auth.users where email in ('ad-nour@test.lb', 'ad-rami@test.lb');
select set_config('t.nour', (select id::text from public.members where full_name = 'Nour Ad'), false);
select set_config('t.rami', (select id::text from public.members where full_name = 'Rami Ad'), false);

insert into public.workout_sessions (gym_id, member_id) values (pg_temp.v('gym'), pg_temp.v('nour')), (pg_temp.v('gym'), pg_temp.v('rami'));
insert into public.body_measurements (gym_id, member_id, weight_kg, measured_on) values (pg_temp.v('gym'), pg_temp.v('nour'), 80, current_date);
insert into public.checkins (gym_id, member_id, source, allowed) values (pg_temp.v('gym'), pg_temp.v('nour'), 'desk', true);

-- Nour deletes her data.
select pg_temp.act_as('ad-nour@test.lb');
select pg_temp.ok(public.account_deletion_blocker() is null, 'members are not blocked');
select pg_temp.ok((public.delete_my_account_data() ->> 'workouts')::int = 1, 'one workout removed');
reset role;
select pg_temp.ok(not exists (select 1 from public.workout_sessions where member_id = pg_temp.v('nour')), 'workouts gone');
select pg_temp.ok(not exists (select 1 from public.body_measurements where member_id = pg_temp.v('nour')), 'measurements gone');
select pg_temp.ok(exists (select 1 from public.checkins where member_id = pg_temp.v('nour')), 'gym keeps check-ins');
select pg_temp.ok((select user_id is null from public.members where id = pg_temp.v('nour')), 'member record unlinked');
select pg_temp.ok(exists (select 1 from public.workout_sessions where member_id = pg_temp.v('rami')), 'other members untouched');

-- The login itself can then be deleted without breaking anything.
delete from auth.users where email = 'ad-nour@test.lb';
select pg_temp.ok(exists (select 1 from public.members where id = pg_temp.v('nour')), 'member record survives');

-- The only owner of a real gym is blocked.
select pg_temp.act_as('ad-owner@test.lb');
select pg_temp.ok(public.account_deletion_blocker() like 'You own Delete Gym.%', 'owner blocker message');
select pg_temp.ok(pg_temp.fails('select public.delete_my_account_data()') like 'You own Delete Gym.%', 'owner cannot delete');
reset role;

-- Staff can delete; their records stay with the gym.
select pg_temp.act_as('ad-desk@test.lb');
select pg_temp.ok(public.account_deletion_blocker() is null, 'staff not blocked');
select public.delete_my_account_data();
reset role;
delete from auth.users where email = 'ad-desk@test.lb';
select pg_temp.ok(not exists (select 1 from public.gym_users gu join auth.users u on u.id = gu.user_id where u.email = 'ad-desk@test.lb'), 'staff role removed');

-- Anonymous visitors can't call it.
set role anon;
select pg_temp.ok(pg_temp.fails('select public.delete_my_account_data()') like '%permission denied%', 'anon cannot call');
reset role;

select 'account deletion: all passed' as result;
