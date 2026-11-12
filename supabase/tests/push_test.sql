-- Push: saving phones, who can see them, and notifications still insert without pg_net.
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
  ('pu-owner@test.lb', '{"full_name":"Owner Pu"}'),
  ('pu-nour@test.lb', '{"full_name":"Nour Pu"}'),
  ('pu-rami@test.lb', '{"full_name":"Rami Pu"}');
select pg_temp.act_as('pu-owner@test.lb');
select set_config('t.gym', public.create_gym('Push Gym')::text, false);
reset role;

-- Nour saves her installed web app, then her Android phone.
select pg_temp.act_as('pu-nour@test.lb');
select public.save_push_subscription('web', 'https://push.example/abc', 'p256', 'authkey', 'Chrome Android');
select public.save_push_subscription('fcm', 'fcm-token-1', null, null, 'android');
select pg_temp.ok((select count(*) = 2 from public.push_subscriptions), 'nour sees her two phones');
select pg_temp.ok(pg_temp.fails($q$select public.save_push_subscription('sms', 'x')$q$) like '%Not a push subscription%', 'bad kind refused');
select pg_temp.ok(pg_temp.fails($q$insert into public.push_subscriptions (user_id, kind, endpoint) values (auth.uid(), 'web', 'https://x')$q$) similar to '%(permission denied|row-level security)%', 'no direct inserts');
reset role;

-- Rami can't see Nour's phones. When he logs in on the same browser, it moves to him.
select pg_temp.act_as('pu-rami@test.lb');
select pg_temp.ok((select count(*) = 0 from public.push_subscriptions), 'rami sees none');
select public.save_push_subscription('web', 'https://push.example/abc', 'p256b', 'authb', 'Chrome Android');
select pg_temp.ok((select count(*) = 1 from public.push_subscriptions), 'browser moved to rami');
reset role;
select pg_temp.ok((select user_id = (select id from auth.users where email = 'pu-rami@test.lb') from public.push_subscriptions where endpoint = 'https://push.example/abc'), 'owner of the endpoint is rami');

-- Secrets are not readable by signed-in users.
select pg_temp.act_as('pu-nour@test.lb');
select pg_temp.ok(pg_temp.fails('select push_dispatch_secret from public.platform_secrets') like '%permission denied%', 'secret hidden');
reset role;
select pg_temp.ok((select length(push_dispatch_secret) = 64 from public.platform_secrets), 'dispatch secret generated');

-- Notifications still insert (no pg_net here, and with a dispatch URL set).
update public.platform_secrets set push_dispatch_url = 'https://example.test/api/push/dispatch';
select public.notify(pg_temp.v('gym'), (select id from auth.users where email = 'pu-nour@test.lb'), 'message', 'Hi', 'Hello', '/portal/messages');
select pg_temp.ok((select count(*) = 1 from public.notifications where title = 'Hi' and push_sent_at is null), 'notification inserted');

-- Test notification: only for your own gyms, and not twice in a row.
select pg_temp.act_as('pu-nour@test.lb');
select pg_temp.ok(pg_temp.fails(format('select public.notify_me_test(%L)', pg_temp.v('gym'))) like '%Not allowed%', 'not her gym');
reset role;
insert into public.gym_users (gym_id, user_id, role) select pg_temp.v('gym'), id, 'member' from auth.users where email = 'pu-nour@test.lb';
select pg_temp.act_as('pu-nour@test.lb');
select public.notify_me_test(pg_temp.v('gym'));
select public.notify_me_test(pg_temp.v('gym'));
reset role;
select pg_temp.ok((select count(*) = 1 from public.notifications where kind = 'test'), 'one test notification');

-- Deleting her account removes her phones.
delete from auth.users where email = 'pu-nour@test.lb';
select pg_temp.ok(not exists (select 1 from public.push_subscriptions where endpoint = 'fcm-token-1'), 'phones removed with account');

select 'push: all passed' as result;
