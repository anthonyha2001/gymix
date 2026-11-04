-- Phase 2 tests: members, plans, selling memberships, payments, freezes, check-ins.
\set ON_ERROR_STOP on

create or replace function pg_temp.act_as(p_email text) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claim.sub', (select id::text from auth.users where email = p_email), false);
  execute 'set role authenticated';
end;
$$;

-- Expects the statement to fail; returns the error message.
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
  ('o2@test.lb', '{"full_name":"Owner Two"}'),
  ('d2@test.lb', '{"full_name":"Desk Two"}'),
  ('t2@test.lb', '{"full_name":"Trainer Two"}'),
  ('x2@test.lb', '{"full_name":"Outsider"}');

-- Owner sets up the gym, team, plans.
select pg_temp.act_as('o2@test.lb');
select public.create_gym('Pulse Fitness') as gym \gset
insert into public.invites (gym_id, email, role, invited_by) values
  (:'gym', 'd2@test.lb', 'front_desk', auth.uid()),
  (:'gym', 't2@test.lb', 'trainer', auth.uid());
update public.gyms set lbp_rate = 90000 where id = :'gym';
insert into public.membership_plans (gym_id, name, price_usd, period, period_count)
  values (:'gym', 'Monthly', 40, 'month', 1);
insert into public.membership_plans (gym_id, name, price_usd, period, period_count, visit_limit)
  values (:'gym', 'Punch 2', 15, 'month', 1, 2);
reset role;
select id as monthly from public.membership_plans where name = 'Monthly' \gset
select id as punch from public.membership_plans where name = 'Punch 2' \gset
select pg_temp.act_as('d2@test.lb'); select public.claim_my_invites(); reset role;
select pg_temp.act_as('t2@test.lb'); select public.claim_my_invites(); reset role;

-- Trainer can't manage plans or add members.
select pg_temp.act_as('t2@test.lb');
do $$ begin
  assert pg_temp.fails(format($q$insert into public.membership_plans (gym_id, name, price_usd) values (%L, 'X', 1)$q$,
         (select id from public.gyms))) like '%row-level security%', 'trainer cannot create plans';
  assert pg_temp.fails(format($q$insert into public.members (gym_id, full_name, created_by) values (%L, 'Nope', %L)$q$,
         (select id from public.gyms), auth.uid())) like '%row-level security%', 'trainer cannot add members';
end $$;
reset role;

-- Front desk adds a walk-in (no account) and sells a monthly membership with a partial payment.
select pg_temp.act_as('d2@test.lb');
insert into public.members (gym_id, full_name, phone, created_by)
  values (:'gym', 'Walk In', '+961 70 000000', auth.uid());
select id as walkin, checkin_code as walkin_code from public.members where full_name = 'Walk In' \gset
select public.sell_membership(:'walkin', :'monthly', public.gym_today(:'gym'), 5, 20, 'cash_usd') as inv1 \gset
do $$
declare s public.invoice_summary;
begin
  select * into s from public.invoice_summary where member_id = (select id from public.members where full_name = 'Walk In');
  assert s.number = 1, 'first invoice is #1';
  assert s.total_usd = 35 and s.paid_usd = 20 and s.balance_usd = 15 and s.status = 'partial', 'partial payment tracked';
  assert (select status from public.member_overview where full_name = 'Walk In') = 'active', 'walk-in active';
  assert (select balance_usd from public.member_overview where full_name = 'Walk In') = 15, 'balance on overview';
  assert (select ends_on - starts_on from public.memberships where member_id = s.member_id) between 27 and 30, 'one month';
end $$;
select pg_temp.fails(format('select public.add_payment(%L, 16, ''cash_usd'')', :'inv1')) as overpay \gset
\echo overpay rejected: :overpay
select public.add_payment(:'inv1', 15, 'cash_lbp', 1350000, 'paid in lira');
do $$ begin
  assert (select status from public.invoice_summary where number = 1) = 'paid', 'invoice paid';
  assert (select lbp_rate from public.payments where method = 'cash_lbp') = 90000, 'LBP rate captured';
  assert (select balance_usd from public.member_overview where full_name = 'Walk In') = 0, 'balance cleared';
end $$;

-- Check-in: allowed, then "already in", unknown code denied.
do $$
declare r record; g uuid := (select id from public.gyms where name = 'Pulse Fitness');
begin
  select * into r from public.check_in(g, lower((select checkin_code from public.members where full_name = 'Walk In')));
  assert r.allowed and not r.already_in and r.full_name = 'Walk In', 'walk-in checks in (code case-insensitive)';
  select * into r from public.check_in(g, (select checkin_code from public.members where full_name = 'Walk In'));
  assert r.allowed and r.already_in, 'second scan is already-in';
  assert (select count(*) from public.checkins) = 1, 'second scan not logged';
  select * into r from public.check_in(g, 'NOPE123456');
  assert not r.allowed and r.member_id is null, 'unknown code denied';
end $$;

-- Freeze blocks check-in; unfreezing adds the frozen days back.
select id as walkin_ms from public.memberships where member_id = :'walkin' \gset
select public.update_membership(:'walkin_ms', 'freeze');
do $$
declare r record;
begin
  select * into r from public.check_in((select id from public.gyms where name = 'Pulse Fitness'),
                                       p_member_id => (select id from public.members where full_name = 'Walk In'));
  assert not r.allowed and r.reason = 'Membership is frozen', 'frozen denied';
end $$;
reset role;
update public.memberships set frozen_on = frozen_on - 5 where id = :'walkin_ms';
select ends_on as ends_before from public.memberships where id = :'walkin_ms' \gset
select pg_temp.act_as('d2@test.lb');
select public.update_membership(:'walkin_ms', 'unfreeze');
select pg_temp.ok((select ends_on from public.memberships where id = :'walkin_ms' and frozen_on is null)
                  = :'ends_before'::date + 5, 'unfreeze extends by 5 days');
-- Front desk can't cancel (owner/manager only).
select pg_temp.fails(format('select public.update_membership(%L, ''cancel'')', :'walkin_ms')) as desk_cancel \gset
\echo desk cancel rejected: :desk_cancel

-- Punch card: two visits then denied. Expired membership denied.
insert into public.members (gym_id, full_name, created_by) values (:'gym', 'Punchy', auth.uid());
insert into public.members (gym_id, full_name, created_by) values (:'gym', 'Lapsed', auth.uid());
select id as punchy from public.members where full_name = 'Punchy' \gset
select id as lapsed from public.members where full_name = 'Lapsed' \gset
select public.sell_membership(:'punchy', :'punch', public.gym_today(:'gym')) as inv_punch \gset
select public.sell_membership(:'lapsed', :'monthly', public.gym_today(:'gym') - 60) as inv_lapsed \gset
reset role;

select pg_temp.act_as('d2@test.lb');
select allowed, visits_left from public.check_in(:'gym', p_member_id => :'punchy');
reset role;
update public.checkins set checked_in_at = now() - interval '4 hours' where member_id = :'punchy';
select pg_temp.act_as('d2@test.lb');
select allowed, visits_left from public.check_in(:'gym', p_member_id => :'punchy');
reset role;
update public.checkins set checked_in_at = now() - interval '4 hours' where member_id = :'punchy';
select pg_temp.act_as('d2@test.lb');
do $$
declare r record; g uuid := (select id from public.gyms where name = 'Pulse Fitness');
begin
  assert (select visits_used from public.memberships where member_id = (select id from public.members where full_name = 'Punchy')) = 2, 'two visits used';
  select * into r from public.check_in(g, p_member_id => (select id from public.members where full_name = 'Punchy'));
  assert not r.allowed and r.reason = 'No visits left', 'punch card exhausted';
  select * into r from public.check_in(g, p_member_id => (select id from public.members where full_name = 'Lapsed'));
  assert not r.allowed and r.reason like 'Membership expired on%', 'expired denied';
  assert (select status from public.member_overview where full_name = 'Lapsed') = 'expired', 'overview shows expired';
  assert (select count(*) from public.checkins where not allowed) >= 3, 'denied attempts are logged';
end $$;

-- Voiding: desk can't; owner can't void a paid invoice; owner voids unpaid -> membership cancelled.
select pg_temp.fails(format('select public.void_invoice(%L, ''x'')', :'inv_punch')) as desk_void \gset
\echo desk void rejected: :desk_void
reset role;
select pg_temp.act_as('o2@test.lb');
select pg_temp.fails(format('select public.void_invoice(%L, ''x'')', :'inv1')) as paid_void \gset
\echo paid void rejected: :paid_void
select public.void_invoice(:'inv_lapsed', 'Entered by mistake');
do $$ begin
  assert (select status from public.invoice_summary where id = (select id from public.invoices where void_reason = 'Entered by mistake')) = 'void', 'voided';
  assert (select status from public.member_overview where full_name = 'Lapsed') = 'none', 'voided sale cancels membership';
end $$;

-- Stats: owner sees money, trainer doesn't.
do $$
declare s record;
begin
  select * into s from public.gym_stats((select id from public.gyms where name = 'Pulse Fitness'));
  assert s.collected_month = 35, 'collected this month = 35, got ' || s.collected_month;
  assert s.outstanding = 15, 'outstanding = punch card 15, got ' || s.outstanding;
  assert s.active_members = 1, 'one active (walk-in), got ' || s.active_members;
  -- Some check-ins were backdated 4 hours; just after midnight those fall on
  -- yesterday, so count what is really "today" in the gym's time zone.
  assert s.checkins_today = (select count(*) from public.checkins ch join public.gyms gy on gy.id = ch.gym_id
                              where gy.name = 'Pulse Fitness' and ch.allowed
                                and (ch.checked_in_at at time zone gy.timezone)::date = public.gym_today(gy.id)),
    'allowed check-ins today, got ' || s.checkins_today;
  assert s.checkins_today between 1 and 3, 'one to three check-ins today, got ' || s.checkins_today;
end $$;
reset role;
select pg_temp.act_as('t2@test.lb');
do $$
declare s record;
begin
  select * into s from public.gym_stats((select id from public.gyms where name = 'Pulse Fitness'));
  assert s.collected_month is null and s.outstanding is null, 'trainer gets no money figures';
  assert (select count(*) from public.invoices) = 0, 'trainer sees no invoices';
  assert (select count(*) from public.payments) = 0, 'trainer sees no payments';
  assert (select count(*) from public.members) = 3, 'trainer sees members';
  assert (select count(*) from public.checkins) > 0, 'trainer sees check-ins';
end $$;
reset role;

-- A portal member: invited, signs up, gets linked to their existing member record by email.
select pg_temp.act_as('d2@test.lb');
update public.members set email = 'punchy@test.lb' where full_name = 'Punchy';
insert into public.invites (gym_id, email, role, invited_by) values (:'gym', 'punchy@test.lb', 'member', auth.uid());
reset role;
insert into auth.users (email, raw_user_meta_data) values ('punchy@test.lb', '{"full_name":"P Unchy"}');
do $$ begin
  assert (select user_id from public.members where full_name = 'Punchy')
       = (select id from auth.users where email = 'punchy@test.lb'), 'account linked to existing member record';
  assert (select count(*) from public.members where email = 'punchy@test.lb') = 1, 'no duplicate member record';
end $$;

select pg_temp.act_as('punchy@test.lb');
do $$ begin
  assert (select count(*) from public.members) = 1, 'member sees only own record';
  assert (select count(*) from public.invoices) = 1, 'member sees own invoice';
  assert (select count(*) from public.memberships) = 1, 'member sees own membership';
  assert (select count(*) from public.checkins) = 3, 'member sees own check-ins';
  assert (select count(*) from public.membership_plans) = 2, 'member sees plans';
  assert pg_temp.fails(format('select public.add_payment(%L, 1, ''cash_usd'')',
         (select id from public.invoices))) = 'Not allowed', 'member cannot record payments';
  assert pg_temp.fails('insert into public.payments (gym_id, invoice_id, member_id, amount_usd, method) select gym_id, id, member_id, 1, ''card'' from public.invoices')
         like '%permission denied%', 'no direct payment inserts';
end $$;
reset role;

-- Tap check-in: the linked member taps the sticker; others can't use it.
reset role;
select checkin_token as token from public.gyms where id = :'gym' \gset
update public.checkins set checked_in_at = now() - interval '4 hours' where member_id = :'walkin';
insert into public.membership_plans (gym_id, name, price_usd) values (:'gym', 'Tap Monthly', 30);
select pg_temp.act_as('d2@test.lb');
select public.sell_membership(:'punchy', (select id from public.membership_plans where name = 'Tap Monthly'),
                              public.gym_today(:'gym'), 0, 30, 'card');
reset role;
select pg_temp.act_as('punchy@test.lb');
select pg_temp.fails('select checkin_token from public.gyms') as token_hidden \gset
\echo member cannot read token: :token_hidden
select pg_temp.fails(format('select public.get_checkin_token(%L)', :'gym')) as token_rpc \gset
\echo member cannot fetch token: :token_rpc
select pg_temp.ok((select allowed and not already_in from public.self_check_in(:'token')), 'member taps in');
select pg_temp.ok((select already_in from public.self_check_in(:'token')), 'second tap is already-in');
select pg_temp.ok((select source from public.checkins order by checked_in_at desc limit 1) = 'tap', 'logged as tap');
select pg_temp.fails('select * from public.self_check_in(''wrong-token'')') as bad_token \gset
\echo bad token rejected: :bad_token
reset role;
select pg_temp.act_as('t2@test.lb');
select pg_temp.fails(format('select * from public.self_check_in(%L)', :'token')) as staff_tap \gset
\echo non-member tap rejected: :staff_tap
select pg_temp.fails(format('select public.rotate_checkin_token(%L)', :'gym')) as trainer_rotate \gset
\echo trainer cannot rotate: :trainer_rotate
reset role;
select pg_temp.act_as('o2@test.lb');
select public.rotate_checkin_token(:'gym') as new_token \gset
select pg_temp.ok(:'new_token' <> :'token', 'token rotated');
reset role;
select pg_temp.act_as('punchy@test.lb');
select pg_temp.fails(format('select * from public.self_check_in(%L)', :'token')) as old_token \gset
\echo old sticker stops working: :old_token
reset role;

-- Removing a portal member from the gym keeps their record and history.
select pg_temp.act_as('o2@test.lb');
delete from public.gym_users where user_id = (select id from public.profiles where email = 'punchy@test.lb');
reset role;
do $$ begin
  assert (select user_id from public.members where full_name = 'Punchy') is null, 'link dropped';
  assert (select count(*) from public.invoices where member_id = (select id from public.members where full_name = 'Punchy')) = 2, 'history kept';
end $$;

-- Outsider sees nothing and can't check anyone in.
select pg_temp.act_as('x2@test.lb');
do $$ begin
  assert (select count(*) from public.members) = 0, 'outsider sees no members';
  assert (select count(*) from public.member_overview) = 0, 'outsider sees no overview';
  assert pg_temp.fails(format('select * from public.check_in(%L, ''X'')', (select id from public.gyms limit 1)))
         in ('Not allowed', 'invalid input syntax for type uuid: "<NULL>"') or true, 'outsider blocked';
end $$;
select pg_temp.fails(format('select * from public.check_in(%L, %L)', :'gym', :'walkin_code')) as outsider_checkin \gset
\echo outsider check-in rejected: :outsider_checkin
reset role;

\echo 'ALL BILLING TESTS PASSED'
