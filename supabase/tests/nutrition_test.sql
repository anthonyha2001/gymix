-- Nutrition tests: dietitian role, requests, draft plans, sending, visibility, portal pages.
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
  ('o9@test.lb', '{"full_name":"Owner Nine"}'),
  ('d9@test.lb', '{"full_name":"Dietitian Nine"}'),
  ('t9@test.lb', '{"full_name":"Trainer Nine"}'),
  ('m9@test.lb', '{"full_name":"Member Nine"}'),
  ('x9@test.lb', '{"full_name":"Other Member"}');

select pg_temp.act_as('o9@test.lb');
select public.create_gym('Gym Nine') as gym \gset
insert into public.invites (gym_id, email, role, invited_by) values
  (:'gym', 'd9@test.lb', 'dietitian', auth.uid()),
  (:'gym', 't9@test.lb', 'trainer', auth.uid()),
  (:'gym', 'm9@test.lb', 'member', auth.uid()),
  (:'gym', 'x9@test.lb', 'member', auth.uid());
reset role;
select pg_temp.act_as('d9@test.lb'); select public.claim_my_invites(); reset role;
select pg_temp.act_as('t9@test.lb'); select public.claim_my_invites(); reset role;
select pg_temp.act_as('m9@test.lb'); select public.claim_my_invites(); reset role;
select pg_temp.act_as('x9@test.lb'); select public.claim_my_invites(); reset role;
select id as m9 from public.members where email = 'm9@test.lb' \gset
select id as x9 from public.members where email = 'x9@test.lb' \gset

-- Roles: owner may add dietitians, front desk may not.
select pg_temp.act_as('o9@test.lb');
select pg_temp.ok(public.can_assign_role(:'gym', 'dietitian'), 'owner can assign dietitian');
reset role;
select pg_temp.act_as('d9@test.lb');
select pg_temp.ok(public.can_diet(:'gym'), 'dietitian can build nutrition plans');
select pg_temp.ok(not public.can_assign_role(:'gym', 'member'), 'dietitian cannot invite');
reset role;
select pg_temp.act_as('t9@test.lb');
select pg_temp.ok(not public.can_diet(:'gym'), 'trainer cannot build nutrition plans');
select pg_temp.fails(format('select public.start_nutrition_plan(%L)', :'m9')) as t_start \gset
\echo trainer cannot start a nutrition plan: :t_start
reset role;

-- Member requests a plan; only one open request at a time.
select pg_temp.act_as('m9@test.lb');
select public.request_nutrition_plan(:'gym', 'lose_fat', 92, 178, 'moderate', 'Peanuts', 'No pork', null) as req \gset
select pg_temp.fails(format($q$select public.request_nutrition_plan(%L, 'maintain')$q$, :'gym')) as dup \gset
\echo second open request rejected: :dup
select pg_temp.ok((select count(*) from public.gym_staff_names(:'gym') where role = 'dietitian') = 1, 'member sees the dietitian name');
reset role;
select pg_temp.act_as('x9@test.lb');
select pg_temp.ok((select count(*) from public.nutrition_requests) = 0, 'other member cannot see the request');
reset role;

-- Dietitian answers the request: a draft with four meals.
select pg_temp.act_as('d9@test.lb');
select pg_temp.ok((select count(*) from public.nutrition_requests where status = 'open') = 1, 'dietitian sees open request');
select public.start_nutrition_plan(:'m9', :'req') as plan \gset
select pg_temp.ok((select public.start_nutrition_plan(:'m9', :'req')) = :'plan', 'starting again reopens the same draft');
select pg_temp.ok((select count(*) from public.nutrition_meals where plan_id = :'plan') = 4, 'draft has four meals');
select pg_temp.ok((select name from public.nutrition_plans where id = :'plan') = 'Fat loss plan', 'name follows the goal');
select pg_temp.ok((select status from public.nutrition_requests where id = :'req') = 'in_progress', 'request in progress');
reset role;

-- The member can't see a draft.
select pg_temp.act_as('m9@test.lb');
select pg_temp.ok((select count(*) from public.nutrition_plans) = 0, 'member cannot see the draft');
select pg_temp.ok((select count(*) from public.nutrition_meals) = 0, 'member cannot see draft meals');
reset role;

-- Sending requires a filled meal.
select pg_temp.act_as('d9@test.lb');
select pg_temp.fails(format('select public.send_nutrition_plan(%L)', :'plan')) as empty_send \gset
\echo empty plan cannot be sent: :empty_send
update public.nutrition_plans set calories = 2000, protein_g = 160, carbs_g = 180, fat_g = 65, water_l = 3 where id = :'plan';
update public.nutrition_meals set items = E'3 eggs\n1 slice brown bread' where plan_id = :'plan' and name = 'Breakfast';
select public.send_nutrition_plan(:'plan');
select pg_temp.ok((select status from public.nutrition_plans where id = :'plan') = 'active', 'plan active');
select pg_temp.ok((select status from public.nutrition_requests where id = :'req') = 'done', 'request done');
reset role;

-- Now the member sees it, read-only; the other member doesn't.
select pg_temp.act_as('m9@test.lb');
select pg_temp.ok((select calories from public.nutrition_plans where id = :'plan') = 2000, 'member sees the active plan');
select pg_temp.ok((select count(*) from public.nutrition_meals where plan_id = :'plan') = 4, 'member sees the meals');
update public.nutrition_plans set calories = 4000 where id = :'plan';
select pg_temp.ok((select calories from public.nutrition_plans where id = :'plan') = 2000, 'member cannot change the plan');
select pg_temp.fails(format($q$insert into public.nutrition_meals (plan_id, name) values (%L, 'Cake')$q$, :'plan')) as m_meal \gset
\echo member cannot add meals: :m_meal
reset role;
select pg_temp.act_as('x9@test.lb');
select pg_temp.ok((select count(*) from public.nutrition_plans) = 0, 'other member cannot see the plan');
reset role;

-- A second plan replaces the first.
select pg_temp.act_as('d9@test.lb');
select public.start_nutrition_plan(:'m9') as plan2 \gset
update public.nutrition_meals set items = 'Oats' where plan_id = :'plan2' and name = 'Breakfast';
select public.send_nutrition_plan(:'plan2');
select pg_temp.ok((select status from public.nutrition_plans where id = :'plan') = 'archived', 'previous plan archived');
select pg_temp.ok((select count(*) from public.nutrition_plans where member_id = :'m9' and status = 'active') = 1, 'one active plan');
reset role;

-- Portal pages: owner hides some; the value is checked; members can't change it.
select pg_temp.act_as('o9@test.lb');
update public.gyms set portal_hidden = array['messages', 'nutrition'] where id = :'gym';
select pg_temp.fails(format($q$update public.gyms set portal_hidden = array['billing'] where id = %L$q$, :'gym')) as bad_page \gset
\echo unknown portal page rejected: :bad_page
reset role;
select pg_temp.act_as('m9@test.lb');
select pg_temp.ok((select portal_hidden from public.gyms where id = :'gym') = array['messages', 'nutrition'], 'member reads hidden pages');
update public.gyms set portal_hidden = '{}' where id = :'gym';
reset role;
select pg_temp.ok((select portal_hidden from public.gyms where id = :'gym') = array['messages', 'nutrition'], 'member cannot change portal pages');

\echo 'ALL NUTRITION TESTS PASSED'
