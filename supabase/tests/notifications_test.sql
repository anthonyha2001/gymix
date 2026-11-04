-- Notifications, reminders, staff counters and monthly courses.
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
  ('o7@test.lb', '{"full_name":"Owner Seven"}'),
  ('t7@test.lb', '{"full_name":"Trainer Seven"}'),
  ('d7@test.lb', '{"full_name":"Dietitian Seven"}'),
  ('m7@test.lb', '{"full_name":"Mia Seven"}'),
  ('x7@test.lb', '{"full_name":"Xavi Seven"}');

select pg_temp.act_as('o7@test.lb');
select public.create_gym('Gym Seven') as gym \gset
insert into public.invites (gym_id, email, role, invited_by) values
  (:'gym', 't7@test.lb', 'trainer', auth.uid()),
  (:'gym', 'd7@test.lb', 'dietitian', auth.uid()),
  (:'gym', 'm7@test.lb', 'member', auth.uid()),
  (:'gym', 'x7@test.lb', 'member', auth.uid());
insert into public.membership_plans (gym_id, name, price_usd) values (:'gym', 'Monthly', 40);
reset role;
select pg_temp.act_as('t7@test.lb'); select public.claim_my_invites(); reset role;
select pg_temp.act_as('d7@test.lb'); select public.claim_my_invites(); reset role;
select pg_temp.act_as('m7@test.lb'); select public.claim_my_invites(); reset role;
select pg_temp.act_as('x7@test.lb'); select public.claim_my_invites(); reset role;
select id as m7 from public.members where email = 'm7@test.lb' \gset
select id as x7 from public.members where email = 'x7@test.lb' \gset
select id as t7 from public.profiles where email = 't7@test.lb' \gset
select id as plan from public.membership_plans where gym_id = :'gym' \gset

-- Messages notify the other side, one unread notice per conversation.
select pg_temp.act_as('m7@test.lb');
select public.open_conversation(:'gym', p_staff_id => :'t7') as conv \gset
insert into public.messages (conversation_id, sender_id, body) values (:'conv', auth.uid(), 'Hi coach');
insert into public.messages (conversation_id, sender_id, body) values (:'conv', auth.uid(), 'Are you there?');
reset role;
select pg_temp.act_as('t7@test.lb');
select pg_temp.ok((select count(*) from public.notifications where kind = 'message' and read_at is null) = 1, 'one unread message notice');
select pg_temp.ok((select body from public.notifications where kind = 'message') = 'Are you there?', 'latest message shown');
select pg_temp.ok((select title from public.notifications where kind = 'message') = 'New message from Mia Seven', 'from the member');
select public.mark_notifications_read();
select pg_temp.ok((select count(*) from public.notifications where read_at is null) = 0, 'marked read');
reset role;

-- Nobody else sees them, and nobody can write them directly.
select pg_temp.act_as('x7@test.lb');
select pg_temp.ok((select count(*) from public.notifications) = 0, 'other member sees none');
select pg_temp.fails(format($q$insert into public.notifications (gym_id, user_id, kind, title) values (%L, auth.uid(), 'x', 'fake')$q$, :'gym')) as fake \gset
select pg_temp.fails(format($q$select public.notify(%L, auth.uid(), 'x', 't', null, null)$q$, :'gym')) as fake_fn \gset
\echo members cannot write notifications: :fake_fn
reset role;

-- Requests notify the right staff, and show in their counters.
select pg_temp.act_as('m7@test.lb');
select public.request_program(:'gym', 'build_muscle', 3, 'beginner');
select public.request_nutrition_plan(:'gym', 'lose_fat');
reset role;
select pg_temp.act_as('t7@test.lb');
select pg_temp.ok((select count(*) from public.notifications where kind = 'program_request') = 1, 'trainer told about program request');
select pg_temp.ok((select count(*) from public.notifications where kind = 'nutrition_request') = 0, 'trainer not told about nutrition');
select pg_temp.ok((select program_requests from public.staff_counts(:'gym')) = 1, 'trainer counter: 1 program request');
select pg_temp.ok((select nutrition_requests from public.staff_counts(:'gym')) = 0, 'trainer has no nutrition counter');
reset role;
select pg_temp.act_as('d7@test.lb');
select pg_temp.ok((select count(*) from public.notifications where kind = 'nutrition_request') = 1, 'dietitian told about nutrition request');
select pg_temp.ok((select nutrition_requests from public.staff_counts(:'gym')) = 1, 'dietitian counter');
reset role;
select pg_temp.act_as('m7@test.lb');
select pg_temp.ok((select count(*) from public.staff_counts(:'gym')) = 0, 'members get no staff counters');
reset role;

-- Dietitian sends the plan -> member notified.
select pg_temp.act_as('d7@test.lb');
select public.start_nutrition_plan(:'m7', (select id from public.nutrition_requests where member_id = :'m7')) as nplan \gset
update public.nutrition_meals set items = 'Oats' where plan_id = :'nplan' and name = 'Breakfast';
select public.send_nutrition_plan(:'nplan');
reset role;
select pg_temp.act_as('m7@test.lb');
select pg_temp.ok((select count(*) from public.notifications where kind = 'nutrition' and title = 'Your nutrition plan is ready') = 1, 'member told plan is ready');
reset role;

-- Monthly course.
select pg_temp.act_as('o7@test.lb');
select public.sell_membership(:'m7', :'plan', public.gym_today(:'gym'));
insert into public.classes (gym_id, name, weekday, start_time, capacity, monthly_price_usd)
values (:'gym', 'Pilates', extract(dow from public.gym_today(:'gym') + 1)::smallint, '18:00', 1, 50);
select id as pil from public.classes where name = 'Pilates' \gset
reset role;

select pg_temp.act_as('m7@test.lb');
select pg_temp.fails(format('select public.book_class(%L, %L)', :'pil', public.gym_today(:'gym') + 1)) as single \gset
\echo single course session refused: :single
select public.subscribe_to_course(:'pil', p_starts_on => public.gym_today(:'gym') + 1) as sub \gset
select pg_temp.ok((select count(*) from public.class_bookings where class_id = :'pil' and status = 'booked') >= 4, 'booked into every session of the month');
select pg_temp.ok((select amount_usd from public.invoices i join public.class_subscriptions s on s.invoice_id = i.id where s.id = :'sub') = 50, 'invoice for the month');
select pg_temp.ok((select count(*) from public.notifications where kind = 'course') = 1, 'told about the subscription');
select pg_temp.fails(format('select public.subscribe_to_course(%L, p_starts_on => %L)', :'pil', public.gym_today(:'gym') + 1)) as twice \gset
\echo no double subscription: :twice

-- Reminders the day before: class tomorrow + course payment due tomorrow.
select public.make_my_reminders(:'gym');
select public.make_my_reminders(:'gym');
select pg_temp.ok((select count(*) from public.notifications where kind = 'reminder' and title like 'Pilates tomorrow at%') = 1, 'class reminder, once');
select pg_temp.ok((select count(*) from public.notifications where kind = 'reminder' and title = 'Pilates tomorrow: payment due') = 1, 'payment reminder');
reset role;

-- The course is full (capacity 1) for another member.
select pg_temp.act_as('o7@test.lb');
select public.sell_membership(:'x7', :'plan', public.gym_today(:'gym'));
select pg_temp.fails(format('select public.subscribe_to_course(%L, %L, %L)', :'pil', :'x7', public.gym_today(:'gym') + 1)) as full_course \gset
\echo full course refused: :full_course
-- Staff cancel: future sessions released.
select public.cancel_course_subscription(:'sub');
select pg_temp.ok((select count(*) from public.class_bookings where class_id = :'pil' and status = 'booked') = 0, 'sessions released');
reset role;

\echo 'ALL NOTIFICATION TESTS PASSED'
