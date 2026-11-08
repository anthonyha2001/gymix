-- Gymix Screens: which slides show where and when, live data, privacy, permissions.
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
  ('os@test.lb', '{"full_name":"Owner S"}'),
  ('fs@test.lb', '{"full_name":"Front S"}'),
  ('ms@test.lb', '{"full_name":"Lara Nassar"}');

select pg_temp.act_as('os@test.lb');
select public.create_gym('Screen Gym') as gym \gset
insert into public.invites (gym_id, email, role, invited_by) values (:'gym', 'fs@test.lb', 'front_desk', auth.uid()), (:'gym', 'ms@test.lb', 'member', auth.uid());
insert into public.members (gym_id, full_name, created_by) values (:'gym', 'Nour Khalil', auth.uid()), (:'gym', 'Rami Abou Haddad', auth.uid());
insert into public.screens (gym_id, name) values (:'gym', 'Lobby TV'), (:'gym', 'Studio TV');
reset role;
select pg_temp.act_as('fs@test.lb'); select public.claim_my_invites(); reset role;
select pg_temp.act_as('ms@test.lb'); select public.claim_my_invites(); reset role;
select id as lobby, token as lobby_token from public.screens where name = 'Lobby TV' \gset
select id as studio, token as studio_token from public.screens where name = 'Studio TV' \gset
select id as nour from public.members where full_name = 'Nour Khalil' \gset
select id as rami from public.members where full_name = 'Rami Abou Haddad' \gset
select id as lara from public.members where full_name = 'Lara Nassar' \gset

select pg_temp.ok(public.screen_name('Rami Abou Haddad') = 'Rami H.' and public.screen_name('Cher') = 'Cher', 'first name and last initial');

-- (Times are the gym's: Asia/Beirut.)
-- Slides: one everywhere, one only on the studio, one expired, one for another weekday, one later today.
select pg_temp.act_as('os@test.lb');
insert into public.screen_slides (gym_id, kind, title, body, position) values (:'gym', 'announcement', 'Closed on Sunday', 'Happy holidays', 1);
insert into public.screen_slides (gym_id, kind, title, screen_ids, position) values (:'gym', 'promo', 'Protein 20% off', array[:'studio']::uuid[], 2);
insert into public.screen_slides (gym_id, kind, title, ends_on) values (:'gym', 'promo', 'Old offer', (now() at time zone 'Asia/Beirut')::date - 1);
insert into public.screen_slides (gym_id, kind, title, weekdays) values (:'gym', 'promo', 'Not today', array[((extract(dow from (now() at time zone 'Asia/Beirut'))::int + 1) % 7)]::smallint[]);
insert into public.screen_slides (gym_id, kind, title, time_from, time_to) values (:'gym', 'promo', 'Never now', ((now() at time zone 'Asia/Beirut') + interval '2 hours')::time, ((now() at time zone 'Asia/Beirut') + interval '3 hours')::time);
insert into public.screen_slides (gym_id, kind, position) values (:'gym', 'leaderboard', 3), (:'gym', 'achievements', 4), (:'gym', 'occupancy', 5), (:'gym', 'schedule', 6);
select pg_temp.fails(format('insert into public.screen_slides (gym_id, kind) values (%L, %L)', :'gym', 'announcement')) as no_title \gset
select pg_temp.fails(format('update public.screens set token = %L where id = %L', 'x', :'lobby')) as token_edit \gset
reset role;

-- Check-ins this month for the leaderboard: Nour 3, Rami 2, Lara 1 (Lara opts out later).
insert into public.checkins (gym_id, member_id, allowed, checked_in_at)
select :'gym', :'nour', true, now() - (n || ' hours')::interval from generate_series(1, 3) n;
insert into public.checkins (gym_id, member_id, allowed, checked_in_at)
select :'gym', :'rami', true, now() - (n || ' hours')::interval from generate_series(1, 2) n;
insert into public.checkins (gym_id, member_id, allowed, checked_in_at) values (:'gym', :'lara', true, now() - interval '1 hour');
insert into public.checkins (gym_id, member_id, allowed, checked_in_at) values (:'gym', :'rami', false, now());
-- A personal record this week: Nour pressed 80 before, 90 now.
insert into public.workout_sessions (id, gym_id, member_id, started_at) values
  ('11111111-1111-1111-1111-111111111111', :'gym', :'nour', now() - interval '20 days'),
  ('22222222-2222-2222-2222-222222222222', :'gym', :'nour', now() - interval '1 day');
insert into public.exercises (id, name) values ('Leg_Press', 'Leg Press') on conflict (id) do nothing;
insert into public.set_logs (session_id, member_id, exercise_id, set_number, weight_kg, reps, logged_at) values
  ('11111111-1111-1111-1111-111111111111', :'nour', 'Leg_Press', 1, 80, 10, now() - interval '20 days'),
  ('22222222-2222-2222-2222-222222222222', :'nour', 'Leg_Press', 1, 90, 8, now() - interval '1 day');

select public.screen_feed(:'lobby_token') as lobby_feed \gset
select pg_temp.ok((:'lobby_feed'::jsonb->'gym'->>'name') = 'Screen Gym', 'feed has the gym');
select pg_temp.ok((select array_agg(s->>'kind' order by ord) = '{announcement,leaderboard,achievements,occupancy,schedule}'
                     from jsonb_array_elements(:'lobby_feed'::jsonb->'slides') with ordinality as t(s, ord)), 'lobby shows the right slides in order');
select pg_temp.ok((select array_agg(s->>'title') @> '{Protein 20% off}' from jsonb_array_elements(public.screen_feed(:'studio_token')->'slides') s), 'studio also shows its own promo');
select pg_temp.ok((select (s->'data'->0->>'name') = 'Nour K.' and (s->'data'->0->>'visits')::int = 3 and jsonb_array_length(s->'data') = 3
                     from jsonb_array_elements(:'lobby_feed'::jsonb->'slides') s where s->>'kind' = 'leaderboard'), 'leaderboard counts allowed check-ins');
select pg_temp.ok((select (s->'data'->0->>'exercise') = 'Leg Press' and (s->'data'->0->>'weight')::numeric = 90 and jsonb_array_length(s->'data') = 1
                     from jsonb_array_elements(:'lobby_feed'::jsonb->'slides') s where s->>'kind' = 'achievements'), 'personal record this week');
select pg_temp.ok((select (s->'data'->>'people')::int >= 0 from jsonb_array_elements(:'lobby_feed'::jsonb->'slides') s where s->>'kind' = 'occupancy'), 'occupancy on screen');
select pg_temp.ok((select last_seen_at is not null from public.screens where id = :'lobby'), 'screen seen');

-- Lara hides herself from the screens.
select pg_temp.act_as('ms@test.lb');
select public.set_show_on_screens(:'gym', false);
reset role;
select pg_temp.ok((select jsonb_array_length(s->'data') = 2 from jsonb_array_elements(public.screen_feed(:'lobby_token')->'slides') s where s->>'kind' = 'leaderboard'), 'opted-out member hidden');

-- Switched off, or unknown: nothing.
select pg_temp.act_as('os@test.lb');
update public.screens set is_active = false where id = :'studio';
select pg_temp.ok((public.screen_preview(:'lobby')->'screen'->>'name') = 'Lobby TV', 'owner preview');
reset role;
select pg_temp.ok(public.screen_feed(:'studio_token') is null, 'switched-off screen gets nothing');
select pg_temp.ok(public.screen_feed('nope') is null, 'unknown token gets nothing');

-- The front desk and members can't manage screens or read feeds.
select pg_temp.act_as('fs@test.lb');
select pg_temp.ok((select count(*) from public.screens) = 0, 'front desk sees no screens');
select pg_temp.fails(format('select public.screen_feed(%L)', :'lobby_token')) as fd_feed \gset
select pg_temp.fails(format('select public.screen_preview(%L)', :'lobby')) as fd_preview \gset
reset role;
select pg_temp.act_as('ms@test.lb');
select pg_temp.ok((select count(*) from public.screen_slides) = 0, 'member sees no slides');
reset role;

\echo screens tests passed
