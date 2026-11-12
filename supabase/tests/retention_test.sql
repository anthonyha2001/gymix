-- Retention: win-back nudges, announcements and the nightly summary.
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
  ('rt-owner@test.lb', '{"full_name":"Owner Rt"}'),
  ('rt-desk@test.lb', '{"full_name":"Desk Rt"}'),
  ('rt-nour@test.lb', '{"full_name":"Nour Khalil"}'),
  ('rt-rami@test.lb', '{"full_name":"Rami Haddad"}'),
  ('rt-lara@test.lb', '{"full_name":"Lara Nassar"}');
select pg_temp.act_as('rt-owner@test.lb');
select set_config('t.gym', public.create_gym('Retain Gym')::text, false);
insert into public.invites (gym_id, email, role, invited_by) values (pg_temp.v('gym'), 'rt-desk@test.lb', 'front_desk', auth.uid());
reset role;
select pg_temp.act_as('rt-desk@test.lb'); select public.claim_my_invites(); reset role;
update public.gyms set created_at = now() - interval '30 days' where id = pg_temp.v('gym');

insert into public.members (gym_id, full_name, phone, user_id) values
  (pg_temp.v('gym'), 'Nour Khalil', '70800001', (select id from auth.users where email = 'rt-nour@test.lb')),
  (pg_temp.v('gym'), 'Rami Haddad', '70800002', (select id from auth.users where email = 'rt-rami@test.lb')),
  (pg_temp.v('gym'), 'Lara Nassar', '70800003', (select id from auth.users where email = 'rt-lara@test.lb'));
insert into public.gym_users (gym_id, user_id, role) select pg_temp.v('gym'), id, 'member' from auth.users where email in ('rt-nour@test.lb', 'rt-rami@test.lb', 'rt-lara@test.lb');
select set_config('t.nour', (select id::text from public.members where full_name = 'Nour Khalil'), false);
select set_config('t.rami', (select id::text from public.members where full_name = 'Rami Haddad'), false);
select set_config('t.lara', (select id::text from public.members where full_name = 'Lara Nassar'), false);
-- Nour: running membership, last came 15 days ago. Rami: came today. Lara: membership ended.
insert into public.memberships (gym_id, member_id, plan_name, starts_on, ends_on) values
  (pg_temp.v('gym'), pg_temp.v('nour'), 'Monthly', current_date - 40, current_date + 20),
  (pg_temp.v('gym'), pg_temp.v('rami'), 'Monthly', current_date - 40, current_date + 3),
  (pg_temp.v('gym'), pg_temp.v('lara'), 'Monthly', current_date - 60, current_date - 2);
insert into public.checkins (gym_id, member_id, source, allowed, checked_in_at) values
  (pg_temp.v('gym'), pg_temp.v('nour'), 'desk', true, now() - interval '15 days'),
  (pg_temp.v('gym'), pg_temp.v('rami'), 'desk', true, now());

-- Win-back: only Nour, and only once for this absence.
select pg_temp.ok(public.send_winbacks() = 1, 'one nudge');
select pg_temp.ok(public.send_winbacks() = 0, 'not twice');
select pg_temp.ok((select title = 'We miss you, Nour' from public.notifications where kind = 'winback'), 'nudge text');
update public.gyms set winback_days = null where id = pg_temp.v('gym');
delete from public.notifications where kind = 'winback';
select pg_temp.ok(public.send_winbacks() = 0, 'off means off');

-- Announcements: owners and managers only; audiences.
select pg_temp.act_as('rt-desk@test.lb');
select pg_temp.ok(pg_temp.fails(format($q$select public.send_announcement(%L, 'members', 'Hi')$q$, pg_temp.v('gym'))) like 'Only owners and managers%', 'desk cannot announce');
reset role;
select pg_temp.act_as('rt-owner@test.lb');
select pg_temp.ok(public.announcement_reach(pg_temp.v('gym'), 'members') = 2, 'two active members');
select pg_temp.ok(public.announcement_reach(pg_temp.v('gym'), 'expiring') = 1, 'rami is expiring');
select pg_temp.ok(public.announcement_reach(pg_temp.v('gym'), 'inactive') = 1, 'nour is inactive');
select pg_temp.ok(public.announcement_reach(pg_temp.v('gym'), 'staff') = 2, 'owner and desk');
select pg_temp.ok(public.send_announcement(pg_temp.v('gym'), 'members', 'Pool closed tomorrow', 'Maintenance until 2 pm') = 2, 'sent to two');
select pg_temp.ok((select count(*) = 1 from public.gym_announcements where sent_to = 2), 'history kept');
reset role;
select pg_temp.ok((select count(*) = 2 from public.notifications where kind = 'announcement' and title = 'Pool closed tomorrow'), 'two notifications');

-- Nightly summary: owner and manager roles get one each; once per day.
select pg_temp.ok(public.send_daily_summaries() >= 1, 'summary sent');
select pg_temp.ok((select count(*) = 1 from public.notifications where kind = 'summary' and title = 'Today at Retain Gym'), 'owner only (desk is not a manager)');
select pg_temp.ok((select body like '1 check-in%' from public.notifications where kind = 'summary' and title = 'Today at Retain Gym'), 'one check-in today');
select public.send_daily_summaries();
select pg_temp.ok((select count(*) = 1 from public.notifications where kind = 'summary' and title = 'Today at Retain Gym'), 'not twice');

-- Members can't run the jobs.
select pg_temp.act_as('rt-nour@test.lb');
select pg_temp.ok(pg_temp.fails('select public.send_winbacks()') like '%permission denied%', 'members cannot run win-back');
reset role;
select 'retention: all passed' as result;
