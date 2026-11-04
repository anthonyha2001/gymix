-- Gymix subscription: trial, payments recorded by a super admin, grace and expiry.
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
  ('o9@test.lb', '{"full_name":"Owner Nine"}'),
  ('t9@test.lb', '{"full_name":"Trainer Nine"}'),
  ('x9@test.lb', '{"full_name":"Other Owner"}'),
  ('a9@test.lb', '{"full_name":"Super Admin"}');
insert into public.platform_admins (user_id) select id from auth.users where email = 'a9@test.lb';

select pg_temp.act_as('o9@test.lb');
select public.create_gym('Gym Nine') as gym \gset
insert into public.invites (gym_id, email, role, invited_by) values (:'gym', 't9@test.lb', 'trainer', auth.uid());
reset role;
select pg_temp.act_as('t9@test.lb'); select public.claim_my_invites(); reset role;
select pg_temp.act_as('x9@test.lb'); select public.create_gym('Gym Other') as other \gset
reset role;

-- New gyms start a 14-day trial.
select pg_temp.act_as('o9@test.lb');
select pg_temp.ok((select status = 'trial' and days_left = 14 from public.gym_subscription(:'gym')), '14-day trial');
reset role;
select pg_temp.act_as('t9@test.lb');
select pg_temp.ok((select status = 'trial' from public.gym_subscription(:'gym')), 'staff can read it');
select pg_temp.fails(format('select public.admin_record_subscription_payment(%L, 1, 10, %L)', :'gym', 'Whish')) as not_admin \gset
\echo staff cannot record payments: :not_admin
select pg_temp.ok((select count(*) from public.platform_payments) = 0, 'trainer sees no payments');
reset role;
select pg_temp.act_as('x9@test.lb');
select pg_temp.fails(format('select * from public.gym_subscription(%L)', :'gym')) as other_gym \gset
\echo other gyms cannot read it: :other_gym
reset role;

-- Trial ended 2 days ago: grace. 5 days ago: expired.
update public.gyms set trial_ends_at = public.gym_today(id) - 2 where id = :'gym';
select pg_temp.act_as('o9@test.lb');
select pg_temp.ok((select status = 'grace' from public.gym_subscription(:'gym')), 'grace after the trial');
reset role;
update public.gyms set trial_ends_at = public.gym_today(id) - 5 where id = :'gym';
select pg_temp.act_as('o9@test.lb');
select pg_temp.ok((select status = 'expired' from public.gym_subscription(:'gym')), 'expired after grace');
reset role;

-- The super admin records 3 months: paid from today.
select pg_temp.act_as('a9@test.lb');
select public.admin_record_subscription_payment(:'gym', 3, 30, 'Whish', 'ref 123') as until \gset
select pg_temp.ok(:'until'::date = (public.gym_today(:'gym') - 1 + interval '3 months')::date, 'three months from today');
select pg_temp.ok((select status = 'active' from public.gym_subscription(:'gym')), 'active once paid');
-- Paying again stacks on top.
select public.admin_record_subscription_payment(:'gym', 1, 10, 'OMT') as until2 \gset
select pg_temp.ok(:'until2'::date = (:'until'::date + interval '1 month')::date, 'stacks on the current end');
select pg_temp.fails(format('select public.admin_record_subscription_payment(%L, 0, 0, %L)', :'gym', 'Cash')) as zero \gset
select public.admin_extend_trial(:'other', 30);
reset role;
select pg_temp.ok((select trial_ends_at from public.gyms where id = :'other') = public.gym_today(:'other') + 44, 'trial extended');
select pg_temp.act_as('a9@test.lb');
select public.admin_save_platform_settings('Whish 71 000 000', '+961 71-000 000');
select pg_temp.ok((select whatsapp from public.platform_settings) = '+96171000000', 'whatsapp cleaned');
select pg_temp.ok((select count(*) from public.admin_gym_overview() where paid_until is not null) = 1, 'console shows paid gym');
reset role;

-- The owner sees their payments and was notified; others see nothing.
select pg_temp.act_as('o9@test.lb');
select pg_temp.ok((select count(*) from public.platform_payments) = 2, 'owner sees both payments');
select pg_temp.ok((select count(*) from public.notifications where title = 'Gymix subscription renewed') = 2, 'owner notified');
select pg_temp.ok((select payment_instructions from public.platform_settings) = 'Whish 71 000 000', 'owner reads instructions');
select pg_temp.fails('update public.platform_settings set whatsapp = $$1$$') as cannot_edit \gset
select pg_temp.fails(format('update public.gyms set paid_until = %L where id = %L', '2099-01-01', :'gym')) as cannot_self_extend \gset
\echo owner cannot extend their own subscription: :cannot_self_extend
reset role;
select pg_temp.act_as('x9@test.lb');
select pg_temp.ok((select count(*) from public.platform_payments) = 0, 'other owner sees none');
reset role;
select pg_temp.ok((select paid_until from public.gyms where id = :'gym') = :'until2'::date, 'paid_until unchanged by owner');

\echo 'ALL SUBSCRIPTION TESTS PASSED'
