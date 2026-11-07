-- Door access: PINs, who each device should let in, the command queue,
-- events becoming check-ins, zones, templates, cards and permissions.
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
  ('oa@test.lb', '{"full_name":"Owner Access"}'),
  ('fa@test.lb', '{"full_name":"Front Access"}');

select pg_temp.act_as('oa@test.lb');
select public.create_gym('Access Gym') as gym \gset
insert into public.invites (gym_id, email, role, invited_by) values (:'gym', 'fa@test.lb', 'front_desk', auth.uid());
insert into public.membership_plans (gym_id, name, price_usd) values (:'gym', 'Monthly', 40);
insert into public.membership_plans (gym_id, name, price_usd) values (:'gym', 'Pool only', 30);
insert into public.members (gym_id, full_name, phone, created_by) values (:'gym', 'Nour Khalil', '70123456', auth.uid());
insert into public.members (gym_id, full_name, phone, created_by) values (:'gym', 'Rami Haddad', '70111222', auth.uid());
insert into public.members (gym_id, full_name, phone, created_by) values (:'gym', 'Lara Nassar', '70333444', auth.uid());
reset role;
select pg_temp.act_as('fa@test.lb'); select public.claim_my_invites(); reset role;

select id as plan from public.membership_plans where gym_id = :'gym' and name = 'Monthly' \gset
select id as pool_plan from public.membership_plans where gym_id = :'gym' and name = 'Pool only' \gset
select id as nour from public.members where full_name = 'Nour Khalil' \gset
select id as rami from public.members where full_name = 'Rami Haddad' \gset
select id as lara from public.members where full_name = 'Lara Nassar' \gset

-- PINs are numbered per gym in order.
select pg_temp.ok((select array_agg(access_pin order by access_pin) = '{1,2,3}' from public.members where gym_id = :'gym'), 'pins 1..3');

-- The owner adds a ZKTeco door. Nobody has a membership yet: nothing to send.
select pg_temp.act_as('oa@test.lb');
insert into public.access_devices (gym_id, vendor, name, serial_number, connection)
values (:'gym', 'zkteco', 'Main door', 'ZK0001', 'push');
reset role;
select id as door from public.access_devices where serial_number = 'ZK0001' \gset
select pg_temp.ok((select count(*) from public.access_commands where device_id = :'door') = 0, 'empty device, no commands');

-- A paid sale: Nour is sent to the door until the membership ends.
select pg_temp.act_as('fa@test.lb');
select public.sell_membership(:'nour', :'plan', public.gym_today(:'gym'), 0, 40, 'cash_usd') as inv \gset
reset role;
select pg_temp.ok((select count(*) = 1 and bool_and(kind = 'upsert_user' and payload->>'pin' = '1' and payload->>'name' = 'Nour Khalil'
                    and (payload->>'valid_until')::date = (select ends_on from public.memberships where member_id = :'nour'))
                   from public.access_commands where device_id = :'door' and member_id = :'nour' and status = 'queued'),
                  'paid sale queues the member with the end date');

-- Rami bought without paying: fine inside the grace period...
select pg_temp.act_as('fa@test.lb');
select public.sell_membership(:'rami', :'plan', public.gym_today(:'gym')) as rinv \gset
reset role;
select pg_temp.ok((select count(*) from public.access_commands where member_id = :'rami' and kind = 'upsert_user') = 1, 'unpaid inside grace still opens');
-- ...but overdue four days later: the next daily check removes him.
update public.invoices set issued_on = issued_on - 4 where id = :'rinv';
update public.access_devices set last_reconciled_on = null where id = :'door';
select public.access_device_seen(:'door', '{"fw":"Ver 8.0"}');
select pg_temp.ok((select count(*) = 1 and bool_and(kind = 'revoke_user') from public.access_commands
                    where member_id = :'rami' and status = 'queued'), 'overdue member revoked (replacing the unsent add)');
select pg_temp.ok((select info->>'fw' = 'Ver 8.0' and last_seen_at is not null from public.access_devices where id = :'door'), 'device info saved');
-- Paying lets him back in.
select pg_temp.act_as('fa@test.lb');
select public.add_payment(:'rinv', 40, 'whish');
reset role;
select pg_temp.ok((select count(*) = 1 and bool_and(kind = 'upsert_user') from public.access_commands
                    where member_id = :'rami' and status = 'queued'), 'paying re-adds');

-- The device collects its commands, confirms one, and a lost one is resent.
select pg_temp.ok((select count(*) from public.access_take_commands(:'door', 50)) = 2, 'two commands handed out');
select pg_temp.ok((select count(*) from public.access_take_commands(:'door', 50)) = 0, 'not handed out twice right away');
select id as c_nour from public.access_commands where member_id = :'nour' and kind = 'upsert_user' \gset
select public.access_command_done(:'door', :c_nour, true, null);
update public.access_commands set sent_at = now() - interval '3 minutes' where member_id = :'rami';
select pg_temp.ok((select count(*) = 1 and bool_and(attempts = 2) from public.access_take_commands(:'door', 50)), 'unconfirmed command resent');
select pg_temp.ok((select status = 'done' from public.access_commands where id = :c_nour), 'confirmed command done');

-- Nothing changes, nothing is queued again.
select public.access_sync_device(:'door');
select pg_temp.ok((select count(*) from public.access_commands where status = 'queued') = 0, 'up-to-date device gets nothing new');

-- A door entry becomes a check-in at the event time; resending it is ignored.
select now() - interval '10 minutes' as t10 \gset
select public.access_ingest_event(:'door', '1', :'t10', 'in', true, 'face', '{}') as r1 \gset
select pg_temp.ok(:'r1' = 'checked_in', 'entry checked in');
select pg_temp.ok((select count(*) = 1 and bool_and(source = 'device' and allowed and checked_in_at < now() - interval '9 minutes')
                   from public.checkins where member_id = :'nour'), 'check-in from the device keeps the event time');
select pg_temp.ok(public.access_ingest_event(:'door', '1', :'t10', 'in', true, 'face', '{}') = 'duplicate', 'resend recognised as a duplicate');
select pg_temp.ok((select count(*) from public.access_events where member_id = :'nour') = 1, 'resend not stored twice');
select pg_temp.ok((select count(*) from public.checkins where member_id = :'nour') = 1, 'resend not checked in twice');
select pg_temp.ok(public.access_ingest_event(:'door', '1', now(), 'out', true, 'face', '{}') = 'exit', 'exit recorded');
select pg_temp.ok(public.access_ingest_event(:'door', '99', now(), 'in', true, 'card', '{}') = 'unknown_member', 'unknown pin');
select pg_temp.ok(public.access_ingest_event(:'door', '3', now(), 'in', false, 'face', '{}') = 'denied_by_device', 'denied at the door');

-- The device let Lara in although she has no membership: refused, and the device is corrected.
select pg_temp.ok(public.access_ingest_event(:'door', '3', now() - interval '1 minute', 'in', true, 'card', '{}') = 'refused', 'stale device: refused');

-- Expiry: when the membership ends the member is revoked.
update public.memberships set ends_on = public.gym_today(:'gym') - 1, starts_on = public.gym_today(:'gym') - 31 where member_id = :'nour';
select pg_temp.ok((select count(*) = 1 and bool_and(kind = 'revoke_user') from public.access_commands
                    where member_id = :'nour' and status = 'queued'), 'expired member revoked');
select pg_temp.ok((select valid_until is null from public.access_grants where member_id = :'nour' and device_id = :'door'), 'grant cleared');

-- Zones: the pool plan only opens the pool door.
select pg_temp.act_as('oa@test.lb');
insert into public.access_zones (gym_id, name) values (:'gym', 'Pool'), (:'gym', 'Ladies area');
reset role;
select id as pool from public.access_zones where name = 'Pool' \gset
select id as ladies from public.access_zones where name = 'Ladies area' \gset
select pg_temp.act_as('oa@test.lb');
insert into public.plan_access_zones (plan_id, zone_id) values (:'pool_plan', :'pool');
insert into public.access_devices (gym_id, vendor, name, serial_number, connection, zone_id)
values (:'gym', 'zkteco', 'Pool gate', 'ZK0002', 'push', :'pool'), (:'gym', 'zkteco', 'Ladies door', 'ZK0003', 'push', :'ladies');
reset role;
select id as pool_gate from public.access_devices where serial_number = 'ZK0002' \gset
select id as ladies_door from public.access_devices where serial_number = 'ZK0003' \gset
select pg_temp.act_as('fa@test.lb');
select public.sell_membership(:'lara', :'pool_plan', public.gym_today(:'gym'), 0, 30, 'cash_usd');
reset role;
select pg_temp.ok((select count(*) from public.access_commands where member_id = :'lara' and device_id = :'pool_gate' and kind = 'upsert_user') = 1, 'pool plan opens the pool');
select pg_temp.ok((select count(*) from public.access_commands where member_id = :'lara' and device_id = :'ladies_door' and kind = 'upsert_user') = 0, 'pool plan does not open the ladies door');
select pg_temp.ok((select count(*) from public.access_commands where member_id = :'rami' and device_id = :'ladies_door' and kind = 'upsert_user') = 1, 'plan without zones opens every door');

-- A fingerprint enrolled on the main door goes to the other doors Rami can open.
select pg_temp.ok(public.access_save_biometric(:'door', '2', 'FP', '6', '{"FID":"6","Size":"4","Valid":"1","TMP":"QUJD"}'), 'template saved');
select pg_temp.ok((select count(*) from public.access_commands where member_id = :'rami' and kind = 'push_biometric' and device_id = :'ladies_door') = 1, 'template shared');
select pg_temp.ok((select count(*) from public.access_commands where member_id = :'rami' and kind = 'push_biometric' and device_id = :'door') = 0, 'not sent back to its own device');
select pg_temp.ok(not public.access_save_biometric(:'door', '42', 'FP', '1', '{}'), 'unknown pin template ignored');

-- Cards: enrolled at the device, or typed by the front desk; never edited directly.
select pg_temp.ok(public.access_save_card(:'door', '2', '1234567'), 'card from device saved');
select pg_temp.ok((select access_card = '1234567' from public.members where id = :'rami'), 'card on member');
select pg_temp.ok((select count(*) from public.access_commands where member_id = :'rami' and kind = 'upsert_user' and payload->>'card' = '1234567' and status = 'queued') >= 1, 'card sent to doors');
select pg_temp.act_as('fa@test.lb');
select pg_temp.fails(format('update public.members set access_card = %L where id = %L', '999', :'lara')) as direct_card \gset
select pg_temp.fails(format('select public.set_member_access_card(%L, %L)', :'lara', '1234567')) as dup_card \gset
select pg_temp.fails(format('select public.set_member_access_card(%L, %L)', :'lara', '12ab')) as bad_card \gset
select public.set_member_access_card(:'lara', '7654321');
select pg_temp.ok((select access_card = '7654321' from public.members where id = :'lara'), 'front desk sets a card');
-- The front desk sees door activity but not the devices or their secrets.
select pg_temp.ok((select count(*) from public.access_devices) = 0, 'front desk cannot see devices');
select pg_temp.ok((select count(*) from public.access_events) > 0, 'front desk sees door activity');
select pg_temp.fails(format('select public.resync_access_device(%L)', :'door')) as fd_resync \gset
select pg_temp.fails(format('select public.access_ingest_event(%L, %L, now(), %L, true)', :'door', '1', 'in')) as fd_ingest \gset
select pg_temp.fails(format('insert into public.access_commands (device_id, gym_id, kind) values (%L, %L, %L)', :'door', :'gym', 'reboot')) as fd_cmd \gset
reset role;
\echo direct card edit refused: :direct_card
\echo duplicate card refused: :dup_card

-- The owner: passwords are write-only, full resync queues everyone again.
select pg_temp.act_as('oa@test.lb');
select pg_temp.fails(format('update public.access_devices set event_token = %L where id = %L', 'x', :'door')) as token_edit \gset
reset role;
select pg_temp.ok((select count(*) from public.access_device_secrets) = 0, 'no secrets yet');
select pg_temp.act_as('oa@test.lb');
insert into public.access_devices (gym_id, vendor, name, connection, host)
values (:'gym', 'hikvision', 'Turnstile', 'direct', 'http://41.0.0.5:8080');
select id as hik from public.access_devices where vendor = 'hikvision' \gset
select public.set_access_device_password(:'hik', 'S3cret!');
select pg_temp.ok((select count(*) from public.access_device_secrets) = 0, 'owner cannot read device passwords');
select pg_temp.ok(public.resync_access_device(:'door') >= 1, 'resync queues members');
select pg_temp.ok(length(public.access_bridge_token(:'gym')) = 64, 'bridge token');
select pg_temp.ok((select count(*) from public.access_device_counts(:'gym')) = 4, 'counts per device');
reset role;
select pg_temp.ok((select password = 'S3cret!' from public.access_device_secrets where device_id = :'hik'), 'password stored');
-- Hikvision is told about members too, with no templates.
select pg_temp.ok((select count(*) from public.access_commands where device_id = :'hik' and kind = 'upsert_user') >= 1, 'hikvision device synced');
select pg_temp.ok((select count(*) from public.access_commands where device_id = :'hik' and kind = 'push_biometric') = 0, 'no zk templates to hikvision');

-- Invalid devices are refused.
select pg_temp.act_as('oa@test.lb');
select pg_temp.fails(format('insert into public.access_devices (gym_id, vendor, name, connection) values (%L, %L, %L, %L)', :'gym', 'zkteco', 'No SN', 'push')) as no_sn \gset
select pg_temp.fails(format('insert into public.access_devices (gym_id, vendor, name, connection) values (%L, %L, %L, %L)', :'gym', 'hikvision', 'No host', 'direct')) as no_host \gset
reset role;

\echo access tests passed
