-- Program sharing: links, what a friend sees, copying, and the gym switch.
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
  ('ps-owner@test.lb', '{"full_name":"Owner Ps"}'),
  ('ps-nour@test.lb', '{"full_name":"Nour Khalil"}'),
  ('ps-rami@test.lb', '{"full_name":"Rami Haddad"}'),
  ('ps-out@test.lb', '{"full_name":"Outsider"}');
select pg_temp.act_as('ps-owner@test.lb');
select set_config('t.gym', public.create_gym('Share Gym')::text, false);
reset role;
insert into public.members (gym_id, full_name, phone, user_id) values
  (pg_temp.v('gym'), 'Nour Khalil', '70700001', (select id from auth.users where email = 'ps-nour@test.lb')),
  (pg_temp.v('gym'), 'Rami Haddad', '70700002', (select id from auth.users where email = 'ps-rami@test.lb'));
insert into public.gym_users (gym_id, user_id, role) select pg_temp.v('gym'), id, 'member' from auth.users where email in ('ps-nour@test.lb', 'ps-rami@test.lb');
select set_config('t.nour', (select id::text from public.members where full_name = 'Nour Khalil'), false);
select set_config('t.rami', (select id::text from public.members where full_name = 'Rami Haddad'), false);
insert into public.exercises (id, name, equipment) values ('Squat_Share', 'Squat Share', 'barbell') on conflict do nothing;

-- Nour's own program (2 days) and a trainer program.
insert into public.programs (gym_id, member_id, name, kind, is_active) values (pg_temp.v('gym'), pg_temp.v('nour'), 'Leg Destroyer', 'self', true);
select set_config('t.prog', (select id::text from public.programs where name = 'Leg Destroyer'), false);
insert into public.program_days (program_id, position, name) values (pg_temp.v('prog'), 0, 'Legs A'), (pg_temp.v('prog'), 1, 'Legs B');
insert into public.program_exercises (day_id, position, exercise_id, sets, reps, target_weight_kg)
select id, 0, 'Squat_Share', 5, '5', 100 from public.program_days where program_id = pg_temp.v('prog');
insert into public.programs (gym_id, member_id, name, kind, is_active) values (pg_temp.v('gym'), pg_temp.v('nour'), 'Coach Plan', 'trainer', true);
select set_config('t.coach', (select id::text from public.programs where name = 'Coach Plan'), false);

-- Nour shares; the same link comes back. Rami can't share Nour's program.
select pg_temp.act_as('ps-nour@test.lb');
select set_config('t.tok', public.share_program(pg_temp.v('prog')), false);
select pg_temp.ok(public.share_program(pg_temp.v('prog')) = current_setting('t.tok'), 'same link');
select pg_temp.ok(pg_temp.fails(format('select public.share_program(%L)', pg_temp.v('coach'))) like '%doesn''t allow%', 'trainer programs not shared by default');
reset role;
select pg_temp.act_as('ps-rami@test.lb');
select pg_temp.ok(pg_temp.fails(format('select public.share_program(%L)', pg_temp.v('prog'))) like '%Not your program%', 'not his program');

-- Rami sees it and adds a copy, without the target weights.
select pg_temp.ok((public.shared_program(current_setting('t.tok')) ->> 'can_add')::boolean, 'rami can add');
select pg_temp.ok((public.shared_program(current_setting('t.tok')) ->> 'by') = 'Nour', 'first name only');
select pg_temp.ok(jsonb_array_length(public.shared_program(current_setting('t.tok')) -> 'days') = 2, 'two days');
select set_config('t.copy', public.copy_shared_program(current_setting('t.tok'))::text, false);
reset role;
select pg_temp.ok((select member_id = pg_temp.v('rami') and kind = 'self' and is_active from public.programs where id = pg_temp.v('copy')), 'copy is ramis own');
select pg_temp.ok((select count(*) = 2 from public.program_exercises pe join public.program_days d on d.id = pe.day_id where d.program_id = pg_temp.v('copy') and pe.target_weight_kg is null), 'exercises copied without weights');
select pg_temp.ok((select copies = 1 from public.program_shares where token = current_setting('t.tok')), 'copy counted');

-- An outsider (and someone signed out) can look, but can't add.
select pg_temp.act_as('ps-out@test.lb');
select pg_temp.ok(not (public.shared_program(current_setting('t.tok')) ->> 'can_add')::boolean, 'outsider cannot add');
select pg_temp.ok(pg_temp.fails(format('select public.copy_shared_program(%L)', current_setting('t.tok'))) like 'Only members of Share Gym%', 'outsider copy refused');
reset role;
set role anon;
select pg_temp.ok((public.shared_program(current_setting('t.tok')) ->> 'gym') = 'Share Gym', 'anyone with the link can look');
reset role;

-- The gym switches sharing off: links stop working.
update public.gyms set program_sharing = 'off' where id = pg_temp.v('gym');
select pg_temp.ok(public.shared_program(current_setting('t.tok')) is null, 'off hides shared programs');
select 'program sharing: all passed' as result;
