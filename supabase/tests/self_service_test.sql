-- Self-service reception: kiosk lookups, check-in, joining, purchases,
-- activation by the desk or a provider, renewals, limits and permissions.
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
  ('ok@test.lb', '{"full_name":"Owner K"}'),
  ('fk@test.lb', '{"full_name":"Front K"}'),
  ('tk@test.lb', '{"full_name":"Trainer K"}');

select pg_temp.act_as('ok@test.lb');
select public.create_gym('Kiosk Gym') as gym \gset
insert into public.invites (gym_id, email, role, invited_by) values (:'gym', 'fk@test.lb', 'front_desk', auth.uid()), (:'gym', 'tk@test.lb', 'trainer', auth.uid());
insert into public.membership_plans (gym_id, name, price_usd) values (:'gym', 'Monthly', 45);
insert into public.members (gym_id, full_name, phone, created_by) values (:'gym', 'Nour Khalil', '+961 70 123 456', auth.uid());
insert into public.kiosks (gym_id, name) values (:'gym', 'Entrance');
update public.gyms set kiosk_whish_number = '70 000 111' where id = :'gym';
reset role;
select pg_temp.act_as('fk@test.lb'); select public.claim_my_invites(); reset role;
select pg_temp.act_as('tk@test.lb'); select public.claim_my_invites(); reset role;
select token as kt, id as kiosk from public.kiosks where name = 'Entrance' \gset
select id as plan from public.membership_plans where gym_id = :'gym' \gset
select id as nour, checkin_code as ncode from public.members where full_name = 'Nour Khalil' \gset

-- Info for the screen: plans and ways to pay.
select pg_temp.ok((select (i->'gym'->>'name') = 'Kiosk Gym' and jsonb_array_length(i->'plans') = 1 and (i->'pay'->>'whish') = '70 000 111'
                          and (i->'pay'->>'omt') is null from public.kiosk_info(:'kt') i), 'kiosk info');
select pg_temp.fails('select public.kiosk_info(''nope'')') as bad_token \gset

-- Finding Nour: phone written any way, or her member code. Only her first name comes back.
select pg_temp.ok((public.kiosk_find_member(:'kt', '070 123456')->>'first_name') = 'Nour', 'found by phone (local format)');
select pg_temp.ok((public.kiosk_find_member(:'kt', '0096170123456')->>'id') = :'nour', 'found by phone (international)');
select pg_temp.ok((public.kiosk_find_member(:'kt', lower(:'ncode'))->>'id') = :'nour', 'found by member code');
select pg_temp.ok(public.kiosk_find_member(:'kt', '71999999') is null, 'unknown phone');
select pg_temp.ok(public.kiosk_find_member(:'kt', '12') is null, 'too short to search');
select pg_temp.ok(not (public.kiosk_find_member(:'kt', '70123456') ? 'phone'), 'no phone or full name returned');

-- No membership: check-in refused and recorded from the kiosk.
select pg_temp.ok((select not (r->>'allowed')::boolean and r->>'reason' = 'No membership' from public.kiosk_check_in(:'kt', :'nour') r), 'refused without a membership');
select pg_temp.ok((select source = 'kiosk' from public.checkins where member_id = :'nour'), 'kiosk check-in recorded');

-- A visitor joins; joining again with the same phone reuses the member.
select public.kiosk_join(:'kt', '  Lea   Haddad ', '03 456 789', 'Lea@Example.com') as j1 \gset
select pg_temp.ok((:'j1'::jsonb->>'first_name') = 'Lea', 'joined');
select pg_temp.ok((select full_name = 'Lea Haddad' and email = 'lea@example.com' and created_by is null and notes like 'Joined at the kiosk%'
                     from public.members where id = (:'j1'::jsonb->>'id')::uuid), 'visitor saved tidy');
select pg_temp.ok((public.kiosk_join(:'kt', 'Lea H', '+961 3 456 789')->>'id') = (:'j1'::jsonb->>'id'), 'same phone reuses the member');
select pg_temp.ok((select count(*) = 2 from public.notifications where kind = 'kiosk' and title = 'New visitor: Lea Haddad'), 'desk and owner told once each');
select pg_temp.fails(format('select public.kiosk_join(%L, %L, %L)', :'kt', 'L', '03456789')) as short_name \gset
select pg_temp.fails(format('select public.kiosk_join(%L, %L, %L)', :'kt', 'Someone', '12')) as bad_phone \gset

-- Nour buys a month, paying by Whish. OMT isn't set up, so it's refused.
select pg_temp.fails(format('select public.kiosk_start_purchase(%L, %L, %L, %L)', :'kt', :'nour', :'plan', 'omt')) as no_omt \gset
select public.kiosk_start_purchase(:'kt', :'nour', :'plan', 'whish') as p1 \gset
select pg_temp.ok((:'p1'::jsonb->>'reference') ~ '^GX-\d{4}$' and (:'p1'::jsonb->>'amount')::numeric = 45 and (:'p1'::jsonb->>'amount_lbp')::numeric = 4028000, 'reference, amount and lira');
select pg_temp.ok((public.kiosk_start_purchase(:'kt', :'nour', :'plan', 'desk')->>'id') = (:'p1'::jsonb->>'id'), 'asking again reuses the open request');
select pg_temp.ok((public.kiosk_intent_status(:'kt', (:'p1'::jsonb->>'id')::uuid)->>'status') = 'pending', 'waiting for payment');

-- The front desk sees it and confirms the Whish payment: the membership starts today.
select pg_temp.act_as('fk@test.lb');
select pg_temp.ok((select count(*) = 1 and bool_and(channel = 'desk') from public.payment_intents where status = 'pending'), 'desk sees the request');
select public.activate_payment_intent((:'p1'::jsonb->>'id')::uuid, 'whish');
reset role;
select pg_temp.ok((select status = 'active' and plan_name = 'Monthly' from public.member_overview where id = :'nour'), 'membership active');
select pg_temp.ok((select ms.starts_on = public.gym_today(:'gym') from public.memberships ms where ms.member_id = :'nour'), 'starts today');
select pg_temp.ok((select s.status = 'paid' from public.invoice_summary s join public.payment_intents i on i.invoice_id = s.id where i.id = (:'p1'::jsonb->>'id')::uuid), 'invoice paid');
select pg_temp.ok((select confirmed_by = (select id from auth.users where email = 'fk@test.lb') from public.payment_intents where id = (:'p1'::jsonb->>'id')::uuid), 'who confirmed');
select pg_temp.ok((public.kiosk_intent_status(:'kt', (:'p1'::jsonb->>'id')::uuid)->>'ends_on') is not null, 'kiosk sees the new end date');
select pg_temp.ok((select (r->>'allowed')::boolean from public.kiosk_check_in(:'kt', :'nour') r), 'now she can check in');

-- Renewing early: the new month starts the day after the current one ends,
-- activated by a provider (no signed-in user), only for the full amount.
select public.kiosk_start_purchase(:'kt', :'nour', :'plan', 'desk') as p2 \gset
-- The server calls this with no signed-in user.
select set_config('request.jwt.claim.sub', '', false);
select pg_temp.ok(public.provider_payment(:'gym', :'p2'::jsonb->>'reference', 40, 'tx-1', 'card') = 'amount_too_low', 'short payment refused');
select pg_temp.ok(public.provider_payment(:'gym', 'GX-0000', 45, 'tx-2', 'card') in ('unknown_reference'), 'unknown reference');
select pg_temp.ok(public.provider_payment(:'gym', lower(:'p2'::jsonb->>'reference'), 45, 'tx-3', 'card') = 'activated', 'provider activates');
select pg_temp.ok(public.provider_payment(:'gym', :'p2'::jsonb->>'reference', 45, 'tx-3', 'card') = 'already_paid', 'provider retry is harmless');
select pg_temp.ok((select array_agg(starts_on order by starts_on) from public.memberships where member_id = :'nour')
                  = array[public.gym_today(:'gym'), (select ends_on + 1 from public.memberships where member_id = :'nour' order by starts_on limit 1)],
                  'renewal starts after the current membership');
select pg_temp.ok((select confirmed_by is null and provider_ref = 'tx-3' from public.payment_intents where id = (:'p2'::jsonb->>'id')::uuid), 'automatic activation recorded');
select pg_temp.ok(coalesce(current_setting('request.jwt.claim.sub', true), '') = '', 'acting as the owner ended with the sale');

-- A signed-in user can't use the automatic path; a trainer can't confirm.
select public.kiosk_start_purchase(:'kt', (:'j1'::jsonb->>'id')::uuid, :'plan', 'desk') as p3 \gset
select pg_temp.act_as('fk@test.lb');
select pg_temp.fails(format('select public.activate_payment_intent(%L, %L, null, null, true)', :'p3'::jsonb->>'id', 'card')) as user_automatic \gset
reset role;
select pg_temp.act_as('tk@test.lb');
select pg_temp.fails(format('select public.activate_payment_intent(%L, %L)', :'p3'::jsonb->>'id', 'cash_usd')) as trainer_confirm \gset
select pg_temp.ok((select count(*) from public.payment_intents) = 0, 'trainer sees no payments');
select pg_temp.fails(format('select public.kiosk_info(%L)', :'kt')) as trainer_kiosk \gset
reset role;
select pg_temp.act_as('fk@test.lb');
select public.cancel_payment_intent((:'p3'::jsonb->>'id')::uuid);
select pg_temp.fails(format('select public.activate_payment_intent(%L, %L)', :'p3'::jsonb->>'id', 'cash_usd')) as cancelled \gset
select pg_temp.ok((select count(*) from public.kiosks) = 0, 'front desk does not see kiosk tokens');
reset role;

-- Old requests expire; a switched-off kiosk stops working.
update public.payment_intents set expires_at = now() - interval '1 minute' where member_id = (:'j1'::jsonb->>'id')::uuid;
select pg_temp.ok((public.kiosk_intent_status(:'kt', (:'p3'::jsonb->>'id')::uuid)->>'status') = 'cancelled', 'cancelled stays cancelled');
select pg_temp.act_as('ok@test.lb');
update public.kiosks set allow_join = false where id = :'kiosk';
reset role;
select pg_temp.fails(format('select public.kiosk_join(%L, %L, %L)', :'kt', 'New Person', '76111222')) as join_off \gset
select pg_temp.act_as('ok@test.lb');
update public.kiosks set is_active = false where id = :'kiosk';
reset role;
select pg_temp.fails(format('select public.kiosk_find_member(%L, %L)', :'kt', '70123456')) as kiosk_off \gset

-- Too many tries in a minute are refused.
update public.kiosks set is_active = true where id = :'kiosk';
insert into public.kiosk_lookups (kiosk_id) select :'kiosk' from generate_series(1, 40);
select pg_temp.fails(format('select public.kiosk_find_member(%L, %L)', :'kt', '70123456')) as rate_limited \gset
\echo rate limit: :rate_limited

\echo self-service tests passed
