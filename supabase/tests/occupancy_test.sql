-- Live occupancy: check-ins, doors and sensors, busy hours, who can see it.
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
  ('oo@test.lb', '{"full_name":"Owner O"}'),
  ('mo@test.lb', '{"full_name":"Member O"}'),
  ('xo@test.lb', '{"full_name":"Stranger"}');

select pg_temp.act_as('oo@test.lb');
select public.create_gym('Occupancy Gym') as gym \gset
insert into public.invites (gym_id, email, role, invited_by) values (:'gym', 'mo@test.lb', 'member', auth.uid());
insert into public.members (gym_id, full_name, created_by)
select :'gym', 'Person ' || n, auth.uid() from generate_series(1, 6) n;
reset role;
select pg_temp.act_as('mo@test.lb'); select public.claim_my_invites(); reset role;

-- No one yet.
select pg_temp.act_as('oo@test.lb');
select pg_temp.ok((select people = 0 and method = 'checkins' and level = 'quiet' from public.gym_occupancy(:'gym')), 'empty gym');
reset role;

-- 1. Check-ins: 4 recent, 2 too old (default visit is 75 minutes).
insert into public.checkins (gym_id, member_id, allowed, checked_in_at)
select :'gym', id, true, now() - interval '20 minutes' from public.members where gym_id = :'gym' and full_name in ('Person 1', 'Person 2', 'Person 3', 'Person 4');
insert into public.checkins (gym_id, member_id, allowed, checked_in_at)
select :'gym', id, true, now() - interval '3 hours' from public.members where gym_id = :'gym' and full_name in ('Person 5', 'Person 6');
insert into public.checkins (gym_id, member_id, allowed, checked_in_at)
select :'gym', id, false, now() - interval '5 minutes' from public.members where gym_id = :'gym' and full_name = 'Person 6';
select pg_temp.act_as('oo@test.lb');
select pg_temp.ok((select people = 4 and method = 'checkins' from public.gym_occupancy(:'gym')), 'recent allowed check-ins count');
update public.gyms set avg_visit_minutes = 240 where id = :'gym';
select pg_temp.ok((select people = 6 from public.gym_occupancy(:'gym')), 'longer visits count older check-ins');
update public.gyms set avg_visit_minutes = 75, capacity = 5 where id = :'gym';
select pg_temp.ok((select level = 'busy' and capacity = 5 from public.gym_occupancy(:'gym')), '4 of 5 is busy');
update public.gyms set capacity = 4 where id = :'gym';
select pg_temp.ok((select level = 'full' from public.gym_occupancy(:'gym')), '4 of 4 is full');
update public.gyms set capacity = 40 where id = :'gym';
select pg_temp.ok((select level = 'quiet' from public.gym_occupancy(:'gym')), '4 of 40 is quiet');
select pg_temp.ok((select count(*) > 0 from public.gym_occupancy_today(:'gym')), 'today by hour');
select pg_temp.ok((select count(*) between 1 and 168 from public.gym_busy_hours(:'gym')), 'busy hours by weekday and hour');
reset role;

-- 2. Doors that see exits: 3 came in, 1 left.
insert into public.access_devices (gym_id, vendor, name, serial_number, connection, direction)
values (:'gym', 'zkteco', 'Turnstile', 'OCC0001', 'push', 'both');
select id as dev from public.access_devices where serial_number = 'OCC0001' \gset
select public.access_ingest_event(:'dev', access_pin::text, now() - interval '30 minutes', 'in', true) from public.members where gym_id = :'gym' and full_name in ('Person 1', 'Person 2', 'Person 3');
select public.access_ingest_event(:'dev', access_pin::text, now() - interval '5 minutes', 'out', true) from public.members where gym_id = :'gym' and full_name = 'Person 1';
select pg_temp.act_as('oo@test.lb');
-- Persons 2 and 3 came in by the door, 1 left by it; Person 4 checked in at the desk 20 minutes ago and still counts.
select pg_temp.ok((select people = 3 and method = 'doors' and entries_today = 3 and exits_today = 1 from public.gym_occupancy(:'gym')), 'doors: in minus out, plus recent desk check-ins');
reset role;

-- 3. A sensor wins while it reports.
select pg_temp.act_as('oo@test.lb');
insert into public.occupancy_sensors (gym_id, name) values (:'gym', 'Entrance counter');
reset role;
select token as stoken from public.occupancy_sensors where gym_id = :'gym' \gset
select pg_temp.ok(public.occupancy_ingest(:'stoken', 10, 3), 'reading saved');
select pg_temp.ok(public.occupancy_ingest(:'stoken', 2, 0), 'second reading');
select pg_temp.ok(not public.occupancy_ingest('nope', 1, 0), 'unknown sensor refused');
select pg_temp.fails(format('select public.occupancy_ingest(%L, -1, 0)', :'stoken')) as negative \gset
select pg_temp.act_as('oo@test.lb');
select pg_temp.ok((select people = 9 and method = 'sensor' from public.gym_occupancy(:'gym')), 'sensor entries minus exits');
select pg_temp.ok((select count(*) from public.occupancy_readings) = 0, 'raw readings stay server-side');
reset role;
select public.occupancy_ingest(:'stoken', 0, 0, 17);
select pg_temp.act_as('oo@test.lb');
select pg_temp.ok((select people = 17 from public.gym_occupancy(:'gym')), 'sensor count wins');
reset role;
update public.occupancy_sensors set last_reading_at = now() - interval '1 hour';
select pg_temp.act_as('oo@test.lb');
select pg_temp.ok((select method = 'doors' from public.gym_occupancy(:'gym')), 'silent sensor falls back to doors');
reset role;

-- Members of the gym see it; strangers don't; members can't read sensors.
select pg_temp.act_as('mo@test.lb');
select pg_temp.ok((select people >= 0 from public.gym_occupancy(:'gym')), 'member sees occupancy');
select pg_temp.ok((select count(*) from public.occupancy_sensors) = 0, 'member sees no sensors');
update public.gyms set capacity = 1 where id = :'gym';
reset role;
select pg_temp.act_as('xo@test.lb');
select pg_temp.fails(format('select * from public.gym_occupancy(%L)', :'gym')) as stranger \gset
select pg_temp.fails(format('select * from public.gym_busy_hours(%L)', :'gym')) as stranger_busy \gset
select pg_temp.fails(format('select public.occupancy_ingest(%L, 1, 0)', :'stoken')) as stranger_ingest \gset
reset role;
select pg_temp.ok((select capacity = 40 from public.gyms where id = :'gym'), 'member could not change capacity');

\echo occupancy tests passed
