-- Home-screen widget: tokens, the summary, and who can read it.
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
  ('wi-owner@test.lb', '{"full_name":"Owner Wi"}'),
  ('wi-nour@test.lb', '{"full_name":"Nour Wi"}');
select pg_temp.act_as('wi-owner@test.lb');
select set_config('t.gym', public.create_gym('Widget Gym')::text, false);
reset role;
insert into public.members (gym_id, full_name, phone, user_id) values
  (pg_temp.v('gym'), 'Nour Wi', '70600001', (select id from auth.users where email = 'wi-nour@test.lb'));
insert into public.gym_users (gym_id, user_id, role) select pg_temp.v('gym'), id, 'member' from auth.users where email = 'wi-nour@test.lb';
select set_config('t.nour', (select id::text from public.members where full_name = 'Nour Wi'), false);
insert into public.memberships (gym_id, member_id, plan_name, starts_on, ends_on)
values (pg_temp.v('gym'), pg_temp.v('nour'), 'Monthly', public.gym_today(pg_temp.v('gym')) - 10, public.gym_today(pg_temp.v('gym')) + 12);
insert into public.checkins (gym_id, member_id, source, allowed) values (pg_temp.v('gym'), pg_temp.v('nour'), 'desk', true);
insert into public.member_training_days (member_id, weekday) values (pg_temp.v('nour'), extract(dow from public.gym_today(pg_temp.v('gym'))));

-- Nour gets a token; asking again gives the same one; a new one replaces it.
select pg_temp.act_as('wi-nour@test.lb');
select set_config('t.tok', public.my_widget_token(), false);
select pg_temp.ok(public.my_widget_token() = current_setting('t.tok'), 'same token');
select pg_temp.ok(current_setting('t.tok') like 'gw_%' and length(current_setting('t.tok')) = 67, 'token shape');
-- Members can't read the summary directly, or anyone's tokens.
select pg_temp.ok(pg_temp.fails(format('select public.widget_data(%L)', current_setting('t.tok'))) like '%permission denied%', 'widget_data is server-only');
select pg_temp.ok((select count(*) = 0 from public.widget_tokens), 'tokens hidden');
reset role;

-- The server reads the summary.
select set_config('t.w', public.widget_data(current_setting('t.tok'))::text, false);
select pg_temp.ok((current_setting('t.w')::jsonb ->> 'gym') = 'Widget Gym', 'gym name');
select pg_temp.ok((current_setting('t.w')::jsonb ->> 'days_left')::int = 12, 'days left');
select pg_temp.ok((current_setting('t.w')::jsonb ->> 'visits_month')::int = 1, 'visits this month');
select pg_temp.ok((current_setting('t.w')::jsonb ->> 'today') = 'Training day', 'training today');
select pg_temp.ok(public.widget_data('gw_wrong') is null, 'wrong token: nothing');

-- A new token cuts the old one off.
select pg_temp.act_as('wi-nour@test.lb'); select public.my_widget_token(true); reset role;
select pg_temp.ok(public.widget_data(current_setting('t.tok')) is null, 'old token dead');

select 'widget: all passed' as result;
