-- Door openings, part 2: "phone must be at the gym", the rate limit, and the
-- one-call polls for ZKTeco terminals and the Gymix Bridge.
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
  ('ds-owner@test.lb', '{"full_name":"Owner Sec"}'),
  ('ds-desk@test.lb', '{"full_name":"Desk Sec"}'),
  ('ds-nour@test.lb', '{"full_name":"Nour Sec"}');

select pg_temp.act_as('ds-owner@test.lb');
select set_config('t.gym', public.create_gym('Secure Gym')::text, false);
insert into public.invites (gym_id, email, role, invited_by) values (pg_temp.v('gym'), 'ds-desk@test.lb', 'front_desk', auth.uid());
insert into public.membership_plans (gym_id, name, price_usd) values (pg_temp.v('gym'), 'Monthly', 40);
reset role;
select pg_temp.act_as('ds-desk@test.lb'); select public.claim_my_invites(); reset role;
insert into public.gym_feature_overrides (gym_id, feature_key, enabled) values (pg_temp.v('gym'), 'access_control', true);
insert into public.members (gym_id, full_name, phone, user_id) values
  (pg_temp.v('gym'), 'Nour Sec', '70200001', (select id from auth.users where email = 'ds-nour@test.lb'));
select set_config('t.nour', (select id::text from public.members where full_name = 'Nour Sec'), false);
select pg_temp.act_as('ds-desk@test.lb');
select public.sell_membership(pg_temp.v('nour'), (select id from public.membership_plans where gym_id = pg_temp.v('gym')), public.gym_today(pg_temp.v('gym')), 0, 40, 'cash_usd');
reset role;
insert into public.access_devices (gym_id, vendor, name, serial_number, connection) values (pg_temp.v('gym'), 'zkteco', 'Front', 'DSZK0001', 'push');
select set_config('t.door', (select id::text from public.access_devices where serial_number = 'DSZK0001'), false);
select set_config('t.tap', (select tap_token from public.access_devices where serial_number = 'DSZK0001'), false);

-- Distance helper: Beirut downtown to Hamra is about 2.4 km.
select pg_temp.ok(public.distance_m(33.8959, 35.5050, 33.8966, 35.4787) between 2300 and 2500, 'distance in metres');
select pg_temp.ok(public.distance_m(33.9, 35.5, 33.9, 35.5) = 0, 'same point');

-- Without a gym location, the link works without location.
select pg_temp.act_as('ds-nour@test.lb');
select pg_temp.ok(not public.door_needs_location(current_setting('t.tap')), 'no location needed by default');
select pg_temp.ok((select allowed from public.door_tap(current_setting('t.tap'))), 'opens without location');
reset role;

-- Only owners and managers set the location.
select pg_temp.act_as('ds-desk@test.lb');
select pg_temp.ok(pg_temp.fails(format('select public.set_door_location(%L, 33.8959, 35.5050, 150)', pg_temp.v('gym'))) like '%Only owners and managers%', 'front desk cannot set the location');
reset role;
select pg_temp.act_as('ds-owner@test.lb');
select pg_temp.ok(pg_temp.fails(format('select public.set_door_location(%L, 33.8959, 35.5050, 5)', pg_temp.v('gym'))) like '%between 30 m%', 'radius too small');
select pg_temp.ok(pg_temp.fails(format('select public.set_door_location(%L, 0, 0, 150)', pg_temp.v('gym'))) like '%look right%', '0,0 refused');
select public.set_door_location(pg_temp.v('gym'), 33.8959, 35.5050, 150);
reset role;
select pg_temp.ok((select door_radius_m = 150 from public.gyms where id = pg_temp.v('gym')), 'location saved');

select pg_temp.act_as('ds-nour@test.lb');
select pg_temp.ok(public.door_needs_location(current_setting('t.tap')), 'location now needed');
select pg_temp.ok(pg_temp.fails(format('select * from public.door_tap(%L)', current_setting('t.tap'))) like '%Turn on location%', 'no location: refused');
select pg_temp.ok(pg_temp.fails(format('select * from public.door_tap(%L, 33.8966, 35.4787, 20)', current_setting('t.tap'))) like '%isn''t at the gym%', 'from Hamra: refused');
-- About 100 m away, accurate: inside 150 m.
select pg_temp.ok((select allowed from public.door_tap(current_setting('t.tap'), 33.8968, 35.5050, 10)), '100 m away: opens');
-- About 250 m away but the phone says +-120 m: allowed for the inaccuracy.
select pg_temp.ok((select allowed from public.door_tap(current_setting('t.tap'), 33.8981, 35.5050, 120)), 'inaccurate fix near the edge: opens');
-- A huge accuracy doesn't open from across town (counted up to 150 m only).
select pg_temp.ok(pg_temp.fails(format('select * from public.door_tap(%L, 33.8966, 35.4787, 5000)', current_setting('t.tap'))) like '%isn''t at the gym%', 'vague fix across town: refused');
reset role;

-- Switched off again.
select pg_temp.act_as('ds-owner@test.lb');
select public.set_door_location(pg_temp.v('gym'), null, null);
reset role;
select pg_temp.ok((select door_lat is not null and door_radius_m is null from public.gyms where id = pg_temp.v('gym')), 'check switched off, gym location kept');

-- Rate limit: 12 openings in 10 minutes.
update public.access_commands set created_at = now() - interval '6 seconds' where member_id = pg_temp.v('nour') and kind = 'open_door';
insert into public.access_commands (device_id, gym_id, member_id, kind, payload, expires_at, created_at, status)
select pg_temp.v('door'), pg_temp.v('gym'), pg_temp.v('nour'), 'open_door', '{}', now() - interval '1 minute', now() - interval '2 minutes', 'done'
  from generate_series(1, 12 - (select count(*) from public.access_commands where member_id = pg_temp.v('nour') and kind = 'open_door'));
select pg_temp.act_as('ds-nour@test.lb');
select pg_temp.ok(pg_temp.fails(format('select * from public.door_tap(%L)', current_setting('t.tap'))) like '%Too many door openings%', '13th opening refused');
reset role;
update public.access_commands set created_at = now() - interval '11 minutes' where member_id = pg_temp.v('nour') and kind = 'open_door';
select pg_temp.act_as('ds-nour@test.lb');
select pg_temp.ok((select allowed from public.door_tap(current_setting('t.tap'))), 'allowed again after 10 minutes');
reset role;

-- ---------------------------------------------------------------- polls
-- ZKTeco: one call notes the device and hands out commands, opening first.
update public.access_devices set last_seen_at = null where id = pg_temp.v('door');
create temp table zk as select * from public.access_zk_poll('DSZK0001', '{"users": 1}');
select pg_temp.ok((select count(*) > 0 from zk), 'zk poll hands out commands');
select pg_temp.ok((select last_seen_at is not null and info->>'users' = '1' from public.access_devices where id = pg_temp.v('door')), 'zk poll marks it seen');
select pg_temp.ok((select count(*) = 0 from public.access_zk_poll('NOPE0000')), 'unknown serial: nothing');
update public.access_devices set is_active = false where id = pg_temp.v('door');
select pg_temp.act_as('ds-desk@test.lb');
select pg_temp.ok(pg_temp.fails(format('select public.access_open_door(%L)', pg_temp.v('door'))) like '%paused%', 'paused');
reset role;
select pg_temp.ok((select count(*) = 0 from public.access_zk_poll('DSZK0001')), 'paused device: nothing');
update public.access_devices set is_active = true where id = pg_temp.v('door');

-- Bridge: devices with their logins and commands in one call.
insert into public.access_devices (gym_id, vendor, name, connection, host) values (pg_temp.v('gym'), 'hikvision', 'Side door', 'bridge', 'http://192.168.1.70');
select set_config('t.side', (select id::text from public.access_devices where name = 'Side door' and gym_id = pg_temp.v('gym')), false);
select pg_temp.act_as('ds-owner@test.lb');
select public.set_access_device_password(pg_temp.v('side'), 'hik-pass');
select set_config('t.btoken', public.access_bridge_token(pg_temp.v('gym')), false);
select set_config('t.sideopen', public.access_open_door(pg_temp.v('side'))::text, false);
reset role;
select pg_temp.ok(public.access_bridge_poll('0000') is null, 'wrong bridge token: null');
create temp table bp as select public.access_bridge_poll(current_setting('t.btoken'), '1.1.0') as j;
select pg_temp.ok((select (j->>'gym_id')::uuid = pg_temp.v('gym') from bp), 'bridge poll: gym');
select pg_temp.ok((select jsonb_array_length(j->'devices') = 1 and j->'devices'->0->>'password' = 'hik-pass' and j->'devices'->0->>'name' = 'Side door' from bp), 'bridge poll: device with login');
select pg_temp.ok((select j->'commands'->0->>'kind' = 'open_door' and (j->'commands'->0->>'id')::bigint = current_setting('t.sideopen')::bigint from bp), 'bridge poll: opening first');
select pg_temp.ok((select last_seen_at is not null and version = '1.1.0' from public.access_bridges where gym_id = pg_temp.v('gym')), 'bridge poll: seen');
select pg_temp.ok((select jsonb_array_length(public.access_bridge_poll(current_setting('t.btoken'), '1.1.0')->'commands') = 0), 'bridge poll: not handed out twice');

-- Nobody but the server can poll.
select pg_temp.act_as('ds-owner@test.lb');
select pg_temp.ok(pg_temp.fails('select * from public.access_zk_poll(''DSZK0001'')') like '%permission denied%', 'users cannot poll as a device');
select pg_temp.ok(pg_temp.fails(format('select public.access_bridge_poll(%L)', current_setting('t.btoken'))) like '%permission denied%', 'users cannot poll as the bridge');
reset role;

select 'door_security_test passed';
