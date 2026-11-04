-- Unpaid accounts: frozen after the grace period, unfrozen by a check-in once paid.
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

insert into auth.users (email, raw_user_meta_data) values
  ('o8@test.lb', '{"full_name":"Owner Eight"}'),
  ('f8@test.lb', '{"full_name":"Front Eight"}'),
  ('m8@test.lb', '{"full_name":"Maya Eight"}');

select pg_temp.act_as('o8@test.lb');
select public.create_gym('Gym Eight') as gym \gset
insert into public.invites (gym_id, email, role, invited_by) values
  (:'gym', 'f8@test.lb', 'front_desk', auth.uid()),
  (:'gym', 'm8@test.lb', 'member', auth.uid());
insert into public.membership_plans (gym_id, name, price_usd) values (:'gym', 'Monthly', 40);
reset role;
select pg_temp.act_as('f8@test.lb'); select public.claim_my_invites(); reset role;
select pg_temp.act_as('m8@test.lb'); select public.claim_my_invites(); reset role;
select id as m8 from public.members where email = 'm8@test.lb' \gset
select id as plan from public.membership_plans where gym_id = :'gym' \gset
select checkin_token as token from public.gyms where id = :'gym' \gset
select pg_temp.ok((select unpaid_grace_days from public.gyms where id = :'gym') = 3, 'default grace is 3 days');

-- Sold today, unpaid: still inside the grace period.
select pg_temp.act_as('f8@test.lb');
select public.sell_membership(:'m8', :'plan', public.gym_today(:'gym')) as inv \gset
reset role;
select pg_temp.act_as('m8@test.lb');
select pg_temp.ok((select not frozen and balance_usd = 40 and overdue_usd = 0 from public.my_account_status(:'gym')), 'not frozen inside grace');
select pg_temp.ok((select allowed from public.self_check_in(:'token')), 'can check in inside grace');
reset role;

-- Four days later it is overdue.
update public.invoices set issued_on = issued_on - 4 where id = :'inv';
delete from public.checkins where member_id = :'m8';
select pg_temp.act_as('m8@test.lb');
select pg_temp.ok((select frozen and overdue_usd = 40 from public.my_account_status(:'gym')), 'frozen when overdue');
select pg_temp.ok((select count(*) from public.notifications where title = 'Your account is frozen') = 1, 'member told');
select pg_temp.ok((select frozen from public.my_account_status(:'gym')), 'still frozen');
select pg_temp.ok((select count(*) from public.notifications where title = 'Your account is frozen') = 1, 'told once');
select pg_temp.ok((select not allowed and reason like 'Account frozen: unpaid balance of $40.00' from public.self_check_in(:'token')), 'tap refused while unpaid');
-- Members cannot unfreeze themselves or call the internals.
select pg_temp.fails(format('update public.members set unpaid_frozen_at = null where id = %L', :'m8')) as self_unfreeze \gset
select pg_temp.fails(format('select public.overdue_balance(%L)', :'m8')) as internal \gset
select pg_temp.fails(format('select public.freeze_unpaid_members(%L)', :'gym')) as not_staff \gset
\echo member cannot unfreeze: :self_unfreeze
reset role;
select pg_temp.ok((select unpaid_frozen_at is not null from public.members where id = :'m8'), 'freeze survived');

-- Staff see it, and the activity log records it.
select pg_temp.act_as('f8@test.lb');
select pg_temp.ok((select unpaid_frozen_at is not null from public.member_overview where id = :'m8'), 'staff see frozen');
reset role;
select pg_temp.ok((select count(*) from public.activity_log where action = 'member.unpaid_frozen') = 1, 'freeze logged');

-- Paying alone does not unfreeze; the next check-in does.
select pg_temp.act_as('f8@test.lb');
select public.add_payment(:'inv', 40, 'cash_usd');
reset role;
select pg_temp.act_as('m8@test.lb');
select pg_temp.ok((select frozen and overdue_usd = 0 from public.my_account_status(:'gym')), 'still frozen after paying, until a tap');
select pg_temp.ok((select allowed from public.self_check_in(:'token')), 'tap after paying lets them in');
select pg_temp.ok((select not frozen from public.my_account_status(:'gym')), 'unfrozen by the tap');
select pg_temp.ok((select count(*) from public.notifications where title = 'Your account is active again') = 1, 'told it is active again');
reset role;

-- The staff sweep freezes overdue members; the desk check-in unfreezes too.
select pg_temp.act_as('f8@test.lb');
select public.sell_membership(:'m8', :'plan', public.gym_today(:'gym') + 40) as inv2 \gset
reset role;
update public.invoices set issued_on = issued_on - 10 where id = :'inv2';
select pg_temp.act_as('f8@test.lb');
select pg_temp.ok(public.freeze_unpaid_members(:'gym') = 1, 'sweep froze one member');
select pg_temp.ok(public.freeze_unpaid_members(:'gym') = 0, 'sweep is idempotent');
select public.add_payment(:'inv2', 40, 'card');
reset role;
delete from public.checkins where member_id = :'m8';
select pg_temp.act_as('f8@test.lb');
select pg_temp.ok((select allowed from public.check_in(:'gym', p_member_id => :'m8')), 'desk check-in after paying');
select pg_temp.ok((select unpaid_frozen_at is null from public.member_overview where id = :'m8'), 'desk check-in unfroze');
reset role;

-- Grace of 0 days: an unpaid invoice freezes the same day.
update public.gyms set unpaid_grace_days = 0 where id = :'gym';
select pg_temp.act_as('f8@test.lb');
select public.sell_membership(:'m8', :'plan', public.gym_today(:'gym') + 80);
reset role;
select pg_temp.act_as('m8@test.lb');
select pg_temp.ok((select frozen from public.my_account_status(:'gym')), 'zero grace freezes at once');
reset role;

\echo 'ALL UNPAID FREEZE TESTS PASSED'
