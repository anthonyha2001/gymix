-- Real push notifications. Every row in public.notifications is also pushed
-- to the person's phones:
--   web   the installed web app (Web Push, VAPID keys kept in platform_secrets)
--   fcm   the Android app (Firebase Cloud Messaging)
--   apns  the iPhone app (Apple Push Notification service)
--
-- How a push is sent: after a notification is inserted, a trigger asks the
-- app's /api/push/dispatch to send it (through pg_net, Supabase's async HTTP
-- extension, so inserts never wait). Without pg_net, or before the app has
-- told the database its address, nothing is called and the bell works as
-- before.

create table public.push_subscriptions (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.profiles (id) on delete cascade,
  kind        text not null check (kind in ('web', 'fcm', 'apns')),
  -- Web: the push service URL. Native: the device token.
  endpoint    text not null unique check (char_length(endpoint) <= 1000),
  p256dh      text check (char_length(p256dh) <= 200),
  auth        text check (char_length(auth) <= 100),
  platform    text check (char_length(platform) <= 60),
  created_at  timestamptz not null default now(),
  last_ok_at  timestamptz
);
create index push_subscriptions_user_idx on public.push_subscriptions (user_id);

alter table public.push_subscriptions enable row level security;
create policy push_subscriptions_select on public.push_subscriptions for select using (user_id = auth.uid());
create policy push_subscriptions_delete on public.push_subscriptions for delete using (user_id = auth.uid());
grant select, delete on public.push_subscriptions to authenticated;

-- Saves this phone for the signed-in person. A phone that changes hands (or
-- account) moves to the new person.
create function public.save_push_subscription(p_kind text, p_endpoint text, p_p256dh text default null, p_auth text default null, p_platform text default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'Log in first';
  end if;
  if p_kind not in ('web', 'fcm', 'apns') or coalesce(trim(p_endpoint), '') = '' then
    raise exception 'Not a push subscription';
  end if;
  insert into public.push_subscriptions (user_id, kind, endpoint, p256dh, auth, platform)
  values (auth.uid(), p_kind, p_endpoint, p_p256dh, p_auth, left(p_platform, 60))
  on conflict (endpoint) do update
    set user_id = excluded.user_id, kind = excluded.kind, p256dh = excluded.p256dh,
        auth = excluded.auth, platform = excluded.platform, created_at = now();
end;
$$;
revoke execute on function public.save_push_subscription(text, text, text, text, text) from public, anon;
grant execute on function public.save_push_subscription(text, text, text, text, text) to authenticated;

alter table public.notifications add column push_sent_at timestamptz;

-- Keys and the dispatch address. Service role only (platform_secrets has no
-- grants for signed-in users).
alter table public.platform_secrets
  add column vapid_public text not null default '',
  add column vapid_private text not null default '',
  add column push_dispatch_url text not null default '',
  add column push_dispatch_secret text not null default (md5(random()::text || clock_timestamp()::text) || md5(clock_timestamp()::text || random()::text));
update public.platform_secrets set push_dispatch_secret = md5(random()::text || clock_timestamp()::text) || md5(clock_timestamp()::text || random()::text);

do $$
begin
  create extension if not exists pg_net;
exception when others then
  raise notice 'pg_net not available; push notifications will not be sent automatically';
end;
$$;

create function public.notifications_push()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_url text;
  v_secret text;
begin
  if not exists (select 1 from public.push_subscriptions where user_id = new.user_id) then
    return null;
  end if;
  select push_dispatch_url, push_dispatch_secret into v_url, v_secret from public.platform_secrets where id;
  if coalesce(v_url, '') = '' or to_regprocedure('net.http_post(text,jsonb,jsonb,jsonb,integer)') is null then
    return null;
  end if;
  execute 'select net.http_post(url := $1, body := $2, headers := $3, timeout_milliseconds := 8000)'
    using v_url, jsonb_build_object('id', new.id), jsonb_build_object('content-type', 'application/json', 'x-push-secret', v_secret);
  return null;
exception when others then
  -- A push problem must never stop the notification itself.
  return null;
end;
$$;

create trigger notifications_push
  after insert on public.notifications
  for each row execute function public.notifications_push();

-- "Send me a test" from the notifications settings: one real notification to
-- yourself, at most one every 20 seconds.
create function public.notify_me_test(p_gym_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null or public.my_gym_role(p_gym_id) is null then
    raise exception 'Not allowed';
  end if;
  insert into public.notifications (gym_id, user_id, kind, title, body, link, dedupe_key)
  values (p_gym_id, auth.uid(), 'test', 'Notifications are on', 'This is how Gymix will reach you. Tap to open the app.', '/',
          'test:' || auth.uid() || ':' || floor(extract(epoch from now()) / 20))
  on conflict (dedupe_key) do nothing;
end;
$$;
revoke execute on function public.notify_me_test(uuid) from public, anon;
grant execute on function public.notify_me_test(uuid) to authenticated;
