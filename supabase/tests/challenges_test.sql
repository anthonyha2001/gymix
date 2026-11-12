-- Monthly challenges: posting, joining by swipe, scores from real records,
-- the leaderboard, privacy between members, and who may do what.
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
  ('ch-owner@test.lb', '{"full_name":"Owner Ch"}'),
  ('ch-desk@test.lb', '{"full_name":"Desk Ch"}'),
  ('ch-nour@test.lb', '{"full_name":"Nour Khalil"}'),
  ('ch-rami@test.lb', '{"full_name":"Rami Haddad"}'),
  ('ch-lara@test.lb', '{"full_name":"Lara Nassar"}'),
  ('ch-other@test.lb', '{"full_name":"Other"}');

select pg_temp.act_as('ch-owner@test.lb');
select set_config('t.gym', public.create_gym('Challenge Gym')::text, false);
insert into public.invites (gym_id, email, role, invited_by) values (pg_temp.v('gym'), 'ch-desk@test.lb', 'front_desk', auth.uid());
reset role;
select pg_temp.act_as('ch-desk@test.lb'); select public.claim_my_invites(); reset role;
select pg_temp.act_as('ch-other@test.lb'); select set_config('t.gym2', public.create_gym('Other Gym')::text, false); reset role;

insert into public.members (gym_id, full_name, phone, user_id) values
  (pg_temp.v('gym'), 'Nour Khalil', '70300001', (select id from auth.users where email = 'ch-nour@test.lb')),
  (pg_temp.v('gym'), 'Rami Haddad', '70300002', (select id from auth.users where email = 'ch-rami@test.lb')),
  (pg_temp.v('gym'), 'Lara Nassar', '70300003', (select id from auth.users where email = 'ch-lara@test.lb')),
  (pg_temp.v('gym'), 'No Account', '70300004', null);
select set_config('t.nour', (select id::text from public.members where full_name = 'Nour Khalil'), false);
select set_config('t.rami', (select id::text from public.members where full_name = 'Rami Haddad'), false);
select set_config('t.lara', (select id::text from public.members where full_name = 'Lara Nassar'), false);

-- Only owners and managers post challenges.
select pg_temp.act_as('ch-desk@test.lb');
select pg_temp.ok(pg_temp.fails(format(
  'insert into public.challenges (gym_id, title, metric, starts_on, ends_on) values (%L, ''Nope'', ''visits'', current_date, current_date + 10)', pg_temp.v('gym')))
  like '%row-level security%', 'front desk cannot post');
reset role;
select pg_temp.act_as('ch-nour@test.lb');
select pg_temp.ok(pg_temp.fails(format(
  'insert into public.challenges (gym_id, title, metric, starts_on, ends_on) values (%L, ''Nope'', ''visits'', current_date, current_date + 10)', pg_temp.v('gym')))
  like '%row-level security%', 'members cannot post');
reset role;

-- The owner posts a visits challenge for this month (target 3) and a volume one.
select pg_temp.act_as('ch-owner@test.lb');
insert into public.challenges (gym_id, title, description, metric, target, prize, starts_on, ends_on)
values (pg_temp.v('gym'), 'November visits', 'Come as often as you can', 'visits', 3, 'Free protein shake',
        public.gym_today(pg_temp.v('gym')) - 5, public.gym_today(pg_temp.v('gym')) + 20);
insert into public.challenges (gym_id, title, metric, starts_on, ends_on)
values (pg_temp.v('gym'), 'Lift the most', 'volume', public.gym_today(pg_temp.v('gym')) - 5, public.gym_today(pg_temp.v('gym')) + 20);
select pg_temp.ok(pg_temp.fails(format(
  'insert into public.challenges (gym_id, title, metric, starts_on, ends_on) values (%L, ''Too long'', ''visits'', current_date, current_date + 120)', pg_temp.v('gym')))
  like '%check%', 'at most about three months');
reset role;
select set_config('t.visits', (select id::text from public.challenges where title = 'November visits'), false);
select set_config('t.volume', (select id::text from public.challenges where title = 'Lift the most'), false);
select pg_temp.ok((select created_by = (select id from auth.users where email = 'ch-owner@test.lb') from public.challenges where id = pg_temp.v('visits')), 'records who posted it');

-- Everyone with an account was told, once per challenge.
select pg_temp.ok((select count(*) = 3 from public.notifications where kind = 'challenge' and link = '/portal/challenges' and title = 'New challenge: November visits'), 'three members notified');
select pg_temp.ok((select body = 'Free protein shake' from public.notifications where title = 'New challenge: November visits' limit 1), 'prize in the notification');

-- Swipes: Nour and Rami join, Lara skips.
select pg_temp.act_as('ch-nour@test.lb'); select public.challenge_set_entry(pg_temp.v('visits'), true); select public.challenge_set_entry(pg_temp.v('volume'), true); reset role;
select pg_temp.act_as('ch-rami@test.lb'); select public.challenge_set_entry(pg_temp.v('visits'), true); reset role;
select pg_temp.act_as('ch-lara@test.lb'); select public.challenge_set_entry(pg_temp.v('visits'), false); reset role;

-- Records: Nour came on 3 different days (twice on one day), Rami once,
-- a refused check-in and one from before the challenge don't count.
insert into public.checkins (gym_id, member_id, allowed, checked_in_at) values
  (pg_temp.v('gym'), pg_temp.v('nour'), true, now() - interval '1 day'),
  (pg_temp.v('gym'), pg_temp.v('nour'), true, now() - interval '2 days'),
  (pg_temp.v('gym'), pg_temp.v('nour'), true, now() - interval '2 days' + interval '1 hour'),
  (pg_temp.v('gym'), pg_temp.v('nour'), true, now() - interval '3 days'),
  (pg_temp.v('gym'), pg_temp.v('rami'), true, now() - interval '1 day'),
  (pg_temp.v('gym'), pg_temp.v('rami'), false, now() - interval '2 days'),
  (pg_temp.v('gym'), pg_temp.v('rami'), true, now() - interval '30 days');

-- Nour lifted 2 sets: 100 kg x 5 and 80 kg x 10 = 1300 kg.
insert into public.exercises (id, name) values ('Squat_Test', 'Squat') on conflict (id) do nothing;
insert into public.workout_sessions (gym_id, member_id, started_at, finished_at) values (pg_temp.v('gym'), pg_temp.v('nour'), now() - interval '1 day', now() - interval '23 hours');
insert into public.set_logs (session_id, member_id, exercise_id, set_number, weight_kg, reps)
select s.id, pg_temp.v('nour'), 'Squat_Test', n, w, r
  from public.workout_sessions s, (values (1, 100, 5), (2, 80, 10)) as x(n, w, r)
 where s.member_id = pg_temp.v('nour');

select pg_temp.ok((select score from public.challenge_scores(pg_temp.v('visits')) where member_id = pg_temp.v('nour')) = 3, 'Nour: 3 days (same day counted once)');
select pg_temp.ok((select score from public.challenge_scores(pg_temp.v('visits')) where member_id = pg_temp.v('rami')) = 1, 'Rami: refused and too-early check-ins not counted');
select pg_temp.ok((select count(*) from public.challenge_scores(pg_temp.v('visits'))) = 2, 'skipped members are not ranked');
select pg_temp.ok((select score from public.challenge_scores(pg_temp.v('volume')) where member_id = pg_temp.v('nour')) = 1300, 'volume in kg');

-- The board, as a member: first name + initial, only own row marked.
select pg_temp.act_as('ch-rami@test.lb');
create temp table board as select * from public.challenge_board(pg_temp.v('visits'));
select pg_temp.ok((select name = 'Nour K.' and rank = 1 and completed and not is_me and member_id is null from board where rank = 1), 'leader shown as Nour K., completed, no id');
select pg_temp.ok((select is_me and member_id = pg_temp.v('rami') and rank = 2 and not completed from board where rank = 2), 'own row marked');
-- The portal list.
create temp table mine as select jsonb_array_elements(public.member_challenges(pg_temp.v('gym'))) as c;
select pg_temp.ok((select count(*) = 2 from mine), 'two challenges listed');
select pg_temp.ok((select c->>'state' = 'active' and c->>'status' = 'joined' and (c->>'rank')::int = 2 and (c->>'score')::numeric = 1
                     and (c->>'participants')::int = 2 and c->'top'->0->>'name' = 'Nour K.' and (c->>'days_left')::int = 21
                   from mine where c->>'title' = 'November visits'), 'Rami sees his place, the top and days left');
select pg_temp.ok((select c->>'status' is null and c->>'rank' is null from mine where c->>'title' = 'Lift the most'), 'not joined: no rank');
reset role;

-- Staff see full names and ids.
select pg_temp.act_as('ch-desk@test.lb');
select pg_temp.ok((select name = 'Nour Khalil' and member_id = pg_temp.v('nour') from public.challenge_board(pg_temp.v('visits')) where rank = 1), 'staff see the full name');
reset role;

-- Another gym sees nothing.
select pg_temp.act_as('ch-other@test.lb');
select pg_temp.ok(pg_temp.fails(format('select * from public.challenge_board(%L)', pg_temp.v('visits'))) like '%Not allowed%', 'other gym: no board');
select pg_temp.ok((select count(*) = 0 from public.challenges where gym_id = pg_temp.v('gym')), 'other gym: no challenges');
select pg_temp.ok(pg_temp.fails(format('select public.challenge_set_entry(%L, true)', pg_temp.v('visits'))) like '%Not allowed%', 'other gym: cannot join');
reset role;

-- Members can't write entries directly, or see others' entries.
select pg_temp.act_as('ch-lara@test.lb');
select pg_temp.ok(pg_temp.fails(format('insert into public.challenge_entries (challenge_id, member_id, gym_id, status) values (%L, %L, %L, ''joined'')',
  pg_temp.v('visits'), pg_temp.v('nour'), pg_temp.v('gym'))) like '%permission denied%', 'no direct entry writes');
select pg_temp.ok((select count(*) = 1 from public.challenge_entries), 'Lara sees only her own entry');
-- Changing her mind: swipe right later.
select public.challenge_set_entry(pg_temp.v('visits'), true);
reset role;
select pg_temp.ok((select count(*) from public.challenge_scores(pg_temp.v('visits'))) = 3, 'Lara joined after skipping');

-- An ended challenge can't be joined, and still shows the result.
update public.challenges set starts_on = public.gym_today(pg_temp.v('gym')) - 40, ends_on = public.gym_today(pg_temp.v('gym')) - 10 where id = pg_temp.v('volume');
select pg_temp.act_as('ch-rami@test.lb');
select pg_temp.ok(pg_temp.fails(format('select public.challenge_set_entry(%L, true)', pg_temp.v('volume'))) like '%has ended%', 'ended: cannot join');
select pg_temp.ok((select c->>'state' = 'ended' from jsonb_array_elements(public.member_challenges(pg_temp.v('gym'))) c where c->>'title' = 'Lift the most'), 'ended state');
reset role;

-- Managers edit and delete.
select pg_temp.act_as('ch-owner@test.lb');
update public.challenges set prize = 'One free month' where id = pg_temp.v('visits');
delete from public.challenges where id = pg_temp.v('volume');
reset role;
select pg_temp.ok((select prize = 'One free month' from public.challenges where id = pg_temp.v('visits')), 'edited');
select pg_temp.ok((select count(*) = 0 from public.challenge_entries where challenge_id = pg_temp.v('volume')), 'deleted with its entries');

select 'challenges_test passed';
