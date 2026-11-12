-- Control room: analytics, support tickets, social, health; who may see what.
\set ON_ERROR_STOP on
create or replace function pg_temp.ok(p_cond boolean, p_msg text) returns void language plpgsql as $$
begin
  if p_cond is not true then raise exception 'assertion failed: %', p_msg; end if;
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
create or replace function pg_temp.act_as(p_email text) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claim.sub', (select id::text from auth.users where email = p_email), false);
  execute 'set role authenticated';
end;
$$;

insert into auth.users (email, raw_user_meta_data) values
  ('cr-boss@test.lb', '{"full_name":"Boss"}'), ('cr-own@test.lb', '{"full_name":"Owner Cr"}'), ('cr-x@test.lb', '{"full_name":"Other"}');
insert into public.platform_admins (user_id) select id from auth.users where email = 'cr-boss@test.lb';
select pg_temp.act_as('cr-own@test.lb');
select set_config('t.gym', public.create_gym('Room Gym')::text, false);
reset role;

-- Analytics rows (written by the server).
insert into public.site_sessions (id, visitor_id, landing_path, exit_path, referrer_host, country, city, lat, lng, device, platform, pageviews, active_ms, last_seen_at)
values ('00000000-0000-0000-0000-0000000000a1', 'v1', '/', '/pricing', 'instagram.com', 'LB', 'Beirut', 33.89, 35.5, 'mobile', 'web', 2, 45000, now()),
       ('00000000-0000-0000-0000-0000000000a2', 'v2', '/', '/', null, 'AE', 'Dubai', 25.2, 55.27, 'desktop', 'web', 1, 3000, now() - interval '10 minutes');
insert into public.site_pageviews (id, session_id, path, active_ms, max_scroll, clicks) values
  ('00000000-0000-0000-0000-0000000000b1', '00000000-0000-0000-0000-0000000000a1', '/', 30000, 80, 2),
  ('00000000-0000-0000-0000-0000000000b2', '00000000-0000-0000-0000-0000000000a1', '/pricing', 15000, 60, 1),
  ('00000000-0000-0000-0000-0000000000b3', '00000000-0000-0000-0000-0000000000a2', '/', 3000, 10, 0);
insert into public.site_events (session_id, pageview_id, kind, label, path) values
  ('00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-0000000000b1', 'cta', 'Start free trial', '/');

-- Only platform admins read it.
select pg_temp.act_as('cr-own@test.lb');
select pg_temp.ok(pg_temp.fails('select public.admin_live()') like '%Not allowed%', 'owner cannot see live');
select pg_temp.ok(pg_temp.fails('select * from public.site_sessions') like '%permission denied%', 'no direct reads');
reset role;
select pg_temp.act_as('cr-boss@test.lb');
select pg_temp.ok(jsonb_array_length(public.admin_live() -> 'now') = 1, 'one on the site now');
select pg_temp.ok((public.admin_visitors(30) -> 'totals' ->> 'sessions')::int = 2, 'two sessions');
select pg_temp.ok((public.admin_visitors(30) -> 'totals' ->> 'bounce_rate')::numeric = 50, 'half bounced');
select pg_temp.ok((public.admin_visitors(30) -> 'funnel' ->> 'pricing')::int = 1, 'one reached pricing');
select pg_temp.ok(jsonb_array_length(public.admin_session('00000000-0000-0000-0000-0000000000a1') -> 'pages') = 2, 'journey has two pages');
select pg_temp.ok(jsonb_array_length(public.admin_sessions(10, 'LB', null)) = 1, 'filter by country');
reset role;

-- Support: owner opens, sees only theirs; Gymix replies; internal notes stay hidden.
select pg_temp.act_as('cr-own@test.lb');
select set_config('t.tk', public.open_support_ticket('Door not opening', 'The ZKTeco reader shows offline', 'hardware', current_setting('t.gym')::uuid)::text, false);
reset role;
select pg_temp.act_as('cr-x@test.lb');
select pg_temp.ok((select count(*) = 0 from public.support_tickets), 'others see nothing');
select pg_temp.ok(pg_temp.fails(format($q$select public.reply_support_ticket(%L, 'hi')$q$, current_setting('t.tk'))) like '%Not allowed%', 'others cannot reply');
reset role;
select pg_temp.act_as('cr-boss@test.lb');
select public.reply_support_ticket(current_setting('t.tk')::uuid, 'Customer is on the trial, check bridge', true);
select public.reply_support_ticket(current_setting('t.tk')::uuid, 'Restart the Bridge, then tap again.');
select public.admin_update_ticket(current_setting('t.tk')::uuid, 'pending', 'high');
reset role;
select pg_temp.ok((select status = 'pending' and priority = 'high' and user_unread and first_reply_at is not null from public.support_tickets where id = current_setting('t.tk')::uuid), 'ticket updated');
select pg_temp.ok(exists (select 1 from public.notifications where kind = 'support'), 'owner notified');
select pg_temp.act_as('cr-own@test.lb');
select pg_temp.ok((select count(*) = 2 from public.support_messages), 'owner sees 2 (not the note)');
select public.reply_support_ticket(current_setting('t.tk')::uuid, 'Works now, thanks');
reset role;
select pg_temp.ok((select status = 'open' and admin_unread from public.support_tickets where id = current_setting('t.tk')::uuid), 'reply reopens for Gymix');

-- Social: admins only; tokens never readable.
select pg_temp.act_as('cr-own@test.lb');
select pg_temp.ok(pg_temp.fails($q$insert into public.social_accounts (platform, handle) values ('instagram', 'gymix')$q$) like '%row-level security%', 'owner cannot add accounts');
reset role;
select pg_temp.act_as('cr-boss@test.lb');
insert into public.social_accounts (platform, handle, followers) values ('instagram', 'gymix.lb', 1200);
select pg_temp.ok(pg_temp.fails('select * from public.social_tokens') like '%permission denied%', 'tokens hidden even from admins in the browser');

-- Health and app stats.
select pg_temp.ok((select count(*) >= 1 from public.admin_gym_health() where name = 'Room Gym' and open_tickets = 1), 'health counts the open ticket');
select pg_temp.ok(public.admin_app_stats() ? 'push', 'app stats');
reset role;
select 'control room: all passed' as result;

-- The tracker: a view opens a session and a page; pings fill in time and scroll.
select public.site_track('{"t":"view","sid":"00000000-0000-0000-0000-0000000000c1","vid":"v9","pv":"00000000-0000-0000-0000-0000000000d1","path":"/","country":"LB","city":"Beirut","device":"mobile","platform":"pwa"}');
select public.site_track('{"t":"view","sid":"00000000-0000-0000-0000-0000000000c1","vid":"v9","pv":"00000000-0000-0000-0000-0000000000d2","path":"/pricing"}');
select public.site_track('{"t":"ping","sid":"00000000-0000-0000-0000-0000000000c1","pv":"00000000-0000-0000-0000-0000000000d2","active_ms":12000,"scroll":75,"clicks":3}');
select public.site_track('{"t":"event","sid":"00000000-0000-0000-0000-0000000000c1","pv":"00000000-0000-0000-0000-0000000000d2","kind":"cta","label":"Start free trial","path":"/pricing"}');
select pg_temp.ok((select pageviews = 2 and active_ms = 12000 and clicks = 3 and exit_path = '/pricing' and platform = 'pwa' and is_new from public.site_sessions where id = '00000000-0000-0000-0000-0000000000c1'), 'session rolled up');
select pg_temp.ok((select max_scroll = 75 from public.site_pageviews where id = '00000000-0000-0000-0000-0000000000d2'), 'scroll kept');
select pg_temp.ok((select count(*) = 1 from public.site_events where session_id = '00000000-0000-0000-0000-0000000000c1'), 'event stored');
select pg_temp.act_as('cr-own@test.lb');
select pg_temp.ok(pg_temp.fails($q$select public.site_track('{}')$q$) like '%permission denied%', 'browsers cannot call the tracker directly');
reset role;
select 'tracker: all passed' as result;

-- Clients: the super admin makes a gym for an owner, and marks the welcome sent.
insert into auth.users (email, raw_user_meta_data) values ('cr-new@test.lb', '{"full_name":"New Owner"}');
select set_config('t.newowner', (select id::text from auth.users where email = 'cr-new@test.lb'), false);
select pg_temp.act_as('cr-own@test.lb');
select pg_temp.ok(pg_temp.fails(format('select public.admin_provision_gym(%L, ''Sneaky'')', current_setting('t.newowner')::uuid)) like '%Not allowed%', 'owners cannot provision');
reset role;
select pg_temp.act_as('cr-boss@test.lb');
select set_config('t.newgym', public.admin_provision_gym(current_setting('t.newowner')::uuid, 'Fresh Gym')::text, false);
select public.admin_mark_welcome_sent(current_setting('t.newgym')::uuid);
reset role;
select pg_temp.ok((select g.welcome_sent_at is not null and gu.role = 'owner' from public.gyms g join public.gym_users gu on gu.gym_id = g.id
                   where g.id = current_setting('t.newgym')::uuid), 'gym made with owner, welcome marked');
select 'clients: all passed' as result;

-- Access requests: anyone can ask; only super admins see and move them.
set role anon;
select set_config('t.req', public.submit_access_request('Rami Haddad', '70123456', 'Rami@Gym.lb', 'Iron Temple', 'Beirut', '50-150')::text, false);
select pg_temp.ok(pg_temp.fails('select * from public.access_requests') like '%permission denied%', 'anon cannot list requests');
select public.submit_access_request('Rami Haddad', '70123456', 'rami@gym.lb', 'Iron Temple');
select public.submit_access_request('Rami Haddad', '70123456', 'rami@gym.lb', 'Iron Temple');
select pg_temp.ok(pg_temp.fails($q$select public.submit_access_request('Rami Haddad', '70123456', 'rami@gym.lb', 'Iron Temple')$q$) like 'We already have your request%', 'three a day');
reset role;
select pg_temp.act_as('cr-own@test.lb');
select pg_temp.ok((select count(*) = 0 from public.access_requests), 'owners see none');
reset role;
select pg_temp.act_as('cr-boss@test.lb');
select pg_temp.ok((select email = 'rami@gym.lb' from public.access_requests where id = current_setting('t.req')::uuid), 'email lowercased, admin sees it');
select public.admin_update_request(current_setting('t.req')::uuid, 'contacted');
select public.admin_update_request(current_setting('t.req')::uuid, 'paid', null, current_setting('t.newgym')::uuid, true);
reset role;
select pg_temp.ok((select status = 'paid' and contacted_at is not null and paid_at is not null and welcome_sent_at is not null and gym_id is not null from public.access_requests where id = current_setting('t.req')::uuid), 'request moved to paid');
select 'requests: all passed' as result;
