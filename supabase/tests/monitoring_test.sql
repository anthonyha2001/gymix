-- Super admin monitoring and control: events are admin-only, pricing is
-- editable and public, suspension locks a gym, grace follows the settings.
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
  ('om@test.lb', '{"full_name":"Owner M"}'),
  ('am@test.lb', '{"full_name":"Admin M"}');
insert into public.platform_admins (user_id) select id from auth.users where email = 'am@test.lb';

select pg_temp.act_as('om@test.lb');
select public.create_gym('Gym M');
reset role;
select set_config('t.gym1', (select id::text from public.gyms where name = 'Gym M'), false);
select pg_temp.act_as('om@test.lb');
reset role;

-- Events as the web app writes them (service role).
insert into public.platform_events (kind, request_type, method, path, visitor_id, device, browser, country, referrer)
select 'request', 'page', 'GET', '/', 'v' || (g % 3), 'mobile', 'Chrome', 'LB', 'google.com' from generate_series(1, 9) g;
insert into public.platform_events (kind, request_type, method, path, visitor_id, device)
values ('request', 'action', 'POST', '/dashboard', 'v1', 'desktop'),
       ('request', 'page', 'GET', '/', null, 'bot');
insert into public.platform_events (kind, user_id, message, ip)
select 'login', id, 'password', '1.2.3.4' from auth.users where email = 'om@test.lb';
insert into public.platform_events (kind, message, ip, detail)
values ('login_failed', 'x@y.z', '5.6.7.8', '{"reason":"wrong password"}'),
       ('error', 'Boom', null, '{"source":"server"}'),
       ('error', 'Boom', null, '{"source":"server"}');
insert into public.platform_events (kind, request_type, method, path, visitor_id, device)
values ('request', 'page', 'GET', '/', 'old', 'desktop');
update public.platform_events set created_at = now() - interval '200 days' where visitor_id = 'old';

-- Only super admins can read or summarise events; nobody can write them through the API.
select pg_temp.act_as('om@test.lb');
select pg_temp.ok((select count(*) = 0 from public.platform_events), 'owner sees no events');
select pg_temp.ok(pg_temp.fails('select public.admin_monitoring(30)') like '%Not allowed%', 'owner cannot summarise');
select pg_temp.ok(pg_temp.fails($$insert into public.platform_events (kind) values ('error')$$) like '%permission%', 'no inserts via API');
reset role;

select pg_temp.act_as('am@test.lb');
select pg_temp.ok((select (m -> 'totals' ->> 'views')::int = 9 from public.admin_monitoring(30) m), '9 human page views (bot and old excluded)');
select pg_temp.ok((select (m -> 'totals' ->> 'visitors')::int = 3 from public.admin_monitoring(30) m), '3 distinct visitors');
select pg_temp.ok((select (m -> 'totals' ->> 'logins')::int = 1 from public.admin_monitoring(30) m), '1 login');
select pg_temp.ok((select (m -> 'totals' ->> 'failed_logins')::int = 1 from public.admin_monitoring(30) m), '1 failed login');
select pg_temp.ok((select (m -> 'totals' ->> 'bot_requests')::int = 1 from public.admin_monitoring(30) m), '1 bot request');
select pg_temp.ok((select jsonb_array_length(m -> 'series') = 7 from public.admin_monitoring(7) m), 'one point per day');
select pg_temp.ok((select (m -> 'error_groups' -> 0 ->> 'occurrences')::int = 2 from public.admin_monitoring(30) m), 'errors grouped');
select pg_temp.ok((select m -> 'referrers' -> 0 ->> 'referrer' = 'google.com' from public.admin_monitoring(30) m), 'referrer counted');
select pg_temp.ok((select count(*) = 1 and bool_and(user_email = 'om@test.lb') from public.admin_recent_events(array['login'])), 'recent logins with user');
select pg_temp.ok((select public.admin_prune_events(90) = 1), 'prune removes the old event');
reset role;

-- Pricing: public to read, admin-only to change; new gyms use the trial length.
set role anon;
select pg_temp.ok((select price_usd = 10 and trial_days = 14 and grace_days = 3 from public.platform_pricing()), 'defaults readable by visitors');
reset role;
select pg_temp.act_as('om@test.lb');
select pg_temp.ok(pg_temp.fails('select public.admin_save_pricing(1, 1, 1)') like '%Not allowed%', 'owner cannot change pricing');
reset role;
select pg_temp.act_as('am@test.lb');
select public.admin_save_pricing(15.5, 30, 5);
reset role;
select pg_temp.ok((select price_usd = 15.5 and trial_days = 30 and grace_days = 5 from public.platform_pricing()), 'pricing saved');
select pg_temp.act_as('om@test.lb');
select public.create_gym('Gym M2');
reset role;
select set_config('t.gym2', (select id::text from public.gyms where name = 'Gym M2'), false);
select pg_temp.act_as('om@test.lb');
select pg_temp.ok((select status = 'trial' and days_left = 30 from public.gym_subscription(current_setting('t.gym2')::uuid)), 'new gym gets 30-day trial');
reset role;

-- Grace follows the setting: 4 days after the end is still grace with 5 grace days.
update public.gyms set trial_ends_at = public.gym_today(id) - 4 where name = 'Gym M';
select pg_temp.act_as('om@test.lb');
select pg_temp.ok((select status = 'grace' from public.gym_subscription(current_setting('t.gym1')::uuid)), 'grace uses setting');
reset role;

-- Suspension: admin only, locks the gym, and can be undone.
select pg_temp.act_as('om@test.lb');
select pg_temp.ok(pg_temp.fails($$select public.admin_set_gym_suspended(current_setting('t.gym2')::uuid, true)$$) like '%Not allowed%', 'owner cannot suspend');
reset role;
select pg_temp.act_as('am@test.lb');
select public.admin_set_gym_suspended(current_setting('t.gym2')::uuid, true, 'Unpaid');
select pg_temp.ok((select suspended_reason = 'Unpaid' from public.admin_gym_overview() where name = 'Gym M2'), 'overview shows suspension');
reset role;
select pg_temp.act_as('om@test.lb');
select pg_temp.ok((select status = 'suspended' from public.gym_subscription(current_setting('t.gym2')::uuid)), 'suspended status');
reset role;
select pg_temp.act_as('am@test.lb');
select public.admin_set_gym_suspended(current_setting('t.gym2')::uuid, false);
reset role;
select pg_temp.act_as('om@test.lb');
select pg_temp.ok((select status = 'trial' from public.gym_subscription(current_setting('t.gym2')::uuid)), 'reopened');
reset role;
