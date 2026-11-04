-- Phase 4 tests: classes & waitlist, PT sessions, chat privacy, body measurements.
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
  ('o4@test.lb', '{"full_name":"Owner Four"}'),
  ('t4@test.lb', '{"full_name":"Trainer Four"}'),
  ('a4@test.lb', '{"full_name":"Alice Member"}'),
  ('b4@test.lb', '{"full_name":"Bob Member"}'),
  ('c4@test.lb', '{"full_name":"Carl Member"}');

select pg_temp.act_as('o4@test.lb');
select public.create_gym('Gym Four') as gym \gset
insert into public.invites (gym_id, email, role, invited_by) values
  (:'gym', 't4@test.lb', 'trainer', auth.uid()), (:'gym', 'a4@test.lb', 'member', auth.uid()),
  (:'gym', 'b4@test.lb', 'member', auth.uid()), (:'gym', 'c4@test.lb', 'member', auth.uid());
insert into public.membership_plans (gym_id, name, price_usd) values (:'gym', 'Monthly', 40);
reset role;
select pg_temp.act_as('t4@test.lb'); select public.claim_my_invites(); reset role;
select pg_temp.act_as('a4@test.lb'); select public.claim_my_invites(); reset role;
select pg_temp.act_as('b4@test.lb'); select public.claim_my_invites(); reset role;
select pg_temp.act_as('c4@test.lb'); select public.claim_my_invites(); reset role;
select id as a4 from public.members where email = 'a4@test.lb' \gset
select id as b4 from public.members where email = 'b4@test.lb' \gset
select id as c4 from public.members where email = 'c4@test.lb' \gset
select id as t4 from public.profiles where email = 't4@test.lb' \gset
select id as plan from public.membership_plans where gym_id = :'gym' \gset

-- Alice and Bob have memberships; Carl doesn't.
select pg_temp.act_as('o4@test.lb');
select public.sell_membership(:'a4', :'plan', public.gym_today(:'gym'));
select public.sell_membership(:'b4', :'plan', public.gym_today(:'gym'));
-- A 1-spot class tomorrow.
insert into public.classes (gym_id, name, trainer_id, weekday, start_time, capacity)
values (:'gym', 'Spinning', :'t4', extract(dow from public.gym_today(:'gym') + 1)::smallint, '19:00', 1);
reset role;
select id as cls from public.classes where name = 'Spinning' \gset
select (public.gym_today(:'gym') + 1) as d \gset

select pg_temp.act_as('t4@test.lb');
select pg_temp.fails(format($q$insert into public.classes (gym_id, name, weekday, start_time) values (%L, 'X', 1, '10:00')$q$, :'gym')) as t_class \gset
\echo trainer cannot edit timetable: :t_class
reset role;

select pg_temp.act_as('a4@test.lb');
select pg_temp.ok(public.book_class(:'cls', :'d') = 'booked', 'alice booked');
select pg_temp.fails(format('select public.book_class(%L, %L)', :'cls', :'d')) as dup \gset
\echo double booking rejected: :dup
select pg_temp.fails(format('select public.book_class(%L, %L)', :'cls', (:'d'::date + 1))) as wrong_day \gset
\echo wrong weekday rejected: :wrong_day
reset role;
select pg_temp.act_as('b4@test.lb');
select pg_temp.ok(public.book_class(:'cls', :'d') = 'waitlist', 'bob waitlisted (class full)');
select pg_temp.ok((select count(*) from public.class_bookings) = 1, 'bob sees only his booking');
reset role;
select pg_temp.act_as('c4@test.lb');
select pg_temp.fails(format('select public.book_class(%L, %L)', :'cls', :'d')) as no_membership \gset
\echo no membership rejected: :no_membership
reset role;

-- Alice cancels -> Bob moves up.
select pg_temp.act_as('a4@test.lb');
select public.cancel_booking((select id from public.class_bookings where member_id = :'a4'));
reset role;
select pg_temp.ok((select status from public.class_bookings where member_id = :'b4') = 'booked', 'waitlist promoted');
select pg_temp.act_as('a4@test.lb');
select pg_temp.ok(public.book_class(:'cls', :'d') = 'waitlist', 'rebooking after cancel goes to waitlist');
reset role;

-- Trainer marks attendance; members can't.
select pg_temp.act_as('b4@test.lb');
select pg_temp.fails(format('select public.mark_attendance(%L, true)', (select id from public.class_bookings where member_id = :'b4'))) as self_attend \gset
\echo member cannot mark attendance: :self_attend
reset role;
select pg_temp.act_as('t4@test.lb');
select public.mark_attendance((select id from public.class_bookings where member_id = :'b4'), true);
select pg_temp.ok((select status from public.class_bookings where member_id = :'b4') = 'attended', 'attended');
reset role;

-- PT sessions: request -> confirm; overlapping confirm is blocked.
select pg_temp.act_as('a4@test.lb');
select public.request_pt_session(:'gym', :'t4', now() + interval '2 days', 60, 'Form check') as s1 \gset
select pg_temp.fails(format('select public.update_pt_session(%L, ''confirm'')', :'s1')) as m_confirm \gset
\echo member cannot confirm: :m_confirm
reset role;
select pg_temp.act_as('b4@test.lb');
select public.request_pt_session(:'gym', :'t4', now() + interval '2 days 30 minutes', 60) as s2 \gset
reset role;
select pg_temp.act_as('t4@test.lb');
select public.update_pt_session(:'s1', 'confirm');
select pg_temp.fails(format('select public.update_pt_session(%L, ''confirm'')', :'s2')) as overlap \gset
\echo overlapping session rejected: :overlap
select public.update_pt_session(:'s2', 'decline');
reset role;
select pg_temp.act_as('b4@test.lb');
select pg_temp.ok((select status from public.pt_sessions) = 'declined', 'bob sees his declined request only');
reset role;

-- Chat: private to the two participants.
select pg_temp.act_as('a4@test.lb');
select public.open_conversation(:'gym', :'t4') as conv \gset
insert into public.messages (conversation_id, sender_id, body) values (:'conv', auth.uid(), 'Hi coach, is my form ok?');
select pg_temp.ok(public.open_conversation(:'gym', :'t4') = :'conv', 'same conversation reused');
reset role;
select pg_temp.act_as('t4@test.lb');
select pg_temp.ok((select count(*) from public.messages where read_at is null) = 1, 'trainer sees unread');
insert into public.messages (conversation_id, sender_id, body) values (:'conv', auth.uid(), 'Looks great!');
select public.mark_conversation_read(:'conv');
select pg_temp.ok((select count(*) from public.messages where read_at is null and sender_id <> auth.uid()) = 0, 'marked read');
reset role;
select pg_temp.act_as('o4@test.lb');
select pg_temp.ok((select count(*) from public.messages) = 0, 'owner cannot read others'' chats');
reset role;
select pg_temp.act_as('b4@test.lb');
select pg_temp.ok((select count(*) from public.conversations) = 0, 'other member sees no conversations');
select pg_temp.fails(format($q$insert into public.messages (conversation_id, sender_id, body) values (%L, auth.uid(), 'sneaky')$q$, :'conv')) as intrude \gset
\echo outsider cannot post: :intrude
select pg_temp.fails(format('select public.open_conversation(%L, %L)', :'gym', (select id from public.profiles where email = 'c4@test.lb'))) as member_to_member \gset
\echo member cannot message another member: :member_to_member
reset role;

-- Measurements: member records own; trainer records for member; others can't see.
select pg_temp.act_as('a4@test.lb');
insert into public.body_measurements (gym_id, member_id, measured_on, weight_kg, body_fat_pct, recorded_by)
values (:'gym', :'a4', current_date, 72.5, 24.0, auth.uid());
select pg_temp.fails(format($q$insert into public.body_measurements (gym_id, member_id, measured_on, weight_kg, recorded_by) values (%L, %L, current_date, 80, auth.uid())$q$, :'gym', :'b4')) as other_measure \gset
\echo cannot record for another member: :other_measure
select pg_temp.fails(format($q$insert into public.body_measurements (gym_id, member_id, measured_on, recorded_by) values (%L, %L, current_date, auth.uid())$q$, :'gym', :'a4')) as empty_measure \gset
\echo empty measurement rejected: :empty_measure
reset role;
select pg_temp.act_as('t4@test.lb');
insert into public.body_measurements (gym_id, member_id, measured_on, weight_kg, muscle_mass_kg, recorded_by)
values (:'gym', :'a4', current_date - 30, 75.0, 30.1, auth.uid());
select pg_temp.ok((select count(*) from public.body_measurements) = 2, 'trainer sees member measurements');
reset role;
select pg_temp.act_as('b4@test.lb');
select pg_temp.ok((select count(*) from public.body_measurements) = 0, 'other member sees none');
reset role;

-- Members see how full a class is, without seeing who booked.
select pg_temp.act_as('c4@test.lb');
select pg_temp.ok((select taken from public.class_spots(:'gym', :'d', :'d')) = 1, 'members see spot counts');
select pg_temp.ok((select waiting from public.class_spots(:'gym', :'d', :'d')) = 1, 'members see waitlist size');
reset role;

\echo 'ALL SCHEDULE TESTS PASSED'
