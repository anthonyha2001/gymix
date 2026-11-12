-- Knowing who is still in the gym: the gym's location, sticker taps as door
-- events, exits ending visits, location checks, and the live count.
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

create or replace function pg_temp.people() returns integer language sql as $$
  select people from public.gym_occupancy(current_setting('t.gym')::uuid)
$$;

insert into auth.users (email, raw_user_meta_data) values
  ('pr-owner@test.lb', '{"full_name":"Owner P"}'),
  ('pr-desk@test.lb', '{"full_name":"Desk P"}'),
  ('pr-nour@test.lb', '{"full_name":"Nour P"}'),
  ('pr-rami@test.lb', '{"full_name":"Rami P"}');

select pg_temp.act_as('pr-owner@test.lb');
select set_config('t.gym', public.create_gym('Presence Gym')::text, false);
insert into public.invites (gym_id, email, role, invited_by) values (pg_temp.v('gym'), 'pr-desk@test.lb', 'front_desk', auth.uid());
insert into public.membership_plans (gym_id, name, price_usd) values (pg_temp.v('gym'), 'Monthly', 40);
reset role;
select pg_temp.act_as('pr-desk@test.lb'); select public.claim_my_invites(); reset role;
insert into public.gym_feature_overrides (gym_id, feature_key, enabled) values (pg_temp.v('gym'), 'access_control', true);
insert into public.members (gym_id, full_name, phone, user_id) values
  (pg_temp.v('gym'), 'Nour P', '70400001', (select id from auth.users where email = 'pr-nour@test.lb')),
  (pg_temp.v('gym'), 'Rami P', '70400002', (select id from auth.users where email = 'pr-rami@test.lb'));
select set_config('t.nour', (select id::text from public.members where full_name = 'Nour P'), false);
select set_config('t.rami', (select id::text from public.members where full_name = 'Rami P'), false);
select pg_temp.act_as('pr-desk@test.lb');
select public.sell_membership(pg_temp.v('nour'), (select id from public.membership_plans where gym_id = pg_temp.v('gym')), public.gym_today(pg_temp.v('gym')), 0, 40, 'cash_usd');
select public.sell_membership(pg_temp.v('rami'), (select id from public.membership_plans where gym_id = pg_temp.v('gym')), public.gym_today(pg_temp.v('gym')), 0, 40, 'cash_usd');
reset role;
insert into public.access_devices (gym_id, vendor, name, connection, host, direction) values
  (pg_temp.v('gym'), 'hikvision', 'Entrance', 'bridge', 'http://10.0.0.1', 'in'),
  (pg_temp.v('gym'), 'hikvision', 'Exit', 'bridge', 'http://10.0.0.2', 'out'),
  (pg_temp.v('gym'), 'hikvision', 'Side door', 'bridge', 'http://10.0.0.3', 'both');
select set_config('t.in_tap', (select tap_token from public.access_devices where name = 'Entrance' and gym_id = pg_temp.v('gym')), false);
select set_config('t.out_tap', (select tap_token from public.access_devices where name = 'Exit' and gym_id = pg_temp.v('gym')), false);
select set_config('t.both_tap', (select tap_token from public.access_devices where name = 'Side door' and gym_id = pg_temp.v('gym')), false);

-- ---------------------------------------------------------------- the gym's location
select pg_temp.act_as('pr-desk@test.lb');
select pg_temp.ok(pg_temp.fails(format('select public.set_gym_location(%L, 33.8959, 35.5050)', pg_temp.v('gym'))) like '%Only owners and managers%', 'front desk cannot move the gym');
reset role;
select pg_temp.act_as('pr-owner@test.lb');
select public.set_gym_location(pg_temp.v('gym'), 33.8959, 35.5050, '  Hamra Street, Beirut  ');
reset role;
select pg_temp.ok((select door_lat = 33.8959 and address = 'Hamra Street, Beirut' and door_radius_m is null from public.gyms where id = pg_temp.v('gym')), 'location and address saved, door check still off');
select pg_temp.act_as('pr-nour@test.lb');
select pg_temp.ok(not public.door_needs_location(current_setting('t.in_tap')), 'a location alone does not make taps ask for location');
select pg_temp.ok(public.presence_ping(pg_temp.v('gym'), 33.8959, 35.5050, 10) = 'off', 'presence checks only when the gym switched the check on');
reset role;
select pg_temp.act_as('pr-owner@test.lb');
select public.set_door_location(pg_temp.v('gym'), 33.8959, 35.5050, 150);
reset role;

-- ---------------------------------------------------------------- sticker taps are door events
select pg_temp.act_as('pr-nour@test.lb');
select pg_temp.ok((select allowed from public.door_tap(current_setting('t.in_tap'), 33.8960, 35.5050, 10)), 'Nour taps in');
reset role;
select pg_temp.ok((select count(*) = 1 and bool_and(direction = 'in' and method = 'phone' and granted and outcome = 'checked_in' and checkin_id is not null)
                   from public.access_events where member_id = pg_temp.v('nour')), 'the entrance tap is an entry event');
select pg_temp.ok(pg_temp.people() = 1, 'one person inside');
select pg_temp.act_as('pr-rami@test.lb');
select pg_temp.ok((select allowed from public.door_tap(current_setting('t.in_tap'), 33.8960, 35.5050, 10)), 'Rami taps in');
reset role;
select pg_temp.ok(pg_temp.people() = 2, 'two inside');

-- Nour leaves through the exit sticker: visit ended, counted out.
select pg_temp.act_as('pr-nour@test.lb');
select pg_temp.ok((select allowed and not already_in from public.door_tap(current_setting('t.out_tap'), 33.8960, 35.5050, 10)), 'exit opens');
reset role;
select pg_temp.ok((select left_at is not null and left_how = 'sticker' from public.checkins where member_id = pg_temp.v('nour')), 'exit sticker ends the visit');
select pg_temp.ok((select count(*) = 1 from public.access_events where member_id = pg_temp.v('nour') and direction = 'out' and outcome = 'exit'), 'exit event recorded');
select pg_temp.ok(pg_temp.people() = 1, 'one inside after Nour left');
select pg_temp.ok((select method = 'doors' and exits_today = 1 from public.gym_occupancy(pg_temp.v('gym'))), 'exits recorded: counted by doors');

-- She comes back in within the hour: the same visit opens again.
select pg_temp.act_as('pr-nour@test.lb');
select pg_temp.ok((select allowed and already_in from public.door_tap(current_setting('t.in_tap'), 33.8960, 35.5050, 10)), 'back in: already checked in today');
reset role;
select pg_temp.ok((select left_at is null from public.checkins where member_id = pg_temp.v('nour')), 'coming back reopens the visit');
select pg_temp.ok(pg_temp.people() = 2, 'two inside again');

-- A two-way door: tapping on the way in, then again after 10+ minutes, is an exit.
update public.checkins set checked_in_at = now() - interval '20 minutes' where member_id = pg_temp.v('rami');
select pg_temp.act_as('pr-rami@test.lb');
select door_tap(current_setting('t.both_tap'), 33.8960, 35.5050, 10);
reset role;
select pg_temp.ok((select direction = 'out' from public.access_events where member_id = pg_temp.v('rami') order by occurred_at desc limit 1), 'two-way door: inside for a while, so it is an exit');
select pg_temp.ok((select left_at is not null from public.checkins where member_id = pg_temp.v('rami')), 'Rami counted out');
select pg_temp.ok(pg_temp.people() = 1, 'one inside');

-- ---------------------------------------------------------------- location checks
-- Rami left through a door: a location near the gym doesn't override it.
select pg_temp.act_as('pr-rami@test.lb');
select pg_temp.ok(public.presence_ping(pg_temp.v('gym'), 33.8960, 35.5050, 10) = 'not_in', 'left through a door: the door wins');
reset role;

-- Nour is at the gym: confirmed.
select pg_temp.act_as('pr-nour@test.lb');
select pg_temp.ok(public.presence_ping(pg_temp.v('gym'), 33.8962, 35.5051, 15) = 'here', 'at the gym: here');
reset role;
select pg_temp.ok((select seen_at is not null from public.checkins where member_id = pg_temp.v('nour')), 'seen at the gym');

-- Past the usual visit length but just seen at the gym: still counted.
delete from public.access_events where gym_id = pg_temp.v('gym');
update public.checkins set checked_in_at = now() - interval '2 hours' where member_id = pg_temp.v('nour');
select pg_temp.ok((select method = 'checkins' from public.gym_occupancy(pg_temp.v('gym'))), 'no exits today: counted by check-ins');
select pg_temp.ok(pg_temp.people() = 1, 'seen 2 h in (usual visit 75 min): still counted');
update public.checkins set seen_at = now() - interval '45 minutes' where member_id = pg_temp.v('nour');
select pg_temp.ok(pg_temp.people() = 0, 'not seen lately and past the usual visit: counted out');

-- In between (600 m away, radius 150: not twice the radius yet beyond 300 m? 600 > 300 => left).
update public.checkins set checked_in_at = now() - interval '30 minutes', seen_at = null where member_id = pg_temp.v('nour');
select pg_temp.act_as('pr-nour@test.lb');
select pg_temp.ok(public.presence_ping(pg_temp.v('gym'), 33.8959 + 0.0022, 35.5050, 20) = 'unsure', 'about 245 m away: unsure, nothing changes');
reset role;
select pg_temp.ok((select left_at is null from public.checkins where member_id = pg_temp.v('nour')), 'unsure keeps the visit');
select pg_temp.act_as('pr-nour@test.lb');
select pg_temp.ok(public.presence_ping(pg_temp.v('gym'), 33.9100, 35.5050, 20) = 'left', 'about 1.5 km away: left');
reset role;
select pg_temp.ok((select left_at is not null and left_how = 'location' from public.checkins where member_id = pg_temp.v('nour')), 'location ended the visit');
select pg_temp.ok(pg_temp.people() = 0, 'counted out');
-- Back at the gym (the app open again): reopened.
select pg_temp.act_as('pr-nour@test.lb');
select pg_temp.ok(public.presence_ping(pg_temp.v('gym'), 33.8959, 35.5050, 10) = 'here', 'back at the gym');
reset role;
select pg_temp.ok(pg_temp.people() = 1, 'counted in again');

-- Only members of the gym can ping.
select pg_temp.act_as('pr-desk@test.lb');
select pg_temp.ok(pg_temp.fails(format('select public.presence_ping(%L, 33.8959, 35.5050)', pg_temp.v('gym'))) like '%Not allowed%', 'staff without a membership cannot ping');
reset role;
set role anon;
select pg_temp.ok(pg_temp.fails(format('select public.presence_ping(%L, 33.8959, 35.5050)', pg_temp.v('gym'))) like '%permission denied%', 'anon cannot ping');
reset role;

-- Clearing the location switches the door check off too.
select pg_temp.act_as('pr-owner@test.lb');
select public.set_gym_location(pg_temp.v('gym'), null, null);
reset role;
select pg_temp.ok((select door_lat is null and door_radius_m is null and address is null from public.gyms where id = pg_temp.v('gym')), 'location cleared with the check');

select 'presence_test passed';
