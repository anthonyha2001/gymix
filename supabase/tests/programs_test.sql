-- Phase 3 tests: machines, available exercises, program requests, programs, swaps, workout logs.
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

-- A tiny exercise catalog.
insert into public.exercises (id, name, equipment, primary_muscles, image_paths) values
  ('Leg_Press',       'Leg Press',       'machine',   '{quadriceps}', '{Leg_Press/0.jpg,Leg_Press/1.jpg}'),
  ('Hack_Squat',      'Hack Squat',      'machine',   '{quadriceps}', '{}'),
  ('Barbell_Squat',   'Barbell Squat',   'barbell',   '{quadriceps}', '{}'),
  ('Pushups',         'Pushups',         'body only', '{chest}',      '{}'),
  ('Chest_Press',     'Chest Press',     'machine',   '{chest}',      '{}');

insert into auth.users (email, raw_user_meta_data) values
  ('o3@test.lb', '{"full_name":"Owner Three"}'),
  ('t3@test.lb', '{"full_name":"Trainer Three"}'),
  ('m3@test.lb', '{"full_name":"Member Three"}'),
  ('n3@test.lb', '{"full_name":"Other Member"}');

select pg_temp.act_as('o3@test.lb');
select public.create_gym('Gym Three') as gym \gset
insert into public.invites (gym_id, email, role, invited_by) values
  (:'gym', 't3@test.lb', 'trainer', auth.uid()),
  (:'gym', 'm3@test.lb', 'member', auth.uid()),
  (:'gym', 'n3@test.lb', 'member', auth.uid());
update public.gyms set program_price_usd = 25 where id = :'gym';

-- Owner registers a leg press machine supporting two exercises.
insert into public.gym_machines (gym_id, name, created_by) values (:'gym', 'Leg press', auth.uid());
select id as machine from public.gym_machines where name = 'Leg press' \gset
insert into public.machine_exercises (machine_id, exercise_id) values (:'machine', 'Leg_Press'), (:'machine', 'Hack_Squat');
reset role;
select pg_temp.act_as('t3@test.lb'); select public.claim_my_invites(); reset role;
select pg_temp.act_as('m3@test.lb'); select public.claim_my_invites(); reset role;
select pg_temp.act_as('n3@test.lb'); select public.claim_my_invites(); reset role;
select id as m3 from public.members where email = 'm3@test.lb' \gset
select id as n3 from public.members where email = 'n3@test.lb' \gset

-- Available exercises = ticked equipment + registered machines. This gym has no barbell yet.
select pg_temp.act_as('o3@test.lb');
select pg_temp.ok((select array_agg(id order by id) from public.gym_exercises where gym_id = :'gym')
                  = array['Hack_Squat', 'Leg_Press'], 'new gym: only its registered machines until equipment is added');
select public.set_gym_equipment(:'gym', array['body only', 'dumbbell']);
select pg_temp.fails(format('select public.set_gym_equipment(%L, array[''spaceship''])', :'gym')) as bad_equipment \gset
\echo unknown equipment rejected: :bad_equipment
reset role;
select pg_temp.act_as('m3@test.lb');
select pg_temp.fails(format('select public.set_gym_equipment(%L, array[''barbell''])', :'gym')) as member_equipment \gset
\echo member cannot change equipment: :member_equipment
select pg_temp.ok((select array_agg(id order by id) from public.gym_exercises where gym_id = :'gym')
                  = array['Hack_Squat', 'Leg_Press', 'Pushups'], 'available: machines + bodyweight, no barbell, no unregistered machine');
select pg_temp.ok((select count(*) from public.gym_machines) = 1, 'member sees machines');
select pg_temp.fails(format($q$insert into public.gym_machines (gym_id, name, created_by) values (%L, 'X', auth.uid())$q$, :'gym')) as m_machine \gset
\echo member cannot add machines: :m_machine

select pg_temp.ok((select count(*) from public.gym_coaches(:'gym')) = 2, 'member sees coach names (owner + trainer)');

-- Member requests a program; gym charges $25 so an invoice appears.
select public.request_program(:'gym', 'build_muscle', 3, 'beginner', 'left knee', null, null) as req \gset
select pg_temp.ok((select amount_usd from public.invoices where description = 'Personal training program') = 25, 'program invoice');
select pg_temp.fails(format('select public.request_program(%L, ''strength'', 2, ''advanced'')', :'gym')) as dup_req \gset
\echo second open request rejected: :dup_req
reset role;

-- Trainer builds a template, then a program for the request from it.
select pg_temp.act_as('t3@test.lb');
select pg_temp.ok((select count(*) from public.program_requests) = 1, 'trainer sees request');
select pg_temp.ok((select count(*) from public.invoices) = 0, 'trainer still sees no invoices');
insert into public.programs (gym_id, name, kind, created_by, is_active) values (:'gym', 'Beginner legs', 'template', auth.uid(), true);
select id as tpl from public.programs where kind = 'template' \gset
insert into public.program_days (program_id, position, name) values (:'tpl', 0, 'Day A');
insert into public.program_exercises (day_id, position, exercise_id, sets, reps, target_weight_kg)
select id, 0, 'Leg_Press', 3, '10-12', 60 from public.program_days where program_id = :'tpl';
select public.create_member_program(:'m3', 'Muscle builder', :'req', :'tpl') as prog \gset
select pg_temp.ok((select status from public.program_requests where id = :'req') = 'in_progress', 'request in progress');
select pg_temp.ok((select count(*) from public.program_exercises pe join public.program_days d on d.id = pe.day_id
                    where d.program_id = :'prog') = 1, 'template copied');
reset role;

-- Draft isn't active yet; member can see it but not edit it.
select pg_temp.act_as('m3@test.lb');
select pg_temp.ok((select is_active from public.programs where id = :'prog') = false, 'draft inactive');
select id as pe from public.program_exercises pe where pe.day_id in (select id from public.program_days where program_id = :'prog') \gset
update public.program_exercises set sets = 9 where id = :'pe';
select pg_temp.ok((select sets from public.program_exercises where id = :'pe') = 3, 'member cannot edit trainer program');
select pg_temp.fails(format('select public.publish_program(%L)', :'prog')) as m_publish \gset
\echo member cannot publish: :m_publish
reset role;

select pg_temp.act_as('t3@test.lb');
select public.publish_program(:'prog');
select pg_temp.ok((select is_active from public.programs where id = :'prog'), 'published');
select pg_temp.ok((select status from public.program_requests where id = :'req') = 'done', 'request done');
reset role;

-- Member swaps freely among available exercises; not to ones the gym can't do.
select pg_temp.act_as('m3@test.lb');
select public.swap_program_exercise(:'pe', 'Hack_Squat');
select pg_temp.ok((select exercise_id = 'Hack_Squat' and swapped_from = 'Leg_Press' from public.program_exercises where id = :'pe'), 'swapped');
select public.swap_program_exercise(:'pe', 'Pushups');
select pg_temp.ok((select swapped_from from public.program_exercises where id = :'pe') = 'Leg_Press', 'keeps original');
select public.swap_program_exercise(:'pe', 'Leg_Press');
select pg_temp.ok((select swapped_from is null from public.program_exercises where id = :'pe'), 'swap back clears flag');
select pg_temp.fails(format('select public.swap_program_exercise(%L, ''Barbell_Squat'')', :'pe')) as no_equipment \gset
\echo unavailable swap rejected: :no_equipment
reset role;
-- Once the gym ticks "barbell", barbell exercises become available.
select pg_temp.act_as('o3@test.lb');
select public.set_gym_equipment(:'gym', array['body only', 'dumbbell', 'barbell']);
reset role;
select pg_temp.act_as('m3@test.lb');
select public.swap_program_exercise(:'pe', 'Barbell_Squat');
select pg_temp.ok((select exercise_id from public.program_exercises where id = :'pe') = 'Barbell_Squat', 'barbell swap after ticking barbell');
select public.swap_program_exercise(:'pe', 'Leg_Press');

-- Member builds their own program and edits it.
insert into public.programs (gym_id, member_id, name, kind, created_by, is_active) values (:'gym', :'m3', 'My plan', 'self', auth.uid(), true);
select id as selfprog from public.programs where kind = 'self' \gset
insert into public.program_days (program_id, position, name) values (:'selfprog', 0, 'Push');
insert into public.program_exercises (day_id, exercise_id) select id, 'Pushups' from public.program_days where program_id = :'selfprog';
update public.program_exercises set sets = 5 where exercise_id = 'Pushups' and day_id in (select id from public.program_days where program_id = :'selfprog');
select pg_temp.ok((select sets from public.program_exercises pe join public.program_days d on d.id = pe.day_id
                    where d.program_id = :'selfprog') = 5, 'member edits own program');
select pg_temp.fails(format($q$insert into public.programs (gym_id, member_id, name, kind, created_by) values (%L, %L, 'Fake', 'trainer', auth.uid())$q$, :'gym', :'m3')) as fake_trainer \gset
\echo member cannot create trainer programs: :fake_trainer

-- Workout logging.
insert into public.workout_sessions (gym_id, member_id, program_id, day_name) values (:'gym', :'m3', :'prog', 'Day A');
select id as sess from public.workout_sessions limit 1 \gset
insert into public.set_logs (session_id, member_id, exercise_id, set_number, weight_kg, reps) values
  (:'sess', :'m3', 'Leg_Press', 1, 60, 12), (:'sess', :'m3', 'Leg_Press', 2, 70, 10), (:'sess', :'m3', 'Pushups', 1, 0, 25);
-- Correcting a logged set updates weight/reps only; moving it to another exercise is not allowed.
update public.set_logs set weight_kg = 65 where session_id = :'sess' and set_number = 1 and exercise_id = 'Leg_Press';
update public.set_logs set weight_kg = 60 where session_id = :'sess' and set_number = 1 and exercise_id = 'Leg_Press';
select pg_temp.fails(format($q$update public.set_logs set exercise_id = 'Pushups' where session_id = %L$q$, :'sess')) as move_set \gset
\echo cannot move a set to another exercise: :move_set
update public.workout_sessions set finished_at = now() where id = :'sess';
select pg_temp.ok((select best_weight_kg from public.exercise_bests where exercise_id = 'Leg_Press') = 70, 'best weight');
select pg_temp.ok((select best_bodyweight_reps from public.exercise_bests where exercise_id = 'Pushups') = 25, 'bodyweight best');
select pg_temp.fails(format($q$insert into public.set_logs (session_id, member_id, exercise_id, set_number, weight_kg, reps) values (%L, %L, 'Leg_Press', 9, 1, 1)$q$, :'sess', :'n3')) as other_log \gset
\echo cannot log for another member: :other_log
reset role;

-- Another member sees none of it.
select pg_temp.act_as('n3@test.lb');
select pg_temp.ok((select count(*) from public.programs where kind <> 'template') = 0, 'other member sees no programs');
select pg_temp.ok((select count(*) from public.workout_sessions) = 0, 'other member sees no sessions');
select pg_temp.ok((select count(*) from public.set_logs) = 0, 'other member sees no sets');
select pg_temp.ok((select count(*) from public.program_requests) = 0, 'other member sees no requests');
select pg_temp.fails(format($q$insert into public.workout_sessions (gym_id, member_id) values (%L, %L)$q$, :'gym', :'m3')) as other_session \gset
\echo cannot start a session as someone else: :other_session
reset role;

-- Trainer follows the member's progress.
select pg_temp.act_as('t3@test.lb');
select pg_temp.ok((select count(*) from public.set_logs) = 3, 'trainer sees logs');
select pg_temp.ok((select count(*) from public.programs where kind = 'self') = 1, 'trainer sees self-built program');
update public.programs set name = 'Edited by trainer' where kind = 'self';
select pg_temp.ok((select name from public.programs where kind = 'self') = 'Edited by trainer', 'coach can edit any program');
select public.save_as_template(:'prog', 'Copy') as tpl2 \gset
select pg_temp.ok((select count(*) from public.program_days where program_id = :'tpl2') = 1, 'saved as template');
reset role;

-- Training flow: free workout with its own exercise list; simulated tap.
select pg_temp.act_as('m3@test.lb');
insert into public.workout_sessions (gym_id, member_id, day_name) values (:'gym', :'m3', 'Free workout');
select id as free from public.workout_sessions where day_name = 'Free workout' \gset
insert into public.workout_exercises (session_id, member_id, exercise_id, added_via, machine_id)
values (:'free', :'m3', 'Leg_Press', 'machine', :'machine');
select pg_temp.ok((select count(*) from public.workout_exercises where session_id = :'free') = 1, 'machine exercise added to free workout');
select pg_temp.fails(format($q$insert into public.workout_exercises (session_id, member_id, exercise_id) values (%L, %L, 'Pushups')$q$, :'free', :'n3')) as other_wex \gset
\echo cannot add to another member workout: :other_wex
select pg_temp.ok((select allowed from public.simulated_check_in(:'gym')) is not null, 'simulated tap works while switched on');
reset role;
select pg_temp.act_as('n3@test.lb');
select pg_temp.ok((select count(*) from public.workout_exercises) = 0, 'other member sees none');
reset role;
select pg_temp.act_as('o3@test.lb');
update public.gyms set tap_simulator = false where id = :'gym';
reset role;
select pg_temp.act_as('m3@test.lb');
select pg_temp.fails(format('select * from public.simulated_check_in(%L)', :'gym')) as sim_off \gset
\echo simulator off blocks fake taps: :sim_off
reset role;

\echo 'ALL PROGRAM TESTS PASSED'
