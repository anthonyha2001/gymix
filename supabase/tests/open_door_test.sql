-- Opening doors: staff "Open door", members tapping a door's NFC sticker,
-- openings first in the queue, expiry, zones, and who may do what.
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
  ('od-owner@test.lb', '{"full_name":"Owner Door"}'),
  ('od-desk@test.lb', '{"full_name":"Desk Door"}'),
  ('od-coach@test.lb', '{"full_name":"Coach Door"}'),
  ('od-nour@test.lb', '{"full_name":"Nour Door"}'),
  ('od-lara@test.lb', '{"full_name":"Lara Door"}'),
  ('od-sami@test.lb', '{"full_name":"Sami Door"}'),
  ('od-other@test.lb', '{"full_name":"Other Gym"}');

select pg_temp.act_as('od-owner@test.lb');
select set_config('t.gym', public.create_gym('Door Gym')::text, false);
insert into public.invites (gym_id, email, role, invited_by) values
  (pg_temp.v('gym'), 'od-desk@test.lb', 'front_desk', auth.uid()),
  (pg_temp.v('gym'), 'od-coach@test.lb', 'trainer', auth.uid());
insert into public.membership_plans (gym_id, name, price_usd) values (pg_temp.v('gym'), 'Monthly', 40), (pg_temp.v('gym'), 'Pool only', 30);
reset role;
select pg_temp.act_as('od-desk@test.lb'); select public.claim_my_invites(); reset role;
select pg_temp.act_as('od-coach@test.lb'); select public.claim_my_invites(); reset role;
select pg_temp.act_as('od-other@test.lb'); select set_config('t.gym2', public.create_gym('Other Gym')::text, false); reset role;

insert into public.members (gym_id, full_name, phone, user_id) values
  (pg_temp.v('gym'), 'Nour Khalil', '70100001', (select id from auth.users where email = 'od-nour@test.lb')),
  (pg_temp.v('gym'), 'Lara Nassar', '70100002', (select id from auth.users where email = 'od-lara@test.lb')),
  (pg_temp.v('gym'), 'Sami Aoun', '70100003', (select id from auth.users where email = 'od-sami@test.lb'));
select set_config('t.nour', (select id::text from public.members where full_name = 'Nour Khalil'), false);
select set_config('t.lara', (select id::text from public.members where full_name = 'Lara Nassar'), false);
select set_config('t.sami', (select id::text from public.members where full_name = 'Sami Aoun'), false);
select set_config('t.plan', (select id::text from public.membership_plans where name = 'Monthly' and gym_id = pg_temp.v('gym')), false);
select set_config('t.pool', (select id::text from public.membership_plans where name = 'Pool only' and gym_id = pg_temp.v('gym')), false);

-- Doors: a main entrance (ZKTeco), a pool door in the Pool zone, an exit.
insert into public.access_zones (gym_id, name) values (pg_temp.v('gym'), 'Pool');
select set_config('t.zone', (select id::text from public.access_zones where name = 'Pool' and gym_id = pg_temp.v('gym')), false);
insert into public.plan_access_zones (plan_id, zone_id) values (pg_temp.v('pool'), pg_temp.v('zone'));
insert into public.access_devices (gym_id, vendor, name, serial_number, connection) values (pg_temp.v('gym'), 'zkteco', 'Main door', 'ODZK0001', 'push');
insert into public.access_devices (gym_id, vendor, name, connection, host, zone_id) values (pg_temp.v('gym'), 'hikvision', 'Pool door', 'bridge', 'http://192.168.1.64', pg_temp.v('zone'));
insert into public.access_devices (gym_id, vendor, name, connection, host, direction) values (pg_temp.v('gym'), 'hikvision', 'Exit', 'bridge', 'http://192.168.1.65', 'out');
select set_config('t.main', (select id::text from public.access_devices where name = 'Main door'), false);
select set_config('t.pooldoor', (select id::text from public.access_devices where name = 'Pool door'), false);
select set_config('t.exit', (select id::text from public.access_devices where name = 'Exit'), false);
select set_config('t.main_tap', (select tap_token from public.access_devices where name = 'Main door'), false);
select set_config('t.pool_tap', (select tap_token from public.access_devices where name = 'Pool door'), false);
select set_config('t.exit_tap', (select tap_token from public.access_devices where name = 'Exit'), false);

select pg_temp.ok((select count(distinct tap_token) = 3 and bool_and(tap_token ~ '^[0-9a-f]{32}$') from public.access_devices), 'each door has its own sticker token');

-- Feature off: nobody can open anything.
select pg_temp.act_as('od-desk@test.lb');
select pg_temp.ok(pg_temp.fails(format('select public.access_open_door(%L)', pg_temp.v('main'))) like '%switched on%', 'feature off: staff refused');
reset role;
select pg_temp.act_as('od-nour@test.lb');
select pg_temp.ok(pg_temp.fails(format('select * from public.door_tap(%L)', current_setting('t.main_tap'))) like '%switched off%', 'feature off: tap refused');
reset role;
insert into public.gym_feature_overrides (gym_id, feature_key, enabled) values (pg_temp.v('gym'), 'access_control', true);

-- Memberships: Nour monthly (every door), Lara pool-only, Sami nothing.
select pg_temp.act_as('od-desk@test.lb');
select public.sell_membership(pg_temp.v('nour'), pg_temp.v('plan'), public.gym_today(pg_temp.v('gym')), 0, 40, 'cash_usd');
select public.sell_membership(pg_temp.v('lara'), pg_temp.v('pool'), public.gym_today(pg_temp.v('gym')), 0, 30, 'cash_usd');
reset role;

-- ---------------------------------------------------------------- staff
select pg_temp.act_as('od-desk@test.lb');
select pg_temp.ok((select count(*) = 3 from public.access_doors(pg_temp.v('gym'))), 'front desk lists the doors');
select set_config('t.cmd', public.access_open_door(pg_temp.v('main'))::text, false);
select pg_temp.ok(public.access_open_status(current_setting('t.cmd')::bigint) = 'waiting', 'queued opening is waiting');
reset role;
select pg_temp.ok((select kind = 'open_door' and expires_at between now() + interval '14 seconds' and now() + interval '16 seconds'
                     and requested_by = (select id from auth.users where email = 'od-desk@test.lb')
                   from public.access_commands where id = current_setting('t.cmd')::bigint), 'opening expires in 15 s and records who asked');

-- The opening is handed out first, ahead of the member updates queued earlier.
select pg_temp.ok((select count(*) > 0 from public.access_commands where device_id = pg_temp.v('main') and kind = 'upsert_user' and status = 'queued'), 'member updates are queued');
select pg_temp.ok((select kind from public.access_take_commands(pg_temp.v('main'), 1)) = 'open_door', 'opening comes out first');
select pg_temp.act_as('od-desk@test.lb');
select pg_temp.ok(public.access_open_status(current_setting('t.cmd')::bigint) = 'sent', 'collected: sent');
reset role;
select public.access_command_done(pg_temp.v('main'), current_setting('t.cmd')::bigint, true);
select pg_temp.act_as('od-desk@test.lb');
select pg_temp.ok(public.access_open_status(current_setting('t.cmd')::bigint) = 'opened', 'confirmed: opened');
reset role;

-- An opening nobody collects in time is dropped, never sent late.
select pg_temp.act_as('od-owner@test.lb');
select set_config('t.late', public.access_open_door(pg_temp.v('main'))::text, false);
reset role;
update public.access_commands set expires_at = now() - interval '1 second' where id = current_setting('t.late')::bigint;
select pg_temp.act_as('od-owner@test.lb');
select pg_temp.ok(public.access_open_status(current_setting('t.late')::bigint) = 'failed', 'expired opening shows as failed');
reset role;
select pg_temp.ok((select count(*) = 0 from public.access_take_commands(pg_temp.v('main'), 200) where kind = 'open_door'), 'expired opening is not handed out');
select pg_temp.ok((select status = 'failed' from public.access_commands where id = current_setting('t.late')::bigint), 'expired opening marked failed');

-- A sent opening is never resent, even when unconfirmed.
select pg_temp.act_as('od-owner@test.lb');
select set_config('t.once', public.access_open_door(pg_temp.v('pooldoor'))::text, false);
reset role;
select count(*) from public.access_take_commands(pg_temp.v('pooldoor'), 200);
update public.access_commands set sent_at = now() - interval '5 minutes' where id = current_setting('t.once')::bigint;
select pg_temp.ok((select count(*) = 0 from public.access_take_commands(pg_temp.v('pooldoor'), 200) where kind = 'open_door'), 'sent opening is not offered again');

-- Who may open: not trainers, not members, not another gym, not paused doors.
select pg_temp.act_as('od-coach@test.lb');
select pg_temp.ok(pg_temp.fails(format('select public.access_open_door(%L)', pg_temp.v('main'))) like '%Not allowed%', 'trainer cannot open');
select pg_temp.ok(pg_temp.fails(format('select * from public.access_doors(%L)', pg_temp.v('gym'))) like '%Not allowed%', 'trainer cannot list doors');
select pg_temp.ok(pg_temp.fails(format('select public.access_open_status(%s)', current_setting('t.cmd'))) like '%Not allowed%', 'trainer cannot read status');
reset role;
select pg_temp.act_as('od-nour@test.lb');
select pg_temp.ok(pg_temp.fails(format('select public.access_open_door(%L)', pg_temp.v('main'))) like '%Not allowed%', 'member cannot use the staff button');
reset role;
select pg_temp.act_as('od-other@test.lb');
select pg_temp.ok(pg_temp.fails(format('select public.access_open_door(%L)', pg_temp.v('main'))) like '%Not allowed%', 'another gym cannot open');
reset role;
update public.access_devices set is_active = false where id = pg_temp.v('exit');
select pg_temp.act_as('od-owner@test.lb');
select pg_temp.ok(pg_temp.fails(format('select public.access_open_door(%L)', pg_temp.v('exit'))) like '%paused%', 'paused door refused');
reset role;
update public.access_devices set is_active = true where id = pg_temp.v('exit');
set role anon;
select pg_temp.ok(pg_temp.fails(format('select public.access_open_door(%L)', pg_temp.v('main'))) like '%permission denied%', 'anon cannot call');
select pg_temp.ok(pg_temp.fails(format('select * from public.door_tap(%L)', current_setting('t.main_tap'))) like '%permission denied%', 'anon cannot tap');
reset role;

-- ---------------------------------------------------------------- member taps
-- Nour taps the main door: checked in, door opens.
select pg_temp.act_as('od-nour@test.lb');
create temp table tap1 as select * from public.door_tap(current_setting('t.main_tap'));
select pg_temp.ok((select allowed and not already_in and door_name = 'Main door' and command_id is not null and device_id = pg_temp.v('main') from tap1), 'Nour: allowed and opening');
select pg_temp.ok(public.access_open_status((select command_id from tap1)) = 'waiting', 'member reads own opening status');
-- Tapping again straight away: already in, same opening (no double unlock).
create temp table tap2 as select * from public.door_tap(current_setting('t.main_tap'));
select pg_temp.ok((select allowed and already_in from tap2), 'second tap: already in, still allowed');
select pg_temp.ok((select t2.command_id = t1.command_id from tap1 t1, tap2 t2), 'second tap within 5 s reuses the opening');
reset role;
select pg_temp.ok((select count(*) = 1 from public.checkins where member_id = pg_temp.v('nour')), 'one check-in for Nour');
select pg_temp.ok((select source = 'tap' from public.checkins where member_id = pg_temp.v('nour')), 'recorded as a tap');

-- Nour can't read someone else's opening.
select pg_temp.act_as('od-nour@test.lb');
select pg_temp.ok(pg_temp.fails(format('select public.access_open_status(%s)', current_setting('t.cmd'))) like '%Not allowed%', 'member cannot read staff opening');
reset role;

-- Lara (pool only) taps the main door: refused before check-in (main door has no zone, so allowed).
-- The main door has no zone, so every plan opens it.
select pg_temp.act_as('od-lara@test.lb');
select pg_temp.ok((select allowed from public.door_tap(current_setting('t.main_tap'))), 'door without zone opens for any plan');
reset role;
-- Nour (monthly, a plan without zones) opens the pool door too.
select pg_temp.act_as('od-nour@test.lb');
select pg_temp.ok((select allowed from public.door_tap(current_setting('t.pool_tap'))), 'plan without zones opens every door');
reset role;

-- Put the main door in a zone the pool plan doesn't cover: Lara is refused with no check-in made.
insert into public.access_zones (gym_id, name) values (pg_temp.v('gym'), 'Gym floor');
update public.access_devices set zone_id = (select id from public.access_zones where name = 'Gym floor') where id = pg_temp.v('main');
delete from public.checkins where member_id = pg_temp.v('lara');
select pg_temp.act_as('od-lara@test.lb');
create temp table tap3 as select * from public.door_tap(current_setting('t.main_tap'));
select pg_temp.ok((select not allowed and reason like '%Gym floor%' and command_id is null from tap3), 'zone not in plan: refused with the zone name');
reset role;
select pg_temp.ok((select count(*) = 0 from public.checkins where member_id = pg_temp.v('lara')), 'zone refusal makes no check-in');

-- Sami (no membership): refused, nothing opens.
select pg_temp.act_as('od-sami@test.lb');
create temp table tap4 as select * from public.door_tap(current_setting('t.pool_tap'));
select pg_temp.ok((select not allowed and command_id is null and reason is not null from tap4), 'no membership: refused');
-- ...but the exit door lets any member out, with no check-in.
create temp table tap5 as select * from public.door_tap(current_setting('t.exit_tap'));
select pg_temp.ok((select allowed and command_id is not null from tap5), 'exit door opens for any member');
reset role;
select pg_temp.ok((select count(*) = 0 from public.checkins where member_id = pg_temp.v('sami') and allowed), 'exit makes no check-in');

-- Someone from another gym, and bad tokens.
select pg_temp.act_as('od-other@test.lb');
select pg_temp.ok(pg_temp.fails(format('select * from public.door_tap(%L)', current_setting('t.main_tap'))) like '%isn''t linked%', 'not a member of this gym');
select pg_temp.ok(pg_temp.fails('select * from public.door_tap(''nope'')') like '%no longer valid%', 'unknown sticker');
reset role;

-- Device check-ins every 2 s: "last seen" is written at most every 15 s.
update public.access_devices set last_seen_at = now() - interval '5 seconds' where id = pg_temp.v('main');
select public.access_device_seen(pg_temp.v('main'));
select pg_temp.ok((select last_seen_at < now() - interval '4 seconds' from public.access_devices where id = pg_temp.v('main')), 'recent: not rewritten');
select public.access_device_seen(pg_temp.v('main'), '{"users": 3}');
select pg_temp.ok((select last_seen_at >= now() - interval '1 second' and info->>'users' = '3' from public.access_devices where id = pg_temp.v('main')), 'new info: written');
update public.access_devices set last_seen_at = now() - interval '20 seconds' where id = pg_temp.v('main');
select public.access_device_seen(pg_temp.v('main'));
select pg_temp.ok((select last_seen_at >= now() - interval '1 second' from public.access_devices where id = pg_temp.v('main')), 'stale: written');

select 'open_door_test passed';
