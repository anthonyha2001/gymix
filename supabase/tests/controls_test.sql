-- Admin controls tests: archive/delete members, refunds, membership edits, check-in deletes, activity log.
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
  ('o6@test.lb', '{"full_name":"Owner Six"}'),
  ('d6@test.lb', '{"full_name":"Desk Six"}');

select pg_temp.act_as('o6@test.lb');
select public.create_gym('Gym Six') as gym \gset
insert into public.invites (gym_id, email, role, invited_by) values (:'gym', 'd6@test.lb', 'front_desk', auth.uid());
insert into public.membership_plans (gym_id, name, price_usd, visit_limit) values (:'gym', 'Punch 5', 30, 5);
insert into public.members (gym_id, full_name, created_by) values (:'gym', 'Paying Pam', auth.uid()), (:'gym', 'Typo Tom', auth.uid());
reset role;
select pg_temp.act_as('d6@test.lb'); select public.claim_my_invites(); reset role;
select id as pam from public.members where full_name = 'Paying Pam' \gset
select id as tom from public.members where full_name = 'Typo Tom' \gset
select id as plan from public.membership_plans where name = 'Punch 5' \gset

-- Front desk sells and checks Pam in.
select pg_temp.act_as('d6@test.lb');
select public.sell_membership(:'pam', :'plan', public.gym_today(:'gym'), 0, 30, 'cash_usd') as inv \gset
select public.check_in(:'gym', p_member_id => :'pam');
select pg_temp.fails(format('select public.refund_payment((select id from public.payments limit 1), ''x'')')) as desk_refund \gset
\echo front desk cannot refund: :desk_refund
select pg_temp.fails(format('select public.delete_member(%L)', :'tom')) as desk_delete \gset
\echo front desk cannot delete members: :desk_delete
select public.set_member_archived(:'tom', true);
select pg_temp.ok((select archived_at is not null from public.member_overview where id = :'tom'), 'front desk archives');
select public.set_member_archived(:'tom', false);
reset role;

select pg_temp.act_as('o6@test.lb');
-- Refund needs a reason, restores the balance, then the invoice can be voided.
select pg_temp.fails(format('select public.refund_payment((select id from public.payments limit 1), '' '')')) as no_reason \gset
\echo refund without reason rejected: :no_reason
select public.refund_payment((select id from public.payments limit 1), 'Changed their mind');
select pg_temp.ok((select status from public.invoice_summary where id = :'inv') = 'unpaid', 'refunded invoice is unpaid again');
select public.void_invoice(:'inv', 'Refunded');

-- Members with invoices can't be deleted; others can.
select pg_temp.fails(format('select public.delete_member(%L)', :'pam')) as billed_delete \gset
\echo billed member kept: :billed_delete
select public.delete_member(:'tom');
select pg_temp.ok((select count(*) from public.members where id = :'tom') = 0, 'typo member deleted');
reset role;

-- A fresh sale to test membership edits and check-in deletes.
select pg_temp.act_as('o6@test.lb');
select public.sell_membership(:'pam', :'plan', public.gym_today(:'gym'), 0, 0) as inv2 \gset
select id as ms from public.memberships where member_id = :'pam' and cancelled_at is null \gset
reset role;
update public.checkins set checked_in_at = now() - interval '5 hours';
select pg_temp.act_as('d6@test.lb');
select public.check_in(:'gym', p_member_id => :'pam');
reset role;
select pg_temp.ok((select visits_used from public.memberships where id = :'ms') = 1, 'one visit used');
select pg_temp.act_as('o6@test.lb');
select public.delete_checkin((select id from public.checkins where membership_id = :'ms'));
select pg_temp.ok((select visits_used from public.memberships where id = :'ms') = 0, 'visit given back');
select public.adjust_membership(:'ms', public.gym_today(:'gym'), public.gym_today(:'gym') + 60, 10, 2);
select pg_temp.ok((select ends_on - starts_on = 60 and visit_limit = 10 and visits_used = 2 from public.memberships where id = :'ms'), 'membership adjusted');
select pg_temp.fails(format('select public.adjust_membership(%L, current_date, current_date - 1, null, 0)', :'ms')) as bad_dates \gset
\echo end before start rejected: :bad_dates

-- Plans can be deleted; sold memberships keep their name.
delete from public.membership_plans where id = :'plan';
select pg_temp.ok((select plan_name from public.memberships where id = :'ms') = 'Punch 5', 'membership keeps plan name');

-- Everything sensitive is in the activity log.
select pg_temp.ok((select count(*) from public.activity_log where gym_id = :'gym') >= 7, 'activity logged');
select pg_temp.ok(exists (select 1 from public.activity_log where action = 'payment.refund' and details->>'reason' = 'Changed their mind'), 'refund reason logged');
select pg_temp.ok(exists (select 1 from public.activity_log where action = 'invoice.void'), 'void logged');
reset role;

select pg_temp.act_as('d6@test.lb');
select pg_temp.ok((select count(*) from public.activity_log) = 0, 'front desk cannot read the log');
select pg_temp.fails(format('select public.delete_checkin((select id from public.checkins limit 1))')) as desk_checkin \gset
\echo front desk cannot delete check-ins: :desk_checkin
reset role;

\echo 'ALL CONTROL TESTS PASSED'
